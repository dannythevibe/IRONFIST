<div align="center">
  <img src="./logo.jpg" alt="IRONFIST Logo" width="110" style="border-radius: 16px;" />
  <h1>IRONFIST</h1>
  <p><b>Hardware Persistence & Developer-First Anti-Abuse Engine</b></p>

  <p>
    <a href="#architecture">Architecture</a> •
    <a href="#quick-start">Quick Start</a> •
    <a href="#sdks">Client SDKs</a> •
    <a href="#mcp-integration">MCP Protocol</a>
  </p>
</div>

---

## Overview

**IRONFIST** is a high-performance hardware fingerprinting, rate limiting, and anti-abuse platform designed to stop trial farming, multi-account fraud, and API abuse across mobile, desktop, and web environments.

Unlike traditional cookie- or IP-based rate limiters, IRONFIST collects persistent hardware signals—such as system GUIDs, keychain hashes, canvas fingerprints, and GPU renderers—building an unforgeable device identity graph that survives app re-installs, browser wipes, and VPN shifts.

---

## Core Capabilities

- **Hardware Persistence**: Binds user accounts and rate limits to physical device traits (Keychain, Widevine DRM, Windows MachineGUID, macOS IOPlatformUUID).
- **Atomic Token Bucket Rate Limiting**: Distributed, sub-millisecond token bucket engine implemented in Go and backed by Redis.
- **IP Intelligence & VPN Detection**: Real-time IP classification distinguishing residential access from data center proxies, VPN exit nodes, and TOR relays.
- **Model Context Protocol (MCP) Server**: Native SSE MCP server enabling AI agents (Cursor, Trae, Claude Code) to inspect risk profiles and enforce rate limits automatically.
- **Multi-Platform SDKs**: Lightweight native collectors for iOS (Swift), Android (Kotlin), Desktop (Rust), and Web (TypeScript).
- **Real-Time Web Console**: Next.js 14 console featuring a live threat feed, graph-match viewer, and interactive device simulator.

---

## System Architecture

```
                       ┌──────────────────────────────────────────────┐
                       │                 CLIENT SDKs                  │
                       │  (iOS Swift, Android Kotlin, Desktop Rust)   │
                       └──────────────────────┬───────────────────────┘
                                              │ Hardware Traits
                                              ▼
                       ┌──────────────────────────────────────────────┐
                       │             IRONFIST GO BACKEND              │
                       │   ├── Hardware Fingerprint Engine            │
                       │   ├── Atomic Token Bucket (Redis)            │
                       │   └── IP Intel & Proxy Detector              │
                       └──────────────────────┬───────────────────────┘
                                              │
                              ┌───────────────┴───────────────┐
                              ▼                               ▼
                      ┌───────────────┐               ┌───────────────┐
                      │  WEB CONSOLE  │               │  MCP SERVER   │
                      │  (Next.js 14) │               │ (SSE Protocol)│
                      └───────────────┘               └───────────────┘
```

---

## Repository Structure

```
IRONFIST/
├── backend/            # Go 1.22 REST API, token bucket limiter, & matcher
├── web-portal/         # Next.js 14 admin dashboard, simulator, & hero page
├── mcp-server/         # Model Context Protocol (MCP) SSE server
├── sdks/               # First-party client SDKs
│   ├── swift-ios/      # iOS Swift trait collector
│   ├── kotlin-android/ # Android Kotlin trait collector
│   ├── rust-desktop/   # Rust desktop trait collector
│   └── js-client/      # TypeScript / Web browser collector
├── logo.jpg            # Official project logo
└── docker-compose.yml  # One-command local development setup
```

---

## Quick Start

### Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose
- [Node.js 18+](https://nodejs.org/) (for web portal)
- [Go 1.22+](https://go.dev/) (for native backend development)

### 1. Run Everything via Docker Compose

```bash
docker-compose up --build
```

Services will start at:
- **Web Console**: `http://localhost:3000`
- **Go API Gateway**: `http://localhost:8080`
- **MCP SSE Server**: `http://localhost:3001`
- **Redis Engine**: `localhost:6379`

### 2. Manual Component Setup

#### Go Backend
```bash
cd backend
go run main.go
```

#### Web Console
```bash
cd web-portal
npm install
npm run dev
```

#### MCP Server
```bash
cd mcp-server
npm install
npm run dev
```

---

## Client SDK Examples

### TypeScript / Web
```typescript
import { IronFistClient } from '@ironfist/client';

const client = new IronFistClient({
  gatewayUrl: 'http://localhost:8080',
  apiKey: 'if_live_key',
});

const traits = await client.collectTraits();
const result = await client.evaluateAccess('user_123', traits);

if (!result.allowed) {
  console.warn('Access denied:', result.reason);
}
```

### iOS (Swift)
```swift
import Foundation

let traits = IronFistIOS.collectTraits()
// Returns hardware-persisted traits including Keychain ID, GPU, & system specs
```

### Android (Kotlin)
```kotlin
val traits = IronFistAndroid.collectTraits(context)
// Collects hardware GUIDs and system specs
```

### Desktop (Rust)
```rust
let traits = ironfist_desktop::collect_traits();
println!("Device Traits: {:?}", traits);
```

---

## MCP Integration

Add the IronFist SSE link to your Cursor or Claude Code environment to enable automated rate limiting and device risk inspection for AI agents:

```json
{
  "mcpServers": {
    "ironfist": {
      "url": "http://localhost:3001/v1/sse"
    }
  }
}
```

---

## License

This project is licensed under the **Apache License 2.0** - see the [LICENSE](LICENSE) file for details.

