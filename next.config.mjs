import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
  // Ship the committed scan data with the serverless function so /api/scout
  // can read it at runtime on Vercel.
  outputFileTracingIncludes: {
    "/api/scout": ["./data/**"],
  },
};

export default nextConfig;
