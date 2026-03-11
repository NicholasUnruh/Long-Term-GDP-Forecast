import sys
import time
from pathlib import Path

import pandas as pd
import numpy as np

from src.utils import load_config, apply_scenario, PROJECT_ROOT, LEAF_INDUSTRIES
from src.data_loader import (
    load_gdp_data, load_population_data, align_state_names,
    get_states, get_last_observed_quarter,
)
from src.historical_analysis import (
    compute_gdp_growth_rates, compute_population_growth,
    compute_industry_shares, compute_historical_gdp_per_capita,
    compute_trend_growth,
)
from src.population_forecast import forecast_population, interpolate_to_quarterly
from src.gdp_forecast import run_gdp_forecast
from src.gdp_per_capita import compute_gdp_per_capita, compute_annual_gdp_per_capita
from src.scenarios import run_scenario, run_all_scenarios, compare_scenarios

OUTPUT_DIR = PROJECT_ROOT / "outputs"


def main(scenario_name="baseline", config_path=None):
    OUTPUT_DIR.mkdir(exist_ok=True)
    t0 = time.time()

    # --- Load config ---
    print("Loading configuration...")
    config = load_config(config_path)
    config = apply_scenario(config, scenario_name)
    end_year = config["forecast"]["end_year"]
    start_q = config["forecast"]["start_quarter"]

    # --- Load data ---
    print("Loading data...")
    gdp_df = load_gdp_data()
    pop_df = load_population_data()
    gdp_df, pop_df = align_state_names(gdp_df, pop_df)

    states = get_states(gdp_df, include_us=False)
    last_q = get_last_observed_quarter(gdp_df)
    print(f"  GDP: {len(gdp_df)} records, last quarter: {last_q}")
    print(f"  Population: {len(pop_df)} records, {len(states)} states")
    print(f"  Forecast horizon: {start_q} to {end_year}:Q4")

    # --- Historical analysis ---
    print("Computing historical analysis...")
    trend_growth = compute_trend_growth(gdp_df)
    industry_shares = compute_industry_shares(gdp_df)
    hist_gdp_pc = compute_historical_gdp_per_capita(gdp_df, pop_df)

    # --- Population forecast ---
    print("Forecasting population...")
    pop_forecast = forecast_population(pop_df, config, end_year)
    pop_forecast_future = pop_forecast[pop_forecast["year"] > pop_df["year"].max()]
    print(f"  Population forecast: {len(pop_forecast_future)} state-year rows")

    pop_quarterly = interpolate_to_quarterly(pop_forecast, start_q, end_year)
    print(f"  Quarterly population: {len(pop_quarterly)} rows")

    # --- GDP forecast ---
    print(f"Forecasting GDP (scenario: {scenario_name})...")
    gdp_forecast = run_gdp_forecast(
        gdp_df, pop_forecast, config, states=states,
        industries=LEAF_INDUSTRIES, end_year=end_year,
    )
    print(f"  GDP forecast: {len(gdp_forecast)} rows")

    # --- GDP per capita ---
    print("Computing GDP per capita...")
    gdp_pc_quarterly = compute_gdp_per_capita(gdp_forecast, pop_quarterly)
    gdp_pc_annual = compute_annual_gdp_per_capita(gdp_forecast, pop_forecast)

    # --- Combine historical + forecast for GDP ---
    print("Combining historical and forecast data...")
    gdp_df["is_forecast"] = False
    gdp_combined = pd.concat([gdp_df, gdp_forecast], ignore_index=True)
    gdp_combined = gdp_combined.sort_values(["state", "industry", "date"]).reset_index(drop=True)

    # --- Save outputs ---
    print("Saving outputs...")
    _save_outputs(
        gdp_forecast, pop_forecast, gdp_pc_annual, gdp_combined,
        trend_growth, scenario_name,
    )

    # --- Print summary ---
    _print_summary(gdp_forecast, pop_forecast, gdp_pc_annual, end_year)

    elapsed = time.time() - t0
    print(f"\nDone in {elapsed:.1f}s. Outputs saved to: {OUTPUT_DIR}")


