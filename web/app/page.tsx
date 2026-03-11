import Link from "next/link";
import { ArrowRight, Cpu, TrendingUp, Users, FlaskConical, Factory, Landmark, Building2, Wheat, Pickaxe, Zap, HardHat, Package, ShoppingCart, Truck, Monitor, Banknote, Home, Briefcase, Building, ClipboardList, GraduationCap, HeartPulse, Palette, UtensilsCrossed, HandHelping, Shield, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BlockEquation, InlineEquation } from "@/components/model-description/equation-display";

export default function ModelDescriptionPage() {
  return (
    <div className="min-h-screen">
      {/* ================================================================== */}
      {/*  HERO SECTION                                                      */}
      {/* ================================================================== */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-muted/50 to-background">
        <div className="container py-16 md:py-24 max-w-4xl mx-auto">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="secondary" className="mb-4">
              Supply-Side Growth Model
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Long-Term US GDP Forecast Model
            </h1>
            <p className="mt-4 text-lg text-muted-foreground md:text-xl">
              A Cobb-Douglas production function approach to forecasting real GDP
              across <strong>50 states + DC</strong>, <strong>23 industries</strong>,
              from <strong>2025 to 2050</strong>.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Quarterly GDP projections, annual population forecasts, and GDP per
              capita -- all driven by configurable assumptions about technology,
              investment, and the labor force.
            </p>
          </div>
        </div>
      </section>

      <div className="container py-12 md:py-16 space-y-16 max-w-4xl mx-auto">
        {/* ================================================================== */}
        {/*  OVERVIEW                                                          */}
        {/* ================================================================== */}
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
          <Separator className="my-4" />
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <h3 className="font-medium">What It Does</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Projects US real GDP by state and industry from the last observed
                quarter (2025:Q3) through the end of 2050 using a neoclassical
                supply-side growth framework. Each state-industry pair receives its
                own constant quarterly growth rate derived from technology,
                investment, and labor assumptions.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Coverage</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                <strong>52 areas</strong> (50 states + DC + US total).{" "}
                <strong>23 leaf industries</strong> forecast independently, with 4
                aggregate categories built from sums. Over{" "}
                <strong>142,000 rows</strong> of quarterly output, plus annual
                population and GDP per capita series.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Key Outputs</h3>
              <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                <li>Quarterly GDP by state and industry (millions, chained 2017$)</li>
                <li>Annual population by state</li>
                <li>Annual GDP per capita by state and industry</li>
                <li>Summary statistics at 5-year milestones</li>
                <li>Multi-scenario comparison tables</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/*  PRODUCTION FUNCTION                                               */}
        {/* ================================================================== */}
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">
            The Production Function
          </h2>
          <Separator className="my-4" />
          <div className="max-w-3xl space-y-4">
            <p className="text-sm text-muted-foreground">
              The model is built on the <strong>Cobb-Douglas production function</strong>,
              which relates output to three inputs: technology (Total Factor
              Productivity), physical capital, and labor. This is the standard
              framework used by the Congressional Budget Office and most
              macroeconomic forecasting agencies.
            </p>

            <div className="rounded-lg border bg-card p-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Level Form
              </p>
              <BlockEquation math="Y = A \cdot K^{\alpha} \cdot L^{1-\alpha}" />
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span><InlineEquation math="Y" /> = Real GDP</span>
                <span className="text-border">|</span>
                <span><InlineEquation math="A" /> = TFP</span>
                <span className="text-border">|</span>
                <span><InlineEquation math="K" /> = Capital stock</span>
                <span className="text-border">|</span>
                <span><InlineEquation math="L" /> = Labor input</span>
                <span className="text-border">|</span>
                <span><InlineEquation math="\alpha" /> = Capital share (0.30)</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              For forecasting, we work with the <strong>growth-rate form</strong>,
              which decomposes GDP growth into contributions from each factor:
            </p>

            <div className="rounded-lg border bg-card p-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Growth Form (the core equation)
              </p>
              <BlockEquation math="\frac{\Delta Y}{Y} = \frac{\Delta A}{A} + \alpha \cdot \frac{\Delta K}{K} + (1 - \alpha) \cdot \frac{\Delta L}{L}" />
              <p className="mt-3 text-xs text-muted-foreground">
                With default parameters: GDP growth = TFP growth + 0.30 &times;
                Capital growth + 0.70 &times; Labor growth. The capital share{" "}
                <InlineEquation math="\alpha" /> can be overridden per industry
                (e.g., 0.50 for Real Estate, 0.20 for Education).
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              All annual growth rates are converted to quarterly using{" "}
              <InlineEquation math="g_q = (1 + g_a)^{0.25} - 1" />, ensuring
              proper compounding over the 25-year forecast horizon.
            </p>
          </div>
        </section>

        {/* ================================================================== */}
        {/*  COMPONENT MODELS                                                  */}
        {/* ================================================================== */}
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">
            Component Models
          </h2>
          <Separator className="my-4" />
          <p className="mb-6 text-sm text-muted-foreground max-w-3xl">
            Each of the three production factors -- technology, capital, and labor --
            is modeled separately with its own set of configurable parameters.
            Together, they determine the growth rate of every state-industry pair.
          </p>

          <div className="grid gap-6 md:grid-cols-3">
            {/* --- TFP Card --- */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                    <Cpu className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>TFP (Technology)</CardTitle>
                    <CardDescription>Total Factor Productivity</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md bg-muted/50 p-3 overflow-x-auto">
                  <BlockEquation math="g_{TFP} = \text{national} + \Delta_{\text{industry}} + \Delta_{\text{state}}" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Captures technological progress, innovation, and efficiency
                  improvements. The single most important driver of long-term
                  growth. Configured as a national baseline with optional
                  per-industry and per-state overrides applied as a cascade.
                </p>
                <div className="space-y-1">
                  <p className="text-xs font-medium">Key Parameters</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline">national: 1.2%</Badge>
                    <Badge variant="outline">Info: 2.2%</Badge>
                    <Badge variant="outline">Prof. Services: 1.8%</Badge>
                    <Badge variant="outline">Mining: 0.5%</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  CBO historical trend: ~1.0%. Our baseline adds +0.15pp for moderate
                  AI gains (Penn Wharton/OECD estimates). Industry TFP calibrated from
                  BLS 2019-2024 data.
                </p>
              </CardContent>
            </Card>

            {/* --- Capital Card --- */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Capital (Investment)</CardTitle>
                    <CardDescription>Physical capital accumulation</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md bg-muted/50 p-3 overflow-x-auto">
                  <BlockEquation math="g_K = \frac{I/Y}{K/Y} - \delta + \text{adj}" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Capital growth depends on the investment-to-GDP ratio, the
                  capital-output ratio, the depreciation rate, and an optional
                  capex adjustment. With defaults: 0.21/3.0 - 0.05 + 0.002 = 2.20%
                  annual capital growth.
                </p>
                <div className="space-y-1">
                  <p className="text-xs font-medium">Key Parameters</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline">I/Y: 0.21</Badge>
                    <Badge variant="outline">K/Y: 3.0</Badge>
                    <Badge variant="outline"><InlineEquation math="\delta" />: 5.0%</Badge>
                    <Badge variant="outline">adj: +0.2%</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Per-industry overrides for both investment ratio and{" "}
                  <InlineEquation math="\alpha" /> (e.g., Utilities{" "}
                  <InlineEquation math="\alpha" />=0.45, Education{" "}
                  <InlineEquation math="\alpha" />=0.20).
                </p>
              </CardContent>
            </Card>

            {/* --- Labor Card --- */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Labor (Workforce)</CardTitle>
                    <CardDescription>Labor force dynamics</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-md bg-muted/50 p-3 overflow-x-auto">
                  <BlockEquation math="g_L = g_{\text{pop}} + \Delta\text{LFPR} + \Delta\text{WAS} + g_{\text{hours}}" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Labor growth is derived from population growth (state-level
                  forecast) plus adjustments for labor force participation rate
                  trends, working-age share changes, and average hours worked.
                  Negative values represent demographic headwinds from an aging
                  population.
                </p>
                <div className="space-y-1">
                  <p className="text-xs font-medium">Key Parameters</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline">LFPR: -0.14%/yr</Badge>
                    <Badge variant="outline">WAS: -0.2%/yr</Badge>
                    <Badge variant="outline">Unemp: 4.0%</Badge>
                    <Badge variant="outline">Hours: -0.1%</Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  US LFPR peaked at ~67% in 2000, declined to ~62% by 2020.
                  Working-age share declining as baby boomers retire.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ================================================================== */}
        {/*  INDUSTRY HIERARCHY                                                */}
        {/* ================================================================== */}
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">
            Industry Hierarchy
          </h2>
          <Separator className="my-4" />
          <div className="max-w-4xl space-y-4">
            <p className="text-sm text-muted-foreground">
              The model forecasts <strong>23 leaf industries</strong> independently
              for each state. Aggregate categories (All Industry Total, Private
              Industries, Manufacturing, Government) are computed as sums of their
              children -- they are never forecast directly. This ensures internal
              consistency: the whole always equals the sum of its parts.
            </p>

            <div className="grid gap-6 md:grid-cols-2">
              {/* --- Goods-Producing & Resources --- */}
              <div className="space-y-4">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Wheat className="h-4 w-4 text-muted-foreground" />
                    Resources &amp; Extraction
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Agriculture, forestry, fishing and hunting
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Mining, quarrying, and oil and gas extraction
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    Utilities &amp; Construction
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Utilities
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Construction
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Factory className="h-4 w-4 text-muted-foreground" />
                    Manufacturing
                    <Badge variant="secondary" className="text-[10px]">Aggregate</Badge>
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Durable goods manufacturing
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Nondurable goods manufacturing
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    Trade &amp; Transportation
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Wholesale trade
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Retail trade
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Transportation and warehousing
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Landmark className="h-4 w-4 text-muted-foreground" />
                    Government
                    <Badge variant="secondary" className="text-[10px]">Aggregate</Badge>
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Federal civilian
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Military
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      State and local
                    </li>
                  </ul>
                </div>
              </div>

              {/* --- Services --- */}
              <div className="space-y-4">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Monitor className="h-4 w-4 text-muted-foreground" />
                    Information &amp; Technology
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Information
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Banknote className="h-4 w-4 text-muted-foreground" />
                    Finance &amp; Real Estate
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Finance and insurance
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Real estate and rental and leasing
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    Professional &amp; Business Services
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Professional, scientific, and technical services
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Management of companies and enterprises
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Administrative and support and waste management
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <HeartPulse className="h-4 w-4 text-muted-foreground" />
                    Education &amp; Health
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Educational services
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Health care and social assistance
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                    Leisure &amp; Other Services
                  </h3>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Arts, entertainment, and recreation
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Accommodation and food services
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
                      Other services (except government)
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 text-xs text-muted-foreground">
              <strong>How aggregates work:</strong> &quot;All industry total&quot; is
              the sum of all 23 leaf industries. &quot;Private industries&quot; = All
              industry total minus Government. &quot;Manufacturing&quot; = Durable +
              Nondurable goods. &quot;Government&quot; = Federal civilian + Military +
              State and local. Industry structural shifts can optionally reallocate
              GDP shares across sectors over time (e.g., Information growing at
              +0.25 pp/yr while Manufacturing shrinks at -0.12 pp/yr).
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/*  POPULATION MODEL                                                  */}
        {/* ================================================================== */}
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">
            Population Model
          </h2>
          <Separator className="my-4" />
          <div className="max-w-3xl space-y-4">
            <p className="text-sm text-muted-foreground">
              Population is the foundation of the labor force, which drives GDP. The
              model uses <strong>decelerating growth with national target
              calibration</strong>, producing projections aligned with the US Census
              Bureau (~369M by 2050), Cooper Center (~371M), and CBO (~360M) forecasts.
            </p>

            <div className="rounded-lg border bg-card p-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Decelerating Growth Model
              </p>
              <BlockEquation math="r_{\text{nat}}(t) = r_0 \cdot (1 - d)^t" />
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span><InlineEquation math="r_0" /> = initial national growth rate (solved to hit target)</span>
                <span className="text-border">|</span>
                <span><InlineEquation math="d" /> = deceleration rate</span>
                <span className="text-border">|</span>
                <span><InlineEquation math="t" /> = years from start</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              The model works in three steps: (1) compute each state&apos;s recent
              compound annual growth rate (CAGR) from historical data, (2) generate a
              smooth national population trajectory where growth decelerates each year
              to exactly hit the configured target, and (3) evolve each state&apos;s
              share of the national total based on its growth differential relative to
              the national average, with damping so that state-level divergence
              gradually fades.
            </p>
            <p className="text-sm text-muted-foreground">
              This captures key demographic trends: sub-replacement fertility
              (TFR ~1.6), deaths exceeding births by ~2030, net immigration as the
              primary growth driver, and Sun Belt states gaining population share while
              Rust Belt states decline. Annual forecasts are interpolated to quarterly
              frequency using a <strong>cubic spline</strong>. The &quot;United
              States&quot; total is always the sum of individual state populations.
            </p>
          </div>
        </section>

        {/* ================================================================== */}
        {/*  SCENARIOS                                                         */}
        {/* ================================================================== */}
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">
            Built-In Scenarios
          </h2>
          <Separator className="my-4" />
          <div className="max-w-4xl space-y-6">
            <p className="text-sm text-muted-foreground">
              The model ships with four pre-built scenarios calibrated from research
              by the CBO, Federal Reserve, BLS, IMF, OECD, and leading economic
              institutions. All scenarios incorporate AI&apos;s impact on productivity --
              the key differentiator is <strong>how much</strong> and{" "}
              <strong>how fast</strong> AI transforms the economy. Scenarios use a{" "}
              <strong>deep-merge</strong> strategy: only the parameters listed are
              changed; everything else inherits from the baseline.
            </p>

            {/* ── Parameter Comparison Table ── */}
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Parameter</TableHead>
                      <TableHead>Baseline</TableHead>
                      <TableHead>High Growth</TableHead>
                      <TableHead>Low Growth</TableHead>
                      <TableHead>AI Boom</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">TFP Growth</TableCell>
                      <TableCell>1.2%</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">1.5%</TableCell>
                      <TableCell className="text-red-600 dark:text-red-400">0.8%</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">2.0%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">AI TFP Boost</TableCell>
                      <TableCell>+0.15pp</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">+0.4pp</TableCell>
                      <TableCell className="text-red-600 dark:text-red-400">~0pp</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">+1.0pp</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Investment / GDP</TableCell>
                      <TableCell>21%</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">23%</TableCell>
                      <TableCell className="text-red-600 dark:text-red-400">18%</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">24%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">CapEx Adjustment</TableCell>
                      <TableCell>+0.2%</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">+0.4%</TableCell>
                      <TableCell className="text-red-600 dark:text-red-400">-0.2%</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">+0.8%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">LFPR Trend</TableCell>
                      <TableCell>-0.14%/yr</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">-0.05%/yr</TableCell>
                      <TableCell className="text-red-600 dark:text-red-400">-0.20%/yr</TableCell>
                      <TableCell>-0.10%/yr</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Population 2050</TableCell>
                      <TableCell>370M</TableCell>
                      <TableCell className="text-green-600 dark:text-green-400">380M</TableCell>
                      <TableCell className="text-red-600 dark:text-red-400">360M</TableCell>
                      <TableCell>370M</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Implied GDP CAGR</TableCell>
                      <TableCell className="font-mono">~1.8%</TableCell>
                      <TableCell className="font-mono text-green-600 dark:text-green-400">~2.5%</TableCell>
                      <TableCell className="font-mono text-red-600 dark:text-red-400">~0.9%</TableCell>
                      <TableCell className="font-mono text-green-600 dark:text-green-400">~3.1%</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Industry TFP Overrides</TableCell>
                      <TableCell className="text-xs">BLS-calibrated defaults</TableCell>
                      <TableCell className="text-xs text-green-600 dark:text-green-400">
                        Info 2.8%, Prof 2.4%
                      </TableCell>
                      <TableCell className="text-xs text-red-600 dark:text-red-400">
                        Info 1.2%, Mfg 0.3%
                      </TableCell>
                      <TableCell className="text-xs text-green-600 dark:text-green-400">
                        Info 4.5%, Prof 3.5%, Fin 3.0%
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* ── Detailed Scenario Cards ── */}
            <div className="grid gap-5 md:grid-cols-2">
              {/* Baseline */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Baseline</CardTitle>
                  <CardDescription>
                    Moderate AI adoption, CBO-aligned growth
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono">~1.8%</span>
                    <span className="text-sm text-muted-foreground">GDP CAGR</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI delivers measurable but modest productivity gains (+0.15pp TFP),
                    concentrated in knowledge-intensive sectors like information and
                    professional services. Demographics remain the primary headwind as
                    baby boomer retirement continues and immigration holds steady.
                    Aligned with the FOMC longer-run 1.8% GDP growth estimate and the
                    CBO central case.
                  </p>
                  <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground space-y-1">
                    <p><strong>TFP rationale:</strong> CBO trend of 1.0% + Penn Wharton/OECD
                    conservative AI estimate of +0.15pp = 1.2%</p>
                    <p><strong>Labor:</strong> BLS projects LFPR declining -0.14pp/yr
                    (62.6% to 61.2% by 2033). Average hours declining per BLS data.</p>
                    <p><strong>Capital:</strong> Investment/GDP at 21% matches 2024 actual
                    GFCF data (CEIC). Modest capex boost from AI infrastructure.</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">
                    Sources: CBO Budget Outlook 2025-2035, FOMC Dec 2025 projections,
                    Penn Wharton Budget Model, BLS labor force projections 2023-2033
                  </p>
                </CardContent>
              </Card>

              {/* High Growth */}
              <Card className="border-green-200 dark:border-green-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-green-700 dark:text-green-400">
                    High Growth
                  </CardTitle>
                  <CardDescription>
                    Strong AI adoption + favorable policy + high investment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-green-700 dark:text-green-400">~2.5%</span>
                    <span className="text-sm text-muted-foreground">GDP CAGR</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI adoption accelerates through favorable policy (immigration reform,
                    R&amp;D tax incentives), a strong investment climate, and rapid institutional
                    adaptation. The OECD upper-range AI impact (+0.4pp TFP boost) materializes
                    alongside demographic tailwinds from higher immigration (380M by 2050).
                    Investment booms from AI infrastructure buildout and manufacturing reshoring.
                  </p>
                  <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground space-y-1">
                    <p><strong>TFP rationale:</strong> CBO high-TFP scenario (baseline + 0.5pp) = 1.5%.
                    Consistent with OECD upper-range AI productivity estimates.</p>
                    <p><strong>Labor:</strong> Immigration reform keeps workforce younger (LFPR -0.05%/yr).
                    Remote work flexibility maintains average hours.</p>
                    <p><strong>Capital:</strong> Investment/GDP rises to 23% driven by AI capex +
                    infrastructure spending. Tighter labor market (3.5% unemployment).</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">
                    Sources: CBO high-TFP alternative scenario (+0.5pp), OECD AI Productivity
                    Assessment (2024), BLS employment projections 2024-2034
                  </p>
                </CardContent>
              </Card>

              {/* Low Growth */}
              <Card className="border-red-200 dark:border-red-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-red-700 dark:text-red-400">
                    Low Growth
                  </CardTitle>
                  <CardDescription>
                    AI disappointment + demographic headwinds + weak investment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-red-700 dark:text-red-400">~0.9%</span>
                    <span className="text-sm text-muted-foreground">GDP CAGR</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI fails to deliver broad productivity gains -- the Acemoglu (2024) thesis
                    is vindicated. The hype cycle peaks without meaningful economic
                    transformation. Combined with aging demographics, sharply curtailed
                    immigration (360M by 2050), and weak business investment, the US enters a
                    Japan-style period of secular stagnation. Structural unemployment rises
                    as displaced workers struggle to transition.
                  </p>
                  <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground space-y-1">
                    <p><strong>TFP rationale:</strong> CBO low-TFP scenario (baseline - 0.5pp) gives 0.6%.
                    We use 0.8% (AI provides marginal, not zero, gains). Acemoglu (2024)
                    estimated only +0.07pp from AI.</p>
                    <p><strong>Labor:</strong> Accelerated retirement (LFPR -0.20%/yr), reduced immigration.
                    Shorter workweeks from weak aggregate demand.</p>
                    <p><strong>Capital:</strong> Investment/GDP drops to 18%. Policy uncertainty and
                    AI capex writedowns drag on investment.</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">
                    Sources: Acemoglu (2024) &quot;The Simple Macroeconomics of AI&quot;,
                    CBO low-TFP alternative scenario (-0.5pp), Census low-immigration projections
                  </p>
                </CardContent>
              </Card>

              {/* AI Boom */}
              <Card className="border-blue-200 dark:border-blue-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-blue-700 dark:text-blue-400">
                    AI Boom
                  </CardTitle>
                  <CardDescription>
                    Transformative AI reshapes the economy
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-400">~3.1%</span>
                    <span className="text-sm text-muted-foreground">GDP CAGR</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    AI proves truly transformative, consistent with Aghion &amp; Bunel (2024) and
                    Goldman Sachs&apos; optimistic projections. Massive capital deepening in AI
                    infrastructure drives TFP gains approaching 1960s levels (+1.0pp AI boost).
                    AI augments workers across most sectors, creating new job categories faster
                    than it displaces existing ones. The economy structurally shifts toward
                    knowledge-intensive sectors (Information gains +0.40pp/yr GDP share).
                  </p>
                  <div className="rounded-md bg-muted/50 p-2.5 text-xs text-muted-foreground space-y-1">
                    <p><strong>TFP rationale:</strong> CBO baseline 1.0% + Aghion/Goldman AI boost of ~1.0pp = 2.0%.
                    Tech-heavy sectors see 3.5-4.5% TFP growth. 10 industries get specific overrides.</p>
                    <p><strong>Capital:</strong> Investment/GDP reaches 24% (AI capex adds 1.5-2pp).
                    K/Y ratio drops to 2.8 as AI capital (software/IP) is more productive per dollar.
                    Depreciation rises to 5.5% (shorter-lived AI assets).</p>
                    <p><strong>Structure:</strong> Economy-wide industry reallocation. Information,
                    professional services, and healthcare gain share. Manufacturing, retail, and
                    administrative services decline as AI automation accelerates.</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">
                    Sources: Aghion &amp; Bunel &quot;AI and Growth&quot; (2024, SF Fed),
                    Goldman Sachs AI economic scenarios, McKinsey AI automation potential estimates
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* ── AI Impact Research Context ── */}
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <h4 className="text-sm font-medium mb-2">
                  How We Calibrate AI&apos;s Impact
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Every scenario includes some AI effect on TFP. The range of credible
                  estimates for AI&apos;s annual TFP impact over the next decade spans from
                  near-zero to +1.5 percentage points:
                </p>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                  <div className="rounded-md border bg-background p-2.5">
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">Conservative</p>
                    <p className="text-lg font-mono font-bold">+0.07pp</p>
                    <p className="text-[10px] text-muted-foreground">Acemoglu (2024, MIT)</p>
                  </div>
                  <div className="rounded-md border bg-background p-2.5">
                    <p className="text-xs font-medium">Evidence-based</p>
                    <p className="text-lg font-mono font-bold">+0.15pp</p>
                    <p className="text-[10px] text-muted-foreground">Penn Wharton / IMF (2025)</p>
                  </div>
                  <div className="rounded-md border bg-background p-2.5">
                    <p className="text-xs font-medium text-green-600 dark:text-green-400">Moderate</p>
                    <p className="text-lg font-mono font-bold">+0.3-0.6pp</p>
                    <p className="text-[10px] text-muted-foreground">OECD / McKinsey (2024)</p>
                  </div>
                  <div className="rounded-md border bg-background p-2.5">
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Optimistic</p>
                    <p className="text-lg font-mono font-bold">+0.7-1.3pp</p>
                    <p className="text-[10px] text-muted-foreground">Aghion / Goldman Sachs</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-2.5">
                  Note: Goldman Sachs&apos; chief economist acknowledged in early 2026 that
                  AI&apos;s actual GDP impact in 2025 was &quot;basically zero,&quot; with
                  broad-based adoption expected to accelerate later this decade.
                  Our scenarios span this full range of uncertainty.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ================================================================== */}
        {/*  LIMITATIONS                                                       */}
        {/* ================================================================== */}
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">
            Limitations &amp; Assumptions
          </h2>
          <Separator className="my-4" />
          <div className="max-w-3xl">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-medium">Constant Growth Rates</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Each state-industry pair receives a single constant quarterly
                  growth rate for the entire 25-year horizon. There is no
                  time-varying growth, no ramp-up or ramp-down, and no business
                  cycles. This is standard for supply-side long-term models.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-medium">No Feedback Loops</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  The three factors (TFP, capital, labor) are independent. Higher
                  GDP does not increase investment, and faster population growth
                  does not affect wages or productivity. This is a deliberate
                  simplification for transparency.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-medium">Supply-Side Only</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  The model captures potential GDP -- the economy&apos;s productive
                  capacity. It does not model demand-side fluctuations, monetary
                  policy, fiscal stimulus, recessions, or financial crises.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-medium">BEA Data Suppression</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Some state-industry combinations in the BEA data end before
                  2025:Q3 (DC, Wyoming, Delaware have suppressed values for certain
                  small industries). The model handles this by projecting forward
                  from the last available data point.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-medium">Population Model</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Population uses decelerating growth calibrated to a national
                  target (default ~370M by 2050, aligned with Census/Cooper Center
                  projections). While this captures migration-driven state
                  differences and national deceleration, it does not model age
                  structure, cohort-component dynamics, or state-level migration flows
                  explicitly.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="text-sm font-medium">Chained Dollars</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  All GDP values are in millions of chained 2017 dollars. While
                  leaf industry sums approximate aggregates well, chained-dollar
                  arithmetic is not perfectly additive -- small discrepancies are
                  possible at the aggregate level.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================================== */}
        {/*  CTA                                                               */}
        {/* ================================================================== */}
        <section className="pb-4">
          <Separator className="mb-8" />
          <div className="mx-auto max-w-xl text-center">
            <h2 className="text-xl font-semibold tracking-tight">
              Ready to explore?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Configure the model parameters yourself -- adjust TFP growth rates,
              investment assumptions, labor dynamics, and more. See how different
              assumptions shape the 25-year trajectory of the US economy.
            </p>
            <div className="mt-6">
              <Link href="/configure">
                <Button size="lg">
                  Configure Parameters
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
