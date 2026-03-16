import { LineChart, Line, ReferenceLine, ResponsiveContainer, Dot, Tooltip as RechartsTooltip } from "recharts";
import type { TrafficDaily } from "@/lib/dashboard-api";

interface SparklineTooltipProps {
  dailyData: TrafficDaily[];
  metricFn: (d: TrafficDaily) => number;
  formatValue: (v: number) => string;
  label: string;
  /** Optional: function that returns true if the raw data for this day is valid for the metric */
  isValidDay?: (d: TrafficDaily) => boolean;
  /** If true, lower values are better (CPC, CPM). Swaps above/below color logic. */
  inverted?: boolean;
  /** Max value cap (e.g., 1.0 for percentages that can't exceed 100%) */
  maxValue?: number;
}

function formatDayLabel(dia: string) {
  try {
    const d = new Date(dia);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return dia;
  }
}

/**
 * Interpolate invalid/gap values using the average of nearest valid neighbors.
 * Also detects outliers (>3x median) and interpolates them.
 * Adds ±12% jitter so estimated points look natural.
 */
function interpolateGaps(
  data: { dia: string; value: number; valid: boolean }[]
): { dia: string; value: number; estimated: boolean }[] {
  const result = data.map((d) => ({ dia: d.dia, value: d.value, estimated: false, valid: d.valid }));

  // Step 1: collect valid values to compute median for outlier detection
  const validValues = result.filter(d => d.valid && d.value > 0).map(d => d.value);
  let median = 0;
  if (validValues.length > 0) {
    const sorted = [...validValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  // Step 2: mark invalid days, outliers (>4x median), AND suspiciously low values (<0.15x median) as needing interpolation
  const needsInterp: Set<number> = new Set();
  for (let i = 0; i < result.length; i++) {
    if (!result[i].valid || result[i].value === 0) {
      needsInterp.add(i);
    } else if (median > 0 && result[i].value > median * 4) {
      needsInterp.add(i);
    } else if (median > 0 && result[i].value < median * 0.15) {
      // Detect suspiciously low values (broken pixel data)
      needsInterp.add(i);
    }
  }

  // If none or all need interpolation, return as-is
  if (needsInterp.size === 0 || needsInterp.size === result.length) {
    return result.map(d => ({ dia: d.dia, value: d.value, estimated: false }));
  }

  for (const idx of needsInterp) {
    let prevVal: number | null = null;
    for (let j = idx - 1; j >= 0; j--) {
      if (!needsInterp.has(j)) { prevVal = result[j].value; break; }
    }
    let nextVal: number | null = null;
    for (let j = idx + 1; j < result.length; j++) {
      if (!needsInterp.has(j)) { nextVal = result[j].value; break; }
    }

    let estimated = 0;
    if (prevVal !== null && nextVal !== null) {
      estimated = (prevVal + nextVal) / 2;
    } else if (prevVal !== null) {
      estimated = prevVal;
    } else if (nextVal !== null) {
      estimated = nextVal;
    }

    // Jitter ±12%
    const jitter = 1 + (Math.random() * 0.24 - 0.12);
    result[idx] = { ...result[idx], value: estimated * jitter, estimated: true };
  }

  return result.map(d => ({ dia: d.dia, value: d.value, estimated: d.estimated }));
}

function CustomTooltipContent({ active, payload, avg, formatValue }: any) {
  if (!active || !payload?.[0]) return null;
  const { dia, value, estimated } = payload[0].payload;
  const diff = avg !== 0 ? ((value - avg) / Math.abs(avg)) * 100 : 0;
  const isAbove = value > avg;

  return (
    <div className="bg-popover border border-border rounded-md px-2.5 py-1.5 shadow-lg text-[10px]">
      <p className="font-semibold text-foreground mb-0.5">
        {formatDayLabel(dia)}
        {estimated && <span className="ml-1 text-yellow-400">≈ estimado</span>}
      </p>
      <p className="text-foreground">Valor: <span className="font-medium">{formatValue(value)}</span></p>
      <p className="text-muted-foreground">Média: <span className="font-medium">{formatValue(avg)}</span></p>
      <p className={isAbove ? 'text-primary' : 'text-destructive'}>
        {diff >= 0 ? '+' : ''}{diff.toFixed(1)}% vs média
      </p>
    </div>
  );
}

export function SparklineTooltip({ dailyData, metricFn, formatValue, label, isValidDay, inverted = false, maxValue }: SparklineTooltipProps) {
  if (!dailyData || dailyData.length === 0) {
    return (
      <div className="w-72 p-3">
        <p className="text-xs font-semibold mb-1 text-foreground">{label} — Últimos 20 dias</p>
        <p className="text-[10px] text-muted-foreground">Dados insuficientes para o gráfico</p>
      </div>
    );
  }

  // Reverse so oldest date is on the LEFT, newest on the RIGHT
  const sorted = [...dailyData].sort((a, b) => new Date(a.dia).getTime() - new Date(b.dia).getTime());
  const rawData = sorted.map((d) => ({
    dia: d.dia,
    value: metricFn(d),
    valid: isValidDay ? isValidDay(d) : true,
  }));

  let chartData = interpolateGaps(rawData);
  // Apply max value cap if specified (e.g., 100% for conversion rates)
  if (maxValue !== undefined) {
    chartData = chartData.map(d => ({ ...d, value: Math.min(d.value, maxValue) }));
  }
  const realValues = chartData.filter(d => !d.estimated).map(d => d.value);
  const avg = realValues.length > 0
    ? realValues.reduce((s, v) => s + v, 0) / realValues.length
    : chartData.reduce((s, d) => s + d.value, 0) / chartData.length;

  const estimatedCount = chartData.filter(d => d.estimated).length;

  return (
    <div className="w-80 p-3" onClick={(e) => e.stopPropagation()}>
      <p className="text-xs font-semibold mb-1 text-foreground">{label} — {chartData.length} dias</p>
      <p className="text-[10px] text-muted-foreground mb-2">
        Média: <span className="font-medium text-foreground">{formatValue(avg)}</span>
        <span className="ml-2">({realValues.length} dias reais{estimatedCount > 0 ? `, ${estimatedCount} estimados` : ''})</span>
      </p>
      <div className="h-32 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <ReferenceLine
              y={avg}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="4 3"
              strokeWidth={1}
            />
            <RechartsTooltip
              content={<CustomTooltipContent avg={avg} formatValue={formatValue} />}
              cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (payload.estimated) {
                  return (
                    <Dot
                      cx={cx}
                      cy={cy}
                      r={3}
                      fill="hsl(45, 93%, 47%)"
                      stroke="hsl(var(--card))"
                      strokeWidth={1.5}
                    />
                  );
                }
                const isAbove = payload.value > avg * 1.05;
                const isBelow = payload.value < avg * 0.95;
                if (!isAbove && !isBelow) return <Dot cx={cx} cy={cy} r={0} fill="none" stroke="none" />;
                // When inverted (CPC/CPM), above avg = bad (red), below avg = good (green)
                const goodColor = "hsl(var(--primary))";
                const badColor = "hsl(var(--destructive))";
                const fillColor = inverted
                  ? (isAbove ? badColor : goodColor)
                  : (isAbove ? goodColor : badColor);
                return (
                  <Dot
                    cx={cx}
                    cy={cy}
                    r={3}
                    fill={fillColor}
                    stroke="hsl(var(--card))"
                    strokeWidth={1.5}
                  />
                );
              }}
              activeDot={{
                r: 4,
                stroke: "hsl(var(--foreground))",
                strokeWidth: 2,
                fill: "hsl(var(--card))",
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
        <span>{formatDayLabel(chartData[0]?.dia)}</span>
        <span>{formatDayLabel(chartData[chartData.length - 1]?.dia)}</span>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[9px]">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Acima</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Abaixo</span>
        {estimatedCount > 0 && (
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'hsl(45, 93%, 47%)' }} /> Estimado</span>
        )}
      </div>
    </div>
  );
}
