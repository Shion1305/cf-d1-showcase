# Development and delivery workflow

## A ladder of evidence

Start with `pnpm dev`: it gives the usual Next.js development experience. `initOpenNextCloudflareForDev` exposes D1 and Secrets Store through Wrangler's local platform proxy. Application code accesses `getCloudflareContext().env`, never an ad hoc SQLite client or a separately configured ORM connection.

Then run `pnpm build:worker` and `pnpm preview`. OpenNext adapts the Next.js build for Workers. Preview runs that build under local `workerd`, exercising bundling and Workers' Node compatibility. The committed compatibility date and flags are reused by every generated environment configuration. [OpenNext development and deployment](https://opennext.js.org/cloudflare/howtos/dev-deploy).

Local D1 and Secrets Store still simulate hosted services. A cloud deployment is the next check, not something local tests can replace.

## Try remote dev D1 from your laptop

After provisioning dev and generating its configuration:

```sh
pnpm infra output dev
pnpm config:generate dev
pnpm setup:local
pnpm exec wrangler d1 migrations apply DB --remote --config .wrangler.dev.json
pnpm dev:remote
```

Authenticate Wrangler first with `pnpm exec wrangler login`. `dev:remote` writes `.wrangler.dev-remote.json`, sets `remote: true` **only on D1**, and points the Next.js development proxy at that file. It rejects extra arguments and non-dev configurations. Writes affect the shared dev database. Coordinate schema changes with other developers; this is not an isolated sandbox.

Secrets Store does not support reading deployed secrets through local development. Remote dev keeps the local Secrets Store binding and fake key. Test the **real dev secret** on the deployed dev Worker. This difference is intentional and visible in the code, rather than silently swapping a secret value into an environment variable. [Secrets Store Workers integration](https://developers.cloudflare.com/secrets-store/integrations/workers/).

## What each check establishes

| Check                        | Finds                                                                             | Does not establish                                        |
| ---------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| TypeScript and lint          | Interface and static code mistakes                                                | Runtime behavior                                          |
| Configuration tests          | Environment/name mismatches, placeholders, accidental production remote dev       | Whether a cloud ID actually belongs to the named database |
| Upgrade test on local D1     | Migration/data incompatibilities in a populated schema                            | Production migration duration or limits                   |
| Worker API/browser tests     | Bundle/runtime incompatibilities, CRUD, validation, local secret access           | Cloud IAM, service availability, global latency           |
| Remote D1 probe              | Real database insert/update/read/delete and schema                                | Application-level write authentication                    |
| Deployed app smoke           | Real Worker reads, actual secret retrieval, expected migration history and commit | Full authenticated API writes without an operator key     |
| Optional authenticated smoke | Full deployed write API and Secrets Store key match                               | A load test or user authentication design                 |

The optional authenticated smoke is `SMOKE_BASE_URL=... EXPECTED_ENV=dev SMOKE_API_KEY=... pnpm test:smoke`; supply the key through your private environment or password manager, not a literal shell-history entry. The automated cloud pipeline uses its D1 deployment permission for a short-lived database probe and does not copy the application's API key into GitHub.

## Promotion

The validation job builds once and tests the artifact before archiving it. Dev or staging downloads the artifact for the workflow's exact commit and verifies its checksum. Terraform is applied before the binding configuration is generated from its outputs. SQL migrations run before the new Worker is deployed. Staging must pass before production becomes eligible.

Production downloads the same archive and changes only runtime bindings and release variables. There is no build-time database query, secret lookup, `NEXT_PUBLIC_*` secret, or environment-specific client bundle. All database-backed routes are dynamic.

The release workflow has a non-canceling concurrency group per source ref. Main-branch staging and production share one lane, preventing a newer staging release from overtaking an older pending production promotion. R2 state locks additionally protect Terraform; they do not serialize independent Wrangler commands. Run regular deployments through CI, and do not manually migrate or deploy an environment while its pipeline is running.

Pull requests never receive deployment credentials and never run Terraform against the real account. Do not convert the workflow to `pull_request_target` while checking out untrusted code. Real infrastructure plans are generated inside the environment's trusted deployment job; PRs get offline validation with a mock provider.

## Remaining differences

Cloud D1 includes service limits, remote latency, availability behavior, and account-level authorization that a local SQLite-backed simulation cannot reproduce. Secrets Store has its own service availability. `nodejs_compat` provides supported Node APIs, not an unrestricted Node server. Pinning packages and the compatibility date makes changes reviewable; it does not freeze all Cloudflare service behavior.

The showcase uses direct primary database access, not read replication or session bookmarks. It has no caching layer for dynamic database routes. Add separate tests before introducing replication, ISR, background jobs, or an external API. Maintain immutable migrations and realistic sanitized upgrade fixtures as the schema grows.
