# Claude Handoff — GDP Forecast Website Implementation

**Date**: March 11, 2026 (updated Session 7)
**Status**: Deployed to Railway, dark mode added, Docker Compose working locally

---

## What Was Built

A full-stack web application wrapping the existing Python GDP forecast engine into 3 pages:

1. **Model Description** (`/`) — Server component with KaTeX equations, Cobb-Douglas explanation, component model cards, industry hierarchy, scenario comparison table, limitations
2. **Parameter Configuration** (`/configure`) — Full parameter form with 7 accordion sections, scenario presets, sliders+inputs, computed values, "Run Forecast" flow with polling dialog
3. **Results Dashboard** (`/dashboard`) — 4 tabs: Per Capita stacked area chart, GDP Trends line chart, Industry & CAGR (state table + industry bar chart), Data Explorer (paginated 141K row table)

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 16.1.6 (App Router, TypeScript) |
| UI | shadcn/ui (base-ui) + Tailwind CSS 4 |
| Charts | Apache ECharts (tree-shaken, canvas renderer) |
| Math | KaTeX (react-katex) |
| Forms | React useState + manual state management |
| Data fetching | TanStack React Query v5 |
| Backend | FastAPI (Python) |
| Job queue | In-memory dict + asyncio.to_thread (no Redis needed yet) |

## How To Run

### Start the API (port 8000):
```bash
cd "C:/Users/nunru/Desktop/Long-Term GDP Forecast"
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload
```

### Start the frontend (port 3000):
```bash
cd "C:/Users/nunru/Desktop/Long-Term GDP Forecast/web"
npm run dev
```

Then open http://localhost:3000. The API pre-computes a baseline forecast on startup (~14 seconds), so the dashboard works immediately with `job_id=baseline`.

## Project Structure

```
Long-Term GDP Forecast/
├── config/forecast_config.yaml          # All model parameters
├── src/                                  # Python forecast engine
│   ├── utils.py, data_loader.py, historical_analysis.py
│   ├── population_forecast.py, labor_forecast.py, capital_forecast.py
│   ├── tfp_forecast.py, gdp_forecast.py, gdp_per_capita.py, scenarios.py
├── main.py                              # Original CLI entry point
├── real_gdp.csv, population.csv         # Source data files
│
├── api/                                  # FastAPI backend (NEW)
│   ├── main.py                          # App with CORS, routers, startup precompute
│   ├── config.py                        # PROJECT_ROOT, ports, CORS origins
│   ├── models/
│   │   ├── forecast.py                  # Pydantic request models (ForecastRequest, etc.)
│   │   └── responses.py                 # Response models (SummaryMetrics, CAGRRow, etc.)
│   ├── routers/
│   │   ├── forecast.py                  # POST /run, GET /status, GET /results/* + /export (10 endpoints)
│   │   ├── config_router.py             # GET /config/defaults, /scenarios
│   │   └── data.py                      # GET /data/states, /industries
│   └── services/
│       └── forecast_service.py          # Wraps src/ modules, computes summary/CAGR/chart data
│
├── web/                                  # Next.js frontend (NEW)
│   ├── app/
│   │   ├── layout.tsx                   # Root layout with Nav, Footer, Providers
│   │   ├── page.tsx                     # Page 1: Model Description (~800 lines)
│   │   ├── configure/page.tsx           # Page 2: Parameter Configuration (~1300 lines)
│   │   └── dashboard/page.tsx           # Page 3: Results Dashboard (~250 lines)
│   ├── components/
│   │   ├── ui/                          # shadcn components (17 files, auto-generated)
│   │   ├── layout/                      # navigation.tsx, footer.tsx
│   │   ├── model-description/           # equation-display.tsx (KaTeX wrapper)
│   │   ├── configure/                   # slider-with-input.tsx
│   │   ├── dashboard/                   # 7 components (+industry-multi-select.tsx)
│   │   ├── charts/                      # echarts-wrapper.tsx, chart-error-boundary.tsx
│   │   └── providers.tsx                # QueryClientProvider + TooltipProvider
│   ├── lib/
│   │   ├── types.ts                     # TypeScript interfaces
│   │   ├── constants.ts                 # Industries, colors, scenario labels
│   │   ├── formatters.ts               # Currency, GDP, population, percent formatters
│   │   ├── api-client.ts               # Typed fetch wrapper for all API endpoints
│   │   ├── hooks/use-forecast.ts       # TanStack Query hooks
│   │   └── utils.ts                    # cn() utility (shadcn)
│   └── types/react-katex.d.ts          # Type declaration for react-katex
```

