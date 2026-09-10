export type Checkpoint = {
  id: string;
  title: string;
  status: "open" | "verified";
  created_at: string;
};

export type Health = {
  ok: boolean;
  environment: string;
  databaseMode: string;
  release: string;
  database: "ready" | "unavailable";
  secret: "ready" | "unavailable";
  migrations: string[];
  queryTimeMs: number;
};

export type DashboardData = { checkpoints: Checkpoint[]; health: Health };
