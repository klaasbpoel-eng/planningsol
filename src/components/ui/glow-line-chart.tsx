import React, { memo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { formatNumber } from "@/lib/utils";

interface DataSeries {
  dataKey: string;
  name: string;
  color: string;
  glowColor?: string;
}

interface GlowLineChartProps {
  data: Record<string, unknown>[];
  xAxisKey: string;
  series: DataSeries[];
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
  referenceLineY?: number;
  referenceLineLabel?: string;
}

const CustomDot = memo(({ 
  cx, 
  cy, 
  color, 
  glowColor 
}: { 
  cx?: number; 
  cy?: number; 
  color: string; 
  glowColor: string;
}) => {
  if (cx === undefined || cy === undefined) return null;
  
  return (
    <g>
      {/* Outer glow */}
      <circle
        cx={cx}
        cy={cy}
        r={12}
        fill={glowColor}
        opacity={0.15}
        className="animate-pulse"
      />
      {/* Middle glow */}
      <circle
        cx={cx}
        cy={cy}
        r={8}
        fill={glowColor}
        opacity={0.25}
      />
      {/* Inner dot with border */}
      <circle
        cx={cx}
        cy={cy}
        r={5}
        fill={color}
        stroke="hsl(var(--background))"
        strokeWidth={2}
        className="drop-shadow-lg"
      />
    </g>
  );
});

CustomDot.displayName = "CustomDot";

const CustomActiveDot = memo(({ 
  cx, 
  cy, 
  color, 
  glowColor 
}: { 
  cx?: number; 
  cy?: number; 
  color: string; 
  glowColor: string;
}) => {
  if (cx === undefined || cy === undefined) return null;
  
  return (
    <g>
      {/* Large outer glow on hover */}
      <circle
        cx={cx}
        cy={cy}
        r={20}
        fill={glowColor}
        opacity={0.2}
        style={{
          filter: `drop-shadow(0 0 8px ${glowColor})`,
        }}
      />
      {/* Medium glow */}
      <circle
        cx={cx}
        cy={cy}
        r={12}
        fill={glowColor}
        opacity={0.35}
      />
      {/* Inner dot */}
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={color}
        stroke="hsl(var(--background))"
        strokeWidth={2}
        style={{
          filter: `drop-shadow(0 0 4px ${color})`,
        }}
      />
    </g>
  );
});

CustomActiveDot.displayName = "CustomActiveDot";

const CustomTooltip = memo(({ 
  active, 
  payload, 
  label,
  formatter 
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
  formatter?: (value: number) => string;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="glass-card rounded-lg border border-border/50 p-3 shadow-xl backdrop-blur-md">
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>
      <div className="space-y-1.5">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ 
                backgroundColor: entry.color,
                boxShadow: `0 0 6px ${entry.color}`,
              }}
            />
            <span className="text-xs text-muted-foreground">{entry.name}:</span>
            <span className="text-sm font-semibold text-foreground">
              {formatter ? formatter(entry.value) : formatNumber(entry.value, 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

CustomTooltip.displayName = "CustomTooltip";

export const GlowLineChart = memo(({
  data,
  xAxisKey,
  series,
  height = 300,
  showGrid = true,
  showLegend = true,
  yAxisFormatter = (value) => formatNumber(value, 0),
  tooltipFormatter,
  referenceLineY,
  referenceLineLabel,
}: GlowLineChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Geen data beschikbaar
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Glow background effect */}
      <div className="absolute inset-0 opacity-30 blur-3xl pointer-events-none">
        {series.map((s, i) => (
          <div
            key={i}
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at ${30 + i * 20}% 50%, ${s.glowColor || s.color}20 0%, transparent 50%)`,
            }}
          />
        ))}
      </div>
      
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.4}
              vertical={false}
            />
          )}
          
          <XAxis
            dataKey={xAxisKey}
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={yAxisFormatter}
          />
          
          <Tooltip
            content={<CustomTooltip formatter={tooltipFormatter} />}
            cursor={{
              stroke: "hsl(var(--muted-foreground))",
              strokeWidth: 1,
              strokeDasharray: "4 4",
            }}
          />
          
          {showLegend && (
            <Legend
              wrapperStyle={{
                paddingTop: "20px",
              }}
              formatter={(value) => (
                <span className="text-sm text-muted-foreground">{value}</span>
              )}
            />
          )}

          {referenceLineY !== undefined && (
            <ReferenceLine
              y={referenceLineY}
              stroke="hsl(var(--muted-foreground))"
              strokeDasharray="8 4"
              label={{
                value: referenceLineLabel,
                position: "right",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 11,
              }}
            />
          )}

          {/* SVG Definitions for glow filters */}
          <defs>
            {series.map((s, i) => (
              <filter key={i} id={`glow-${i}`} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            ))}
          </defs>

          {series.map((s, i) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color}
              strokeWidth={3}
              dot={(props) => (
                <CustomDot
                  {...props}
                  color={s.color}
                  glowColor={s.glowColor || s.color}
                />
              )}
              activeDot={(props) => (
                <CustomActiveDot
                  {...props}
                  color={s.color}
                  glowColor={s.glowColor || s.color}
                />
              )}
              style={{
                filter: `drop-shadow(0 0 6px ${s.glowColor || s.color}40)`,
              }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

GlowLineChart.displayName = "GlowLineChart";
