# Claude Agent Handoff - Long-Term GDP Forecast

## What This Project Does

Forecasts US real GDP by state (50 + DC) and industry (23 leaf sectors) from 2025:Q4 to 2050 using a Cobb-Douglas production function. Also forecasts population by state and derives GDP per capita. All assumptions are configurable via `config/forecast_config.yaml`.

## How To Run

```bash
python main.py                # Baseline scenario
python main.py high_growth    # Specific scenario
python main.py --all          # All 4 scenarios + comparison CSV
```

Runtime: ~14 seconds per scenario. Outputs go to `outputs/`.

## Core Model

GDP growth is computed per state-industry pair using:

```
GDP_growth = TFP_growth + alpha * Capital_growth + (1 - alpha) * Labor_growth
```

- **TFP**: read from config, with national/industry/state overrides (`tfp_forecast.py`)
- **Capital growth**: `(investment_ratio / capital_output_ratio) - depreciation + capex_adj` (`capital_forecast.py`)
- **Labor growth**: `population_growth + lfpr_trend + working_age_share_trend + hours_growth` (`labor_forecast.py`)
- **alpha**: 0.30 default, per-industry overrides in config under `capital.by_industry.{industry}.alpha`

All annual rates are converted to quarterly with `(1 + r)^0.25 - 1`.

## Project Structure

```
config/forecast_config.yaml   <- All tunable parameters (heavily commented)
main.py                       <- Entry point: load -> forecast -> save -> print summary
src/
  utils.py                    <- Config loading, constants (LEAF_INDUSTRIES, SUB_AGGREGATE_INDUSTRIES), quarter/date helpers
  data_loader.py              <- Parses real_gdp.csv (wide BEA format) and population.csv into long DataFrames
  historical_analysis.py      <- Growth rates, industry shares, trend decomposition from historical data
  population_forecast.py      <- Log-linear trend fit per state, projects to 2050, cubic spline to quarterly
  labor_forecast.py           <- Derives labor growth from population growth + config adjustments
  capital_forecast.py         <- Capital growth from investment/depreciation assumptions + per-industry alpha
  tfp_forecast.py             <- TFP growth lookup from config (national -> industry -> state cascade)
  gdp_forecast.py             <- Core engine: per state-industry growth calc, industry shifts, aggregate building, US totals
  gdp_per_capita.py           <- GDP / population (quarterly and annual)
  scenarios.py                <- Runs named scenarios by deep-merging config overrides
outputs/                      <- Generated CSVs (not committed)
```

## Data Files

### `real_gdp.csv` (BEA quarterly GDP by state and industry)
- **Format**: Wide. Row 1 = state names repeated per industry (1405 columns). Row 2 = industry names. Rows 3+ = quarterly data.
- **Range**: 2005:Q1 to 2025:Q3 (83 valid quarters)
- **Areas**: 52 (50 states + DC + "United States")
- **Industries per area**: 27 (23 leaf + 4 aggregates)
- **Values**: Millions of chained 2017 dollars
- **Gotcha**: Some state-industry combos have data ending before 2025:Q3 (DC, Wyoming, etc. have suppressed BEA data for some industries). The engine handles this by projecting forward from the last available data point to the forecast start quarter using the same growth rate.
- **Parsing**: `data_loader.load_gdp_data()` returns a long DataFrame with columns `[quarter, state, industry, real_gdp, date]`.

### `population.csv` (Census annual population by state)
- **Format**: Year as first column, then one column per state
- **Range**: 1960 to 2025 (66 years)
- **Values**: In thousands (multiplied by 1000 during loading)
- **Areas**: 51 (50 states + DC) + "United States" total
- **Parsing**: `data_loader.load_population_data()` returns a long DataFrame with columns `[year, state, population]`.

## Industry Hierarchy (defined in `utils.py`)

The 27 BEA industries have parent-child relationships:

```
All industry total             <- sum of all 23 leaf industries
  Private industries           <- All industry total minus Government
  Government and govt enterprises  <- sum of: Federal civilian + Military + State and local
  Manufacturing                    <- sum of: Durable goods + Nondurable goods
```

- **LEAF_INDUSTRIES** (23): The independently forecast industries. These are the actual forecast units.
- **SUB_AGGREGATE_INDUSTRIES**: Manufacturing, Government (sums of their children)
- **AGGREGATE_INDUSTRIES**: "All industry total", "Private industries" (derived from leaves)

Aggregates are NOT independently forecast. They are built from leaf sums by `build_aggregates()` in `gdp_forecast.py`.