## API Endpoints (FastAPI, port 8000)

```
POST   /forecast/run                                    # Submit forecast, returns job_id
GET    /forecast/status/{job_id}                        # Poll status (queued/running/completed/failed)
GET    /forecast/results/{job_id}/summary?state=          # Summary metrics (state-aware, defaults to US)
GET    /forecast/results/{job_id}/cagr/states           # CAGR table by state
GET    /forecast/results/{job_id}/cagr/industries?state= # CAGR by industry (state-aware, defaults to US)
GET    /forecast/results/{job_id}/charts/stacked-gdp-per-capita?state=   # Stacked chart data
GET    /forecast/results/{job_id}/charts/gdp-trends?state=&industries=   # Line chart data
GET    /forecast/results/{job_id}/tables/gdp?state=&industry=&page=&per_page=   # Paginated GDP
GET    /forecast/results/{job_id}/tables/gdp-per-capita?state=&industry=&page=   # Paginated GDP/cap
GET    /config/defaults                                 # Full YAML config as JSON
GET    /config/scenarios                                # Scenario names and overrides
GET    /data/states                                     # List of 51 state names
GET    /forecast/results/{job_id}/export                  # Wide-format GDP per capita CSV (2010+, State_Industry columns)
GET    /data/states                                     # List of 51 state names
GET    /data/industries                                 # Leaf, sub-aggregate, aggregate lists
```

## What's Working (Verified)

- [x] Model Description page renders with KaTeX equations, 3 component cards, industry hierarchy, scenario table
- [x] Configure page loads defaults from API, shows all 7 accordion sections with sliders
- [x] Scenario preset buttons (Baseline, High Growth, Low Growth, AI Boom) load overrides
- [x] "Run Forecast" submits job, polls status, redirects to dashboard on completion
- [x] Dashboard summary cards: $36.46T GDP, 370.0M pop, $97,903/cap, 1.64% CAGR
- [x] Stacked per-capita GDP chart (23 industries) with tooltips showing value + % breakdown
- [x] CAGR by Industry horizontal bar chart (Information 4.02%, Utilities 3.73%, etc.)
- [x] CAGR by State sortable table (Utah 2.74%, Washington 2.68%, Texas 2.64%)
- [x] GDP Trends line chart with industry multi-select (up to 8 industries)
- [x] Data Explorer with paginated 141,804 rows, dataset/state/industry filters, date column
- [x] Export button downloads full forecast as CSV
- [x] Dashboard shows loading spinner while baseline computes on startup
- [x] Error boundaries around all chart components
- [x] Frontend builds cleanly: `npx next build` passes TypeScript + compilation
- [x] API all 19 routes registered and returning correct data

## Resolved Issues (Session 2 — March 11, 2026)

### Bug Fixes (all resolved)
1. ~~**Data Explorer filter display**~~: Fixed by replacing base-ui `<SelectValue />` with explicit `<span>` display text. Base-ui Select.Value can't resolve item labels from portaled items before dropdown opens.
2. ~~**Data Explorer "Date" column empty**~~: Fixed by adding `"date"` column to the API response in `api/routers/forecast.py` (GDP table endpoint), with `.astype(str)` for serialization.
3. ~~**Data Explorer dataset selector shows "gdp"**~~: Same root cause as #1, fixed with explicit display text.

