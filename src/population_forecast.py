import pandas as pd
import numpy as np
from scipy.interpolate import CubicSpline
from src.utils import quarter_to_date, generate_quarter_range


def _compute_state_cagr(pop_df, state, start_year, end_year):
    """Compute compound annual growth rate for a state between two years."""
    sd = pop_df[pop_df["state"] == state].sort_values("year")
    p_start = sd[sd["year"] == start_year]["population"].values
    p_end = sd[sd["year"] == end_year]["population"].values
    if len(p_start) == 0 or len(p_end) == 0 or p_start[0] <= 0:
        return 0.0
    n = end_year - start_year
    if n <= 0:
        return 0.0
    return (p_end[0] / p_start[0]) ** (1.0 / n) - 1.0


def _national_population_path(base_pop, base_year, end_year, target_pop, decel_rate):
    """Generate a smooth national population trajectory from base to target.

    Uses a decelerating growth curve where the annual growth rate declines
    geometrically each year:  rate(t) = initial_rate * (1 - decel_rate)^t

    The initial_rate is solved so that the cumulative growth hits target_pop
    at end_year exactly.
    """
    n_years = end_year - base_year
    if n_years <= 0:
        return {base_year: base_pop}

    growth_needed = target_pop / base_pop

    # Solve for initial_rate: prod_{t=0..n-1} (1 + r0*(1-d)^t) = growth_needed
    # Use binary search since the product is monotonic in r0
    lo, hi = -0.01, 0.05
    for _ in range(200):
        mid = (lo + hi) / 2.0
        product = 1.0
        for t in range(n_years):
            rate_t = mid * ((1.0 - decel_rate) ** t)
            product *= (1.0 + rate_t)
        if product < growth_needed:
            lo = mid
        else:
            hi = mid

    initial_rate = (lo + hi) / 2.0

    path = {base_year: base_pop}
    pop = base_pop
    for t in range(n_years):
        year = base_year + t + 1
        rate_t = initial_rate * ((1.0 - decel_rate) ** t)
        pop = pop * (1.0 + rate_t)
        path[year] = pop

    return path


