"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { DashboardData, Checkpoint } from "@/lib/types";

const stages = [
  {
    name: "Local",
    command: "pnpm dev",
    description: "Fast feedback, local data.",
  },
  {
    name: "Dev",
    command: "pnpm dev:remote",
    description: "Try the real D1 service.",
  },
  {
    name: "Staging",
    command: "Push to main",
    description: "Test a deployed Worker.",
  },
  {
    name: "Production",
    command: "Approve promotion",
    description: "Ship the tested artifact.",
  },
];

export function Dashboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData);
  const [apiKey, setApiKey] = useState("");
  const [title, setTitle] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const [entries, health] = await Promise.all([
      fetch("/api/checkpoints", { cache: "no-store" }),
      fetch("/api/health", { cache: "no-store" }),
    ]);
    if (!entries.ok || !health.ok)
      throw new Error(
        "A binding is unavailable. Check your setup and try again.",
      );
    setData({
      checkpoints: (await entries.json()).checkpoints,
      health: await health.json(),
    });
  }

  async function perform(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      await refresh();
      setNotice(success);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Something went wrong.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function mutate(path: string, method: string, body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok)
      throw new Error(
        (await response.json()).error ?? "The change could not be saved.",
      );
  }

  function addCheckpoint(event: FormEvent) {
    event.preventDefault();
    void perform(async () => {
      await mutate("/api/checkpoints", "POST", { title });
      setTitle("");
    }, "Checkpoint saved to D1.");
  }

  const verified = data.checkpoints.filter(
    (item) => item.status === "verified",
  ).length;
  const visible = data.checkpoints.filter(
    (item) => filter === "all" || item.status === filter,
  );

  function toggle(item: Checkpoint) {
    void perform(
      () =>
        mutate(`/api/checkpoints/${item.id}`, "PATCH", {
          status: item.status === "open" ? "verified" : "open",
        }),
      "Checkpoint updated.",
    );
  }

  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Fieldwork home">
          <span className="brand-mark">
            f<span>↗</span>
          </span>
          fieldwork<span className="brand-divider">/</span>
          <span className="brand-sub">D1 showcase</span>
        </Link>
        <a
          className="source-link"
          href="https://github.com/Shion1305/cf-d1-showcase"
        >
          View source <span aria-hidden>↗</span>
        </a>
      </header>

      <main>
        <div className="intro">
          <div>
            <p className="eyebrow">
              <span className="dot" /> THE PATH TO PRODUCTION
            </p>
            <h1>Same code. Every environment.</h1>
            <p className="lead">
              A small working lab for Next.js, Cloudflare Workers, and D1.
              <br className="desktop-break" /> Make a change here. Take the same
              workflow all the way to production.
            </p>
          </div>
          <div
            className={`environment ${data.health.environment === "production" ? "production" : ""}`}
          >
            <span className="dot" />
            {data.health.environment}
            <span className="environment-caption">current environment</span>
          </div>
        </div>

        <section className="pipeline" aria-label="Development workflow">
          {stages.map((stage, index) => (
            <div
              className={`stage ${stage.name.toLowerCase() === data.health.environment ? "active" : ""}`}
              key={stage.name}
            >
              <div className="stage-heading">
                <span className="stage-number">0{index + 1}</span>
                <strong>{stage.name}</strong>
                <span className="stage-arrow" aria-hidden>
                  {index < 3 ? "→" : "↗"}
                </span>
              </div>
              <p>{stage.description}</p>
              <code>{stage.command}</code>
            </div>
          ))}
        </section>

        <div className="workspace">
          <section className="ledger" aria-labelledby="ledger-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">LIVE DATABASE</p>
                <h2 id="ledger-title">Your checkpoints</h2>
              </div>
              <button
                className="quiet-button"
                disabled={busy}
                onClick={() =>
                  void perform(
                    async () => {},
                    "Bindings checked and data refreshed.",
                  )
                }
              >
                <span aria-hidden>↻</span> Refresh
              </button>
            </div>
            <p className="section-description">
              Create, verify, and remove a checkpoint to exercise the full
              stack.
            </p>

            <details className="access-panel" open>
              <summary>
                Write access <span>API key required</span>
              </summary>
              <label htmlFor="api-key">API key for this environment</label>
              <input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                autoComplete="off"
                placeholder="Enter your write API key"
              />
              <p>
                {data.health.secretMode === "local" ? (
                  <>
                    Local secret for local execution:{" "}
                    <code>local-showcase-only</code>.{" "}
                  </>
                ) : null}
                Kept in this tab’s memory. The server checks it against Secrets
                Store.
              </p>
            </details>

            <form className="create-form" onSubmit={addCheckpoint}>
              <label className="sr-only" htmlFor="checkpoint-title">
                Checkpoint title
              </label>
              <input
                id="checkpoint-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={120}
                required
                placeholder="What would you like to verify?"
              />
              <button
                className="primary-button"
                disabled={busy || !apiKey || !title.trim()}
                type="submit"
              >
                <span aria-hidden>＋</span> Add checkpoint
              </button>
            </form>
            <div aria-live="polite" className="feedback">
              {error ? (
                <p className="error" role="alert">
                  {error}
                </p>
              ) : notice ? (
                <p>{notice}</p>
              ) : null}
            </div>

            <div className="table-toolbar">
              <div className="filters" aria-label="Filter checkpoints">
                {["all", "open", "verified"].map((value) => (
                  <button
                    key={value}
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {value}
                    <span>
                      {value === "all"
                        ? data.checkpoints.length
                        : value === "verified"
                          ? verified
                          : data.checkpoints.length - verified}
                    </span>
                  </button>
                ))}
              </div>
              <span className="small-label">Latest 100 records</span>
            </div>
            <div className="checkpoint-list">
              {visible.length === 0 ? (
                <div className="empty">
                  <span aria-hidden>◫</span>
                  <h3>
                    No {filter === "all" ? "" : `${filter} `}checkpoints yet
                  </h3>
                  <p>
                    {data.health.database === "ready"
                      ? "Add a checkpoint above to put D1 to work."
                      : "Run pnpm setup:local to initialize the local bindings."}
                  </p>
                </div>
              ) : (
                visible.map((item) => (
                  <div className="checkpoint" key={item.id}>
                    <button
                      className={`check-button ${item.status}`}
                      onClick={() => toggle(item)}
                      disabled={busy || !apiKey}
                      aria-label={`${item.status === "open" ? "Verify" : "Reopen"} ${item.title}`}
                    >
                      <span aria-hidden>
                        {item.status === "verified" ? "✓" : ""}
                      </span>
                    </button>
                    <div className="checkpoint-content">
                      <span className="checkpoint-title">{item.title}</span>
                      <span className="record-meta">
                        {new Date(item.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "UTC",
                        })}{" "}
                        UTC <span>·</span> {item.id.slice(0, 8)}
                      </span>
                    </div>
                    <span className={`status-pill ${item.status}`}>
                      {item.status}
                    </span>
                    <button
                      className="delete-button"
                      disabled={busy || !apiKey}
                      onClick={() =>
                        void perform(
                          () => mutate(`/api/checkpoints/${item.id}`, "DELETE"),
                          "Checkpoint removed.",
                        )
                      }
                      aria-label={`Delete ${item.title}`}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="ledger-footer">
              <span className="dot" /> Reads and writes use the same D1 binding
              in every environment.
            </div>
          </section>

          <aside>
            <section className="runtime-card" aria-labelledby="runtime-title">
              <div className="card-heading">
                <h2 id="runtime-title">Binding health</h2>
                <span
                  className={`health-pill ${data.health.ok ? "" : "unavailable"}`}
                >
                  {data.health.ok ? "Connected" : "Needs setup"}
                </span>
              </div>
              <dl className="facts">
                <div>
                  <dt>Database</dt>
                  <dd>
                    {data.health.databaseMode === "local"
                      ? "Local SQLite"
                      : "Cloudflare D1"}
                  </dd>
                </div>
                <div>
                  <dt>D1 binding</dt>
                  <dd>
                    <code>DB</code>
                    <span
                      className={`dot ${data.health.database === "ready" ? "" : "warning"}`}
                    />
                  </dd>
                </div>
                <div>
                  <dt>Secrets Store</dt>
                  <dd>
                    {data.health.secret}
                    <span
                      className={`dot ${data.health.secret === "ready" ? "" : "warning"}`}
                    />
                  </dd>
                </div>
                <div>
                  <dt>Health check</dt>
                  <dd>{data.health.queryTimeMs} ms</dd>
                </div>
                <div>
                  <dt>Release</dt>
                  <dd>
                    <code>{data.health.release.slice(0, 12)}</code>
                  </dd>
                </div>
              </dl>
              <div className="migration-heading">
                APPLIED MIGRATIONS <span>{data.health.migrations.length}</span>
              </div>
              <ul className="migrations">
                {data.health.migrations.map((name) => (
                  <li key={name}>
                    <span>✓</span>
                    <code>{name}</code>
                  </li>
                ))}
              </ul>
              <a
                className="text-link"
                href="/api/health"
                target="_blank"
                rel="noreferrer"
              >
                Inspect health response <span aria-hidden>↗</span>
              </a>
            </section>
            <section className="note-card">
              <span className="note-symbol" aria-hidden>
                ↗
              </span>
              <h2>Close the environment gap.</h2>
              <p>
                Fast local feedback is the beginning. Test the built Worker
                locally, then let staging verify the real cloud bindings.
              </p>
              <div className="command">
                <span>$</span>
                <code>
                  pnpm build:worker
                  <br />
                  pnpm preview
                </code>
              </div>
              <a
                className="text-link"
                href="https://github.com/Shion1305/cf-d1-showcase/blob/main/docs/workflow.md"
              >
                Explore the workflow <span aria-hidden>→</span>
              </a>
            </section>
          </aside>
        </div>
        <footer>
          <span>
            FIELDWORK <span className="footer-divider">/</span> A Cloudflare D1
            showcase
          </span>
          <span>
            Next.js <span>·</span> Workers <span>·</span> D1 <span>·</span>{" "}
            Terraform
          </span>
        </footer>
      </main>
    </>
  );
}
