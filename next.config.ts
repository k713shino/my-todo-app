/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: false, // ←ここでWebpackモードにしますわ
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
