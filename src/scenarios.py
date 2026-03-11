import pandas as pd
from src.utils import load_config, apply_scenario
from src.data_loader import load_gdp_data, load_population_data, align_state_names
from src.population_forecast import forecast_population, interpolate_to_quarterly
from src.gdp_forecast import run_gdp_forecast
from src.gdp_per_capita import compute_gdp_per_capita


def run_scenario(scenario_name, config_path=None):
    config = load_config(config_path)
    scenario_config = apply_scenario(config, scenario_name)

    gdp_df = load_gdp_data()
    pop_df = load_population_data()
    gdp_df, pop_df = align_state_names(gdp_df, pop_df)

    end_year = scenario_config["forecast"]["end_year"]

    pop_forecast = forecast_population(pop_df, scenario_config, end_year)

    start_q = scenario_config["forecast"]["start_quarter"]
    pop_quarterly = interpolate_to_quarterly(pop_forecast, start_q, end_year)

    gdp_forecast = run_gdp_forecast(gdp_df, pop_forecast, scenario_config, end_year=end_year)

    gdp_pc = compute_gdp_per_capita(gdp_forecast, pop_quarterly)

    return {
        "scenario": scenario_name,
        "config": scenario_config,
        "population_forecast": pop_forecast,
        "gdp_forecast": gdp_forecast,
        "gdp_per_capita": gdp_pc,
    }


def run_all_scenarios(config_path=None):
    config = load_config(config_path)
    scenario_names = list(config.get("scenarios", {}).keys())
    if not scenario_names:
        scenario_names = ["baseline"]

    results = {}
    for name in scenario_names:
        print(f"Running scenario: {name}...")
        results[name] = run_scenario(name, config_path)
        print(f"  Completed: {len(results[name]['gdp_forecast'])} GDP forecast rows")

    return results


def compare_scenarios(results, state="United States", industry="All industry total"):
    comparison = []
    for name, data in results.items():
        fc = data["gdp_forecast"]
        mask = (fc["state"] == state) & (fc["industry"] == industry)
        subset = fc[mask][["quarter", "real_gdp"]].copy()
        subset = subset.rename(columns={"real_gdp": f"gdp_{name}"})
        comparison.append(subset)

    if not comparison:
        return pd.DataFrame()

    merged = comparison[0]
    for df in comparison[1:]:
        merged = merged.merge(df, on="quarter", how="outer")

    return merged.sort_values("quarter").reset_index(drop=True)
