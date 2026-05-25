/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/ai/ingest": ["./node_modules/pdfjs-dist/cmaps/**/*"],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    // pdfjs-dist v5 es pure ESM — unshift para ir antes de las reglas default de Next.js
    config.module.rules.unshift({
      test: /\.m?js$/,
      include: /node_modules\/pdfjs-dist/,
      type: "javascript/auto",
      resolve: { fullySpecified: false },
    });
    return config;
  },
};

export default nextConfig;
