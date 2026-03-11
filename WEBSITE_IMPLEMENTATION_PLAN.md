# Long-Term GDP Forecast Website: Comprehensive Implementation Plan

**Date**: March 10, 2026
**Status**: Planning
**Scope**: Transform the existing Python CLI GDP forecasting tool into a production-caliber interactive web application.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technology Stack Selection](#2-technology-stack-selection)
3. [Architecture Design](#3-architecture-design)
4. [Page-by-Page Design](#4-page-by-page-design)
5. [Data Pipeline](#5-data-pipeline)
6. [File and Folder Structure](#6-file-and-folder-structure)
7. [Implementation Phases](#7-implementation-phases)
8. [Key Technical Decisions](#8-key-technical-decisions)
9. [Risk Analysis](#9-risk-analysis)
10. [Sources](#10-sources)

---

## 1. Executive Summary

### What We Are Building

A three-page web application that:
1. **Explains the model** with full mathematical notation and economic context
2. **Lets users configure every parameter** in the Cobb-Douglas production function model via an intuitive UI
3. **Displays rich interactive output** including stacked per-capita GDP charts by industry for every state and the US, CAGR tables, and filterable data exploration

### Core Constraint

The Python forecast engine takes ~14 seconds per scenario. This is a long-running computation that cannot execute in a request/response cycle. The architecture must handle this gracefully with background job processing, progress feedback, and result caching.

### Recommended Stack (Summary)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend framework** | Next.js 15 (App Router, TypeScript) | Best React meta-framework; SSR/SSG for model description page; API routes for backend communication |
| **UI components** | shadcn/ui + Tailwind CSS 4 | Production-quality, accessible, Tailwind-native components; ownership model (no runtime dependency) |
| **Charting** | Apache ECharts (via echarts-for-react) | Canvas renderer handles 23 stacked area series without SVG performance degradation; rich interactivity |
| **Math rendering** | KaTeX (via react-katex) | Fast LaTeX rendering for equations on model description page |
| **Data tables** | TanStack Table + shadcn DataTable | Virtual scrolling, server-side filtering/pagination for 142K-row datasets |
| **Forms** | React Hook Form + Zod | Validated nested parameter configuration with good DX |
| **Backend API** | FastAPI (Python) | Same language as the forecast engine; async support; automatic OpenAPI schema generation |
| **Task queue** | Redis + RQ (Redis Queue) | Handles 14-second model runs as background jobs with progress polling |
| **Deployment** | Docker Compose (Nginx + Next.js + FastAPI + Redis) | Single-machine deployment with proper service isolation |

---

## 2. Technology Stack Selection

### 2.1 Frontend Framework: Next.js 15 (App Router)

**Decision**: Next.js 15 with the App Router and TypeScript.

**Why Next.js over alternatives**:
- **vs. plain React (Vite)**: We need SSR/SSG for the model description page (SEO, fast initial load for a content-heavy page with math), API route handlers to proxy to FastAPI, and a file-system router. Vite+React gives none of these without manual setup.
- **vs. Remix**: Next.js has a larger ecosystem, better integration with shadcn/ui, and Vercel's template ecosystem provides starter patterns for the Next.js + FastAPI architecture we need.
- **vs. Astro**: Astro excels at content sites, not interactive data dashboards with heavy client-side state and real-time chart filtering.

**Key features we will use**:
- **App Router**: File-based routing for our 3 pages
- **Server Components**: The model description page will be a server component (static content + KaTeX rendering)
- **Route Handlers** (`app/api/*/route.ts`): Proxy layer to FastAPI backend for forecast runs, parameter validation, and result retrieval
- **Client Components**: Dashboard and parameter configuration pages need full client-side interactivity

**Confidence**: High. Next.js + FastAPI is an established pattern with official Vercel starter templates and extensive community adoption in 2025-2026.

### 2.2 Charting Library: Apache ECharts (via echarts-for-react)

**Decision**: Apache ECharts with the `echarts-for-react` wrapper.

This was the most researched decision because the stacked per-capita GDP chart is the centerpiece visualization, requiring 23 industry series stacked for each of 52 areas (50 states + DC + US), with ~26 annual data points per series (2025-2050).

**Why ECharts over alternatives**:

| Criterion | Recharts | Plotly.js | Nivo | ECharts | D3 (raw) |
|-----------|----------|-----------|------|---------|----------|
| 23-series stacked area performance | Poor (SVG-only, known issues with many series) | Good (WebGL for some types) | Good (canvas mode) | Excellent (canvas by default, optimized for high-cardinality) | Excellent (full control) |
| Bundle size | ~45KB | ~3MB+ | ~150KB+ | ~800KB (tree-shakeable to ~300KB) | ~30KB (modular) |
| React integration quality | Native | Wrapper (react-plotly.js) | Native | Wrapper (echarts-for-react) | Manual |
| Stacked area chart API | Good | Adequate (stackgroup) | Via Line+enableArea | Excellent (native stack + areaStyle) | Build from scratch |
| Interactive tooltips/zoom/brush | Basic | Good | Limited (no zoom/brush) | Excellent (built-in dataZoom, brush, toolbox) | Build from scratch |
| npm weekly downloads (core) | ~6.7M | ~800K | ~300K | ~2M | ~4.5M |
| Development effort | Low | Medium | Low-Medium | Medium | Very High |

**Critical factor**: The stacked area chart with 23 industries.

- **Recharts** renders via SVG. At 23 series with ~100 data points each (quarterly for 25 years), that is 2,300+ SVG `<path>` elements plus fills, tooltips, and animations. Known GitHub issues (#354, #1146, #5282) document performance degradation with this many elements. Recharts would require significant optimization workarounds.

- **Plotly.js** handles it via WebGL for scatter/line but stacked area charts use SVG. Its ~3MB bundle size is also prohibitive for a production website. Performance reports on the Plotly community forums indicate issues with 30K+ data points.

- **Nivo** supports canvas rendering but its stacked area support is through the Line component with `enableArea`, and the canvas variant may not fully support stacking. Nivo also lacks built-in zoom/brush, which are important for a 25-year time series.

- **ECharts** uses Canvas by default, with a purpose-built stacked area chart type. Its `dataZoom` component allows users to brush/zoom into specific year ranges. The `toolbox` provides export, data view, and zoom controls. Since v5.3.0, even SVG rendering improved 2-10x. The library has 65,850 GitHub stars and 2M+ weekly npm downloads, placing it as the second most popular charting library after Chart.js.

- **D3** would provide maximum control but at massive development cost. The time to build a production-quality stacked area chart with tooltips, zoom, legends, and responsive sizing from scratch in D3 is 2-4 weeks versus 2-3 days with ECharts.

**ECharts tree-shaking**: We will import only the required chart types and components to reduce bundle size from ~800KB to ~300KB:
```typescript
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { CanvasRenderer } from 'echarts/renderers';
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, ToolboxComponent } from 'echarts/components';
echarts.use([LineChart, CanvasRenderer, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, ToolboxComponent]);
```

**Confidence**: High. ECharts is the strongest choice for 23-series stacked area charts based on rendering architecture, built-in interactivity, and ecosystem maturity.

### 2.3 UI Component Library: shadcn/ui + Tailwind CSS 4

**Decision**: shadcn/ui (built on Radix UI primitives) with Tailwind CSS 4.

**Rationale**:
- **Ownership model**: Components are copied into the project, not imported from a runtime library. This means zero dependency risk, full customization control, and no version-lock concerns.
- **Accessibility**: Built on Radix UI primitives, which provide WCAG-compliant keyboard navigation, focus management, and ARIA attributes out of the box.
- **Tailwind CSS 4**: The latest Tailwind version with improved performance and the new oxide engine. shadcn/ui is designed for Tailwind-first styling.
- **Dashboard components**: shadcn/ui provides Card, Table, Accordion, Tabs, Select, Slider, Input, Sheet, Dialog, Tooltip -- all components we need for the parameter configuration and dashboard pages.
- **Community adoption**: shadcn/ui is the dominant React component library choice in 2026 for new Next.js projects.

**Specific components we will use**:
- **Card**: Metric display cards on the dashboard
- **Accordion**: Collapsible parameter sections on the configuration page
- **Tabs**: Switching between chart views on the dashboard
- **Table** (+ TanStack Table): Filterable data tables for output data
- **Select/Combobox**: State and industry selection dropdowns
- **Slider + Input**: Numeric parameter inputs with both slider and precise entry
- **Sheet/Dialog**: Mobile-friendly filter panels
- **Skeleton**: Loading states during 14-second model computation
- **Toast**: Notifications for forecast completion, errors

**Confidence**: High. shadcn/ui + Tailwind is the consensus best practice for production Next.js applications in 2026.

### 2.4 Math Rendering: KaTeX (via react-katex)

**Decision**: KaTeX for rendering the Cobb-Douglas production function equations on the model description page.

**Why KaTeX over MathJax**:
- KaTeX renders significantly faster than MathJax (pre-renders to HTML+CSS, no full-page reflow)
- Smaller bundle size (~100KB vs ~200KB+)
- Sufficient LaTeX coverage for our equations (basic algebra, Greek letters, fractions, subscripts)
- Well-tested with Next.js 14/15 via `react-katex` and `@caporeista/math-latex`

We do not need MathJax's broader LaTeX coverage (AMS environments, complex matrices) -- our equations are standard production function notation.

**Confidence**: High. This is a straightforward choice for the limited set of mathematical expressions we need.

### 2.5 Backend: FastAPI (Python)

**Decision**: FastAPI as the backend API server.

**Rationale**:
- **Same language as the forecast engine**: The existing model is pure Python (pandas, numpy, scipy). FastAPI can import and call the model modules directly without subprocess overhead.
- **Async support**: FastAPI is built on Starlette/ASGI, supporting async request handling. While the model computation itself is CPU-bound, the API server can handle concurrent requests to serve cached results while a computation runs.
- **Automatic OpenAPI schema**: FastAPI generates an OpenAPI specification from Pydantic models, which can be used to generate TypeScript types for the frontend (end-to-end type safety).
- **Pydantic validation**: The config YAML structure maps naturally to nested Pydantic models for request validation.

**Why not Next.js API routes alone**: The Python model cannot run inside Node.js. We would need to shell out to a Python subprocess from Node.js, losing type safety, error handling, and the ability to stream progress. A dedicated Python backend is cleaner.

**Why not Django**: Overkill. We need an API, not an ORM/admin/template engine. FastAPI is lighter and faster for pure API workloads.

**Confidence**: High. FastAPI + Python scientific stack is a natural fit for wrapping an existing Python computation engine.

### 2.6 Task Queue: Redis + RQ

**Decision**: Redis Queue (RQ) for background job processing of model runs.

**Why a task queue is necessary**: The model takes ~14 seconds per scenario. HTTP requests should not block for 14 seconds. The pattern is:
1. Client submits parameters via POST
2. Server enqueues a job and returns a `job_id` immediately
3. Client polls `GET /api/jobs/{job_id}` for status
4. When complete, client fetches results from `GET /api/results/{job_id}`

**Why RQ over Celery**:
- Celery is more powerful but significantly more complex to configure and debug. It requires a separate message broker (RabbitMQ or Redis) plus a results backend.
- RQ uses Redis as both broker and results store, has minimal configuration, and is designed for exactly this pattern: enqueue Python functions and poll for results.
- Our workload is simple: one job type (run forecast), low concurrency (likely single-user or few concurrent users), and moderate duration (14 seconds). RQ handles this without the overhead of Celery's multi-broker architecture.
- If we later need features like scheduled jobs, retries, or high concurrency, migrating from RQ to Celery is straightforward.

**Confidence**: High for the expected workload. Medium for high-concurrency scenarios (would need Celery or similar).

### 2.7 Deployment: Docker Compose

**Decision**: Docker Compose with four services (Nginx, Next.js, FastAPI, Redis).

**Rationale**: This is a single-application deployment, not a microservices architecture. Docker Compose provides service isolation, reproducible builds, and simple deployment on any VPS/cloud VM. The four services are:

1. **Nginx**: Reverse proxy, TLS termination, static file serving, request routing
2. **Next.js**: Frontend application (Node.js server for SSR)
3. **FastAPI**: Backend API (Uvicorn server)
4. **Redis**: Job queue and result cache

**Why not Vercel + separate Python host**: Vercel does not support long-running Python processes (serverless function timeout is typically 10-60 seconds, and our model takes 14 seconds with limited headroom). Hosting the Python backend separately adds complexity for inter-service communication, CORS, and latency.

**Why not Kubernetes**: Overkill for a single application with low expected concurrency. Docker Compose provides the same containerization benefits without the orchestration overhead.

**Confidence**: High. This is the standard deployment pattern for Next.js + Python backend applications on a single server.

---

## 3. Architecture Design

### 3.1 System Architecture Overview

```
                        Internet
                           |
                     [Nginx :443]
                      /         \
                     /           \
           [Next.js :3000]    [FastAPI :8000]
           (Frontend SSR)     (Backend API)
                                  |
                              [Redis :6379]
                            (Job Queue + Cache)
                                  |
                           [RQ Worker Process]
                         (Runs Python model)
```

### 3.2 Request Flow: Running a Forecast

```
1. User configures parameters on Page 2 (Parameter Configuration)
2. User clicks "Run Forecast"
3. Frontend sends POST /api/forecast/run to Next.js API route
4. Next.js API route proxies to FastAPI: POST /forecast/run
5. FastAPI validates parameters (Pydantic), enqueues job in Redis via RQ
6. FastAPI returns { job_id: "abc123", status: "queued" }
7. Next.js returns this to the frontend
8. Frontend begins polling: GET /api/forecast/status/abc123
9. Next.js proxies to FastAPI: GET /forecast/status/abc123
10. FastAPI checks RQ job status, returns { status: "running", progress: 45 }
11. After ~14 seconds, job completes. RQ stores result DataFrames as JSON in Redis.
12. Poll returns { status: "completed", job_id: "abc123" }
13. Frontend requests: GET /api/forecast/results/abc123
14. Next.js proxies to FastAPI: GET /forecast/results/abc123
15. FastAPI retrieves cached results from Redis, returns JSON
16. Frontend renders charts and tables on Page 3 (Dashboard)
```

### 3.3 API Design (FastAPI)

```
POST   /forecast/run                  # Submit forecast job with config parameters
GET    /forecast/status/{job_id}      # Poll job status
GET    /forecast/results/{job_id}     # Retrieve completed results

GET    /config/defaults               # Get default config values (for form initialization)
GET    /config/scenarios              # Get available scenario definitions
POST   /config/validate               # Validate a config without running the model

GET    /data/states                   # List of all states
GET    /data/industries               # List of all industries (leaf, sub-aggregate, aggregate)
GET    /data/historical/gdp           # Historical GDP data (for chart overlays)
GET    /data/historical/population    # Historical population data
```

#### Request/Response Models (Pydantic)

```python
class ForecastRequest(BaseModel):
    """Maps to the full config YAML structure"""
    forecast: ForecastHorizon
    production_function: ProductionFunction
    tfp: TFPConfig
    capital: CapitalConfig
    labor: LaborConfig
    population: PopulationConfig
    industry: IndustryConfig
    scenario: str = "custom"  # or a named scenario

class ForecastHorizon(BaseModel):
    start_quarter: str = "2025:Q4"
    end_year: int = Field(default=2050, ge=2026, le=2100)

class ProductionFunction(BaseModel):
    alpha: float = Field(default=0.30, ge=0.10, le=0.60)
    depreciation_rate: float = Field(default=0.05, ge=0.01, le=0.15)

class TFPConfig(BaseModel):
    national_growth_rate: float = Field(default=0.010, ge=-0.01, le=0.05)
    by_industry: dict[str, float] = {}
    by_state: dict[str, float] = {}
    convergence_rate: float = Field(default=0.02, ge=0.0, le=0.10)

# ... (similar for Capital, Labor, Population, Industry configs)

class JobStatusResponse(BaseModel):
    job_id: str
    status: Literal["queued", "running", "completed", "failed"]
    progress: int | None = None  # 0-100
    error: str | None = None
    created_at: datetime
    completed_at: datetime | None = None

class ForecastResultResponse(BaseModel):
    job_id: str
    scenario: str
    summary: USSummary
    gdp_by_state_industry: list[GDPRecord]  # Paginated
    population_by_state: list[PopulationRecord]
    gdp_per_capita: list[GDPPerCapitaRecord]  # Paginated
    cagr: CAGRData
```

### 3.4 Data Serialization Strategy

The model produces large DataFrames:
- `gdp_forecast_by_state_industry.csv`: 141,804 rows
- `gdp_per_capita_forecast.csv`: 36,504 rows
- `population_forecast_by_state.csv`: 4,732 rows

**Approach**: Do NOT send all 141K rows to the frontend in a single response. Instead:

1. **Summary endpoints**: Return pre-aggregated data for charts (annual state-level totals, US totals by industry, CAGR values). This reduces the GDP dataset from 141K quarterly state-industry rows to ~1,400 annual state-level rows or ~600 annual US-industry rows.

2. **Paginated detail endpoints**: For the data table explorer, return paginated results with server-side filtering:
   ```
   GET /forecast/results/{job_id}/gdp?state=California&industry=Information&page=1&per_page=100
   ```

3. **Chart-specific endpoints**: Pre-compute the exact data shapes needed for each chart type:
   ```
   GET /forecast/results/{job_id}/charts/stacked-gdp-per-capita?state=California&frequency=annual
   GET /forecast/results/{job_id}/charts/cagr-by-state
   GET /forecast/results/{job_id}/charts/cagr-by-industry
   ```

This keeps individual API responses under 500KB while the full dataset remains available through pagination.

### 3.5 State Management (Frontend)

**Approach**: Combination of React Context, URL state, and TanStack Query.

- **TanStack Query (React Query)**: For all server state -- forecast results, job status polling, historical data, config defaults. Provides caching, background refetching, loading/error states, and optimistic updates.
- **URL search params**: For dashboard filter state (selected state, industry, chart type). This makes views shareable via URL.
- **React Context**: For the parameter configuration form state, since it's a complex nested object that needs to be shared across accordion sections.
- **No Redux/Zustand**: Not needed. TanStack Query handles server state, URL params handle view state, and React Context handles form state. Adding a global state manager would be unnecessary complexity.

---

## 4. Page-by-Page Design

### 4.1 Page 1: Model Description

**URL**: `/` (home page)

**Purpose**: Explain the GDP forecast model with full mathematical detail and economic context. This is essentially a technical documentation page that establishes credibility and transparency.

#### Layout

```
+------------------------------------------------------------------+
|  HEADER: Navigation (Model | Configure | Dashboard)               |
+------------------------------------------------------------------+
|                                                                    |
|  Hero Section                                                      |
|  "Long-Term US GDP Forecast Model"                                |
|  Subtitle: Cobb-Douglas production function approach,             |
|  forecasting real GDP by state and industry to 2050               |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  Section 1: Overview                                               |
|  - What this model does (1 paragraph)                              |
|  - Coverage: 50 states + DC, 23 industries, 2025-2050            |
|  - Key output: GDP, GDP per capita, population forecasts          |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  Section 2: The Production Function                                |
|  - Cobb-Douglas equation (KaTeX rendered)                         |
|                                                                    |
|    Y = A * K^alpha * L^(1-alpha)                                  |
|                                                                    |
|  - Growth rate form:                                               |
|                                                                    |
|    dY/Y = dA/A + alpha*(dK/K) + (1-alpha)*(dL/L)                |
|                                                                    |
|  - Explanation of each term                                        |
|  - Why this model (historical use by CBO, academic standard)      |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  Section 3: Component Models (3-column cards on desktop)           |
|                                                                    |
|  +------------------+ +------------------+ +------------------+    |
|  | TFP Growth       | | Capital Growth   | | Labor Growth     |    |
|  | (Technology)     | | (Investment)     | | (Workforce)      |    |
|  |                  | |                  | |                  |    |
|  | Formula          | | Formula          | | Formula          |    |
|  | What it captures | | What it captures | | What it captures |    |
|  | Key parameters   | | Key parameters   | | Key parameters   |    |
|  | Historical range | | Historical range | | Historical range |    |
|  +------------------+ +------------------+ +------------------+    |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  Section 4: Industry Hierarchy                                     |
|  - Tree diagram of 27 BEA industries                              |
|  - Explain leaf vs. aggregate                                      |
|  - Structural shift mechanism                                      |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  Section 5: Population Model                                       |
|  - Log-linear trend fitting                                        |
|  - ln(pop) = a + b*year equation                                  |
|  - Quarterly interpolation via cubic spline                        |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  Section 6: Scenarios                                              |
|  - Explanation of the four built-in scenarios                      |
|  - Parameter comparison table                                      |
|  - When to use each                                                |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  Section 7: Limitations and Caveats                                |
|  - Constant growth rates (no business cycles)                      |
|  - No feedback loops (GDP doesn't feed back to TFP)              |
|  - Data suppression in small states                                |
|  - Supply-side only (no demand modeling)                           |
|                                                                    |
+------------------------------------------------------------------+
|  CTA: "Configure Parameters and Run Your Forecast ->"             |
+------------------------------------------------------------------+
|  FOOTER                                                            |
+------------------------------------------------------------------+
```

#### Component Hierarchy

```
ModelDescriptionPage (Server Component)
  +-- PageHeader
  +-- HeroSection
  +-- OverviewSection
  +-- ProductionFunctionSection
  |     +-- KaTeXEquation (Client Component for interactivity)
  |     +-- TermExplanation x 4 (Y, A, K, L)
  +-- ComponentModelsSection
  |     +-- ComponentCard (TFP)
  |     +-- ComponentCard (Capital)
  |     +-- ComponentCard (Labor)
  +-- IndustryHierarchySection
  |     +-- IndustryTreeDiagram
  +-- PopulationModelSection
  +-- ScenariosSection
  |     +-- ScenarioComparisonTable
  +-- LimitationsSection
  +-- CTASection
  +-- PageFooter
```

#### Technical Notes
- This page should be a **Server Component** (static content, no client-side state)
- KaTeX CSS and fonts loaded via Next.js `<Head>` or layout metadata
- Responsive: single-column on mobile, multi-column cards on desktop
- Use `prose` Tailwind class for readable typography
- Estimated content: ~2,000-3,000 words

### 4.2 Page 2: Parameter Configuration

**URL**: `/configure`

**Purpose**: Allow users to set every model parameter via an intuitive, well-organized form, then submit the forecast for computation.

#### Layout

```
+------------------------------------------------------------------+
|  HEADER: Navigation                                                |
+------------------------------------------------------------------+
|                                                                    |
|  Page Title: "Configure Forecast Parameters"                       |
|  Subtitle: "Adjust assumptions to create your scenario"            |
|                                                                    |
|  +---Top Bar---------------------------------------------------+  |
|  | Scenario Selector: [Baseline v] [High Growth] [Low] [AI Boom]| |
|  | [Reset to Defaults]                      [Run Forecast ->]   | |
|  +-------------------------------------------------------------+  |
|                                                                    |
|  +---Accordion Section 1: Forecast Horizon---(expanded)--------+  |
|  |                                                              |  |
|  |  Start Quarter:  [2025:Q4 v]                                |  |
|  |  End Year:       [====O==========] 2050                     |  |
|  |                  2030        2075   ^input                   |  |
|  +-------------------------------------------------------------+  |
|                                                                    |
|  +---Accordion Section 2: Production Function---(expanded)-----+  |
|  |                                                              |  |
|  |  Capital Share (alpha):  [====O======] 0.30                 |  |
|  |                          0.10     0.60  ^input               |  |
|  |  Info tooltip: "CBO uses 0.30. Higher = investment           |  |
|  |  matters more for growth."                                   |  |
|  |                                                              |  |
|  |  Depreciation Rate:     [===O=======] 0.05 (5.0%)          |  |
|  |                          0.01    0.15                        |  |
|  +-------------------------------------------------------------+  |
|                                                                    |
|  +---Accordion Section 3: TFP (Total Factor Productivity)------+  |
|  |                                                              |  |
|  |  National TFP Growth:   [=====O=====] 0.010 (1.0%)         |  |
|  |                         -0.01    0.05                        |  |
|  |  Convergence Rate:      [==O========] 0.02                  |  |
|  |                          0.0     0.10                        |  |
|  |                                                              |  |
|  |  [v] Industry-Specific TFP Overrides (click to expand)      |  |
|  |  +--------------------------------------------------------+ |  |
|  |  | Industry                              | TFP Rate       | |  |
|  |  |---------------------------------------|----------------| |  |
|  |  | Information                           | [0.020] (2.0%) | |  |
|  |  | Prof, scientific, technical services  | [0.015] (1.5%) | |  |
|  |  | Finance and insurance                 | [0.012] (1.2%) | |  |
|  |  | ... (all 23 industries)               | [    ]         | |  |
|  |  +--------------------------------------------------------+ |  |
|  |                                                              |  |
|  |  [v] State-Specific TFP Overrides (click to expand)         |  |
|  |  +--------------------------------------------------------+ |  |
|  |  | [+ Add state override]                                  | |  |
|  |  | State            | TFP Rate                             | |  |
|  |  | [Select state v] | [0.015]                              | |  |
|  |  +--------------------------------------------------------+ |  |
|  +-------------------------------------------------------------+  |
|                                                                    |
|  +---Accordion Section 4: Capital & Investment-----------------+  |
|  |                                                              |  |
|  |  Investment/GDP Ratio:  [====O======] 0.20 (20%)           |  |
|  |  Capital/Output Ratio:  [=====O=====] 3.0                  |  |
|  |  CapEx Growth Adj:      [=====O=====] 0.0                  |  |
|  |                                                              |  |
|  |  Implied Capital Growth: 1.67% per year  (computed live)    |  |
|  |                                                              |  |
|  |  [v] Industry-Specific Capital Overrides                     |  |
|  |  (table with investment_ratio and alpha per industry)        |  |
|  +-------------------------------------------------------------+  |
|                                                                    |
|  +---Accordion Section 5: Labor Force--------------------------+  |
|  |  LFPR Trend:             [====O=====] -0.001 (-0.1%/yr)    |  |
|  |  Working-Age Share Trend: [===O=====] -0.002 (-0.2%/yr)    |  |
|  |  Natural Unemployment:    [====O====]  0.04  (4.0%)        |  |
|  |  Hours Growth:            [=====O===]  0.0                  |  |
|  |                                                              |  |
|  |  Implied Labor Growth (excl. pop): -0.3% per year           |  |
|  +-------------------------------------------------------------+  |
|                                                                    |
|  +---Accordion Section 6: Population--------------------------+   |
|  |  Fit Start Year:        [====O======] 2000                  |  |
|  |  National Growth Target: [disabled / null] [enable toggle]  |  |
|  |                                                              |  |
|  |  [v] State-Specific Population Overrides                     |  |
|  |  (table: add/remove state overrides)                         |  |
|  +-------------------------------------------------------------+  |
|                                                                    |
|  +---Accordion Section 7: Industry Structural Shifts-----------+  |
|  |  [x] Enable Structural Shifts                                |  |
|  |                                                              |  |
|  |  +--------------------------------------------------------+ |  |
|  |  | Industry                              | Shift Rate     | |  |
|  |  | Information                           | [+0.002]       | |  |
|  |  | Manufacturing                        | [-0.0015]      | |  |
|  |  | ... (industries with nonzero shifts)  | [    ]         | |  |
|  |  +--------------------------------------------------------+ |  |
|  +-------------------------------------------------------------+  |
|                                                                    |
|  +---Sticky Bottom Bar-----------------------------------------+  |
|  | Changes: 3 parameters modified                               |  |
|  | [Reset All]                              [Run Forecast ->]  |  |
|  +-------------------------------------------------------------+  |
|                                                                    |
+------------------------------------------------------------------+
```

#### Component Hierarchy

```
ConfigurePage (Client Component)
  +-- PageHeader
  +-- ScenarioSelector
  |     +-- ScenarioButton x 4 (baseline, high_growth, low_growth, ai_boom)
  |     +-- ResetButton
  +-- ConfigForm (React Hook Form provider)
  |     +-- AccordionGroup (shadcn Accordion, multiple open)
  |     |     +-- ForecastHorizonSection
  |     |     |     +-- QuarterSelect
  |     |     |     +-- SliderWithInput (end_year)
  |     |     +-- ProductionFunctionSection
  |     |     |     +-- SliderWithInput (alpha)
  |     |     |     +-- SliderWithInput (depreciation_rate)
  |     |     |     +-- ComputedValue (implied growth display)
  |     |     +-- TFPSection
  |     |     |     +-- SliderWithInput (national_growth_rate)
  |     |     |     +-- SliderWithInput (convergence_rate)
  |     |     |     +-- CollapsibleSubsection (by_industry)
  |     |     |     |     +-- IndustryParameterTable
  |     |     |     |           +-- IndustryRow x 23 (industry name + input)
  |     |     |     +-- CollapsibleSubsection (by_state)
  |     |     |           +-- DynamicOverrideTable
  |     |     |                 +-- AddOverrideRow
  |     |     |                 +-- OverrideRow x N (state select + input)
  |     |     +-- CapitalSection
  |     |     |     +-- SliderWithInput x 3 (inv ratio, K/Y ratio, capex adj)
  |     |     |     +-- ComputedValue (implied capital growth)
  |     |     |     +-- CollapsibleSubsection (by_industry)
  |     |     |           +-- IndustryCapitalTable
  |     |     |                 +-- IndustryRow x 23 (investment_ratio + alpha)
  |     |     +-- LaborSection
  |     |     |     +-- SliderWithInput x 4
  |     |     |     +-- ComputedValue (implied labor growth excl. population)
  |     |     +-- PopulationSection
  |     |     |     +-- SliderWithInput (fit_start_year)
  |     |     |     +-- ToggleWithInput (national_growth_target)
  |     |     |     +-- CollapsibleSubsection (by_state)
  |     |     |           +-- DynamicOverrideTable
  |     |     +-- IndustryShiftsSection
  |     |           +-- Toggle (structural_shift enabled)
  |     |           +-- ShiftRatesTable (conditional on toggle)
  |     +-- StickyBottomBar
  |           +-- ChangeCounter
  |           +-- ResetButton
  |           +-- RunForecastButton
  +-- RunForecastDialog (loading state with progress)
  |     +-- ProgressBar
  |     +-- StatusText
  |     +-- CancelButton
  +-- PageFooter
```

#### Key UI Patterns

**SliderWithInput**: Every numeric parameter uses a compound control:
```
Label:  [========O=========]  [0.030]  (3.0%)
        ^slider               ^input    ^display
```
- Slider for quick approximate adjustment
- Input field for precise value entry
- Percentage display for rates (auto-computed from decimal)
- Tooltip with description, valid range, and historical context

**Scenario Selector**: Clicking a scenario name loads all its overrides into the form. The form shows which values differ from baseline via a subtle visual indicator (a colored dot or border). Users can further modify values after loading a scenario.

**Computed Values**: Some sections show real-time computed values:
- Capital section: "Implied Capital Growth: (0.20 / 3.0) - 0.05 + 0.0 = 1.67%/yr"
- Labor section: "Implied Labor Growth (excl. population): -0.1% + -0.2% + 0.0% = -0.3%/yr"
These update live as parameters change, giving immediate feedback on the production function math.

**Industry Tables**: For the 23 industries, use a compact table layout with industry names abbreviated for space. Each row has one or two input fields. Industries are grouped by type (capital-intensive, balanced, labor-intensive) with subtle separators matching the config file organization.

### 4.3 Page 3: Results Dashboard

**URL**: `/dashboard` (redirects to `/dashboard?job_id=xxx` after forecast run)

**Purpose**: Display all forecast outputs through interactive charts, summary metrics, and filterable data tables.

#### Layout

```
+------------------------------------------------------------------+
|  HEADER: Navigation                                                |
+------------------------------------------------------------------+
|                                                                    |
|  +---Top Controls----------------------------------------------+  |
|  | Scenario: Baseline (Custom)    Job completed 2m ago          |  |
|  | [Configure Parameters]         [Export All as CSV]           |  |
|  +-------------------------------------------------------------+  |
|                                                                    |
|  +---Summary Metrics Cards (4-column grid)---------------------+  |
|  | US GDP 2050     | US Pop 2050    | US GDP/Cap 2050 | US CAGR |  |
|  | $38.2T          | 370.5M         | $103,100        | 2.1%    |  |
|  | (+58% from 2025)| (+10.5%)       | (+43%)          |         |  |
|  +-------------------------------------------------------------+  |
|                                                                    |
|  +---Tabs: [GDP Trends] [Per Capita] [Industry Mix] [Data]----+  |
|  |                                                              |  |
|  |  TAB 1: GDP Trends                                           |  |
|  |  +---Filters---------------------------------------------+  |  |
|  |  | Area: [United States v]  Metric: [Real GDP v]          |  |  |
|  |  | Industries: [All Industry Total v] [+ Add]             |  |  |
|  |  +-------------------------------------------------------+  |  |
|  |  |                                                        |  |  |
|  |  |  [Line chart: GDP trajectory over time]                |  |  |
|  |  |  X-axis: 2025-2050 (quarterly)                         |  |  |
|  |  |  Y-axis: Real GDP ($ trillions)                        |  |  |
|  |  |  Lines: Selected industries                            |  |  |
|  |  |  [dataZoom slider at bottom for year range selection]   |  |  |
|  |  |                                                        |  |  |
|  |  +-------------------------------------------------------+  |  |
|  |                                                              |  |
|  |  TAB 2: Per Capita GDP (THE KEY CHART)                       |  |
|  |  +---Filters---------------------------------------------+  |  |
|  |  | Area: [United States v] [+ Compare: California]        |  |  |
|  |  | View: [Stacked Area v]  Frequency: [Annual v]          |  |  |
|  |  +-------------------------------------------------------+  |  |
|  |  |                                                        |  |  |
|  |  |  [STACKED AREA CHART: Per Capita GDP by Industry]      |  |  |
|  |  |  X-axis: 2025-2050 (annual)                            |  |  |
|  |  |  Y-axis: GDP per Capita ($)                            |  |  |
|  |  |  23 stacked areas, one per leaf industry               |  |  |
|  |  |  Color-coded by industry group                         |  |  |
|  |  |  Hover: tooltip with industry name + value + %         |  |  |
|  |  |  [dataZoom slider at bottom]                           |  |  |
|  |  |                                                        |  |  |
|  |  +-------------------------------------------------------+  |  |
|  |  |  Legend (scrollable, grouped by type):                 |  |  |
|  |  |  [x] Agriculture  [x] Mining  [x] Utilities  ...      |  |  |
|  |  +-------------------------------------------------------+  |  |
|  |                                                              |  |
|  |  TAB 3: Industry Mix & CAGR                                  |  |
|  |  +---Sub-tabs: [CAGR by State] [CAGR by Industry] [Mix]--+  |  |
|  |  |                                                        |  |  |
|  |  |  CAGR by State:                                        |  |  |
|  |  |  +--Sortable Table-----------------------------------+ |  |  |
|  |  |  | State        | 2050 GDP | GDP/Cap | CAGR  | Pop   | |  |  |
|  |  |  | California   | $5.2T    | $110K   | 2.3%  | 47.2M | |  |  |
|  |  |  | Texas        | $4.1T    | $98K    | 2.5%  | 41.8M | |  |  |
|  |  |  | ...          |          |         |       |       | |  |  |
|  |  |  +-------------------------------------------------- + |  |  |
|  |  |                                                        |  |  |
|  |  |  CAGR by Industry (US level):                          |  |  |
|  |  |  +--Horizontal Bar Chart-----------------------------+ |  |  |
|  |  |  | Information           ============================| |  |  |
|  |  |  | Prof/Tech Services    =======================     | |  |  |
|  |  |  | Finance & Insurance   ====================        | |  |  |
|  |  |  | ...                                               | |  |  |
|  |  |  | Mining                =====                       | |  |  |
|  |  |  +---------------------------------------------------+ |  |  |
|  |  |                                                        |  |  |
|  |  |  Industry Mix (Pie/Donut):                             |  |  |
|  |  |  State: [United States v]   Year: [2025] [2050]       |  |  |
|  |  |  [Pie chart showing industry shares side by side]      |  |  |
|  |  +-------------------------------------------------------+  |  |
|  |                                                              |  |
|  |  TAB 4: Data Explorer                                        |  |
|  |  +---Filters---------------------------------------------+  |  |
|  |  | Dataset: [GDP by State-Industry v]                     |  |  |
|  |  | State: [All v]  Industry: [All v]  Year: [All v]      |  |  |
|  |  | [Search...]                        [Export CSV]        |  |  |
|  |  +-------------------------------------------------------+  |  |
|  |  |                                                        |  |  |
|  |  |  [TanStack Table with virtual scrolling]               |  |  |
|  |  |  Columns: quarter | state | industry | real_gdp |      |  |  |
|  |  |  Pagination: showing 1-100 of 141,804                 |  |  |
|  |  |  [< 1 2 3 ... 1418 >]                                 |  |  |
|  |  |                                                        |  |  |
|  |  +-------------------------------------------------------+  |  |
|  +-------------------------------------------------------------+  |
|                                                                    |
+------------------------------------------------------------------+
```

#### Component Hierarchy

```
DashboardPage (Client Component)
  +-- PageHeader
  +-- TopControls
  |     +-- ScenarioLabel
  |     +-- ConfigureButton (link to /configure)
  |     +-- ExportButton
  +-- SummaryMetricsGrid
  |     +-- MetricCard x 4 (GDP, Population, GDP/Cap, CAGR)
  +-- DashboardTabs (shadcn Tabs)
  |     +-- GDPTrendsTab
  |     |     +-- AreaFilterBar
  |     |     |     +-- StateSelect
  |     |     |     +-- IndustryMultiSelect
  |     |     +-- LineChart (ECharts)
  |     +-- PerCapitaTab
  |     |     +-- AreaFilterBar
  |     |     |     +-- StateSelect
  |     |     |     +-- CompareStateSelect
  |     |     |     +-- ViewModeSelect (stacked/line)
  |     |     |     +-- FrequencySelect (annual/quarterly)
  |     |     +-- StackedAreaChart (ECharts - THE KEY CHART)
  |     |     +-- IndustryLegend (scrollable, grouped)
  |     +-- IndustryMixTab
  |     |     +-- SubTabs
  |     |     |     +-- CAGRByStateTable (TanStack Table, sortable)
  |     |     |     +-- CAGRByIndustryChart (ECharts horizontal bar)
  |     |     |     +-- IndustryMixComparison
  |     |     |           +-- YearSelector
  |     |     |           +-- PieChart x 2 (start year vs end year)
  |     +-- DataExplorerTab
  |           +-- DatasetSelector
  |           +-- FilterBar
  |           |     +-- StateFilter
  |           |     +-- IndustryFilter
  |           |     +-- YearRangeFilter
  |           |     +-- SearchInput
  |           +-- DataTable (TanStack Table + shadcn)
  |           |     +-- VirtualizedRows
  |           |     +-- SortableHeaders
  |           |     +-- Pagination
  |           +-- ExportCSVButton
  +-- PageFooter
```

#### The Stacked Per Capita GDP Chart (Detailed Specification)

This is the most important visualization. Detailed specification:

**Chart Type**: ECharts stacked area chart (line series with `areaStyle` and `stack`)

**Data Shape** (per area selection):
- X-axis: 26 annual data points (2025-2050)
- Y-axis: GDP per capita in dollars
- Series: 23 leaf industries, each showing per-capita contribution
- Total height of stack = total GDP per capita for that state/year

**Color Scheme**: A carefully chosen 23-color palette grouped by industry category:
```
Capital-intensive (warm tones):
  Real estate         - #B71C1C (deep red)
  Utilities           - #D32F2F (red)
  Mining              - #E53935 (light red)
  Manufacturing (D)   - #F4511E (red-orange)
  Manufacturing (ND)  - #FF7043 (salmon)
  Agriculture         - #FF8A65 (peach)

Knowledge/Tech (blues):
  Information         - #0D47A1 (deep blue)
  Prof/Tech Services  - #1565C0 (blue)
  Finance & Insurance - #1976D2 (medium blue)
  Management          - #42A5F5 (light blue)

Services (greens):
  Health care         - #1B5E20 (deep green)
  Education           - #2E7D32 (green)
  Admin/Support       - #43A047 (medium green)
  Accommodation/Food  - #66BB6A (light green)
  Retail trade        - #81C784 (pale green)
  Wholesale trade     - #A5D6A7 (very light green)

Other (neutrals/purples):
  Construction        - #4A148C (deep purple)
  Transportation      - #6A1B9A (purple)
  Arts/Entertainment  - #7B1FA2 (medium purple)
  Other services      - #9C27B0 (light purple)

Government (grays):
  Federal civilian    - #37474F (dark gray)
  Military            - #546E7A (medium gray)
  State and local     - #78909C (light gray)
```

**Interactivity**:
- **Hover tooltip**: Shows industry name, per-capita value, and percentage of total for that year
- **Legend click**: Toggle individual industries on/off (useful to focus on specific sectors)
- **DataZoom**: Slider below chart to select year range
- **Toolbox**: Save as image, data view, zoom/restore
- **Area selector dropdown**: Switch between US total and any state

**Responsive behavior**:
- Desktop (>1024px): Full chart with legend on right side
- Tablet (768-1024px): Chart with legend below
- Mobile (<768px): Chart takes full width, legend in a collapsible accordion, dataZoom touch-enabled

**ECharts Configuration Example**:
```typescript
const option: EChartsOption = {
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'cross' },
    formatter: (params) => {
      // Custom tooltip showing all industries with values and percentages
    }
  },
  legend: {
    type: 'scroll',
    orient: 'vertical',
    right: 0,
    top: 20,
    bottom: 20,
  },
  grid: { left: 80, right: 200, top: 60, bottom: 80 },
  xAxis: { type: 'category', data: years, boundaryGap: false },
  yAxis: {
    type: 'value',
    axisLabel: { formatter: '${value}' },
    name: 'GDP per Capita ($)',
  },
  dataZoom: [
    { type: 'slider', xAxisIndex: 0, bottom: 10 },
    { type: 'inside', xAxisIndex: 0 },
  ],
  series: LEAF_INDUSTRIES.map((industry, i) => ({
    name: industry,
    type: 'line',
    stack: 'total',
    areaStyle: { opacity: 0.8 },
    emphasis: { focus: 'series' },
    data: getIndustryData(industry),
    itemStyle: { color: INDUSTRY_COLORS[industry] },
  })),
};
```

---

## 5. Data Pipeline

### 5.1 Data Flow: End to End

```
[User configures params]
        |
        v
[POST /forecast/run] -- config JSON -->
        |
        v
[FastAPI validates with Pydantic]
        |
        v
[Enqueue RQ job]
        |
        v
[RQ Worker picks up job]
        |
        v
[Python model executes (~14s)]
  - load_gdp_data()
  - load_population_data()
  - forecast_population()
  - run_gdp_forecast()
  - compute_gdp_per_capita()
  - compute CAGR values
        |
        v
[Worker stores results in Redis]
  - Summary metrics (JSON, ~5KB)
  - GDP per capita by state-industry-year (JSON, ~3MB)
  - CAGR tables (JSON, ~50KB)
  - Full GDP forecast (JSON, ~15MB, compressed)
  - Population forecast (JSON, ~500KB)
        |
        v
[Frontend polls for completion]
        |
        v
[Frontend requests chart-specific data]
  - GET /results/{id}/charts/stacked-gdp-per-capita?state=US
  - GET /results/{id}/charts/cagr-by-state
  - GET /results/{id}/tables/gdp?state=CA&page=1
        |
        v
[FastAPI serves from Redis cache]
  - Transforms DataFrames to chart-ready JSON
  - Paginates table data
  - Returns compressed JSON responses
```

### 5.2 Result Storage in Redis

Results are stored in Redis with a TTL of 1 hour (configurable). Key structure:

```
forecast:{job_id}:status        -> "completed"
forecast:{job_id}:config        -> {original config JSON}
forecast:{job_id}:summary       -> {US GDP/pop/CAGR summary}
forecast:{job_id}:gdp_pc        -> {GDP per capita DataFrame as JSON}
forecast:{job_id}:cagr_state    -> {CAGR by state table}
forecast:{job_id}:cagr_industry -> {CAGR by industry table}
forecast:{job_id}:gdp_full      -> {compressed full GDP DataFrame}
forecast:{job_id}:pop           -> {population forecast DataFrame}
```

### 5.3 Chart Data Transformations

The Python model outputs DataFrames. The FastAPI backend transforms these into chart-ready JSON before sending to the frontend. Key transformations:

**Stacked Per Capita GDP Chart**:
```python
# Input: gdp_per_capita DataFrame (36K rows, all states, all industries, annual)
# Filter: one state, leaf industries only
# Output: { years: [2025,...,2050], series: { "Information": [4500, 4600, ...], ... } }

def get_stacked_gdp_per_capita(results, state: str) -> dict:
    df = results['gdp_pc']
    state_df = df[(df['state'] == state) & (df['industry'].isin(LEAF_INDUSTRIES))]
    pivot = state_df.pivot_table(
        index='year', columns='industry', values='gdp_per_capita', aggfunc='first'
    )
    return {
        'years': pivot.index.tolist(),
        'series': {col: pivot[col].tolist() for col in LEAF_INDUSTRIES if col in pivot.columns}
    }
```

**CAGR by State**:
```python
# Input: GDP per capita DataFrame
# Output: { state: str, gdp_2050: float, gdp_pc_2050: float, cagr: float, pop_2050: float }[]

def compute_cagr_by_state(results) -> list[dict]:
    df = results['gdp_pc']
    all_ind = df[df['industry'] == 'All industry total']
    first_year = all_ind['year'].min()
    last_year = all_ind['year'].max()

    cagr_rows = []
    for state in all_ind['state'].unique():
        start = all_ind[(all_ind['state'] == state) & (all_ind['year'] == first_year)]
        end = all_ind[(all_ind['state'] == state) & (all_ind['year'] == last_year)]
        if len(start) > 0 and len(end) > 0:
            n_years = last_year - first_year
            cagr = (end.iloc[0]['real_gdp'] / start.iloc[0]['real_gdp']) ** (1/n_years) - 1
            cagr_rows.append({
                'state': state,
                'gdp_2050': end.iloc[0]['real_gdp'],
                'gdp_per_capita_2050': end.iloc[0]['gdp_per_capita'],
                'cagr': cagr,
                'population_2050': end.iloc[0]['population'],
            })
    return sorted(cagr_rows, key=lambda x: x['cagr'], reverse=True)
```

### 5.4 Caching Strategy

**Level 1 -- Redis (Server-side)**:
- Full model results cached for 1 hour after computation
- Identical config submissions return cached results (config hash as lookup key)

**Level 2 -- TanStack Query (Client-side)**:
- Chart data cached in browser memory for the session
- `staleTime: Infinity` for completed forecast results (they don't change)
- Automatic garbage collection of old queries

**Level 3 -- Pre-computed defaults**:
- On application startup, run the baseline scenario and cache results
- First-time visitors see instant results without waiting 14 seconds
- Optionally pre-compute all 4 built-in scenarios

---

## 6. File and Folder Structure

```
Long-Term GDP Forecast/
|
|-- config/
|   |-- forecast_config.yaml          # (existing) Default model parameters
|
|-- data/
|   |-- real_gdp.csv                  # (existing, moved from root) BEA GDP data
|   |-- population.csv                # (existing, moved from root) Census population data
|
|-- src/                              # (existing) Python forecast engine
|   |-- __init__.py
|   |-- utils.py
|   |-- data_loader.py
|   |-- historical_analysis.py
|   |-- population_forecast.py
|   |-- labor_forecast.py
|   |-- capital_forecast.py
|   |-- tfp_forecast.py
|   |-- gdp_forecast.py
|   |-- gdp_per_capita.py
|   |-- scenarios.py
|
|-- api/                              # NEW: FastAPI backend
|   |-- __init__.py
|   |-- main.py                       # FastAPI app, CORS, lifespan
|   |-- config.py                     # API settings (Redis URL, origins, etc.)
|   |-- models/                       # Pydantic request/response models
|   |   |-- __init__.py
|   |   |-- forecast.py               # ForecastRequest, ForecastResult, etc.
|   |   |-- config_models.py          # TFPConfig, CapitalConfig, etc.
|   |   |-- responses.py              # JobStatus, ChartData, etc.
|   |-- routers/
|   |   |-- __init__.py
|   |   |-- forecast.py               # POST /forecast/run, GET /status, GET /results
|   |   |-- config_router.py          # GET /config/defaults, /scenarios
|   |   |-- data.py                   # GET /data/states, /industries, /historical
|   |   |-- charts.py                 # GET /results/{id}/charts/*
|   |-- services/
|   |   |-- __init__.py
|   |   |-- forecast_service.py       # Orchestrates model run, wraps existing src/
|   |   |-- result_service.py         # Retrieves/transforms cached results
|   |   |-- cache_service.py          # Redis get/set/hash operations
|   |-- workers/
|   |   |-- __init__.py
|   |   |-- forecast_worker.py        # RQ job function: runs the model
|   |-- transformers/
|       |-- __init__.py
|       |-- chart_data.py             # DataFrame -> chart JSON transformations
|       |-- table_data.py             # DataFrame -> paginated table JSON
|       |-- cagr.py                   # CAGR computation from results
|
|-- web/                              # NEW: Next.js frontend
|   |-- package.json
|   |-- tsconfig.json
|   |-- tailwind.config.ts
|   |-- next.config.ts
|   |-- postcss.config.mjs
|   |
|   |-- app/
|   |   |-- layout.tsx                # Root layout (nav, footer, fonts, metadata)
|   |   |-- page.tsx                  # Page 1: Model Description (Server Component)
|   |   |-- configure/
|   |   |   |-- page.tsx              # Page 2: Parameter Configuration
|   |   |-- dashboard/
|   |   |   |-- page.tsx              # Page 3: Results Dashboard
|   |   |-- api/                      # Next.js API route handlers (proxy to FastAPI)
|   |       |-- forecast/
|   |       |   |-- run/route.ts
|   |       |   |-- status/[jobId]/route.ts
|   |       |   |-- results/[jobId]/route.ts
|   |       |-- config/
|   |           |-- defaults/route.ts
|   |           |-- scenarios/route.ts
|   |
|   |-- components/
|   |   |-- ui/                       # shadcn/ui components (auto-generated)
|   |   |   |-- accordion.tsx
|   |   |   |-- button.tsx
|   |   |   |-- card.tsx
|   |   |   |-- input.tsx
|   |   |   |-- select.tsx
|   |   |   |-- slider.tsx
|   |   |   |-- table.tsx
|   |   |   |-- tabs.tsx
|   |   |   |-- toast.tsx
|   |   |   |-- skeleton.tsx
|   |   |   |-- ... (other shadcn components)
|   |   |
|   |   |-- layout/
|   |   |   |-- navigation.tsx        # Top navigation bar
|   |   |   |-- footer.tsx
|   |   |   |-- page-header.tsx
|   |   |
|   |   |-- model-description/       # Page 1 components
|   |   |   |-- hero-section.tsx
|   |   |   |-- equation-display.tsx   # KaTeX wrapper
|   |   |   |-- component-card.tsx
|   |   |   |-- industry-tree.tsx
|   |   |   |-- scenario-table.tsx
|   |   |
|   |   |-- configure/               # Page 2 components
|   |   |   |-- scenario-selector.tsx
|   |   |   |-- config-form.tsx        # React Hook Form provider
|   |   |   |-- slider-with-input.tsx  # Compound slider+input control
|   |   |   |-- industry-parameter-table.tsx
|   |   |   |-- dynamic-override-table.tsx
|   |   |   |-- computed-value.tsx
|   |   |   |-- section-tfp.tsx
|   |   |   |-- section-capital.tsx
|   |   |   |-- section-labor.tsx
|   |   |   |-- section-population.tsx
|   |   |   |-- section-industry.tsx
|   |   |   |-- section-horizon.tsx
|   |   |   |-- section-production-fn.tsx
|   |   |   |-- sticky-bottom-bar.tsx
|   |   |   |-- run-forecast-dialog.tsx
|   |   |
|   |   |-- dashboard/               # Page 3 components
|   |   |   |-- summary-metrics.tsx
|   |   |   |-- gdp-trends-chart.tsx
|   |   |   |-- stacked-gdp-per-capita-chart.tsx  # THE KEY CHART
|   |   |   |-- cagr-state-table.tsx
|   |   |   |-- cagr-industry-chart.tsx
|   |   |   |-- industry-mix-comparison.tsx
|   |   |   |-- data-explorer.tsx
|   |   |   |-- area-filter-bar.tsx
|   |   |   |-- industry-legend.tsx
|   |   |
|   |   |-- charts/                   # Shared chart components
|   |       |-- echarts-wrapper.tsx    # Base ECharts React wrapper
|   |       |-- chart-colors.ts       # Industry color palette
|   |       |-- chart-utils.ts        # Formatters, tooltip builders
|   |
|   |-- lib/
|   |   |-- api-client.ts            # Typed API client (fetch wrapper)
|   |   |-- types.ts                  # TypeScript interfaces matching Pydantic models
|   |   |-- constants.ts              # Industry lists, state lists, color maps
|   |   |-- formatters.ts            # Number/currency/percentage formatters
|   |   |-- hooks/
|   |       |-- use-forecast.ts       # TanStack Query hooks for forecast operations
|   |       |-- use-config.ts         # Hooks for config defaults and scenarios
|   |       |-- use-chart-data.ts     # Hooks for chart-specific data
|   |
|   |-- public/
|       |-- favicon.ico
|       |-- og-image.png              # Open Graph image for social sharing
|
|-- docker/                           # NEW: Deployment configuration
|   |-- docker-compose.yml
|   |-- Dockerfile.api                # FastAPI + Python dependencies
|   |-- Dockerfile.web                # Next.js build
|   |-- nginx.conf                    # Nginx reverse proxy config
|
|-- main.py                           # (existing) CLI entry point (preserved)
|-- requirements.txt                  # (existing) Python CLI dependencies
|-- requirements-api.txt              # NEW: Additional API dependencies
|-- CLAUDE.md                         # (existing)
|-- WEBSITE_IMPLEMENTATION_PLAN.md    # (this file)
```

---

## 7. Implementation Phases

### Phase 1: Foundation (Estimated: 5-7 days)

**Objective**: Set up the project skeleton, backend API, and verify the Python model can be called from a web context.

**Tasks**:

1.1. **Initialize Next.js project** in `web/` directory
   - `npx create-next-app@latest web --typescript --tailwind --eslint --app --src-dir=false`
   - Install shadcn/ui: `npx shadcn@latest init`
   - Install core shadcn components: button, card, input, tabs, accordion, select, slider, table, toast, skeleton, dialog, sheet
   - Configure `next.config.ts` with API rewrites to FastAPI

1.2. **Initialize FastAPI project** in `api/` directory
   - Create FastAPI app with CORS middleware
   - Define Pydantic models matching the config YAML structure
   - Implement `GET /config/defaults` (reads and returns the YAML config)
   - Implement `GET /data/states` and `GET /data/industries`

1.3. **Set up Redis + RQ**
   - Add Redis to Docker setup (or use local Redis for development)
   - Create the RQ forecast worker that calls existing `src/` modules
   - Implement `POST /forecast/run` (enqueues job, returns job_id)
   - Implement `GET /forecast/status/{job_id}` (polls RQ job status)
   - Test: submit a forecast via curl, poll until complete, verify results in Redis

1.4. **Create shared layout** in Next.js
   - Navigation component with 3 page links
   - Footer component
   - Root layout with fonts (Inter or Geist), metadata, Tailwind

1.5. **Docker Compose for development**
   - `docker-compose.dev.yml` with hot-reload for both Next.js and FastAPI
   - Redis container
   - Volume mounts for source code

**Deliverables**: Working API that can run forecasts via HTTP. Navigable Next.js shell. Docker dev environment.

**Validation**: Run `POST /forecast/run` with baseline config, poll until complete, retrieve results.

**Risk**: Redis/RQ configuration on Windows for development. Mitigation: Use Docker for Redis from the start.

---

### Phase 2: Model Description Page (Estimated: 3-4 days)

**Objective**: Build the complete model description page with mathematical equations and economic explanations.

**Tasks**:

2.1. **Install and configure KaTeX**
   - `npm install katex react-katex`
   - Import KaTeX CSS in root layout
   - Create `EquationDisplay` component wrapping `react-katex`

2.2. **Write content sections**
   - Overview section
   - Production function section with KaTeX equations
   - Component model cards (TFP, Capital, Labor)
   - Industry hierarchy tree diagram
   - Population model section
   - Scenarios comparison table
   - Limitations section

2.3. **Style and responsive design**
   - Tailwind `prose` class for body text
   - Responsive grid for component cards (3-col desktop, 1-col mobile)
   - Anchor links in sidebar navigation (optional, for long page)
   - Smooth scroll behavior

2.4. **CTA section**
   - "Configure Parameters" button linking to /configure
   - Brief summary of what users can do

**Deliverables**: Complete, polished model description page.

**Validation**: Page renders correctly on desktop and mobile. All equations display properly. Content is accurate and complete.

---

### Phase 3: Parameter Configuration Page (Estimated: 7-10 days)

**Objective**: Build the full parameter configuration form with all YAML sections represented.

This is the most complex page due to the nested form structure and numerous input types.

**Tasks**:

3.1. **Set up React Hook Form + Zod**
   - Define Zod schema matching ForecastRequest Pydantic model
   - Initialize form with defaults from `GET /config/defaults`
   - Create form context provider

3.2. **Build the SliderWithInput compound component**
   - shadcn Slider + Input in a horizontal layout
   - Bidirectional binding (slider updates input, input updates slider)
   - Label, description tooltip, valid range enforcement
   - Percentage display for rate values
   - Unit testing for edge cases (min/max bounds, decimal precision)

3.3. **Build accordion sections** (one at a time):
   - 3.3a. Forecast Horizon section
   - 3.3b. Production Function section (with implied growth display)
   - 3.3c. TFP section (national rate + industry table + state overrides)
   - 3.3d. Capital section (global params + industry table with 2 columns)
   - 3.3e. Labor section (4 sliders + implied growth)
   - 3.3f. Population section (fit year + growth target toggle + state overrides)
   - 3.3g. Industry Shifts section (toggle + shift rates table)

3.4. **Build the Scenario Selector**
   - Fetch scenarios from `GET /config/scenarios`
   - Click scenario -> populate form with scenario overrides
   - Visual diff indicators (highlight modified values)
   - Reset to Defaults button

3.5. **Build the IndustryParameterTable component**
   - Reusable table for industry-level overrides
   - Used in TFP, Capital, and Industry Shifts sections
   - Compact layout with industry names and 1-2 input columns
   - Grouping by industry type with subtle separators

3.6. **Build the DynamicOverrideTable component**
   - Used for state-specific TFP and population overrides
   - Add/remove rows with state selector + value input
   - State selector excludes already-added states

3.7. **Build Run Forecast flow**
   - Sticky bottom bar with Run button and change counter
   - Run Forecast Dialog with progress bar
   - Submit config to `POST /forecast/run`
   - Poll status with progress display
   - On completion, redirect to `/dashboard?job_id=xxx`

3.8. **Form validation and error handling**
   - Zod validation on submit
   - Inline error messages for out-of-range values
   - API-level validation via `POST /config/validate`

**Deliverables**: Fully functional parameter configuration page with all sections.

**Validation**: Load each scenario, verify form populates correctly. Modify parameters, run forecast, verify job completes. Test edge cases (extreme values, empty overrides, all overrides filled).

---

### Phase 4: Results Dashboard -- Charts (Estimated: 8-10 days)

**Objective**: Build the dashboard page with all chart visualizations.

**Tasks**:

4.1. **Install and configure ECharts**
   - `npm install echarts echarts-for-react`
   - Create tree-shaken ECharts setup (import only needed modules)
   - Create base `EChartsWrapper` component with responsive sizing, loading state, and error boundary

4.2. **Build chart data API endpoints** (FastAPI side)
   - `GET /results/{id}/charts/stacked-gdp-per-capita?state=...`
   - `GET /results/{id}/charts/gdp-trends?state=...&industries=...`
   - `GET /results/{id}/charts/cagr-by-state`
   - `GET /results/{id}/charts/cagr-by-industry`
   - `GET /results/{id}/charts/industry-mix?state=...&year=...`
   - Unit tests for each transformer

4.3. **Build Summary Metrics cards**
   - 4 cards: US GDP 2050, US Population 2050, GDP per Capita 2050, US CAGR
   - Each with value + change from 2025
   - Skeleton loading state

4.4. **Build the Stacked Per Capita GDP chart** (THE KEY CHART)
   - ECharts stacked area configuration
   - 23-color industry palette
   - State selector dropdown
   - Custom tooltip (industry, value, percentage)
   - DataZoom slider
   - Legend with toggle
   - Responsive: legend position changes by viewport
   - Performance testing with all 52 areas

4.5. **Build the GDP Trends line chart**
   - Multi-line chart for selected industries
   - State selector
   - Industry multi-select
   - DataZoom

4.6. **Build the CAGR by Industry horizontal bar chart**
   - Sorted horizontal bars
   - Color-coded by industry group
   - Value labels on bars

4.7. **Build the Industry Mix comparison** (pie/donut charts)
   - Side-by-side pie charts for start year vs end year
   - State selector
   - Year selector (any year in forecast range)

4.8. **Build the CAGR by State table**
   - TanStack Table with sorting on every column
   - Columns: State, 2050 GDP, GDP/Capita, CAGR, Population
   - Currency and percentage formatters
   - Click row to switch charts to that state

4.9. **Dashboard tab navigation**
   - Tabs component with URL sync (tab selection in URL params)
   - Smooth transitions between tabs
   - Lazy loading of tab content

**Deliverables**: Complete dashboard with all charts working and interactive.

**Validation**: Run baseline forecast, verify all charts render with correct data. Switch states, verify chart updates. Check all CAGR values match CLI output. Test with all 4 scenarios.

---

### Phase 5: Data Explorer and Polish (Estimated: 5-7 days)

**Objective**: Build the data explorer table and polish all pages to production quality.

**Tasks**:

5.1. **Build the Data Explorer tab**
   - Dataset selector (GDP by state-industry, GDP per capita, Population)
   - TanStack Table with server-side pagination
   - Column sorting
   - Filter by state, industry, year range
   - Search across all columns
   - Export filtered data as CSV
   - Virtual scrolling for performance

5.2. **Build paginated API endpoints** (FastAPI side)
   - `GET /results/{id}/tables/gdp?state=...&industry=...&year_min=...&year_max=...&page=1&per_page=100&sort=real_gdp&order=desc`
   - `GET /results/{id}/tables/gdp-per-capita?...`
   - `GET /results/{id}/tables/population?...`
   - `GET /results/{id}/export/csv?dataset=gdp&state=...&industry=...` (full filtered CSV download)

5.3. **Loading states and error handling**
   - Skeleton components for all cards and charts during loading
   - Error boundaries around each chart
   - Toast notifications for API errors
   - Empty states ("No data" for filtered views with no results)
   - 14-second loading experience: progress bar, estimated time, cancel option

5.4. **Responsive design pass**
   - Test all pages at 320px, 768px, 1024px, 1440px widths
   - Fix layout issues
   - Mobile navigation (hamburger menu or bottom nav)
   - Touch-friendly chart interactions

5.5. **Performance optimization**
   - ECharts lazy loading (dynamic import)
   - Next.js Image optimization for any static images
   - Bundle analysis (`next build --analyze`)
   - API response compression (gzip)
   - Redis result compression for large DataFrames

5.6. **Visual polish**
   - Consistent typography scale
   - Color consistency across charts and UI
   - Hover states, focus rings, transitions
   - Dark mode support (optional, but Tailwind makes it easy with shadcn)
   - Favicon and Open Graph metadata

**Deliverables**: Production-ready application with polished UI/UX.

**Validation**: Full user journey test: read model description, configure parameters, run forecast, explore all dashboard tabs. Test on mobile. Verify data accuracy against CLI output for all 4 scenarios.

---

### Phase 6: Deployment and Production Readiness (Estimated: 3-5 days)

**Objective**: Containerize, deploy, and ensure production stability.

**Tasks**:

6.1. **Dockerfiles**
   - `Dockerfile.api`: Python 3.11 + FastAPI + all model dependencies
   - `Dockerfile.web`: Multi-stage Node.js build with standalone output
   - Optimize image sizes (slim base images, multi-stage builds)

6.2. **Docker Compose production config**
   - Nginx reverse proxy with SSL termination
   - Proper healthchecks for all services
   - Restart policies
   - Memory limits
   - Redis persistence configuration

6.3. **Nginx configuration**
   - Route `/` to Next.js (port 3000)
   - Route `/api/backend/` to FastAPI (port 8000)
   - Static file caching headers
   - Gzip compression
   - Rate limiting (prevent abuse of forecast endpoint)

6.4. **Pre-computation on startup**
   - Run baseline scenario on API startup, cache results
   - Optionally pre-compute all 4 built-in scenarios
   - First-time visitors see instant results

6.5. **Monitoring and logging**
   - Structured logging in FastAPI (JSON format)
   - Request ID tracking across services
   - Error alerting (optional: Sentry integration)

6.6. **Security hardening**
   - CORS restricted to application domain
   - Rate limiting on forecast endpoint (prevent resource exhaustion)
   - Input validation (Pydantic + Zod double validation)
   - No sensitive data exposure in API responses

**Deliverables**: Deployable Docker Compose setup. Production-ready configuration.

**Validation**: Deploy on a test server. Run through full user journey. Load test with multiple concurrent forecast requests. Verify containers restart on failure.

---

## 8. Key Technical Decisions

### 8.1 Decision: Separate Backend (FastAPI) vs. Next.js API Routes Only

**Chosen**: Separate FastAPI backend.

**Rationale**: The Python forecast engine cannot run inside Node.js. The alternatives were:
1. **Shell out to Python from Next.js API routes**: Loses type safety, error handling, progress tracking. Subprocess management is brittle.
2. **Compile Python to WASM**: Not feasible with pandas/numpy/scipy dependencies.
3. **Rewrite model in TypeScript**: Enormous effort, loses the existing validated Python code.
4. **Separate Python API server**: Clean separation, same-language integration with model, proper async job handling.

Option 4 is clearly the best. The cost is running two servers, which Docker Compose makes trivial.

### 8.2 Decision: Polling vs. WebSocket vs. Server-Sent Events for Job Status

**Chosen**: Polling.

**Rationale**: For a 14-second job with single-user focus:
- **WebSocket**: More complex, requires persistent connection management. Adds complexity to both frontend and backend for a feature used once per forecast run.
- **SSE (Server-Sent Events)**: Simpler than WebSocket but still requires keeping a connection open. FastAPI SSE support is less mature than REST.
- **Polling**: Simple, reliable, stateless. Poll every 2 seconds for ~7 polls total. TanStack Query has built-in polling support (`refetchInterval`). If the poll fails, just retry.

The 14-second duration does not justify WebSocket complexity. If forecast runtime grew to 5+ minutes or we needed real-time multi-user updates, we would switch to WebSocket or SSE.

### 8.3 Decision: Next.js API Route Proxy vs. Direct Frontend-to-FastAPI

**Chosen**: Next.js API routes proxy to FastAPI.

**Rationale**:
- Avoids CORS complexity (frontend talks to same origin)
- Allows Next.js to add authentication/rate-limiting middleware later
- Single deployment domain (no separate API subdomain needed)
- Next.js can cache/transform responses if needed

The Next.js API routes are thin proxy layers -- they forward the request to FastAPI and return the response. Minimal logic lives here.

### 8.4 Decision: Data Storage (Redis vs. Database vs. Filesystem)

**Chosen**: Redis for result caching, filesystem for raw data (CSV files).

**Rationale**: We do not need a database. The application is:
- **Read-only for source data**: CSV files are loaded at model runtime, never modified.
- **Ephemeral for results**: Forecast results are computed per-request and cached temporarily. No need for persistent storage of results (users can re-run).
- **No user accounts**: No user data to persist.

Redis provides fast key-value storage for cached results with automatic TTL expiration. If results needed to persist across server restarts, we would add Redis persistence (RDB/AOF) or switch to a database, but for this application, ephemeral caching is sufficient.

### 8.5 Decision: Annual vs. Quarterly Data for Charts

**Chosen**: Annual by default, quarterly available for detailed view.

**Rationale**: The stacked area chart with 23 series at quarterly frequency would have 23 x 100 = 2,300 data points. At annual frequency, it's 23 x 26 = 598 data points. The annual view is cleaner visually and faster to render. Users who need quarterly detail can access it in the Data Explorer tab or switch the chart to quarterly mode.

### 8.6 Decision: Color Palette for 23 Industries

**Chosen**: Grouped categorical palette (described in Section 4.3).

**Rationale**: With 23 series, a standard categorical palette (like D3's Category10 or Category20) would have many similar colors. Instead, we group industries into 5 categories and use different hue ranges for each group:
- Capital-intensive: Warm reds/oranges
- Knowledge/Tech: Blues
- Services: Greens
- Other: Purples
- Government: Grays

Within each group, industries are differentiated by lightness. This makes it possible to visually identify industry groups even without reading the legend.

---

## 9. Risk Analysis

### 9.1 Known Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ECharts stacked area chart too slow with 23 series | Low | High | Canvas renderer is fast; test early with real data in Phase 4. Fallback: reduce to top 10 industries + "Other". |
| 14-second model runtime causes poor UX | Medium | Medium | Progress bar, pre-computed baseline, async job queue. Consider model optimization (vectorize, reduce IO). |
| Redis memory usage with large results | Low | Medium | Compress results (zlib), set TTL to 1 hour, limit concurrent cached results. |
| React Hook Form struggles with deeply nested config | Low | Medium | Flatten the form structure if needed; use controlled components for complex sections. |
| ECharts `echarts-for-react` wrapper lacks features | Low | Low | Create custom wrapper using `echarts` core directly if needed. |

### 9.2 Probable Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Mobile experience is degraded for complex charts | High | Medium | Accept that stacked 23-series charts are best on desktop. Provide simplified mobile views (top 5 industries, table view). |
| Config form is overwhelming for non-expert users | Medium | Medium | Clear defaults, tooltips, scenario presets, "Advanced" collapsible sections. Most users will just pick a scenario and run. |
| Color palette for 23 industries is hard to distinguish | Medium | Medium | Grouped palette helps. Interactive legend toggle helps. Tooltip on hover provides definitive identification. |

### 9.3 Tail Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Python model produces incorrect results when called from API vs CLI | Very Low | Very High | Unit tests comparing API output to CLI output for all 4 scenarios. |
| Redis crashes during forecast run, losing results | Very Low | Low | Retry the job. Redis AOF persistence as optional safeguard. |
| Concurrent forecast requests exhaust server memory | Low | High | Rate limit forecast endpoint (1 concurrent job per client). Queue additional requests. |

### 9.4 Open Questions

1. **Authentication**: Is this a public website or does it need user accounts? The plan assumes public access with rate limiting. If authentication is needed, add NextAuth.js.

2. **Hosting target**: Where will this be deployed? A VPS (DigitalOcean, Linode), a cloud provider (AWS ECS, GCP Cloud Run), or a local server? The Docker Compose approach works on all of these.

3. **Custom scenarios**: Should users be able to save and share custom parameter configurations? This would require a database (even just SQLite) for persistence.

4. **Multi-scenario comparison**: Should the dashboard support viewing multiple scenarios side-by-side? The current plan shows one scenario at a time. Adding comparison would require running multiple forecasts and a more complex chart layout.

---

## 10. Sources

### Charting Libraries
- [15 Best React JS Chart Libraries in 2026 - Technostacks](https://technostacks.com/blog/react-chart-libraries/)
- [Best React chart libraries (2025 update) - LogRocket Blog](https://blog.logrocket.com/best-react-chart-libraries-2025/)
- [When to Use D3, ECharts, Recharts, or Plotly - Medium](https://medium.com/@pallavi8khedle/when-to-use-d3-echarts-recharts-or-plotly-based-on-real-visualizations-ive-built-08ba1d433d2b)
- [d3 vs nivo vs plotly vs recharts vs victory-chart - npm trends](https://npmtrends.com/d3-vs-nivo-vs-plotly-vs-recharts-vs-victory-chart)
- [Recharts stacked bars performance - GitHub Issue #354](https://github.com/recharts/recharts/issues/354)
- [Recharts is slow with large data - GitHub Issue #1146](https://github.com/recharts/recharts/issues/1146)
- [Plotly.js stacked area chart performance - Plotly Community Forum](https://community.plotly.com/t/how-to-improve-performance-of-horizontal-stacked-barchart-rendered-in-react-js-with-huge-data/81880)
- [Improve performance of extremely large datasets - Plotly GitHub #5641](https://github.com/plotly/plotly.js/issues/5641)
- [Canvas vs. SVG - Apache ECharts Handbook](https://echarts.apache.org/handbook/en/best-practices/canvas-vs-svg/)
- [Enabling Apache ECharts in React - Tania Rascia](https://www.taniarascia.com/apache-echarts-react/)
- [echarts-for-react - npm](https://www.npmjs.com/package/echarts-for-react)
- [echarts vs plotly.js vs recharts - npm trends](https://npmtrends.com/echarts-vs-plotly.js-vs-react-linechart-vs-recharts)
- [6 Best JavaScript Charting Libraries for Dashboards in 2026 - Embeddable](https://embeddable.com/blog/javascript-charting-libraries)
- [ECharts Features](https://echarts.apache.org/en/feature.html)

### UI Framework & Components
- [5 Best React UI Libraries for 2026 - DEV Community](https://dev.to/ansonch/5-best-react-ui-libraries-for-2026-and-when-to-use-each-1p4j)
- [Best React Component Libraries 2026 - Design Revision](https://designrevision.com/blog/best-react-component-libraries)
- [Choosing the Right UI Framework in 2026 - Medium](https://lalatenduswain.medium.com/choosing-the-right-ui-framework-in-2026-tailwind-css-vs-bootstrap-vs-material-ui-vs-shadcn-ui-c5842f4c7e91)
- [React UI libraries in 2025: Comparing shadcn/ui, Radix, Mantine, MUI - Makers' Den](https://makersden.io/blog/react-ui-libs-2025-comparing-shadcn-radix-mantine-mui-chakra)
- [shadcn/ui Data Table](https://www.shadcn.io/ui/data-table)
- [TanStack Table](https://tanstack.com/table/latest)

### Backend Architecture
- [Next.js FastAPI Starter - Vercel](https://vercel.com/templates/next.js/nextjs-fastapi-starter)
- [Creating a Scalable Full-Stack Web App with Next.js and FastAPI - Medium](https://medium.com/@pottavijay/creating-a-scalable-full-stack-web-app-with-next-js-and-fastapi-eb4db44f4f4e)
- [Background Tasks - FastAPI](https://fastapi.tiangolo.com/tutorial/background-tasks/)
- [Managing Background Tasks and Long-Running Operations in FastAPI - Leapcell](https://leapcell.io/blog/managing-background-tasks-and-long-running-operations-in-fastapi)
- [Optimizing FastAPI Performance with WebSockets and Asynchronous Tasks - Poespas Blog](https://blog.poespas.me/posts/2025/03/05/fastapi-websockets-asynchronous-tasks/)
- [Handling Long-Running Tasks in FastAPI - DataScienceTribe](https://www.datasciencebyexample.com/2023/08/26/handling-long-running-tasks-in-fastapi-python/)
- [FastAPI for Microservices: High-Performance Python API Design Patterns](https://talent500.com/blog/fastapi-microservices-python-api-design-patterns-2025/)

### Deployment
- [How to Deploy Next.js to a Docker Container - ServersInc](https://serversinc.io/blog/how-to-deploy-next-js-to-a-docker-container-complete-2025-production-guide/)
- [FastAPI in Containers - Docker - FastAPI Docs](https://fastapi.tiangolo.com/deployment/docker/)
- [Dockerizing a FastAPI Backend and Next.js Frontend - Medium](https://medium.com/@manzurulhoque/dockerizing-a-fastapi-backend-and-next-js-frontend-part-1-configuring-kubernetes-part-2-920432d1f35f)
- [Building APIs with Next.js - Next.js Blog](https://nextjs.org/blog/building-apis-with-nextjs)
- [Server Actions vs API Routes in Next.js 15 - Wisp CMS](https://www.wisp.blog/blog/server-actions-vs-api-routes-in-nextjs-15-which-should-i-use)

### Math Rendering
- [KaTeX - The fastest math typesetting library](https://katex.org/)
- [react-katex - npm](https://www.npmjs.com/package/react-katex)
- [KaTeX vs. MathJax Comparison - BigGo News](https://biggo.com/news/202511040733_KaTeX_MathJax_Web_Rendering_Comparison)

### Forms & Data Tables
- [Composable Form Handling in 2025: React Hook Form, TanStack Form, and Beyond - Makers' Den](https://makersden.io/blog/composable-form-handling-in-2025-react-hook-form-tanstack-form-and-beyond)
- [Advanced Shadcn Table: Server-Side Sort, Filter, Paginate](https://next.jqueryscript.net/shadcn-ui/advanced-shadcn-table/)
- [Enterprise-Grade Data Table Component with TanStack and Shadcn/ui](https://next.jqueryscript.net/shadcn-ui/enterprise-data-table-tanstack/)

---

## Appendix A: Total Effort Estimate

| Phase | Description | Estimated Days |
|-------|-------------|---------------|
| Phase 1 | Foundation (project setup, API, Redis/RQ, Docker) | 5-7 |
| Phase 2 | Model Description Page | 3-4 |
| Phase 3 | Parameter Configuration Page | 7-10 |
| Phase 4 | Results Dashboard (all charts) | 8-10 |
| Phase 5 | Data Explorer + Polish | 5-7 |
| Phase 6 | Deployment + Production Readiness | 3-5 |
| **Total** | | **31-43 days** |

These estimates assume a single developer working full-time with experience in Next.js, FastAPI, and the component libraries. The range accounts for debugging, iteration on UI design, and unforeseen complexity.

**Critical path**: Phase 1 -> Phase 3 -> Phase 4 (backend setup must be done before the config page can submit forecasts, and forecasts must work before the dashboard can display results). Phase 2 (model description) can be built in parallel with Phase 3.

## Appendix B: Dependencies (New)

### Python (requirements-api.txt)
```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
pydantic>=2.9.0
redis>=5.0.0
rq>=1.16.0
python-multipart>=0.0.12
orjson>=3.10.0
# Plus existing: pandas, numpy, scipy, pyyaml
```

### Node.js (web/package.json key dependencies)
```json
{
  "dependencies": {
    "next": "^15.2",
    "react": "^19.0",
    "react-dom": "^19.0",
    "echarts": "^5.6",
    "echarts-for-react": "^3.0",
    "katex": "^0.16",
    "react-katex": "^3.0",
    "@tanstack/react-query": "^5.60",
    "@tanstack/react-table": "^8.20",
    "react-hook-form": "^7.54",
    "@hookform/resolvers": "^3.9",
    "zod": "^3.24",
    "class-variance-authority": "^0.7",
    "clsx": "^2.1",
    "tailwind-merge": "^2.6",
    "lucide-react": "^0.460"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "@types/react": "^19",
    "@types/node": "^22",
    "tailwindcss": "^4.0",
    "@tailwindcss/typography": "^0.5",
    "eslint": "^9",
    "eslint-config-next": "^15.2"
  }
}
```
