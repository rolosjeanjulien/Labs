# Labs — Product Requirements Document (MVP)

## Purpose
**Labs** is a personal biological data ecosystem for performance athletes.
It combines wearable / Apple Health signals with proprietary biomarker testing
(sIgA, Cortisol, Testosterone, Creatinine) into one longitudinal,
individually-owned health record, interpreted by an AI layer called **Invie**.

Design thesis: *"the calm authority of a lab report, the daily usefulness of a coach."*

## Persona (MVP demo)
- **Léa Moreau**, trail runner, training for a 100K Ultra (September).
- 70 days of physiologically coherent data deterministically seeded.
- Story arc embedded: high-load block (days 30–40) causing a visible sIgA dip
  (days 38–47), then taper + recovery.

## Surface area (5 screens)
1. **Onboarding** — profile (name / sport / goal) → Apple Health connect (adapter-pattern mock) → baseline calibration message.
2. **Today** — hero Readiness score (0–100) with personal-baseline band, one-word verdict (Train hard / Moderate / Recover), Invie narrative, 4 signal cards (HRV, Sleep, 7d Load, sIgA), drivers list, sovereignty footer.
3. **Biomarkers** — focus screen for sIgA with full-width longitudinal chart, shaded personal baseline band, training-load overlay toggle, secondary tabs for Cortisol / Testosterone / Creatinine.
4. **Trends** — multi-metric comparison (biomarkers vs wearables) with 2w/6w/3m range selector.
5. **Invie** — conversational chat powered by the same pluggable Invie module that drives the Today narrative.
6. **Vault** — connected data sources list with last-sync, sovereignty messaging (France · RGPD), export action, rights list.

## Architecture

### Backend (FastAPI + MongoDB)
- `seed_data.py` — deterministic dataset generator (seed=42).
- `data_sources/` — adapter pattern. Each source (`apple_health.py`, `biomarkers.py`, `manual.py`) implements `DataSourceAdapter.fetch() / status()`. Future sources (Strava, Vital/Terra) plug in by subclassing.
- `invie_agent.py` — **single source of truth** for AI interpretation. `generate_insight()` and `chat()` consume the same structured context. Rule-based for MVP; documented swap point (`# INVIE_AGENT_PLACEHOLDER`) for replacing with a real LLM service without changing the API contract.
- `server.py` — `/api/*` endpoints:
  - `POST /api/onboarding`
  - `GET  /api/athlete`
  - `GET  /api/today`
  - `GET  /api/biomarkers/{siga|cortisol|testosterone|creatinine}`
  - `GET  /api/trends?range=2w|6w|3m`
  - `POST /api/invie/insight`
  - `POST /api/invie/chat`
  - `GET  /api/vault/sources`
- Idempotent seeding on startup; collections: `athlete`, `daily_metrics`, `biomarkers`, `baselines`, `sources`.

### Frontend (Expo React Native + react-native-svg)
- Routing: `app/index.tsx` (storage check) → `app/onboarding.tsx` or bottom-tab group `app/(tabs)/{today,biomarkers,trends,invie,vault}.tsx`.
- Theme (`src/theme.ts`): dark-first (#050507 bg, #0F1115 panel), restrained teal accent (#1FA98F), system mono for tabular numerics.
- Custom SVG chart (`src/components/Chart.tsx`) renders the **signature personal baseline band** behind every trend line (smooth bezier curve, training-load overlay, dot markers, highlighted last reading).
- No external auth, no push notifications, no LLM keys for MVP.

## Key visual identities
- **Personal baseline band** — shaded teal range behind every key value, never population average.
- **Tabular monospaced numerics** — system mono so numbers do not shift on update.
- Restrained status colors (good/watch/alert) used only on data, never decoratively.

## Out of scope (MVP)
- Real Apple HealthKit (would require native build & user device; adapter is structured for swap-in).
- Real LLM behind Invie (rule-based, contract preserved).
- Authentication (single demo athlete persisted in MongoDB).
- Push notifications.

## Status: ✅ Complete
