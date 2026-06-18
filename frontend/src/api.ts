const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

if (!BASE) {
  console.warn("EXPO_PUBLIC_BACKEND_URL is not set");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} :: ${text}`);
  }
  return res.json() as Promise<T>;
}

export type Band = { low: number; mid: number; high: number };

export type Signal = {
  key: string;
  label: string;
  value: number;
  unit: string;
  band: Band;
  delta_pct: number;
  source: string;
};

export type Driver = {
  label: string;
  value: number;
  unit: string;
  score: number;
  position: "below" | "in" | "above";
  delta_pct: number;
};

export type TodayResponse = {
  date: string;
  readiness: {
    score: number;
    verdict: "train_hard" | "moderate" | "recover";
    confidence: number;
    band: Band;
    history: { date: string; value: number }[];
  };
  narrative: string;
  drivers: Driver[];
  signals: Signal[];
  sovereignty: { region: string; owner: string };
};

export type BiomarkerResponse = {
  metric: "siga" | "cortisol" | "testosterone" | "creatinine";
  label: string;
  subtitle: string;
  unit: string;
  band: Band;
  series: { date: string; day_index: number; value: number }[];
  training_load: { date: string; day_index: number; value: number }[];
  latest: { date: string; day_index: number; value: number };
  delta_abs: number;
  delta_pct: number;
  position: "below" | "in" | "above";
};

export type TrendsResponse = {
  range: "2w" | "6w" | "3m";
  metrics: {
    key: string;
    label: string;
    unit: string;
    band: Band;
    kind: "wearable" | "biomarker";
    series: { date: string; day_index: number; value: number }[];
  }[];
};

export type VaultResponse = {
  sovereignty: { region: string; host: string; compliance: string[]; owner: string };
  sources: {
    id: string;
    label: string;
    kind: string;
    status: string;
    last_sync: string | null;
    metrics: string[];
  }[];
  totals: { daily_metrics: number; biomarker_readings: number };
};

export type ChatResponse = {
  reply: string;
  verdict: "train_hard" | "moderate" | "recover";
  drivers: Driver[];
};

export const api = {
  onboarding: (body: { name: string; sport: string; goal: string; connect_apple_health: boolean }) =>
    request<{ ok: boolean }>("/onboarding", { method: "POST", body: JSON.stringify(body) }),
  today: () => request<TodayResponse>("/today"),
  biomarker: (metric: string) => request<BiomarkerResponse>(`/biomarkers/${metric}`),
  trends: (range: "2w" | "6w" | "3m") => request<TrendsResponse>(`/trends?range=${range}`),
  invieInsight: () =>
    request<{ narrative: string; verdict: string; score: number; drivers: Driver[] }>(
      "/invie/insight",
      { method: "POST", body: JSON.stringify({}) },
    ),
  invieChat: (message: string) =>
    request<ChatResponse>("/invie/chat", { method: "POST", body: JSON.stringify({ message }) }),
  vault: () => request<VaultResponse>("/vault/sources"),
};
