import { test, expect } from "@playwright/test";

const headers = { Authorization: "Bearer local-showcase-only" };

test("deployed-format Worker resolves D1 and Secrets Store", async ({
  request,
}) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({
    ok: true,
    environment: "local",
    databaseMode: "local",
    secret: "ready",
    database: "ready",
  });
  expect((await response.json()).migrations).toEqual([
    "0001_create_checkpoints.sql",
    "0002_add_checkpoint_status.sql",
  ]);
  expect(await response.text()).not.toContain("local-showcase-only");
  expect(response.headers()["cache-control"]).toBe("no-store");
});

test("authenticate every mutation and reject malformed input", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/checkpoints", {
        data: { title: "Unauthorized" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.post("/api/checkpoints", {
        headers: { Authorization: "Bearer wrong" },
        data: { title: "Unauthorized" },
      })
    ).status(),
  ).toBe(401);
  expect(
    (
      await request.patch("/api/checkpoints/missing", {
        data: { status: "verified" },
      })
    ).status(),
  ).toBe(401);
  expect((await request.delete("/api/checkpoints/missing")).status()).toBe(401);
  expect(
    (
      await request.post("/api/checkpoints", { headers, data: { title: " " } })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/checkpoints", {
        headers,
        data: { title: "x".repeat(121) },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/checkpoints", {
        headers: { ...headers, "Content-Type": "application/json" },
        data: "{",
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/checkpoints", {
        headers,
        data: { title: "x".repeat(5000) },
      })
    ).status(),
  ).toBe(413);
  expect(
    (
      await request.post("/api/checkpoints", {
        headers: { ...headers, Origin: "https://untrusted.example" },
        data: { title: "Blocked" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.patch("/api/checkpoints/missing", {
        headers,
        data: { status: "invalid" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (await request.delete("/api/checkpoints/missing", { headers })).status(),
  ).toBe(404);
});

test("API persists literal SQL-looking input and returns explicit update/delete results", async ({
  request,
}) => {
  const title = `test-${crypto.randomUUID()}'); DROP TABLE checkpoints; --`;
  const created = await request.post("/api/checkpoints", {
    headers,
    data: { title },
  });
  expect(created.status()).toBe(201);
  const { checkpoint } = await created.json();
  try {
    expect(checkpoint).toMatchObject({ title, status: "open" });
    expect(
      (await (await request.get("/api/checkpoints")).json()).checkpoints,
    ).toContainEqual(checkpoint);
    const patched = await request.patch(`/api/checkpoints/${checkpoint.id}`, {
      headers,
      data: { status: "verified" },
    });
    expect(patched.status()).toBe(200);
    expect((await patched.json()).checkpoint.status).toBe("verified");
  } finally {
    expect(
      (
        await request.delete(`/api/checkpoints/${checkpoint.id}`, { headers })
      ).status(),
    ).toBe(204);
  }
  expect(
    (
      await request.delete(`/api/checkpoints/${checkpoint.id}`, { headers })
    ).status(),
  ).toBe(404);
});

test("browser can create, reload, verify, filter, and delete a checkpoint", async ({
  page,
  request,
}) => {
  const title = `Browser check ${crypto.randomUUID().slice(0, 8)}`;
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Same code. Every environment." }),
  ).toBeVisible();
  await page
    .getByLabel("API key for this environment")
    .fill("local-showcase-only");
  await page.getByLabel("Checkpoint title").fill(title);
  await page.getByRole("button", { name: "Add checkpoint" }).click();
  await expect(page.getByText("Checkpoint saved to D1.")).toBeVisible();
  try {
    await page.reload();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page
      .getByLabel("API key for this environment")
      .fill("local-showcase-only");
    await page
      .getByRole("button", { name: `Verify ${title}`, exact: true })
      .click();
    await expect(page.getByText("Checkpoint updated.")).toBeVisible();
    await page.getByRole("button", { name: /^verified\s+\d+$/i }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: `Delete ${title}`, exact: true })
      .click();
    await expect(page.getByText("Checkpoint removed.")).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toHaveCount(0);
  } finally {
    const rows = (await (await request.get("/api/checkpoints")).json())
      .checkpoints;
    for (const item of rows.filter(
      (row: { title: string }) => row.title === title,
    )) {
      await request.delete(`/api/checkpoints/${item.id}`, { headers });
    }
  }
});

test("layout fits a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your checkpoints" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
