import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@hypsometra/engine", "@hypsometra/opt", "@hypsometra/data", "@hypsometra/ui"],
};

export default nextConfig;
