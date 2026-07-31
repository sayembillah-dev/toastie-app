import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['antd', '@ant-design/icons', '@ant-design/nextjs-registry'],
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
