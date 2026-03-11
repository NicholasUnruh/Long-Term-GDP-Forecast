export const LEAF_INDUSTRIES = [
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
] as const;

// Short display names for industries
export const INDUSTRY_SHORT_NAMES: Record<string, string> = {
  "Agriculture, forestry, fishing and hunting": "Agriculture",
  "Mining, quarrying, and oil and gas extraction": "Mining",
  "Utilities": "Utilities",
  "Construction": "Construction",
  "Durable goods manufacturing": "Durable Mfg",
  "Nondurable goods manufacturing": "Nondurable Mfg",
  "Wholesale trade": "Wholesale",
  "Retail trade": "Retail",
  "Transportation and warehousing": "Transportation",
  "Information": "Information",
  "Finance and insurance": "Finance",
  "Real estate and rental and leasing": "Real Estate",
  "Professional, scientific, and technical services": "Prof/Tech Services",
  "Management of companies and enterprises": "Management",
  "Administrative and support and waste management and remediation services": "Admin/Support",
  "Educational services": "Education",
  "Health care and social assistance": "Healthcare",
  "Arts, entertainment, and recreation": "Arts/Entertainment",
  "Accommodation and food services": "Accommodation/Food",
  "Other services (except government and government enterprises)": "Other Services",
  "Federal civilian": "Federal Civilian",
  "Military": "Military",
  "State and local": "State & Local Govt",
};

// 23-color palette grouped by industry type
export const INDUSTRY_COLORS: Record<string, string> = {
  // Capital-intensive (warm tones)
  "Real estate and rental and leasing": "#B71C1C",
  "Utilities": "#D32F2F",
  "Mining, quarrying, and oil and gas extraction": "#E53935",
  "Durable goods manufacturing": "#F4511E",
  "Nondurable goods manufacturing": "#FF7043",
  "Agriculture, forestry, fishing and hunting": "#FF8A65",
  // Knowledge/Tech (blues)
  "Information": "#0D47A1",
  "Professional, scientific, and technical services": "#1565C0",
  "Finance and insurance": "#1976D2",
  "Management of companies and enterprises": "#42A5F5",
  // Services (greens)
  "Health care and social assistance": "#1B5E20",
  "Educational services": "#2E7D32",
  "Administrative and support and waste management and remediation services": "#43A047",
  "Accommodation and food services": "#66BB6A",
  "Retail trade": "#81C784",
  "Wholesale trade": "#A5D6A7",
  // Other (purples)
  "Construction": "#4A148C",
  "Transportation and warehousing": "#6A1B9A",
  "Arts, entertainment, and recreation": "#7B1FA2",
  "Other services (except government and government enterprises)": "#9C27B0",
  // Government (grays)
  "Federal civilian": "#37474F",
  "Military": "#546E7A",
  "State and local": "#78909C",
};

export const SCENARIOS = ['baseline', 'high_growth', 'low_growth', 'ai_boom'] as const;

export const SCENARIO_LABELS: Record<string, string> = {
  baseline: 'Baseline',
  high_growth: 'High Growth',
  low_growth: 'Low Growth',
  ai_boom: 'AI Boom',
};
