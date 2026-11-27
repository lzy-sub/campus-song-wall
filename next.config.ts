import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 部署产物要求输出 standalone，供 deploy-build 生成 .next/standalone
  output: "standalone",
};

export default nextConfig;