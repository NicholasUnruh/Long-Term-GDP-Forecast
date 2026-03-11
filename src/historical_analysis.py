import pandas as pd
import numpy as np


def compute_gdp_growth_rates(gdp_df):
    df = gdp_df.sort_values(["state", "industry", "date"]).copy()
    df["gdp_qoq"] = df.groupby(["state", "industry"])["real_gdp"].pct_change()
    df["gdp_qoq_annualized"] = (1 + df["gdp_qoq"]) ** 4 - 1

    df["gdp_yoy"] = df.groupby(["state", "industry"])["real_gdp"].pct_change(periods=4)
    return df


def compute_industry_shares(gdp_df):
    totals = gdp_df[gdp_df["industry"] == "All industry total"][
        ["quarter", "state", "real_gdp"]
    ].rename(columns={"real_gdp": "state_total"})

    merged = gdp_df.merge(totals, on=["quarter", "state"], how="left")
    merged["industry_share"] = merged["real_gdp"] / merged["state_total"]
    return merged[["quarter", "state", "industry", "industry_share"]]


def compute_population_growth(pop_df):
    df = pop_df.sort_values(["state", "year"]).copy()
    df["pop_growth"] = df.groupby("state")["population"].pct_change()
    return df


def compute_historical_gdp_per_capita(gdp_df, pop_df):
    gdp_annual = gdp_df.copy()
    gdp_annual["year"] = gdp_annual["date"].dt.year
    gdp_annual = gdp_annual.groupby(["year", "state", "industry"])["real_gdp"].mean().reset_index()

    merged = gdp_annual.merge(pop_df[["year", "state", "population"]], on=["year", "state"], how="inner")
    merged["gdp_per_capita"] = (merged["real_gdp"] * 1_000_000) / merged["population"]
    return merged


def compute_trend_growth(gdp_df, window_years=5):
    df = gdp_df.sort_values(["state", "industry", "date"]).copy()
    window = window_years * 4

    def _cagr(series):
        if len(series) < 2 or series.iloc[0] <= 0 or series.iloc[-1] <= 0:
            return np.nan
        return (series.iloc[-1] / series.iloc[0]) ** (1 / len(series)) - 1

    results = []
    for (state, industry), group in df.groupby(["state", "industry"]):
        group = group.sort_values("date")
        recent = group.tail(window)
        if len(recent) >= 8:
            qtr_cagr = _cagr(recent["real_gdp"])
            annual_cagr = (1 + qtr_cagr) ** 4 - 1 if not np.isnan(qtr_cagr) else np.nan
            results.append({
                "state": state,
                "industry": industry,
                "trend_growth_annual": annual_cagr,
                "trend_growth_quarterly": qtr_cagr,
            })

    return pd.DataFrame(results)


def get_summary_stats(gdp_df, pop_df):
    gdp_with_growth = compute_gdp_growth_rates(gdp_df)
    pop_with_growth = compute_population_growth(pop_df)
    industry_shares = compute_industry_shares(gdp_df)
    trend_growth = compute_trend_growth(gdp_df)

    return {
        "gdp_growth": gdp_with_growth,
        "pop_growth": pop_with_growth,
        "industry_shares": industry_shares,
        "trend_growth": trend_growth,
    }
