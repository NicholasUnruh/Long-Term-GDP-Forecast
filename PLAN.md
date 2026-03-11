# Long-Term GDP Forecast Plan (to 2050)
## GDP by State, by Industry, with GDP per Capita

---

## 1. Project Overview

**Objective:** Forecast real GDP by state and industry, population by state, and GDP per capita by state and industry through 2050, using a configurable supply-side growth model grounded in established economic methodology (CBO, World Bank, Conference Board).

**Data Available:**
- `real_gdp.csv` — BEA quarterly real GDP by state and industry (2005:Q1 – 2025:Q3), 52 areas (50 states + DC + US total), 27 industry categories per area
- `population.csv` — Annual population by state (1960–2025), 51 areas (50 states + DC) + US total, in thousands

**Output:** Quarterly GDP, annual population, and annual GDP per capita forecasts from 2025 Q4 through 2050 Q4, broken down by state and industry.

---

## 2. Methodology

### 2.1 Core Framework: Supply-Side Growth Accounting

Following the CBO and World Bank approach, long-term GDP is driven by supply-side factors via a **Cobb-Douglas production function**:

```
Y = A × K^α × L^(1−α)
```

Where:
- **Y** = Real GDP (output)
- **A** = Total Factor Productivity (TFP) — efficiency of combining inputs
- **K** = Capital stock
- **L** = Labor input (workers × hours × quality)
- **α** = Capital share of output (typically 0.30)
- **(1−α)** = Labor share of output (typically 0.70)

**Growth rate form** (log-linearized):

```
ΔY/Y = ΔA/A + α × (ΔK/K) + (1−α) × (ΔL/L)
```

This decomposes GDP growth into three additive components:
1. **TFP growth** — technological progress, institutional improvements
2. **Capital contribution** — α × growth rate of capital stock
3. **Labor contribution** — (1−α) × growth rate of labor input

### 2.2 Why This Approach

| Approach | Pros | Cons | Used By |
|----------|------|------|---------|
| **Production function (chosen)** | Theoretically grounded, decomposable, configurable | Requires assumptions on TFP/capital | CBO, World Bank, IMF, Conference Board |
| Time-series (ARIMA/VAR) | Data-driven, captures short-term dynamics | Unreliable 25+ years out, no structural insight | Short-term forecasts only |
| Expenditure-side | Captures demand shocks | Not suitable for long-term supply constraints | Short-term GDP nowcasting |

For horizons beyond 10 years, the supply-side production function approach is the established standard.

### 2.3 Forecast Strategy

```
                    ┌──────────────────────────┐
                    │    CONFIG (YAML/JSON)     │
                    │  - TFP growth rates       │
                    │  - Capital growth rates    │
                    │  - Labor participation     │
                    │  - Industry weights        │
                    │  - α (capital share)       │
                    │  - Depreciation rate       │
                    └────────────┬─────────────┘
                                 │
           ┌─────────────────────┼─────────────────────┐
           │                     │                      │
           ▼                     ▼                      ▼
  ┌────────────────┐  ┌───────────────────┐  ┌──────────────────┐
  │  POPULATION    │  │  GDP BY STATE &   │  │  CAPITAL STOCK   │
  │  FORECAST      │  │  INDUSTRY GROWTH  │  │  PROJECTION      │
  │  (by state)    │  │  (production fn)  │  │  (accumulation)  │
  └───────┬────────┘  └────────┬──────────┘  └────────┬─────────┘
          │                    │                       │
          │                    ▼                       │
          │           ┌────────────────┐               │
          │           │  GDP FORECAST  │◄──────────────┘
          │           │  by state &    │
          │           │  industry      │
          │           └───────┬────────┘
          │                   │
          ▼                   ▼
  ┌──────────────────────────────────────┐
  │      GDP PER CAPITA FORECAST         │
  │      = GDP(state) / POP(state)       │
  │      by state, by industry           │
  └──────────────────────────────────────┘
```

---

## 3. Data Pipeline

