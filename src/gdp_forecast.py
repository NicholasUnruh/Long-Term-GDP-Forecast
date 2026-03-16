import pandas as pd
import numpy as np
from src.utils import (
    generate_quarter_range, LEAF_INDUSTRIES, SUB_AGGREGATE_INDUSTRIES,
    AGGREGATE_INDUSTRIES, quarter_to_date,
)


def compute_historical_cagr(gdp_df, state, industry, start_year=None, cagr_cap=None):
    """Compute the annualized CAGR for a state-industry pair from historical data.

    If start_year is None, uses the full available range (max range).
    If cagr_cap is provided, clamps the annual CAGR to [-cap, +cap].
    Returns (annual_cagr, quarterly_cagr). Falls back to 0.02 annual if data is insufficient.
    """
    mask = (gdp_df["state"] == state) & (gdp_df["industry"] == industry)
    subset = gdp_df[mask].sort_values("date")

    if len(subset) < 2:
        return 0.02, (1.02 ** 0.25) - 1  # fallback: 2% annual

    if start_year is not None:
        subset = subset[subset["date"].dt.year >= start_year]
        if len(subset) < 2:
            # Not enough data in the requested range; use all available
            subset = gdp_df[mask].sort_values("date")

    first_val = float(subset.iloc[0]["real_gdp"])
    last_val = float(subset.iloc[-1]["real_gdp"])

    if first_val <= 0 or last_val <= 0:
        return 0.02, (1.02 ** 0.25) - 1

    n_quarters = len(subset) - 1
    if n_quarters == 0:
        return 0.02, (1.02 ** 0.25) - 1

    # Quarterly CAGR
    quarterly_cagr = (last_val / first_val) ** (1.0 / n_quarters) - 1

    # Annualize
    annual_cagr = (1 + quarterly_cagr) ** 4 - 1

    # Cap extreme values to prevent unrealistic compounding over 25+ years
    if cagr_cap is not None and cagr_cap > 0:
        annual_cagr = max(-cagr_cap, min(cagr_cap, annual_cagr))
        # Recompute quarterly from capped annual
        quarterly_cagr = (1 + annual_cagr) ** 0.25 - 1

    return annual_cagr, quarterly_cagr


def get_base_gdp(gdp_df, state, industry):
    mask = (gdp_df["state"] == state) & (gdp_df["industry"] == industry)
    subset = gdp_df[mask].sort_values("date")
    if len(subset) == 0:
        return np.nan, None
    last = subset.iloc[-1]
    return float(last["real_gdp"]), last["quarter"]


def forecast_state_industry(gdp_df, pop_forecast_df, config, state, industry, end_year):
    """Forecast a single state-industry pair using historical CAGR extrapolation.

    Supports a two-phase growth model:
      - Short-term: uses a CAGR computed from a recent historical window
        (short_term_start_year), applied for short_term_years.
      - Long-term: uses the CAGR from the full historical_range_start_year
        for the remaining forecast horizon.
    If short_term_years is 0 or short_term_start_year is not set, the entire
    forecast uses the long-term rate.
    """
    base_gdp, last_quarter = get_base_gdp(gdp_df, state, industry)
    if np.isnan(base_gdp) or last_quarter is None:
        return pd.DataFrame()

    fc_cfg = config.get("forecast", {})

    # Cap logic
    cagr_cap = fc_cfg.get("cagr_cap", 0)
    cagr_overrides = fc_cfg.get("cagr_overrides", {})
    pair_key = f"{state}|{industry}"
    pair_cap = cagr_overrides.get(pair_key)
    effective_cap = pair_cap if pair_cap is not None else (cagr_cap if cagr_cap else None)

    # Long-term CAGR (full range)
    hist_start = fc_cfg.get("historical_range_start_year", None)
    _, lt_growth_q = compute_historical_cagr(
        gdp_df, state, industry, start_year=hist_start, cagr_cap=effective_cap
    )

    # Short-term CAGR (recent window)
    st_years = fc_cfg.get("short_term_years", 0)
    st_start = fc_cfg.get("short_term_start_year", None)
    if st_years > 0 and st_start is not None:
        _, st_growth_q = compute_historical_cagr(
            gdp_df, state, industry, start_year=st_start, cagr_cap=effective_cap
        )
        st_quarters = st_years * 4  # number of quarters in short-term phase
    else:
        st_growth_q = lt_growth_q
        st_quarters = 0

    forecast_start_q = fc_cfg["start_quarter"]
    quarters = generate_quarter_range(forecast_start_q, end_year)

    # Handle gap between last data point and forecast start
    data_end = _next_quarter(last_quarter)
    gap_quarters = generate_quarter_range(data_end, int(forecast_start_q.split(":")[0]))
    gap_quarters = [q for q in gap_quarters if q < forecast_start_q]
    n_gap = len(gap_quarters)
    # Use short-term rate for the gap projection if short-term is active
    gap_rate = st_growth_q if st_quarters > 0 else lt_growth_q
    projected_base = base_gdp * (1 + gap_rate) ** (n_gap + 1) if n_gap > 0 else base_gdp * (1 + gap_rate)

    gdp_values = [projected_base]
    for idx in range(1, len(quarters)):
        # Use short-term rate for the first st_quarters, then long-term
        rate = st_growth_q if idx < st_quarters else lt_growth_q
        gdp_values.append(gdp_values[-1] * (1 + rate))

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
