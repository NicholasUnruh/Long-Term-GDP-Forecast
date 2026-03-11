import numpy as np


def get_tfp_growth_rate(config, state=None, industry=None):
    tfp_cfg = config.get("tfp", {})
    base_rate = tfp_cfg.get("national_growth_rate", 0.010)

    if industry and industry in tfp_cfg.get("by_industry", {}):
        base_rate = tfp_cfg["by_industry"][industry]

    if state and state in tfp_cfg.get("by_state", {}):
        state_adj = tfp_cfg["by_state"][state]
        if isinstance(state_adj, dict):
            base_rate += state_adj.get("adjustment", 0.0)
        else:
            base_rate = state_adj

    return base_rate


def get_tfp_growth_quarterly(config, state=None, industry=None):
    annual_rate = get_tfp_growth_rate(config, state, industry)
    quarterly_rate = (1 + annual_rate) ** 0.25 - 1
    return quarterly_rate