### 3.1 Data Ingestion & Cleaning (`src/data_loader.py`)

**GDP Data (real_gdp.csv):**
- Parse the wide-format BEA CSV (rows 1-2 are multi-level headers: Area × Industry)
- Reshape to long format: columns = `[quarter, state, industry, real_gdp]`
- Handle the 27 industry categories (some are subtotals — flag parent/child relationships):
  - "All industry total" and "Private industries" are aggregates
  - "Manufacturing" = "Durable goods" + "Nondurable goods"
  - "Government" = "Federal civilian" + "Military" + "State and local"
- Convert quarter strings ("2005:Q1") to datetime
- Strip trailing empty rows
- Validate: 52 areas × 27 industries × 83 quarters

**Population Data (population.csv):**
- Parse annual data (1960–2025), 51 areas + US total
- Align state names between GDP and population datasets
- Values are in thousands — document units clearly

### 3.2 Historical Analysis (`src/historical_analysis.py`)

Compute from historical data:
- **GDP growth rates** by state and industry (quarter-over-quarter annualized, year-over-year)
- **Population growth rates** by state
- **GDP per capita** levels and growth rates by state
- **Industry share of GDP** by state (how each industry contributes to state total)
- **Trend decomposition** — separate cyclical from structural growth using HP filter or linear trend
- **Implied labor productivity** growth = GDP growth − labor growth (approximated from population)

---

## 4. Forecasting Modules

### 4.1 Population Forecast (`src/population_forecast.py`)

**Method: Log-linear trend with configurable adjustments**

1. Fit log-linear regression to recent population data (2000–2025) for each state:
   ```
   ln(Pop_t) = a + b × t + ε
   ```
   This gives a baseline growth rate `b` per state.

2. Allow config overrides:
   - National population growth rate target
   - State-specific growth rate adjustments
   - Migration shift factors (e.g., Sun Belt acceleration)

3. Project quarterly population by interpolating annual forecasts (cubic spline).

4. **Constraint:** State populations sum to national total (proportional scaling).

**Alternative (stretch goal):** Cohort-component model using Census age-structure data, but this adds significant complexity. The log-linear approach is standard for GDP forecasting contexts where population is an input, not the primary output.

### 4.2 Labor Input Projection (`src/labor_forecast.py`)

Labor input is derived from population:

```
L = Population × Working_Age_Share × Labor_Force_Participation × (1 − Unemployment_Rate) × Avg_Hours
```

For simplicity in this model:
```
Labor_Growth ≈ Population_Growth + LFPR_Change + Hours_Change
```

**Config inputs:**
- `labor_force_participation_rate_trend` — national and by state (default: gradual decline per CBO projections)
- `working_age_share_trend` — captures aging demographics
- `unemployment_rate_long_run` — natural rate assumption (default: 4.0%)

### 4.3 Capital Stock Projection (`src/capital_forecast.py`)

**Capital accumulation equation:**
```
K_{t+1} = (1 − δ) × K_t + I_t
```

Where:
- **δ** = depreciation rate (default: 5% annually, configurable)
- **I_t** = gross investment = savings rate × GDP

Since we don't have direct capital stock data by state/industry, we use the **growth rate approach**:

```
ΔK/K = Investment_Rate × (Y/K) − δ
```

**Config inputs:**
- `depreciation_rate` — default 0.05
- `investment_to_gdp_ratio` — capex/GDP ratio by state or industry (default: ~0.20, configurable)
- `capital_output_ratio` — K/Y ratio (default: ~3.0, used to initialize)
- `capex_growth_adjustment` — additional growth/decline in investment rates

**By industry:** Different industries have different capital intensities:
- Manufacturing, utilities, mining: high capital intensity (α ≈ 0.35-0.45)
- Services, education, health: lower capital intensity (α ≈ 0.20-0.30)
- Config allows industry-specific α overrides

### 4.4 TFP Projection (`src/tfp_forecast.py`)

TFP is the residual — the hardest component to forecast but the most important for long-term growth.

