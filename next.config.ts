import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverRuntimeConfig: {
    // Only available on the server side
    port: 3000,
    host: '0.0.0.0',
  },
};

export default nextConfig;
