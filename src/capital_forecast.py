import numpy as np


def compute_capital_growth_rate(config, industry=None):
    cap_cfg = config.get("capital", {})
    pf_cfg = config.get("production_function", {})

    inv_ratio = cap_cfg.get("investment_to_gdp_ratio", 0.20)
    ky_ratio = cap_cfg.get("capital_output_ratio", 3.0)
    depreciation = pf_cfg.get("depreciation_rate", 0.05)
    capex_adj = cap_cfg.get("capex_growth_adjustment", 0.0)

    if industry and industry in cap_cfg.get("by_industry", {}):
        ind_cfg = cap_cfg["by_industry"][industry]
        inv_ratio = ind_cfg.get("investment_ratio", inv_ratio)

    capital_growth = (inv_ratio / ky_ratio) - depreciation + capex_adj
    return capital_growth


def compute_capital_growth_quarterly(config, industry=None):
    annual_rate = compute_capital_growth_rate(config, industry)
    quarterly_rate = (1 + annual_rate) ** 0.25 - 1
    return quarterly_rate


def get_alpha(config, industry=None):
    pf_cfg = config.get("production_function", {})
    alpha = pf_cfg.get("alpha", 0.30)

    if industry:
        cap_cfg = config.get("capital", {})
        ind_cfg = cap_cfg.get("by_industry", {}).get(industry, {})
        alpha = ind_cfg.get("alpha", alpha)

    return alpha