**Approach:**
1. **Historical TFP extraction:** Back out implied TFP growth from historical GDP, labor, and capital data using:
   ```
   ΔA/A = ΔY/Y − α × (ΔK/K) − (1−α) × (ΔL/L)
   ```

2. **Baseline projection:** Use recent trend (e.g., 10-year average TFP growth, typically 0.5%–1.5% for US)

3. **Config adjustments:**
   - `tfp_growth_rate` — national baseline (default: 1.0% per CBO/Conference Board estimates)
   - `tfp_growth_by_state` — state-specific overrides
   - `tfp_growth_by_industry` — industry-specific (tech sectors higher, traditional lower)
   - `ai_productivity_boost` — optional scenario for AI-driven TFP acceleration
   - `tfp_convergence` — whether lagging states converge toward leader TFP levels

### 4.5 GDP Growth Engine (`src/gdp_forecast.py`)

**Core calculation for each state-industry pair, each period:**

```python
def forecast_gdp_growth(tfp_growth, capital_growth, labor_growth, alpha):
    """Cobb-Douglas growth accounting"""
    return tfp_growth + alpha * capital_growth + (1 - alpha) * labor_growth

def project_gdp(base_gdp, growth_rates, periods):
    """Compound growth forward"""
    gdp = [base_gdp]
    for t in range(periods):
        gdp.append(gdp[-1] * (1 + growth_rates[t]))
    return gdp
```

**Steps:**
1. For each state × industry, compute growth rate per quarter using production function
2. Apply growth rate to last observed GDP level (2025:Q3) to project forward
3. Ensure state industry totals are consistent with "All industry total"
4. National total = sum of state totals (cross-validation)

**Industry-specific adjustments:**
- Structural shifts (e.g., declining manufacturing share, rising tech/services)
- Config: `industry_share_shift` — annual change in industry's share of state GDP

### 4.6 GDP Per Capita (`src/gdp_per_capita.py`)

Simple derivation:
```
GDP_per_capita(state, t) = GDP(state, t) / Population(state, t)
```

Also compute by industry:
```
GDP_per_capita_industry(state, industry, t) = GDP(state, industry, t) / Population(state, t)
```

This gives each industry's contribution to per-capita output in each state.

---

## 5. Configuration System (`config/`)

### 5.1 Main Config File (`config/forecast_config.yaml`)

```yaml
# === FORECAST HORIZON ===
forecast:
  start_quarter: "2025:Q4"
  end_year: 2050
  frequency: "quarterly"  # quarterly GDP, annual population

# === PRODUCTION FUNCTION PARAMETERS ===
production_function:
  alpha: 0.30                    # Capital share of output (CBO default)
  depreciation_rate: 0.05        # Annual capital depreciation

# === TFP (Total Factor Productivity) ===
tfp:
  national_growth_rate: 0.010    # 1.0% annual TFP growth (baseline)
  by_industry:                   # Override by industry
    "Information": 0.020
    "Manufacturing": 0.008
    "Health care and social assistance": 0.005
    "Mining, quarrying, and oil and gas extraction": 0.003
  by_state: {}                   # Optional state overrides
  convergence_rate: 0.02         # Speed at which lagging states converge

# === CAPITAL / INVESTMENT ===
capital:
  investment_to_gdp_ratio: 0.20  # National average
  capex_growth_adjustment: 0.0   # Additional annual change
  capital_output_ratio: 3.0      # Initial K/Y ratio
  by_industry:
    "Manufacturing": { investment_ratio: 0.25, alpha: 0.40 }
    "Information": { investment_ratio: 0.30, alpha: 0.35 }
    "Utilities": { investment_ratio: 0.35, alpha: 0.45 }
    "Construction": { investment_ratio: 0.20, alpha: 0.35 }

# === LABOR ===
labor:
  lfpr_trend: -0.001             # -0.1 pp/year labor force participation decline
  working_age_share_trend: -0.002 # Aging demographics
  natural_unemployment_rate: 0.04
  hours_growth: 0.0              # No change in average hours

# === POPULATION ===
population:
  method: "log_linear"           # or "custom_rates"
  national_growth_target: null   # If set, scale states to hit this
  by_state: {}                   # Optional state-specific overrides

# === INDUSTRY STRUCTURE ===
industry:
  structural_shift: true         # Allow industry shares to evolve
  shift_rates:                   # Annual change in share of state GDP
    "Information": 0.003
    "Professional, scientific, and technical services": 0.002
    "Manufacturing": -0.002
    "Retail trade": -0.001

# === SCENARIOS ===
scenarios:
  baseline: {}                   # Uses all defaults above
  high_growth:
    tfp: { national_growth_rate: 0.015 }
    capital: { capex_growth_adjustment: 0.005 }
  low_growth:
    tfp: { national_growth_rate: 0.005 }
    labor: { lfpr_trend: -0.002 }
  ai_boom:
    tfp:
      national_growth_rate: 0.020
      by_industry:
        "Information": 0.040
        "Professional, scientific, and technical services": 0.030
```

