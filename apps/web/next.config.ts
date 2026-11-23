import path from 'node:path';
import type { NextConfig } from 'next';

const ROOT = path.resolve(__dirname, '..', '..');

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source, so Next compiles them with the app.
  transpilePackages: [
    '@aiqa/dashboard',
    '@aiqa/reporting-engine',
    '@aiqa/self-healing-engine',
    '@aiqa/ai-engine',
  ],
  // The pnpm workspace root, for module resolution and for tracing files into a standalone build.
  turbopack: { root: ROOT },
  outputFileTracingRoot: ROOT,
  // The container image (apps/web/Dockerfile) sets NEXT_OUTPUT=standalone; local runs use next start.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  poweredByHeader: false,
  // No image optimiser: it needs sharp (LGPL libvips), and the app serves no photos.
  images: { unoptimized: true },
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;
