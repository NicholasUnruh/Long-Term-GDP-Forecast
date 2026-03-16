# Claude Agent Handoff - Long-Term GDP Forecast

## What This Project Does

Forecasts US real GDP by state (50 + DC) and industry (23 leaf sectors) from 2025:Q4 to 2050 using historical CAGR extrapolation. Also forecasts population by state and derives GDP per capita at state-industry level. All assumptions are configurable via `config/forecast_config.yaml` and the web UI.

## How To Run

```bash
# Local dev
python -m uvicorn api.main:app --port 8000   # API
cd web && npm run dev                          # Frontend → http://localhost:3000

# Docker
docker compose up --build                      # → http://localhost

# Deploy
git push                                       # Railway auto-deploys
```

Runtime: ~14 seconds per forecast. API pre-computes baseline on startup.

## Core Model

GDP growth is computed per state-industry pair using **historical CAGR extrapolation**:

```
CAGR = (GDP_end / GDP_start)^(1/n) - 1
GDP_t+1 = GDP_t * (1 + quarterly_CAGR)
```

- **CAGR** is computed from BEA historical data over a configurable date range
- **Two-phase growth**: optional short-term CAGR (recent window) for first N years, then long-term CAGR
- **Per-pair caps**: individual state-industry CAGR caps to prevent extreme compounding
- **Global cap**: optional blanket cap on all growth rates
- **Population**: decelerating growth model with national target calibration (`population_forecast.py`)
- **GDP per capita**: `(real_gdp * 1,000,000) / population` at state-industry level

### Config Parameters (forecast section)

| Parameter | Default | Description |
|-----------|---------|-------------|
| `historical_range_start_year` | null (all data) | Start year for long-term CAGR computation |
| `short_term_years` | 0 | Years to apply short-term CAGR (0=disabled) |
| `short_term_start_year` | 2015 | Historical range for short-term CAGR |
| `cagr_cap` | 0 | Global max annual CAGR (0=no cap) |
| `cagr_overrides` | {} | Per-pair caps: `"State\|Industry": max_rate` |

## Project Structure

```
config/forecast_config.yaml   <- All tunable parameters (heavily commented)
main.py                       <- CLI entry point (legacy)
src/
  utils.py                    <- Config loading, constants, quarter/date helpers
  data_loader.py              <- Parses CSVs into DataFrames (cached after first load)
  historical_analysis.py      <- Growth rates, industry shares, trend decomposition
  population_forecast.py      <- Decelerating growth + national target calibration
  gdp_forecast.py             <- Core engine: CAGR computation, two-phase growth, caps, aggregates
  gdp_per_capita.py           <- GDP / population (quarterly and annual)
  labor_forecast.py           <- (legacy, unused by current engine)
  capital_forecast.py         <- (legacy, unused by current engine)
  tfp_forecast.py             <- (legacy, unused by current engine)
  scenarios.py                <- Named scenario deep-merge
api/
  main.py                     <- FastAPI app, startup precompute, CORS
  config.py                   <- PROJECT_ROOT, ports, CORS origins
  models/forecast.py          <- Pydantic request models (ForecastHorizon, PopulationConfig, etc.)
  models/responses.py         <- Response models (SummaryMetrics, CAGRRow, etc.)
  routers/forecast.py         <- POST /run, GET /status, GET /results/* (job eviction: max 5)
  routers/config_router.py    <- GET /config/defaults, /scenarios
  routers/data.py             <- GET /data/states, /industries, /cagr-preview, /historical-range
  services/forecast_service.py <- Wraps src/ modules, computes analytics
web/
  app/page.tsx                <- Home: model description, CAGR methodology
  app/configure/page.tsx      <- Configure: CAGR range, short-term, caps, population, industry shifts
  app/dashboard/page.tsx      <- Dashboard: charts, tables, export
  lib/api-client.ts           <- Typed API client (includes getCAGRPreview)
  lib/types.ts                <- TypeScript interfaces
```

## Data Files

### `real_gdp.csv` (BEA quarterly GDP by state and industry)
- **Format**: Wide. Row 1 = state names, Row 2 = industry names, Rows 3+ = quarterly data
- **Range**: 2005:Q1 to 2025:Q3 (83 quarters)
- **Areas**: 52 (50 states + DC + "United States")
- **Industries per area**: 27 (23 leaf + 4 aggregates)
- **Values**: Millions of chained 2017 dollars
- **Gotcha**: Some combos have suppressed BEA data. Engine projects forward from last available.

### `population.csv` (Census annual population by state)
- **Range**: 1960 to 2025. Values in thousands (multiplied by 1000 during loading).

## Industry Hierarchy (defined in `utils.py`)

- **LEAF_INDUSTRIES** (23): Independently forecast. These are the actual forecast units.
- **SUB_AGGREGATE_INDUSTRIES**: Manufacturing, Government (sums of children)
- **AGGREGATE_INDUSTRIES**: "All industry total", "Private industries" (derived from leaves)

Aggregates are built from leaf sums by `build_aggregates()`.

## Execution Flow (API)

1. Load config, apply scenario + user overrides
2. Load & parse cached GDP and population CSVs
3. Forecast population by state to end_year
4. For each state x leaf industry:
   - Compute short-term CAGR (if enabled) from recent historical window
   - Compute long-term CAGR from full historical range
   - Apply per-pair cap or global cap
   - Project forward: short-term rate for first N years, then long-term
5. Apply industry structural shifts (if enabled)
6. Build aggregate industry rows from leaf sums
7. Sum across states for US totals
8. Compute annual GDP per capita at state-industry level
9. Return results (evict oldest job if >5 stored)

## Memory Optimizations

- **CSV caching**: `load_gdp_data()` and `load_population_data()` parse once, cached in module globals
- **Job eviction**: Max 5 completed jobs in memory (~39MB each). Oldest evicted on new job.
- **No duplicate storage**: `gdp_combined` rebuilt on demand for export only

## Key API Endpoints

```
POST   /forecast/run                          # Submit forecast
GET    /forecast/status/{job_id}              # Poll status
GET    /forecast/results/{job_id}/summary     # Summary metrics
GET    /forecast/results/{job_id}/cagr/states # CAGR by state
GET    /forecast/results/{job_id}/export      # Wide CSV download
GET    /data/cagr-preview?start_year=         # Preview all 1173 CAGRs
GET    /data/states                           # State list
GET    /data/industries                       # Industry hierarchy
GET    /config/defaults                       # Full YAML as JSON
```

## Configure Page (3 sections)

1. **Forecast Horizon & Historical Range**: End year, long-term CAGR start year, short-term duration + start year, CAGR preview table with per-row caps, global cap slider
2. **Population**: National target (370M), fit start year, growth deceleration, share damping, per-state overrides
3. **Industry Structural Shifts**: Toggle + per-industry shift rates

## Known Quirks

1. **Data gaps**: Some state-industry combos end before 2025:Q3. Engine projects forward from last available.
2. **Two-phase growth**: Short-term rate applies for exactly `short_term_years * 4` quarters, then hard switch to long-term.
3. **CAGR outliers**: Without caps, some pairs (CA Info 8.7%, ND Mining 15.4%) produce extreme 25yr compounding. The preview table highlights these.
4. **Units**: GDP in millions of chained 2017$. Population in persons. GDP/cap = `(GDP * 1M) / pop`.
5. **US totals**: Always sum of states, never independently forecast.

## Dependencies

```
# Python
pandas numpy scipy pyyaml fastapi uvicorn pydantic

# Node.js (web/)
next react echarts echarts-for-react katex @tanstack/react-query
```