### 5.2 Why These Parameters Matter

| Parameter | Effect | Typical Range |
|-----------|--------|---------------|
| `alpha` (capital share) | Higher → capital investment matters more | 0.25 – 0.40 |
| `tfp_growth_rate` | Main driver of long-term growth | 0.5% – 2.0% |
| `investment_to_gdp_ratio` | Higher → faster capital accumulation | 15% – 30% |
| `depreciation_rate` | Higher → more investment needed to maintain K | 3% – 8% |
| `lfpr_trend` | Aging demographics drag on labor supply | -0.3% to +0.1% |
| `capex_growth_adjustment` | Boost/reduce investment growth over time | -1% to +2% |

---

## 6. Project Structure

```
Long-Term GDP Forecast/
├── real_gdp.csv                     # BEA quarterly GDP data (input)
├── population.csv                   # Census annual population (input)
├── PLAN.md                          # This document
│
├── config/
│   └── forecast_config.yaml         # All configurable parameters
│
├── src/
│   ├── __init__.py
│   ├── data_loader.py               # Parse & clean GDP + population CSVs
│   ├── historical_analysis.py       # Compute historical growth rates, trends
│   ├── population_forecast.py       # Population projection by state
│   ├── labor_forecast.py            # Labor input from population + LFPR
│   ├── capital_forecast.py          # Capital stock growth projection
│   ├── tfp_forecast.py              # TFP growth projection
│   ├── gdp_forecast.py              # Core GDP growth engine (production fn)
│   ├── gdp_per_capita.py            # GDP / Population calculation
│   ├── scenarios.py                 # Scenario runner (baseline, high, low)
│   └── utils.py                     # Shared utilities, constants
│
├── outputs/
│   ├── gdp_forecast_by_state_industry.csv
│   ├── population_forecast_by_state.csv
│   ├── gdp_per_capita_forecast.csv
│   └── summary_statistics.csv
│
├── notebooks/
│   └── exploration.ipynb            # Data exploration & visualization
│
├── main.py                          # Entry point: load config → run forecast → save
├── requirements.txt                 # Python dependencies
└── README.md                        # Usage instructions
```

---

## 7. Implementation Phases

### Phase 1: Data Foundation
1. `data_loader.py` — Parse both CSVs into clean pandas DataFrames
2. Align state names between datasets
3. Validate data completeness
4. Create long-format GDP DataFrame: `(quarter, state, industry, real_gdp)`
5. Create population DataFrame: `(year, state, population)`

### Phase 2: Historical Analysis
1. Compute historical GDP growth rates (YoY, QoQ annualized)
2. Compute population growth rates
3. Compute GDP per capita historically
4. Calculate industry shares of state GDP over time
5. Extract trend growth rates (basis for calibrating forecasts)

### Phase 3: Population Forecast
1. Fit log-linear model to each state's population (2000–2025)
2. Project to 2050
3. Apply config adjustments
4. Interpolate to quarterly frequency

