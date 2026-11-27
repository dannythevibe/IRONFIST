/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

// Production is a static export served by the Cloudflare Worker in ../worker,
// which also answers /api, /v1 and /mcp on the same origin. In development,
// `next dev` proxies those paths to `wrangler dev` (port 8787).
const nextConfig = {
  images: { unoptimized: true },
  // Lets the console import the JavaScript SDK straight from ../sdks/js-client.
  experimental: { externalDir: true },
  ...(isDev
    ? {
        async rewrites() {
          const target = process.env.IRONFIST_DEV_API || 'http://localhost:8787';
          return [
            { source: '/api/:path*', destination: `${target}/api/:path*` },
            { source: '/v1/:path*', destination: `${target}/v1/:path*` },
            { source: '/mcp', destination: `${target}/mcp` },
            { source: '/health', destination: `${target}/health` },
          ];
        },
      }
    : { output: 'export' }),
};

module.exports = nextConfig;
