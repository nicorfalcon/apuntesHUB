/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Necesario para que react-pdf funcione con Next.js
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