### Phase 4: GDP Forecast Engine
1. Load config parameters
2. For each state × industry:
   a. Compute labor growth from population forecast + config
   b. Compute capital growth from investment assumptions + config
   c. Compute TFP growth from config (with industry/state overrides)
   d. Apply Cobb-Douglas: `g_Y = g_A + α*g_K + (1-α)*g_L`
   e. Project GDP levels forward from last observed value
3. Reconcile: ensure industry sub-totals = state totals
4. Cross-check: national sum ≈ US total projection

### Phase 5: GDP Per Capita & Outputs
1. Compute GDP per capita = GDP / Population for each state
2. Compute industry-level GDP per capita
3. Generate output CSVs
4. Generate summary statistics (growth rates, rankings, shares)

### Phase 6: Scenarios & Visualization
1. Implement scenario runner (apply config overrides)
2. Run baseline, high growth, low growth, AI boom scenarios
3. Create comparison visualizations

---

## 8. Python Dependencies

```
pandas>=2.0
numpy>=1.24
scipy>=1.10
pyyaml>=6.0
matplotlib>=3.7
statsmodels>=0.14       # For HP filter, trend decomposition
```

---

## 9. Key Assumptions & Limitations

### Assumptions
- **Cobb-Douglas with constant returns to scale** (CBO standard)
- **Capital share α = 0.30** (CBO standard; configurable)
- **No structural breaks** — growth paths are smooth trend projections
- **Industry structure evolves gradually** — no sudden industry creation/destruction
- **State economies are independent** — no inter-state spillover modeling
- **Population ≈ labor proxy** — refined via LFPR and working-age share configs

### Limitations
- No demand-side shocks (recessions, fiscal policy) — this is a supply-side trend model
- Capital stock is estimated, not directly observed at state-industry level
- TFP is assumed, not endogenously determined
- No age-structure modeling in population (simplified vs. cohort-component)
- Quarterly GDP forecasts will show smooth trends (no business cycle fluctuations)

### Mitigations
- Config system allows scenario analysis to bracket uncertainty
- Industry-specific parameters capture heterogeneous growth
- State-specific overrides allow incorporating external projections
- Reconciliation checks ensure internal consistency

---

## 10. Validation Strategy

1. **Backtesting:** Hold out 2020–2025 data, forecast from 2019, compare accuracy
2. **Benchmark comparison:** Compare 2030 projections against CBO/IMF/World Bank forecasts
3. **Consistency checks:**
   - Sum of state GDPs ≈ national GDP
   - Sum of industry GDPs = state total GDP
   - GDP per capita = GDP / population (identity check)
   - Growth rates are in plausible ranges (0%–5% annually)
4. **Sensitivity analysis:** Vary key parameters ±50% and examine output ranges

---

## 11. Research Sources

- [CBO: Estimating and Projecting Potential Output Using CBO's Forecasting Growth Model (Working Paper 2018-03)](https://www.cbo.gov/publication/53558)
- [World Bank: Long-Term Growth Model (LTGM)](https://www.worldbank.org/en/research/brief/LTGM)
- [Conference Board: How to Forecast GDP in the Long Run](https://www.conference-board.org/topics/recession-knowledge-center/how-to-forecast-GDP-in-the-long-run)
- [QuantEcon: The Solow-Swan Growth Model (Python)](https://intro.quantecon.org/solow.html)
- [BEA: GDP by State Methodology](https://www.bea.gov/resources/methodologies/gdp-by-state)
- [BEA: GDP by State Data](https://www.bea.gov/data/gdp/gdp-state)
- [Census Bureau: Population Projections](https://www.census.gov/programs-surveys/popproj.html)
- [Cooper Center: National 50-State Population Projections](https://www.coopercenter.org/research/national-50-state-population-projections-2030-2040-2050)
- [IMF WEO April 2024: Medium-Term Growth Prospects](https://www.imf.org/-/media/files/publications/weo/2024/april/english/ch3.pdf)
- [CFA Institute: Economic Growth & Growth Accounting](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2025/economic-growth)
