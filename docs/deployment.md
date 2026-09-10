# Deploy dev, staging, and production

## 1. Bootstrap account services once

Sign in and confirm the intended account:

```sh
pnpm exec wrangler login
pnpm exec wrangler whoami
```

Create a **private** R2 bucket for Terraform state and find or create the account's Secrets Store:

```sh
pnpm exec wrangler r2 bucket create cf-d1-showcase-tfstate
pnpm exec wrangler secrets-store store list --remote
# Only if there is no existing store:
pnpm exec wrangler secrets-store store create cf-d1-showcase --remote
```

The state bucket and account-level store are bootstrap resources, outside the application Terraform root. They must outlive individual application environments. Reuse an existing account store if present. Do not enable public access on the state bucket. [Cloudflare R2 Terraform backend](https://developers.cloudflare.com/terraform/advanced-topics/remote-backend/).

Create a Cloudflare deployment API token scoped to the intended account with **D1 Edit**, **Workers Scripts Edit**, and **Secrets Store Edit**. The API names for these permissions may appear as `D1 Write`, `Workers Scripts Write`, and `Secrets Store Write`. Workers deployment must also be allowed to bind account secrets; check the Secrets Store Deployer role if your organization's IAM policy restricts it. The initial store/secret administrator can be a different identity from the deployment identity.

Separately, create an **R2 Object Read & Write** token scoped to the state bucket. Save its Access Key ID and Secret Access Key. Wrangler's interactive OAuth login is useful locally, but it is not the long-lived credential used by GitHub Actions or the S3 backend. [R2 credentials](https://developers.cloudflare.com/r2/api/tokens/).

```sh
cp .env.example .env.deploy
chmod 600 .env.deploy
```

Fill `.env.deploy` in an editor. `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are your **R2 S3 credentials**, not AWS account credentials. `pnpm infra` and `pnpm release` load this ignored file automatically; CI injects the same variables. `WORKERS_SUBDOMAIN` is the account's existing subdomain without `.workers.dev`. Never commit `.env.deploy`.

## 2. Put three distinct API keys into Secrets Store

Create a different high-entropy key for each environment using your password manager. Use the interactive prompt so a value is not written into shell history:

```sh
pnpm exec wrangler secrets-store secret create STORE_ID --name cf-d1-showcase-dev-admin-api-key --scopes workers --remote
pnpm exec wrangler secrets-store secret create STORE_ID --name cf-d1-showcase-staging-admin-api-key --scopes workers --remote
pnpm exec wrangler secrets-store secret create STORE_ID --name cf-d1-showcase-production-admin-api-key --scopes workers --remote
```

Replace `STORE_ID` with your store ID. Only references to these names/IDs enter Terraform outputs or Wrangler configuration. Terraform never receives an API key value. See [secret handling](secrets.md).

## 3. Provision databases with Terraform

```sh
pnpm infra plan dev
pnpm infra apply dev
pnpm infra apply staging
pnpm infra apply production
```

`apply` generates a fresh saved plan, displays it, and applies it. It is the explicit apply command, so it does not prompt again. Use `plan` to inspect changes independently. In CI, configure the environment gate before allowing apply.

Each invocation initializes its own backend key and local Terraform data directory:

| Environment | Database                       | State object                                  |
| ----------- | ------------------------------ | --------------------------------------------- |
| dev         | `cf-d1-showcase-dev-db`        | `cf-d1-showcase/dev/terraform.tfstate`        |
| staging     | `cf-d1-showcase-staging-db`    | `cf-d1-showcase/staging/terraform.tfstate`    |
| production  | `cf-d1-showcase-production-db` | `cf-d1-showcase/production/terraform.tfstate` |

The S3 backend uses lock files (`use_lockfile = true`). R2 supports the conditional object writes used by this lock mechanism; a lock must not be forcibly removed while its owner is running. [Terraform S3 locking](https://developer.hashicorp.com/terraform/language/backend/s3), [R2 conditional operations](https://developers.cloudflare.com/r2/api/s3/api/).

All three database resources have `prevent_destroy = true`. This protects against replacement/deletion while the resource block remains in the configuration; it is not a Cloudflare backup and does not protect a resource removed entirely from Terraform code. Do not use `terraform init -reconfigure` with a different state key for an existing environment: use a reviewed state migration instead. The wrapper always derives the key from the explicit project and environment.

## 4. Build once and deploy manually

```sh
pnpm setup:local
pnpm check
pnpm build:worker
pnpm test:e2e
pnpm config:generate dev
pnpm release dev
```

`release` requires the existing build, applies pending remote migrations, then deploys through OpenNext. It does not rebuild. Generate the staging/production configuration from their own Terraform outputs and use the same commands with the appropriate target. Prefer CI for repeated releases; manual releases are for initial bootstrap or coordinated recovery.

Verify a deployment:

```sh
SMOKE_BASE_URL=https://cf-d1-showcase-dev.YOUR_SUBDOMAIN.workers.dev EXPECTED_ENV=dev pnpm test:smoke
node scripts/smoke-d1.mjs dev
```

The D1 probe uses Wrangler authentication, creates a uniquely named synthetic record, verifies it, and removes it in a `finally` block. The health endpoint checks the schema, applied migrations, and an actual Secrets Store retrieval. It returns availability only, never the secret.

## 5. Connect GitHub Actions

Create GitHub environments named **dev**, **staging**, and **production**. Configure **production required reviewers** so promotion waits for approval. For a one-person demo, allow the initiating account to approve; for a team, require another reviewer. Restrict dev deployments to `develop` and staging/production to `main`.

Set these non-secret repository variables:

| Variable                    | Value                                                            |
| --------------------------- | ---------------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`     | Account ID                                                       |
| `TF_STATE_BUCKET`           | Private state bucket name                                        |
| `SECRETS_STORE_ID`          | Account Secrets Store ID                                         |
| `WORKERS_SUBDOMAIN`         | Account subdomain without `.workers.dev`                         |
| `CLOUDFLARE_DEPLOY_ENABLED` | `true` after the other values, secrets, and gates are configured |

Set these GitHub Actions secrets, preferably separately scoped in each environment for a team:

| Secret                 | Purpose                                       |
| ---------------------- | --------------------------------------------- |
| `CLOUDFLARE_API_TOKEN` | D1 Terraform/API access and Worker deployment |
| `R2_ACCESS_KEY_ID`     | Terraform state access                        |
| `R2_SECRET_ACCESS_KEY` | Terraform state access                        |

The application's write API key is **not** a GitHub secret. It stays in Cloudflare Secrets Store. GitHub needs platform credentials to deploy, and the Worker retrieves the application secret at runtime.

Push `develop` for dev. Push `main` for staging and subsequent production promotion. You can also dispatch **Validate and release** on either allowed branch. The YAML `environment: production` attaches the job to an environment; **it does not itself create a required-reviewer rule**. Check the actual repository environment settings before enabling deployment.

Protect `main` with the `verify` and `terraform` checks for a team repository. Keep infrastructure changes and SQL migrations reviewable in the same PR as application changes. API tokens scoped to an account still have broader reach than a single D1 database; use separate Cloudflare accounts if you need a hard production security boundary.
