/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
    dirs: ['app']
  },
  images: { unoptimized: true }
};

module.exports = nextConfig;
