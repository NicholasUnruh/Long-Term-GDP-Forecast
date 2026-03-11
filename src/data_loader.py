import pandas as pd
import numpy as np
from pathlib import Path
from src.utils import PROJECT_ROOT, quarter_to_date


def load_gdp_data(path=None):
    path = path or PROJECT_ROOT / "real_gdp.csv"
    raw = pd.read_csv(path, encoding="utf-8-sig", header=None, low_memory=False)

    areas = raw.iloc[0, 1:].values
    descriptions = raw.iloc[1, 1:].values

    areas = [str(a).strip() for a in areas]
    descriptions = [str(d).strip() for d in descriptions]

    data_rows = raw.iloc[2:]
    quarters = data_rows.iloc[:, 0].astype(str).str.strip()
    valid_mask = quarters.str.contains(":", na=False)
    data_rows = data_rows[valid_mask.values].copy()
    quarters = quarters[valid_mask].values

    values = data_rows.iloc[:, 1:].values

    records = []
    for q_idx, quarter in enumerate(quarters):
        for col_idx in range(len(areas)):
            val = values[q_idx, col_idx]
            try:
                val = float(val)
            except (ValueError, TypeError):
                val = np.nan
            records.append({
                "quarter": quarter,
                "state": areas[col_idx],
                "industry": descriptions[col_idx],
                "real_gdp": val,
            })

    df = pd.DataFrame(records)
    df["date"] = df["quarter"].apply(quarter_to_date)
    df = df.dropna(subset=["real_gdp"])

    return df


def load_population_data(path=None):
    path = path or PROJECT_ROOT / "population.csv"
    raw = pd.read_csv(path, encoding="utf-8-sig")

    id_col = raw.columns[0]
    df = raw.melt(id_vars=[id_col], var_name="state", value_name="population")
    df = df.rename(columns={id_col: "year"})
    df["year"] = df["year"].astype(int)
    df["population"] = pd.to_numeric(df["population"], errors="coerce") * 1000
    df = df.dropna(subset=["population"])

    return df


def align_state_names(gdp_df, pop_df):
    gdp_states = set(gdp_df["state"].unique())
    pop_states = set(pop_df["state"].unique())

    common = gdp_states & pop_states
    gdp_only = gdp_states - pop_states
    pop_only = pop_states - gdp_only

    name_map = {}
    for gs in gdp_only:
        for ps in pop_only:
            if gs.lower().replace(" ", "") == ps.lower().replace(" ", ""):
                name_map[ps] = gs
                break

    if name_map:
        pop_df = pop_df.copy()
        pop_df["state"] = pop_df["state"].replace(name_map)

    return gdp_df, pop_df


def get_states(gdp_df, include_us=False):
    states = sorted(gdp_df["state"].unique())
    if not include_us:
        states = [s for s in states if s != "United States"]
    return states


def get_industries(gdp_df):
    return list(gdp_df["industry"].unique())


def get_last_observed_quarter(gdp_df):
    return gdp_df["quarter"].iloc[-1] if len(gdp_df) > 0 else None


def get_gdp_pivot(gdp_df, state, industry):
    mask = (gdp_df["state"] == state) & (gdp_df["industry"] == industry)
    subset = gdp_df[mask].sort_values("date")
    return subset[["quarter", "date", "real_gdp"]].reset_index(drop=True)
