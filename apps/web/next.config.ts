import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A separate distDir lets a verification build run while `next dev` owns .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@hypsometra/engine", "@hypsometra/opt", "@hypsometra/data", "@hypsometra/mt5", "@hypsometra/ui"],
};

export default nextConfig;