## Execution Flow (main.py)

1. Load config, apply scenario overrides
2. Load & parse GDP and population CSVs (`data_loader`)
3. Align state names between datasets
4. Compute historical trend growth rates (`historical_analysis`)
5. Forecast population by state to 2050 (`population_forecast`)
6. Interpolate population to quarterly via cubic spline
7. For each state x leaf industry: compute quarterly GDP growth rate, project forward from last observed value (`gdp_forecast.forecast_state_industry`)
8. Apply industry structural shifts if enabled (`gdp_forecast.apply_industry_shifts`)
9. Build aggregate industry rows from leaf sums (`gdp_forecast.build_aggregates`)
10. Sum across states to create US totals (`gdp_forecast._compute_us_totals`)
11. Compute GDP per capita = (GDP in millions * 1,000,000) / population
12. Save CSVs to `outputs/`

## Output Files

| File | Content |
|------|---------|
| `gdp_forecast_by_state_industry.csv` | ~142K rows. Columns: quarter, date, state, industry, real_gdp, is_forecast |
| `population_forecast_by_state.csv` | ~4.7K rows. Columns: year, state, population |
| `gdp_per_capita_forecast.csv` | ~36K rows. Columns: year, state, industry, real_gdp, population, gdp_per_capita |
| `summary_statistics.csv` | Milestone snapshots (2025/2030/2035/2040/2045/2050) for all states, All industry total |
| `historical_trend_growth.csv` | 5-year CAGR for each state-industry from historical data |
| `scenario_comparison_us_total.csv` | US total GDP across all scenarios (only created by `--all`) |

## Config System (`config/forecast_config.yaml`)

The config file is heavily commented with ranges and explanations. Key sections:

- **`forecast`**: Start quarter, end year
- **`production_function`**: Global alpha (0.30) and depreciation (0.05)
- **`tfp`**: National TFP growth + per-industry + per-state overrides
- **`capital`**: Investment/GDP ratio, capital/output ratio, capex adjustment, per-industry investment_ratio and alpha overrides
- **`labor`**: LFPR trend, working-age share trend, unemployment, hours growth
- **`population`**: Projection method, fit start year, national target, per-state overrides
- **`industry`**: Structural shift toggle + shift rates per industry
- **`scenarios`**: Named parameter override sets (baseline, high_growth, low_growth, ai_boom)

Scenarios work via deep merge: only the keys you specify are overridden. `apply_scenario()` in `utils.py` handles this.

## Known Quirks / Things To Watch

1. **Data gaps**: Some state-industry combos in the BEA data end before 2025:Q3 (DC, WY, DE, etc. have BEA data suppression for certain industries). `forecast_state_industry()` handles this by computing the gap and projecting the base GDP forward to the standard start quarter before beginning the forecast.

2. **Constant growth rate per series**: Each state-industry pair gets a single constant quarterly growth rate for the entire forecast horizon. There is no time-varying growth (no ramp-up/down, no business cycles). This is standard for supply-side long-term models.

3. **Industry shifts**: `apply_industry_shifts()` adjusts the GDP shares of leaf industries per quarter. This is a share reallocation — total state GDP stays the same, but composition shifts. Shift rates are in the config under `industry.shift_rates`.

4. **Population method**: Only `log_linear` is implemented. It fits `ln(pop) = a + b*year` to each state's data from `fit_start_year` to present, then extrapolates. Quarterly interpolation uses scipy CubicSpline.

5. **Units**: GDP is in millions of chained 2017 dollars throughout. Population is in actual persons. GDP per capita = `(real_gdp * 1_000_000) / population`.

6. **US totals**: "United States" rows are always computed as the sum of individual states — they are never independently forecast.

## Likely Next Steps / Enhancement Ideas

- **Visualization**: Add matplotlib charts (GDP trajectory, state comparisons, industry breakdown, scenario fan charts)
- **Time-varying growth**: Let TFP or capital growth ramp up/down over decades instead of being constant
- **Historical backtesting**: Hold out 2020-2025, forecast from 2019, compare to actuals
- **Sensitivity analysis**: Programmatic parameter sweeps with output comparison
- **Better population model**: Cohort-component method using age structure data
- **State-level labor data**: Use BLS employment data instead of deriving labor from population
- **Export to Excel**: Multi-sheet workbook with summary dashboards
- **API/dashboard**: Flask/Streamlit app for interactive parameter adjustment

## Dependencies

```
pandas numpy scipy pyyaml matplotlib statsmodels
```

Install: `pip install -r requirements.txt`