### Enhancements (all resolved)
4. ~~**GDP Trends industry multi-select**~~: New `IndustryMultiSelect` component (`web/components/dashboard/industry-multi-select.tsx`). Supports up to 8 simultaneous industries with checkboxes, uses industry-specific colors from the 23-color palette.
5. ~~**Export button**~~: New `GET /forecast/results/{job_id}/export` endpoint returns streaming CSV of full GDP forecast. The existing `handleExport` in the dashboard now works.
6. ~~**Pre-computed baseline loading state**~~: Dashboard now uses `useJobStatus` to poll job status. Shows a spinner + progress message while baseline computes, error state if failed. Data hooks are guarded with `isReady` flag.
7. ~~**Error boundaries**~~: New `ChartErrorBoundary` class component (`web/components/charts/chart-error-boundary.tsx`) wraps all chart components in the dashboard. Shows retry button on failure.
8. ~~**Loading/error states**~~: Charts now receive `isError` prop and show distinct error vs loading UI.

## Resolved Issues (Session 4 — March 11, 2026)

### Population Model Overhaul
- **Problem**: Old log-linear model projected 420M US population by 2050 — 50-60M above every credible source (Census ~369M, Cooper Center ~371M, CBO ~360M)
- **Solution**: Replaced with decelerating growth + national target calibration model
  - Computes each state's recent CAGR (2010-2025)
  - Generates smooth national trajectory where growth decelerates yearly to hit configured target
  - Evolves state shares based on damped growth differentials (fast states gain share, declining states lose share)
  - National total guaranteed to match target exactly
- **New config params** (`population` section in `forecast_config.yaml`):
  - `national_pop_target: 370000000` (midpoint of Census 369M / Cooper Center 371M)
  - `growth_deceleration: 0.04` (annual decay of growth rate)
  - `share_damping: 0.03` (state convergence rate)
  - `fit_start_year: 2010` (changed from 2000)
  - `by_state: {}` (per-state CAGR overrides, unchanged interface)
- **Removed params**: `method` (was "log_linear"), `national_growth_target` (was a growth rate, replaced by absolute target)
- **Files changed**:
  - `src/population_forecast.py` — core rewrite, legacy functions preserved at bottom
  - `config/forecast_config.yaml` — new population section with research-based defaults
  - `api/models/forecast.py` — `PopulationConfig` Pydantic model updated
  - `web/lib/types.ts` — TypeScript types updated
  - `web/app/configure/page.tsx` — new sliders (target in millions, deceleration, damping), removed old method toggle
  - `web/app/page.tsx` — model description + limitations text updated
- **Validation results**:
  - 2030: 349.7M (matches Cooper Center 349.7M exactly)
  - 2040: 361.8M (matches Cooper Center 362M)
  - 2050: 370.0M (target hit exactly)
  - Growth deceleration: 0.46%/yr → 0.20%/yr (matches CBO pattern)
  - State patterns: TX +25%, FL +22%, UT +27% gain; WV -7.7%, IL -4.8%, MI -5.1% decline
- **GDP impact**: CAGR dropped from 2.06% to 1.64% due to lower labor growth contribution (population growth 0.32%/yr barely offsets LFPR -0.1% + aging -0.2%)

### TFP / AI Discussion (pending decision)
- Baseline TFP is 1.0% (pre-AI historical average) — user noted this seems low for a 2050 forecast
- Research on AI impact on TFP: range from +0.07 pp/yr (Acemoglu, skeptic) to +1.5 pp/yr (Goldman Sachs, bull)
- Moderate consensus: +0.3 to +0.5 pp/yr → baseline of 1.3-1.5%
- **User may want to raise baseline TFP to ~1.3%** to reflect moderate AI assumption and align with CBO's ~1.8% GDP growth projection
- Current AI Boom scenario at 2.0% TFP remains as optimistic case

