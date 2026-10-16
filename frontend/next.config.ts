import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

/** The FastAPI backend that `next dev` proxies `/api` requests to. */
const DEV_API_ORIGIN = process.env.PRELEGAL_API_ORIGIN ?? "http://localhost:8000";

export default function nextConfig(phase: string): NextConfig {
  const config: NextConfig = {
    // Emit /login/index.html rather than /login.html so FastAPI's StaticFiles(html=True) serves it.
    trailingSlash: true,
    turbopack: {
      rules: {
        "*.css": {
          loaders: ["@tailwindcss/turbopack"],
          as: "*.css",
        },
      },
    },
  };

  if (phase === PHASE_DEVELOPMENT_SERVER) {
    // In development the backend runs separately, so proxy the API to it.
    return {
      ...config,
      // Otherwise every /api call is first 308-redirected to a trailing-slash URL.
      skipTrailingSlashRedirect: true,
      rewrites: async () => [{ source: "/api/:path*", destination: `${DEV_API_ORIGIN}/api/:path*` }],
    };
  }

  // Production builds are a static export (frontend/out/) that FastAPI serves.
  return { ...config, output: "export" };
}
