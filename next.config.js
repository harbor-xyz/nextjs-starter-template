/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  swcMinify: false,
  experimental: {
    forceSwcTransforms: false,
  },
  eslint: {
    ignoreDuringBuilds: true,
    dirs: ['app']
  },
  images: { unoptimized: true },
  webpack: (config, { isServer, dev }) => {
    // Force Next.js to use Babel instead of SWC
    config.module.rules.push({
      test: /\.(js|jsx|ts|tsx)$/,
      exclude: /node_modules/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['next/babel'],
        },
      },
    });
    
    return config;
  },
}

module.exports = nextConfig