def forecast_population(pop_df, config, end_year=2050):
    """Forecast state-level population using decelerating growth with national
    target calibration.

    The model:
    1. Computes each state's recent CAGR (compound annual growth rate)
    2. Generates a national population trajectory that smoothly decelerates
       from current growth to hit the configured national target
    3. Evolves each state's share of national population based on relative
       growth differentials (fast-growing states gain share, declining states
       lose share), with the differential damped over time
    4. National total is guaranteed to match the target path exactly

    Config keys (under 'population'):
        national_pop_target: Target US population for end_year (default: 370_000_000)
            Based on Census Bureau / Cooper Center consensus projections.
        growth_deceleration: Annual decay rate for growth (default: 0.04)
            Controls how quickly growth slows. Higher = faster slowdown.
        fit_start_year: Start year for computing recent CAGR (default: 2010)
        share_damping: Annual damping of state growth differentials (default: 0.03)
            How quickly state-level divergence from national average fades.
        by_state: Dict of state-specific growth rate overrides (annual rate).
    """
    pop_config = config.get("population", {})
    fit_start = pop_config.get("fit_start_year", 2010)
    national_target = pop_config.get("national_pop_target", 370_000_000)
    decel_rate = pop_config.get("growth_deceleration", 0.04)
    share_damping = pop_config.get("share_damping", 0.03)
    state_overrides = pop_config.get("by_state", {})

    base_year = pop_df["year"].max()
    states = sorted([s for s in pop_df["state"].unique() if s != "United States"])

    # Compute current base populations and recent growth rates per state
    state_base_pop = {}
    state_cagr = {}
    for state in states:
        sd = pop_df[pop_df["state"] == state].sort_values("year")
        bp = sd[sd["year"] == base_year]["population"].values
        state_base_pop[state] = float(bp[0]) if len(bp) > 0 else 0.0

        if state in state_overrides and state_overrides[state] is not None:
            state_cagr[state] = float(state_overrides[state])
        else:
            state_cagr[state] = _compute_state_cagr(pop_df, state, fit_start, base_year)

    total_base = sum(state_base_pop.values())

    # Compute national CAGR for the same period
    national_cagr = _compute_state_cagr(pop_df, "United States", fit_start, base_year)
    if national_cagr == 0:
        national_cagr = sum(
            state_cagr[s] * state_base_pop[s] for s in states
        ) / total_base

    # Compute growth differentials: how much faster/slower each state grows vs national
    state_differential = {}
    for state in states:
        state_differential[state] = state_cagr[state] - national_cagr

    # Generate the national population path (smooth deceleration to target)
    national_path = _national_population_path(
        total_base, base_year, end_year, national_target, decel_rate
    )

    # Compute current state shares
    state_shares = {}
    for state in states:
        state_shares[state] = state_base_pop[state] / total_base if total_base > 0 else 0

    # Project forward: evolve shares based on damped differentials
    results = []
    for state in states:
        results.append({
            "year": base_year,
            "state": state,
            "population": state_base_pop[state],
        })

    for t in range(1, end_year - base_year + 1):
        year = base_year + t

        # Damping factor: differentials shrink over time
        damp = (1.0 - share_damping) ** t

        # Compute raw (unnormalized) share adjustments
        raw_shares = {}
        for state in states:
            # Each state's share grows/shrinks by its differential, damped over time
            adj = state_differential[state] * damp
            raw_shares[state] = state_shares[state] * (1.0 + adj)

        # Normalize so shares sum to 1.0
        total_raw = sum(raw_shares.values())
        for state in states:
            state_shares[state] = raw_shares[state] / total_raw

        # Apply shares to national total
        nat_pop = national_path[year]
        for state in states:
            pop = nat_pop * state_shares[state]
            results.append({
                "year": year,
                "state": state,
                "population": max(pop, 0),
            })

    all_proj = pd.DataFrame(results)

    # Add US totals
    us_total = all_proj.groupby("year")["population"].sum().reset_index()
    us_total["state"] = "United States"
    all_proj = pd.concat([all_proj, us_total], ignore_index=True)

    # Combine with historical data
    last_year = pop_df["year"].max()
    historical = pop_df[pop_df["year"] <= last_year].copy()
    forecast_only = all_proj[all_proj["year"] > last_year]
    combined = pd.concat([historical, forecast_only], ignore_index=True)

    return combined


# --- Legacy functions (kept for backward compatibility) ---

def fit_population_trend(pop_df, state, fit_start_year=2000):
    state_data = pop_df[(pop_df["state"] == state) & (pop_df["year"] >= fit_start_year)].sort_values("year")
    if len(state_data) < 3:
        state_data = pop_df[pop_df["state"] == state].sort_values("year")

    years = state_data["year"].values.astype(float)
    pop = state_data["population"].values.astype(float)

    log_pop = np.log(pop)
    coeffs = np.polyfit(years, log_pop, deg=1)
    growth_rate = coeffs[0]
    intercept = coeffs[1]

    return {
        "growth_rate": growth_rate,
        "intercept": intercept,
        "last_year": int(years[-1]),
        "last_pop": float(pop[-1]),
    }


def interpolate_to_quarterly(annual_pop_df, start_quarter, end_year):
    quarters = generate_quarter_range(start_quarter, end_year)
    quarter_dates = [quarter_to_date(q) for q in quarters]

    results = []
    for state in annual_pop_df["state"].unique():
        state_data = annual_pop_df[annual_pop_df["state"] == state].sort_values("year")
        years_float = state_data["year"].values.astype(float) + 0.5
        pops = state_data["population"].values.astype(float)

        if len(years_float) < 3:
            continue

        cs = CubicSpline(years_float, pops, extrapolate=True)

        for q, qd in zip(quarters, quarter_dates):
            year_frac = qd.year + (qd.month - 1) / 12
            pop_interp = float(cs(year_frac))
            results.append({"quarter": q, "date": qd, "state": state, "population": max(pop_interp, 0)})

    return pd.DataFrame(results)
