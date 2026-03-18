import { LineChart, Line, ReferenceLine, ResponsiveContainer, Dot, Tooltip as RechartsTooltip } from "recharts";
import type { TrafficDaily } from "@/lib/dashboard-api";
import { formatDayMonth } from "@/lib/date-utils";

interface SparklineTooltipProps {
  dailyData: TrafficDaily[];
  metricFn: (d: TrafficDaily) => number;
  formatValue: (v: number) => string;
  label: string;
  /** Optional: function that returns true if the raw data for this day is valid for the metric */
  isValidDay?: (d: TrafficDaily) => boolean;
  /** If true, lower values are better (CPC, CPM). Swaps above/below color logic. */
  inverted?: boolean;
  /** Disable all interpolation for this metric */
  disableEstimation?: boolean;
  /** Marks abnormally low values as broken data when below median * factor */
  lowOutlierFactor?: number;
  /** Marks abnormally high values as broken data when above median * factor */
  highOutlierFactor?: number;
  /** Max value cap (e.g., 1.0 for percentages that can't exceed 100%) */
  maxValue?: number;
}

function formatDayLabel(dia: string) {
  try {
    return formatDayMonth(dia);
  } catch {
    return dia;
  }
}

/**
 * Interpolate broken segments as a smooth bridge between the last valid day and the next valid day.
 * This avoids artificial spikes during periods where tracking failed.
 */
function interpolateGaps(
  data: { dia: string; value: number; valid: boolean }[],
  options?: {
    disableEstimation?: boolean;
    lowOutlierFactor?: number;
    highOutlierFactor?: number;
  }
): { dia: string; value: number; estimated: boolean }[] {
  const { disableEstimation = false, lowOutlierFactor = 0, highOutlierFactor = 4 } = options || {};

  if (disableEstimation) {
    return data.map((d) => ({ dia: d.dia, value: d.value, estimated: false }));
  }

  const result = data.map((d) => ({ dia: d.dia, value: d.value, estimated: false, valid: d.valid }));

  const validValues = result.filter((d) => d.valid && d.value > 0).map((d) => d.value);
  let median = 0;
  if (validValues.length > 0) {
    const sorted = [...validValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  const needsInterp: Set<number> = new Set();
  for (let i = 0; i < result.length; i++) {
    if (!result[i].valid || result[i].value === 0) {
      needsInterp.add(i);
      continue;
    }

    if (median > 0 && highOutlierFactor > 0 && result[i].value > median * highOutlierFactor) {
      needsInterp.add(i);
      continue;
    }

    if (median > 0 && lowOutlierFactor > 0 && result[i].value < median * lowOutlierFactor) {
      needsInterp.add(i);
    }
  }

  if (needsInterp.size === 0 || needsInterp.size === result.length) {
    return result.map((d) => ({ dia: d.dia, value: d.value, estimated: false }));
  }

  let index = 0;
  while (index < result.length) {
    if (!needsInterp.has(index)) {
      index += 1;
      continue;
    }

    const start = index;
    while (index + 1 < result.length && needsInterp.has(index + 1)) {
      index += 1;
    }
    const end = index;

    let prevVal: number | null = null;
    for (let j = start - 1; j >= 0; j--) {
      if (!needsInterp.has(j)) {
        prevVal = result[j].value;
        break;
      }
    }

    let nextVal: number | null = null;
    for (let j = end + 1; j < result.length; j++) {
      if (!needsInterp.has(j)) {
        nextVal = result[j].value;
        break;
      }
    }

    const segmentLength = end - start + 1;
    const fallback = prevVal ?? nextVal ?? 0;
    const startVal = prevVal ?? nextVal ?? fallback;
    const endVal = nextVal ?? prevVal ?? fallback;
    const sameAnchors = Math.abs(endVal - startVal) < 0.0001;

    for (let offset = 0; offset < segmentLength; offset++) {
      let estimated = fallback;

      if (prevVal !== null && nextVal !== null) {
        const progress = (offset + 1) / (segmentLength + 1);
        estimated = startVal + (endVal - startVal) * progress;

        if (sameAnchors) {
          const direction = offset % 2 === 0 ? -1 : 1;
          estimated = estimated * (1 + direction * 0.015);
        }
      } else {
        const direction = offset % 2 === 0 ? -1 : 1;
        estimated = fallback * (1 + direction * 0.015);
      }

      result[start + offset] = {
        ...result[start + offset],
        value: Math.max(0, estimated),
        estimated: true,
      };
    }

    index += 1;
  }

  return result.map((d) => ({ dia: d.dia, value: d.value, estimated: d.estimated }));
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

export function SparklineTooltip({ dailyData, metricFn, formatValue, label, isValidDay, inverted = false, disableEstimation = false, lowOutlierFactor = 0, highOutlierFactor = 4, maxValue }: SparklineTooltipProps) {
  if (!dailyData || dailyData.length === 0) {
    return (
      <div className="w-72 max-w-full p-3">
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

  let chartData = interpolateGaps(rawData, {
    disableEstimation,
    lowOutlierFactor,
    highOutlierFactor,
  });
  if (maxValue !== undefined) {
    chartData = chartData.map(d => ({ ...d, value: Math.min(d.value, maxValue) }));
  }
  const realValues = chartData.filter(d => !d.estimated).map(d => d.value);
  const avg = realValues.length > 0
    ? realValues.reduce((s, v) => s + v, 0) / realValues.length
    : chartData.reduce((s, d) => s + d.value, 0) / chartData.length;

  const estimatedCount = chartData.filter(d => d.estimated).length;

  return (
    <div className="w-80 max-w-full p-3" onClick={(e) => e.stopPropagation()}>
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
        <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full inline-block ${inverted ? 'bg-destructive' : 'bg-primary'}`} /> Acima</span>
        <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full inline-block ${inverted ? 'bg-primary' : 'bg-destructive'}`} /> Abaixo</span>
        {estimatedCount > 0 && (
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'hsl(45, 93%, 47%)' }} /> Estimado</span>
        )}
      </div>
    </div>
  );
}
