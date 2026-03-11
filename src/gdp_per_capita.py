import pandas as pd
import numpy as np


def compute_gdp_per_capita(gdp_df, pop_quarterly_df):
    merged = gdp_df.merge(
        pop_quarterly_df[["quarter", "state", "population"]],
        on=["quarter", "state"],
        how="left",
    )

    merged["gdp_per_capita"] = np.where(
        merged["population"] > 0,
        (merged["real_gdp"] * 1_000_000) / merged["population"],
        np.nan,
    )

    return merged


def compute_annual_gdp_per_capita(gdp_df, pop_annual_df):
    gdp_annual = gdp_df.copy()
    gdp_annual["year"] = gdp_annual["date"].dt.year
    gdp_annual = gdp_annual.groupby(["year", "state", "industry"])["real_gdp"].mean().reset_index()

    merged = gdp_annual.merge(
        pop_annual_df[["year", "state", "population"]],
        on=["year", "state"],
        how="left",
    )

    merged["gdp_per_capita"] = np.where(
        merged["population"] > 0,
        (merged["real_gdp"] * 1_000_000) / merged["population"],
        np.nan,
    )

    return merged
