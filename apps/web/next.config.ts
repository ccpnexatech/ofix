import type { NextConfig } from 'next';

const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Same-origin proxy to the API: no CORS, and the httpOnly refresh cookie
  // works identically in dev and production (spec 003 / ADR-008).
  rewrites() {
    return Promise.resolve([
      { source: '/api/v1/:path*', destination: `${API_ORIGIN}/api/v1/:path*` },
    ]);
  },
};

export default nextConfig;
