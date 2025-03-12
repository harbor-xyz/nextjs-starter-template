/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  eslint: {
    ignoreDuringBuilds: true,
    dirs: ['app']
  },
  images: { unoptimized: true },
  experimental: {
    serverComponentsExternalPackages : ['@electric-sql/pglite'],
  },
};

module.exports = nextConfig;
