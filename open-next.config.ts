import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// All database-backed routes are dynamic. Add an explicit cache strategy before ISR.
export default defineCloudflareConfig();
