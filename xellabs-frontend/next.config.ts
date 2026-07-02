import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '34.30.6.247',
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '34.30.6.247:3000',
      ],
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
