import yaml
import copy
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = PROJECT_ROOT / "config" / "forecast_config.yaml"

AGGREGATE_INDUSTRIES = [
    "All industry total",
    "Private industries",
]

SUB_AGGREGATE_INDUSTRIES = {
    "Manufacturing": ["Durable goods manufacturing", "Nondurable goods manufacturing"],
    "Government and government enterprises": ["Federal civilian", "Military", "State and local"],
}

LEAF_INDUSTRIES = [
    "Agriculture, forestry, fishing and hunting",
    "Mining, quarrying, and oil and gas extraction",
    "Utilities",
    "Construction",
    "Durable goods manufacturing",
    "Nondurable goods manufacturing",
    "Wholesale trade",
    "Retail trade",
    "Transportation and warehousing",
    "Information",
    "Finance and insurance",
    "Real estate and rental and leasing",
    "Professional, scientific, and technical services",
    "Management of companies and enterprises",
    "Administrative and support and waste management and remediation services",
    "Educational services",
    "Health care and social assistance",
    "Arts, entertainment, and recreation",
    "Accommodation and food services",
    "Other services (except government and government enterprises)",
    "Federal civilian",
    "Military",
    "State and local",
]

# Growth mode per industry: "exponential" compounds quarterly,
# "linear" uses a fixed dollar increment derived from CAGR * base_gdp.
# Industries not in this dict default to "linear".
DEFAULT_GROWTH_MODES: dict[str, str] = {
    "Information": "exponential",
    "Professional, scientific, and technical services": "exponential",
    "Finance and insurance": "exponential",
    "Management of companies and enterprises": "exponential",
}

ALL_FORECAST_INDUSTRIES = LEAF_INDUSTRIES + list(SUB_AGGREGATE_INDUSTRIES.keys()) + AGGREGATE_INDUSTRIES


def load_config(path=None):
    path = path or CONFIG_PATH
    with open(path, "r") as f:
        return yaml.safe_load(f)


def apply_scenario(config, scenario_name):
    if scenario_name == "baseline" or scenario_name not in config.get("scenarios", {}):
        return config
    overrides = config["scenarios"][scenario_name]
    merged = copy.deepcopy(config)
    _deep_merge(merged, overrides)
    return merged


def _deep_merge(base, override):
    for key, value in override.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value


def quarter_to_date(q_str):
    import pandas as pd
    year, q = q_str.split(":")
    month = {"Q1": 1, "Q2": 4, "Q3": 7, "Q4": 10}[q]
    return pd.Timestamp(year=int(year), month=month, day=1)


def date_to_quarter(dt):
    q = (dt.month - 1) // 3 + 1
    return f"{dt.year}:Q{q}"


def generate_quarter_range(start_q, end_year):
    import pandas as pd
    start = quarter_to_date(start_q)
    end = pd.Timestamp(year=end_year, month=10, day=1)
    dates = pd.date_range(start=start, end=end, freq="QS")
    return [date_to_quarter(d) for d in dates]
