/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  eslint: {
    ignoreDuringBuilds: true,
    dirs: ['app']
  },
  images: { unoptimized: true }
};

module.exports = nextConfig;
