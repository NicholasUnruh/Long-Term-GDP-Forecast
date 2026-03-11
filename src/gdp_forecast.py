import pandas as pd
import numpy as np
from src.utils import (
    generate_quarter_range, LEAF_INDUSTRIES, SUB_AGGREGATE_INDUSTRIES,
    AGGREGATE_INDUSTRIES, quarter_to_date,
)
from src.labor_forecast import compute_labor_growth_quarterly
from src.capital_forecast import compute_capital_growth_quarterly, get_alpha
from src.tfp_forecast import get_tfp_growth_quarterly


def compute_gdp_growth_quarterly(config, state, industry, pop_growth_annual):
    tfp_g = get_tfp_growth_quarterly(config, state, industry)
    cap_g = compute_capital_growth_quarterly(config, industry)
    lab_g = compute_labor_growth_quarterly(pop_growth_annual, config)
    alpha = get_alpha(config, industry)

    gdp_growth = tfp_g + alpha * cap_g + (1 - alpha) * lab_g
    return gdp_growth


def get_base_gdp(gdp_df, state, industry):
    mask = (gdp_df["state"] == state) & (gdp_df["industry"] == industry)
    subset = gdp_df[mask].sort_values("date")
    if len(subset) == 0:
        return np.nan, None
    last = subset.iloc[-1]
    return float(last["real_gdp"]), last["quarter"]


def forecast_state_industry(gdp_df, pop_forecast_df, config, state, industry, end_year):
    base_gdp, last_quarter = get_base_gdp(gdp_df, state, industry)
    if np.isnan(base_gdp) or last_quarter is None:
        return pd.DataFrame()

    pop_state = pop_forecast_df[pop_forecast_df["state"] == state].sort_values("year")
    if len(pop_state) < 2:
        pop_growth_annual = 0.005
    else:
        recent = pop_state.tail(10)
        if len(recent) >= 2:
            pop_growth_annual = (recent["population"].iloc[-1] / recent["population"].iloc[0]) ** (
                1 / (len(recent) - 1)
            ) - 1
        else:
            pop_growth_annual = 0.005

    growth_q = compute_gdp_growth_quarterly(config, state, industry, pop_growth_annual)

    forecast_start_q = config["forecast"]["start_quarter"]
    quarters = generate_quarter_range(forecast_start_q, end_year)

    data_end = _next_quarter(last_quarter)
    gap_quarters = generate_quarter_range(data_end, int(forecast_start_q.split(":")[0]))
    gap_quarters = [q for q in gap_quarters if q < forecast_start_q]
    n_gap = len(gap_quarters)
    projected_base = base_gdp * (1 + growth_q) ** (n_gap + 1) if n_gap > 0 else base_gdp * (1 + growth_q)

    gdp_values = [projected_base]
    for _ in quarters[1:]:
        gdp_values.append(gdp_values[-1] * (1 + growth_q))

    records = []
    for q, val in zip(quarters, gdp_values):
        records.append({
            "quarter": q,
            "date": quarter_to_date(q),
            "state": state,
            "industry": industry,
            "real_gdp": val,
            "is_forecast": True,
        })

    return pd.DataFrame(records)


def _next_quarter(q_str):
    year, q = q_str.split(":")
    year = int(year)
    q_num = int(q[1])
    if q_num == 4:
        return f"{year + 1}:Q1"
    return f"{year}:Q{q_num + 1}"


def apply_industry_shifts(forecast_df, config):
    ind_cfg = config.get("industry", {})
    if not ind_cfg.get("structural_shift", False):
        return forecast_df

    shift_rates = ind_cfg.get("shift_rates", {})
    if not shift_rates:
        return forecast_df

    df = forecast_df.copy()
    leaf_df = df[df["industry"].isin(LEAF_INDUSTRIES)].copy()

    shift_map = {ind: rate / 4 for ind, rate in shift_rates.items()}
    leaf_df["shift"] = leaf_df["industry"].map(shift_map).fillna(0.0)

    totals = leaf_df.groupby(["state", "quarter"])["real_gdp"].transform("sum")
    shares = leaf_df["real_gdp"] / totals
    new_shares = (shares + leaf_df["shift"]).clip(lower=0.001)
    norm_totals = new_shares.groupby([leaf_df["state"], leaf_df["quarter"]]).transform("sum")
    new_shares = new_shares / norm_totals

    leaf_df["real_gdp"] = new_shares * totals
    df.loc[leaf_df.index, "real_gdp"] = leaf_df["real_gdp"]

    return df


def build_aggregates(forecast_df):
    govt_children = SUB_AGGREGATE_INDUSTRIES.get("Government and government enterprises", [])
    agg_records = []

    for (state, quarter), group in forecast_df.groupby(["state", "quarter"]):
        leaves = group[group["industry"].isin(LEAF_INDUSTRIES)]
        if len(leaves) == 0:
            continue

        date = group["date"].iloc[0]
        base = {"quarter": quarter, "date": date, "state": state, "is_forecast": True}

        for parent, children in SUB_AGGREGATE_INDUSTRIES.items():
            child_sum = leaves[leaves["industry"].isin(children)]["real_gdp"].sum()
            agg_records.append({**base, "industry": parent, "real_gdp": child_sum})

        leaf_sum = leaves["real_gdp"].sum()
        agg_records.append({**base, "industry": "All industry total", "real_gdp": leaf_sum})

        govt_sum = leaves[leaves["industry"].isin(govt_children)]["real_gdp"].sum()
        agg_records.append({**base, "industry": "Private industries", "real_gdp": leaf_sum - govt_sum})

    return pd.concat([forecast_df, pd.DataFrame(agg_records)], ignore_index=True)


def run_gdp_forecast(gdp_df, pop_forecast_df, config, states=None, industries=None, end_year=2050):
    if states is None:
        states = sorted([s for s in gdp_df["state"].unique() if s != "United States"])
    if industries is None:
        industries = LEAF_INDUSTRIES

    all_forecasts = []
    for state in states:
        for industry in industries:
            fc = forecast_state_industry(gdp_df, pop_forecast_df, config, state, industry, end_year)
            if len(fc) > 0:
                all_forecasts.append(fc)

    if not all_forecasts:
        return pd.DataFrame()

    forecast_df = pd.concat(all_forecasts, ignore_index=True)

    ind_cfg = config.get("industry", {})
    if ind_cfg.get("structural_shift", False):
        forecast_df = apply_industry_shifts(forecast_df, config)

    forecast_df = build_aggregates(forecast_df)

    us_forecast = _compute_us_totals(forecast_df)
    forecast_df = pd.concat([forecast_df, us_forecast], ignore_index=True)

    return forecast_df


def _compute_us_totals(forecast_df):
    all_industries = LEAF_INDUSTRIES + list(SUB_AGGREGATE_INDUSTRIES.keys()) + AGGREGATE_INDUSTRIES

    us_records = []
    for (quarter, industry), group in forecast_df.groupby(["quarter", "industry"]):
        if industry not in all_industries:
            continue
        us_records.append({
            "quarter": quarter,
            "date": group["date"].iloc[0],
            "state": "United States",
            "industry": industry,
            "real_gdp": group["real_gdp"].sum(),
            "is_forecast": True,
        })

    return pd.DataFrame(us_records)
