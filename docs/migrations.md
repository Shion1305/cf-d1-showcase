# Schema changes, deployment order, and recovery

## One migration history

`migrations/*.sql` is the source of truth in every environment. Wrangler records applied filenames in `d1_migrations`. Terraform creates databases; it does not create tables, apply SQL through provisioners, or load application fixtures.

```sh
pnpm exec wrangler d1 migrations create DB add_checkpoint_description
# Edit the new SQL file, then:
pnpm db:migrate
pnpm check
pnpm build:worker
pnpm test:e2e
```

Commit the new migration and application change together. Never edit a migration that has reached a shared database: Wrangler will not replay an already-recorded migration just because its contents changed. Add a new forward migration. CI's upgrade fixture demonstrates this with a populated v1 database, not just an empty schema. [D1 migration behavior](https://developers.cloudflare.com/d1/reference/migrations/).

Synthetic fixtures live in `seeds/local.sql` and are only run with `--local`. Deployments never copy a production database into development and never apply local seed data remotely.

## Expand, deploy, contract

1. Add a backward-compatible column/table/index. Supply defaults where the old writer needs them.
2. Apply the migration while the previous Worker is still serving traffic.
3. Deploy the new Worker and check health plus real reads/writes.
4. Backfill in bounded, resumable steps if needed.
5. Remove obsolete columns or behavior in a later release, after the rollback window closes.

`0002_add_checkpoint_status.sql` is an expand migration: old inserts still work because `status` defaults to `open`. The test checks this behavior. Staging failure blocks production promotion.

Review production migration cost separately. A small local dataset does not predict remote migration time, contention, quota consumption, or interruption. D1 database limits and Time Travel retention depend on the active plan; verify the account's current limits when planning a large change.

## If deployment fails

- **Terraform fails:** stop before migration or Worker deployment. Fix the plan/state/permissions; do not create a second database manually under a different state key.
- **Migration fails:** Wrangler stops and the release script does not deploy the new Worker. Inspect applied migration history and the error before retrying. Previously successful migrations may already be applied.
- **Worker deployment or smoke fails:** additive schema changes remain. Restore the last known-good Worker only if it is compatible with the expanded schema, then fix forward.
- **Data must be recovered:** pause writes, choose and verify a recovery point, and use a deliberate database recovery procedure. Do not automatically restore D1 to an older point after a failed application deployment: that can discard valid writes.

Useful inspection commands:

```sh
pnpm exec wrangler d1 migrations list DB --remote --config .wrangler.production.json
pnpm exec wrangler deployments list --config .wrangler.production.json
pnpm exec wrangler d1 time-travel info DB --config .wrangler.production.json
```

A reviewed `wrangler rollback VERSION_ID --config .wrangler.production.json` rolls back Worker code, not the database. Confirm the selected version's bindings and schema expectations first. [Worker rollback](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/), [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).

## Retire an environment

Disable its deployment lane and coordinate all writers. Export and verify a backup if the data matters. Removing `prevent_destroy`, deleting a resource block, or changing a backend key is a reviewed operation, not a routine cleanup step. Delete only the intended environment's Worker, D1 database, and secret; retain the shared state bucket and account store if other environments still use them. The repository provides no automatic production teardown command.
