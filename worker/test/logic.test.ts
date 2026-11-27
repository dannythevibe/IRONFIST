import assert from 'node:assert/strict';
import { test } from 'node:test';

import { takeTokens, validateBucketParams } from '../src/bucket.ts';
import { inspectIP, isAnonymized } from '../src/ipintel.ts';
import {
  calculateSimilarity,
  hasEnoughSignal,
  hasHardIdConflict,
  sanitizeTraits,
} from '../src/matcher.ts';

const browser = {
  os_platform: 'Win32',
  cpu_cores: 8,
  memory_gb: 8,
  gpu_renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11)',
  screen_resolution: '2560x1440',
  color_depth: 24,
  timezone: 'Africa/Lagos',
  language: 'en-US',
  canvas_hash: 'c'.repeat(64),
  webgl_hash: 'w'.repeat(64),
};

test('identical fingerprints score 1', () => {
  assert.equal(calculateSimilarity(browser, { ...browser }), 1);
});

test('same device after travel and a monitor change still matches', () => {
  const later = { ...browser, timezone: 'Europe/London', screen_resolution: '1920x1080' };
  assert.ok(calculateSimilarity(browser, later) >= 0.85);
  assert.ok(calculateSimilarity(browser, { ...browser, timezone: 'Europe/London' }) >= 0.88);
});

test('a different canvas fingerprint falls below the threshold', () => {
  assert.ok(calculateSimilarity(browser, { ...browser, canvas_hash: 'x'.repeat(64) }) < 0.88);
});

test('different platforms never match', () => {
  assert.equal(calculateSimilarity(browser, { ...browser, os_platform: 'MacIntel' }), 0);
});

test('devices without canvas or WebGL data are never fuzzy matched', () => {
  // Two phones of the same model share every one of these values.
  const phone = { os_platform: 'ios', cpu_cores: 6, memory_gb: 8, screen_resolution: '393x852', gpu_renderer: 'Apple GPU' };
  assert.equal(calculateSimilarity(phone, { ...phone }), 0);
});

test('a GPU string contained in the other counts as a partial match', () => {
  const a = { ...browser, gpu_renderer: 'NVIDIA GeForce RTX 4070' };
  const s = calculateSimilarity(a, browser);
  assert.ok(s > 0.9 && s < 1);
});

test('sanitizeTraits keeps known fields and drops the rest', () => {
  const t = sanitizeTraits({
    windows_guid: '  abc-123  ',
    cpu_cores: 8,
    memory_gb: -4,
    canvas_hash: 'x'.repeat(1000),
    evil: { nested: true },
    os_platform: 42,
  });
  assert.deepEqual(t.ids, { windows_guid: 'abc-123' });
  assert.equal(t.soft.cpu_cores, 8);
  assert.equal(t.soft.memory_gb, undefined);
  assert.equal(t.soft.canvas_hash?.length, 256);
  assert.equal(t.soft.os_platform, undefined);
  assert.equal((t.soft as Record<string, unknown>).evil, undefined);
});

test('sanitizeTraits maps the legacy Android storage field', () => {
  assert.deepEqual(sanitizeTraits({ encrypted_sp_id: 'abc' }).ids, { storage_id: 'abc' });
});

test('sanitizeTraits tolerates junk input', () => {
  for (const junk of [null, undefined, 'str', 7, []]) {
    assert.deepEqual(sanitizeTraits(junk), { ids: {}, soft: {} });
  }
});

test('hasEnoughSignal requires an identifier or a high-entropy fingerprint', () => {
  assert.equal(hasEnoughSignal(sanitizeTraits({ cpu_cores: 8, screen_resolution: '1x1' })), false);
  assert.equal(hasEnoughSignal(sanitizeTraits({ keychain_id: 'k' })), true);
  assert.equal(hasEnoughSignal(sanitizeTraits({ canvas_hash: 'h' })), true);
});

test('hard identifier conflicts rule a candidate out; storage tokens do not', () => {
  assert.equal(hasHardIdConflict({ windows_guid: 'a' }, { windows_guid: 'b' }), true);
  assert.equal(hasHardIdConflict({ windows_guid: 'a' }, { windows_guid: 'a' }), false);
  assert.equal(hasHardIdConflict({ windows_guid: 'a' }, { keychain_id: 'b' }), false);
  assert.equal(hasHardIdConflict({ storage_id: 'a' }, { storage_id: 'b' }), false);
});

test('token bucket starts full, drains, and refills over time', () => {
  let { state, result } = takeTokens(null, 10, 2, 1, 0);
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 9);

  ({ state, result } = takeTokens(state, 10, 2, 9, 0));
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 0);

  ({ state, result } = takeTokens(state, 10, 2, 1, 0));
  assert.equal(result.allowed, false);
  assert.equal(result.retry_after, 0.5);

  ({ state, result } = takeTokens(state, 10, 2, 1, 1000));
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 1);

  ({ result } = takeTokens(state, 10, 2, 1, 3_600_000));
  assert.equal(result.remaining, 9, 'never refills past capacity');
});

test('a denied request does not consume tokens', () => {
  const first = takeTokens(null, 5, 1, 5, 0);
  const denied = takeTokens(first.state, 5, 1, 3, 1000);
  assert.equal(denied.result.allowed, false);
  assert.equal(denied.result.remaining, 1);
});

test('requests larger than the bucket can never succeed', () => {
  assert.equal(takeTokens(null, 5, 1, 6, 0).result.retry_after, null);
});

test('lowering capacity clamps the stored balance', () => {
  const full = takeTokens(null, 100, 5, 1, 0);
  assert.equal(takeTokens(full.state, 10, 5, 1, 0).result.remaining, 9);
});

test('bucket parameter validation', () => {
  assert.equal(validateBucketParams(100, 5, 1), null);
  assert.ok(validateBucketParams(0, 5, 1));
  assert.ok(validateBucketParams(100, -1, 1));
  assert.ok(validateBucketParams(100, 5, 0));
  assert.ok(validateBucketParams(Number.NaN, 5, 1));
});

test('IP check: residential ISP is low risk', () => {
  const r = inspectIP({ ip: '102.89.1.1', asn: 29465, org: 'MTN NIGERIA Communication limited', country: 'NG' });
  assert.equal(r.available, true);
  assert.equal(isAnonymized(r), false);
  assert.equal(r.risk_score, 5);
});

test('IP check: hosting ASN is flagged as datacenter', () => {
  const r = inspectIP({ ip: '3.3.3.3', asn: 16509, org: 'Amazon.com, Inc.', country: 'US' });
  assert.equal(r.is_datacenter, true);
  assert.equal(isAnonymized(r), true);
});

test('IP check: VPN networks and Tor are flagged', () => {
  assert.equal(inspectIP({ ip: '1.1.1.1', asn: 9009, org: 'M247 Europe SRL', country: 'RO' }).is_vpn, true);
  const tor = inspectIP({ ip: '1.1.1.1', asn: 1, org: 'x', country: 'T1' });
  assert.equal(tor.is_tor, true);
  assert.equal(tor.risk_score, 95);
});

test('IP check: no network data means unavailable, not safe-by-guess', () => {
  const r = inspectIP({ ip: '127.0.0.1' });
  assert.equal(r.available, false);
  assert.equal(isAnonymized(r), false);
});
