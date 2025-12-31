import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  // Exclude Firebase Functions from build
  // The functions directory is excluded via tsconfig.json and .vercelignore
}

export default nextConfig
