import type { D1Database } from "@cloudflare/workers-types";

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    ADMIN_API_KEY: { get(): Promise<string | null> };
    APP_ENV: "local" | "dev" | "staging" | "production";
    DATABASE_MODE: "local" | "remote";
    SECRET_MODE: "local" | "remote";
    RELEASE_SHA: string;
  }
}
