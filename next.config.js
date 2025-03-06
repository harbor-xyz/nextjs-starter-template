/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  experimental: {
    parallelRoutes: true,
    prefetchRSC: true,
    serverActions: true,
  },  
};

module.exports = nextConfig;