### Critical Operational Note
- **After any `src/` Python code changes, the API server must be fully killed and restarted** — Python's import cache holds stale modules even with uvicorn `--reload`. The dashboard shows cached results from previous forecast runs, so a new forecast must be triggered from the Configure page after restart.

## Resolved Issues (Session 6 — March 11, 2026)

### Export CSV Overhaul
- **Before**: Long-format CSV with columns `quarter, date, state, industry, real_gdp, is_forecast` — forecast data only
- **After**: Wide-format CSV with GDP per capita values, historical data from 2010 + forecast
  - Single header row: `Quarter, "Alabama_Accommodation and food services", "Alabama_Agriculture...", ...`
  - Rows are quarters (2010:Q1 through 2050:Q4)
  - Values are GDP per capita (real_gdp * 1,000,000 / population)
- **Files changed**:
  - `api/routers/forecast.py` — export endpoint rewritten with pivot_table + manual CSV header
  - `api/services/forecast_service.py` — now stores `gdp_combined` (historical 2010+ merged with forecast) in results dict

### Per-Capita Industry Chart Tooltip Fix
- **Problem**: Tooltip didn't show which industry was being hovered — the `highlight`/`downplay` event approach via React ref had timing issues
- **Solution**: Switched to `mouseover`/`mouseout` events (more reliable for stacked area charts). Hovered industry now appears prominently at top of tooltip in a blue highlight box with name, value, and % of total.
- **File**: `web/components/dashboard/stacked-gdp-per-capita-chart.tsx`

### Critical Server Restart Note
- `uvicorn --reload` spawns child Python processes that often survive when the parent is killed, continuing to serve stale code
- **Fix**: Must `taskkill` all Python processes, clear `__pycache__` dirs, then restart without `--reload` for reliable code updates

## Resolved Issues (Session 3 — March 11, 2026)

### Page Centering
- Model page (`app/page.tsx`): Added `max-w-4xl mx-auto` to hero and content containers
- Dashboard page (`app/dashboard/page.tsx`): Added `max-w-6xl mx-auto` to all containers (wider for charts/tables)
- Configure page already had `max-w-4xl mx-auto` — was the reference for centering

### State-Aware Dashboard
- **Summary metrics**: `/summary` and `/cagr/industries` API endpoints now accept `?state=` query param
- Backend: `compute_summary_metrics()` and `compute_cagr_by_industry()` in `api/services/forecast_service.py` accept `state` param; pre-computed result used for US, on-the-fly for individual states
- Frontend hooks: `useSummary(jobId, state)` and `useCAGRByIndustry(jobId, state)` include state in React Query key for proper refetching
- Summary card titles dynamically show state name (e.g., "California GDP 2050")
- CAGR by Industry chart title updates per state

### Console Error Fix
- `app/page.tsx` line 731: Changed `<Button render={<Link href="/configure" />}>` to `<Link href="/configure"><Button>` — Base UI requires native `<button>` when `nativeButton` prop is true

### Remaining Items
- **Run Forecast from Configure**: Full end-to-end flow (configure → run → dashboard redirect) needs re-testing after scenario recalibration.
- **Mobile responsiveness**: Not yet tested on mobile viewports.

## Resolved Issues (Session 7 — March 11, 2026)

### Dark Mode
- Wired up `next-themes` ThemeProvider in `web/components/providers.tsx`
- Created `web/components/layout/theme-toggle.tsx` (Sun/Moon icon button)
- Added to navigation bar (right-aligned via `ml-auto`)
- `suppressHydrationWarning` added to `<html>` tag in `layout.tsx`
- Dark mode CSS variables already existed in `globals.css` (shadcn default)

### Docker Compose (Local Development)
- `Dockerfile.api` — Python 3.11-slim, copies src + data + config, runs uvicorn on 8000
- `Dockerfile.web` — Multi-stage Node 20 Alpine (deps → build → standalone runner) on 3000
- `docker-compose.yml` — 3 services: api, web, nginx (exposed on port 80)
- `nginx/nginx.conf` — Reverse proxy: `/forecast/`, `/config/`, `/data/` → api; everything else → web
- `.dockerignore` — Excludes node_modules, .next, outputs, __pycache__, .git
- Tested and verified: all 3 containers healthy, baseline precompute completes, frontend loads

