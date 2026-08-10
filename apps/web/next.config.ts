import path from 'node:path';
import { config } from 'dotenv';
import type { NextConfig } from 'next';

// A single .env lives at the repo root, shared with apps/api — see
// app.module.ts's ConfigModule.forRoot. Next.js only auto-loads .env files
// from its own project root (this directory), so the root file is loaded
// explicitly here, before anything reads process.env.API_URL below.
// dotenv never overwrites a key already in process.env, so .env.local
// (gitignored, optional) takes priority over .env when both set the same key.
config({ path: path.resolve(__dirname, '../../.env.local') });
config({ path: path.resolve(__dirname, '../../.env') });

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['antd', '@ant-design/icons', '@ant-design/nextjs-registry'],
  env: {
    API_URL,
  },
  async rewrites() {
    // Proxy browser calls to /api/* through to the NestJS app, so the frontend
    // never needs a cross-origin URL in development.
    return [
      {
        source: '/api/:path*',
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
