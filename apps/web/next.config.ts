import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  webpack(config) {
    // Yjs を単一インスタンスに強制（重複importの警告を解消）
    config.resolve.alias = {
      ...config.resolve.alias,
      yjs: path.resolve(__dirname, "node_modules/yjs"),
    };
    return config;
  },
};

export default nextConfig;
