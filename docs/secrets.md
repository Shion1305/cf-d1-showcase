# API key handling

The demo uses `ADMIN_API_KEY` to authorize checkpoint writes. Public reads and the health response never include it. A client may supply a key in the `Authorization: Bearer …` header; the server retrieves the expected value with `await env.ADMIN_API_KEY.get()` and compares fixed-length SHA-256 digests using `timingSafeEqual`.

The browser password input keeps the operator-supplied key in React state for that tab. It is not saved to local storage, cookies, a URL, or an application log. Reloading clears it. This is a single-operator demonstration; add proper user authentication, authorization, rate limiting, and access policies for a real application. Only store synthetic records in this public showcase.

## Local and cloud parity

`pnpm setup:local` creates an explicitly fake key in Wrangler's local Secrets Store. Application code uses the same binding interface in Node development, local Worker preview, and Cloudflare Workers. There is no plaintext-variable fallback.

The committed key `local-showcase-only` is not a deployed credential. Never use it in a remote store. Remote dev connects to the real dev database while retaining the local fake secret because deployed Secrets Store values are unavailable through local development. A deployed dev Worker uses its own real dev key. [Cloudflare's Secrets Store integration](https://developers.cloudflare.com/secrets-store/integrations/workers/).

## Deployment and rotation

Provision the secret before deploying its binding. The deployment config contains only `binding`, `store_id`, and `secret_name`. Store/secret names are environment-specific references; values are administered through Secrets Store, not through a Terraform resource with a `sensitive` argument. Marking a Terraform value sensitive would only hide presentation, not necessarily keep it out of state.

To rotate, find the secret ID in the dashboard or use:

```sh
pnpm exec wrangler secrets-store secret list STORE_ID --remote
pnpm exec wrangler secrets-store secret update STORE_ID --secret-id SECRET_ID --remote
```

Enter the new value at the secure prompt. Keep the same secret name and binding. The application does not cache the key itself, but allow for Secrets Store propagation and verify the new key against the deployed API. A health check confirms retrieval, not that an operator has the matching value. Rotate dev first, then staging, then production, and update the authorized operator's password manager. Never log the previous or new value.

If a binding is missing or returns an empty value, writes fail closed. The health endpoint reports `secret: unavailable` and returns HTTP 503. The API suppresses raw binding exceptions to avoid including secret service details in responses.

Cloudflare Secrets Store is an account-level service, distinct from a per-Worker `wrangler secret put` plaintext binding. This showcase uses **Secrets Store**, including its local emulator. The selected Wrangler release labels its Secrets Store commands as open beta; monitor service changes before adopting this setup as a production standard.