### Railway Deployment (Production)
- **GitHub repo**: https://github.com/NicholasUnruh/Long-Term-GDP-Forecast (master branch)
- **2 Railway services** from same repo:
  - `api` — uses `Dockerfile.api`, private (no public domain), port 8000
  - `web` — uses `Dockerfile.web`, public domain on port 3000
- **No nginx on Railway** — Next.js rewrites in `next.config.ts` proxy API paths to internal network
- **Internal networking**: `API_INTERNAL_URL=http://api.railway.internal:8000` (Railway private DNS)
- **Build args**: `NEXT_PUBLIC_API_URL=""` (empty string → relative URLs, proxied through rewrites)
- `railway-api.toml` / `railway-web.toml` — config-as-code for Railway builds
- **Deploy workflow**: `git push` to master → Railway auto-deploys both services

### Code Changes for Deployment
- `next.config.ts` — Added `output: "standalone"` + rewrites for `/forecast/`, `/config/`, `/data/` using `API_INTERNAL_URL` env var
- `api/config.py` — CORS_ORIGINS now configurable via `CORS_ORIGINS` env var (comma-separated)
- `web/lib/api-client.ts` + `web/app/dashboard/page.tsx` — Changed `||` to `??` for `NEXT_PUBLIC_API_URL` so empty string works (relative URLs for production)

## Type Issues Fixed During Build

The project uses shadcn/ui v4 which is built on `@base-ui/react` (not Radix). Key differences from older shadcn:

- `Select.onValueChange` passes `(value: string | null, eventDetails)` — handlers must accept `string | null`
- `Slider.onValueChange` passes `(value: number | readonly number[], eventDetails)` — handler param must be `readonly number[]` not `number[]`
- `Accordion` uses numeric values for items, `defaultValue={[1, 2, 3]}` for multi-expand

These were already fixed in the codebase.

## Key Architecture Decisions

1. **In-memory job store** (not Redis): Jobs stored in a Python dict in the FastAPI process. Simpler than Redis for single-server deployment. Upgrade to Redis if needed for multi-worker.

2. **Pre-computed baseline**: API runs baseline forecast on startup and stores with key `"baseline"`. Dashboard defaults to `job_id=baseline`.

3. **Chart-specific API endpoints**: Backend transforms DataFrames into chart-ready JSON (e.g., stacked chart gets `{years: [...], series: {industry: [values]}}`). Frontend never receives 141K rows for charts.

4. **ECharts over Recharts**: Canvas renderer handles 23 stacked series without SVG performance issues. Tree-shaken from 800KB to ~300KB.

5. **Next.js rewrites as API proxy**: In production (Railway), Next.js rewrites in `next.config.ts` proxy `/forecast/`, `/config/`, `/data/` to the API over Railway's private network. No CORS needed. Locally, the rewrites point to `http://localhost:8000`. Docker Compose uses nginx instead.

## Dependencies

### Python (existing + new):
```
pandas numpy scipy pyyaml statsmodels matplotlib
fastapi uvicorn pydantic orjson
```

### Node.js (web/package.json):
```
next react react-dom
echarts echarts-for-react
katex react-katex
@tanstack/react-query @tanstack/react-table
react-hook-form @hookform/resolvers zod
class-variance-authority clsx tailwind-merge lucide-react
tailwindcss typescript eslint
```

## Reference: Implementation Plan

The full implementation plan is in `WEBSITE_IMPLEMENTATION_PLAN.md` (1745 lines). It covers:
- Technology stack rationale with sources
- Architecture diagrams and request flow
- Page-by-page wireframes with component hierarchies
- 23-color industry palette specification
- 6-phase build plan (31-43 days estimated, core done in this session)
- Risk analysis and open questions
