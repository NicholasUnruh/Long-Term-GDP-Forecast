import numpy as np


def compute_labor_growth_rate(pop_growth_rate, config):
    labor_cfg = config.get("labor", {})
    lfpr_trend = labor_cfg.get("lfpr_trend", -0.001)
    wa_share_trend = labor_cfg.get("working_age_share_trend", -0.002)
    hours_growth = labor_cfg.get("hours_growth", 0.0)

    labor_growth = pop_growth_rate + lfpr_trend + wa_share_trend + hours_growth
    return labor_growth


def compute_labor_growth_quarterly(pop_growth_annual, config):
    annual_rate = compute_labor_growth_rate(pop_growth_annual, config)
    quarterly_rate = (1 + annual_rate) ** 0.25 - 1
    return quarterly_rate
