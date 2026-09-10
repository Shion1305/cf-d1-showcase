import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Build without cloud credentials. Bindings are only accessed at request time.
if (process.env.NODE_ENV === "development") {
  initOpenNextCloudflareForDev({
    configPath: process.env.SHOWCASE_WRANGLER_CONFIG ?? "wrangler.json",
  });
}

const config: NextConfig = { poweredByHeader: false };
export default config;
