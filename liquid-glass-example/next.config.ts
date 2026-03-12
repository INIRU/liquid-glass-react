import type { NextConfig } from "next";
import path from "path";

const isGHPages = process.env.GITHUB_ACTIONS === "true"

const nextConfig: NextConfig = {
  output: "export",
  basePath: isGHPages ? "/liquid-glass-react" : "",
  assetPrefix: isGHPages ? "/liquid-glass-react/" : "",
  reactStrictMode: true,
  experimental: {
    externalDir: true,
  },
  webpack: (config) => {
    // Ensure all external imports use the same React instance
    config.resolve.alias = {
      ...config.resolve.alias,
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
    };
    return config;
  },
};

export default nextConfig;
