import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The same-origin proxy to the API lives in app/api/v1/[...path]/route.ts
  // (runtime, not build-time — see the comment there).
};

export default nextConfig;