def _save_outputs(gdp_forecast, pop_forecast, gdp_pc_annual, gdp_combined,
                  trend_growth, scenario_name):
    suffix = f"_{scenario_name}" if scenario_name != "baseline" else ""

    gdp_forecast.to_csv(
        OUTPUT_DIR / f"gdp_forecast_by_state_industry{suffix}.csv", index=False,
    )

    pop_out = pop_forecast[["year", "state", "population"]].copy()
    pop_out.to_csv(
        OUTPUT_DIR / f"population_forecast_by_state{suffix}.csv", index=False,
    )

    gdp_pc_out = gdp_pc_annual[["year", "state", "industry", "real_gdp", "population", "gdp_per_capita"]].copy()
    gdp_pc_out.to_csv(
        OUTPUT_DIR / f"gdp_per_capita_forecast{suffix}.csv", index=False,
    )

    # Summary: 2025, 2030, 2040, 2050 snapshots for all-industry total
    milestone_years = [2025, 2030, 2035, 2040, 2045, 2050]
    summary_rows = []
    for year in milestone_years:
        year_mask = (gdp_pc_annual["year"] == year) & (
            gdp_pc_annual["industry"] == "All industry total"
        )
        year_data = gdp_pc_annual[year_mask]
        for _, row in year_data.iterrows():
            summary_rows.append({
                "year": year,
                "state": row["state"],
                "real_gdp_millions": row["real_gdp"],
                "population": row["population"],
                "gdp_per_capita": row["gdp_per_capita"],
            })

    if summary_rows:
        pd.DataFrame(summary_rows).to_csv(
            OUTPUT_DIR / f"summary_statistics{suffix}.csv", index=False,
        )

    trend_growth.to_csv(OUTPUT_DIR / "historical_trend_growth.csv", index=False)


def _print_summary(gdp_forecast, pop_forecast, gdp_pc_annual, end_year):
    print("\n" + "=" * 70)
    print("FORECAST SUMMARY")
    print("=" * 70)

    us_gdp = gdp_forecast[
        (gdp_forecast["state"] == "United States")
        & (gdp_forecast["industry"] == "All industry total")
    ].sort_values("date")

    if len(us_gdp) > 0:
        first_gdp = us_gdp.iloc[0]["real_gdp"]
        last_gdp = us_gdp.iloc[-1]["real_gdp"]
        n_quarters = len(us_gdp)
        cagr = (last_gdp / first_gdp) ** (4 / n_quarters) - 1 if first_gdp > 0 else 0

        print(f"\nUS Real GDP:")
        print(f"  Start ({us_gdp.iloc[0]['quarter']}):  ${first_gdp / 1e6:.2f} trillion")
        print(f"  End   ({us_gdp.iloc[-1]['quarter']}): ${last_gdp / 1e6:.2f} trillion")
        print(f"  CAGR: {cagr * 100:.2f}%")

    us_pop = pop_forecast[pop_forecast["state"] == "United States"].sort_values("year")
    if len(us_pop) > 0:
        last_hist = us_pop[us_pop["year"] <= 2025].iloc[-1]
        last_proj = us_pop[us_pop["year"] == end_year]
        if len(last_proj) > 0:
            print(f"\nUS Population:")
            print(f"  2025: {last_hist['population'] / 1e6:.1f} million")
            print(f"  {end_year}: {last_proj.iloc[0]['population'] / 1e6:.1f} million")

    us_pc = gdp_pc_annual[
        (gdp_pc_annual["state"] == "United States")
        & (gdp_pc_annual["industry"] == "All industry total")
    ].sort_values("year")
    if len(us_pc) > 0:
        last_pc = us_pc[us_pc["year"] == end_year]
        first_pc = us_pc.iloc[0]
        if len(last_pc) > 0:
            print(f"\nUS GDP per Capita:")
            print(f"  {int(first_pc['year'])}: ${first_pc['gdp_per_capita']:,.0f}")
            print(f"  {end_year}: ${last_pc.iloc[0]['gdp_per_capita']:,.0f}")

    print("\nTop 5 states by 2050 GDP (All industry):")
    state_2050 = gdp_pc_annual[
        (gdp_pc_annual["year"] == end_year)
        & (gdp_pc_annual["industry"] == "All industry total")
        & (gdp_pc_annual["state"] != "United States")
    ].nlargest(5, "real_gdp")
    for _, row in state_2050.iterrows():
        print(f"  {row['state']}: ${row['real_gdp'] / 1e6:.2f}T  (per capita: ${row['gdp_per_capita']:,.0f})")

    print("\nTop 5 states by 2050 GDP per Capita:")
    state_pc_2050 = gdp_pc_annual[
        (gdp_pc_annual["year"] == end_year)
        & (gdp_pc_annual["industry"] == "All industry total")
        & (gdp_pc_annual["state"] != "United States")
    ].nlargest(5, "gdp_per_capita")
    for _, row in state_pc_2050.iterrows():
        print(f"  {row['state']}: ${row['gdp_per_capita']:,.0f}  (GDP: ${row['real_gdp'] / 1e6:.2f}T)")


def run_all():
    OUTPUT_DIR.mkdir(exist_ok=True)
    results = run_all_scenarios()

    comparison = compare_scenarios(results)
    if len(comparison) > 0:
        comparison.to_csv(OUTPUT_DIR / "scenario_comparison_us_total.csv", index=False)
        print("\nScenario comparison saved.")

    return results


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--all":
        run_all()
    else:
        scenario = sys.argv[1] if len(sys.argv) > 1 else "baseline"
        main(scenario)
