import React, { memo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from "recharts";
import { formatNumber } from "@/lib/utils";

interface DataSeries {
  dataKey: string;
  name: string;
  color: string;
  shadowColor?: string;
}

interface RoundedBarChartProps {
  data: Record<string, unknown>[];
  xAxisKey: string;
  series: DataSeries[];
  height?: number;
  layout?: "horizontal" | "vertical";
  showGrid?: boolean;
  showLegend?: boolean;
  barRadius?: number;
  barSize?: number;
  yAxisFormatter?: (value: number) => string;
  tooltipFormatter?: (value: number) => string;
  stacked?: boolean;
}

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
    payload: Record<string, unknown>;
  }>;
  label?: string;
  formatter?: (value: number) => string;
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="glass-card rounded-xl border border-border/50 p-4 shadow-2xl backdrop-blur-md">
      <p className="text-sm font-semibold text-foreground mb-3">{label}</p>
      <div className="space-y-2">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-md"
              style={{ 
                backgroundColor: entry.color,
                boxShadow: `0 2px 8px ${entry.color}60`,
              }}
            />
            <span className="text-xs text-muted-foreground flex-1">{entry.name}</span>
            <span className="text-sm font-bold text-foreground">
              {formatter ? formatter(entry.value) : formatNumber(entry.value, 0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});

CustomTooltip.displayName = "CustomTooltip";

// Custom bar shape with shadow
const RoundedBar = (props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  shadowColor?: string;
  radius?: number;
}) => {
  const { x = 0, y = 0, width = 0, height = 0, fill, shadowColor, radius = 8 } = props;
  
  if (height === 0) return null;
  
  const isNegative = height < 0;
  const actualY = isNegative ? y + height : y;
  const actualHeight = Math.abs(height);
  
  // Determine which corners should be rounded based on direction
  const topRadius = !isNegative ? radius : 0;
  const bottomRadius = isNegative ? radius : 0;
  
  return (
    <g>
      {/* Shadow layer */}
      <rect
        x={x + 2}
        y={actualY + 4}
        width={width}
        height={actualHeight}
        rx={radius}
        ry={radius}
        fill={shadowColor || fill}
        opacity={0.2}
        style={{
          filter: 'blur(4px)',
        }}
      />
      {/* Main bar with gradient */}
      <defs>
        <linearGradient id={`barGradient-${fill}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity={1} />
          <stop offset="100%" stopColor={fill} stopOpacity={0.7} />
        </linearGradient>
      </defs>
      <rect
        x={x}
        y={actualY}
        width={width}
        height={actualHeight}
        rx={topRadius}
        ry={topRadius}
        fill={`url(#barGradient-${fill})`}
        style={{
          filter: `drop-shadow(0 4px 6px ${shadowColor || fill}40)`,
        }}
      />
      {/* Highlight effect */}
      <rect
        x={x + 2}
        y={actualY + 2}
        width={Math.max(0, width - 4)}
        height={Math.min(actualHeight * 0.3, 20)}
        rx={topRadius - 1}
        ry={topRadius - 1}
        fill="white"
        opacity={0.15}
      />
    </g>
  );
};

export const RoundedBarChart = memo(({
  data,
  xAxisKey,
  series,
  height = 300,
  layout = "horizontal",
  showGrid = true,
  showLegend = true,
  barRadius = 8,
  barSize,
  yAxisFormatter = (value) => formatNumber(value, 0),
  tooltipFormatter,
  stacked = false,
}: RoundedBarChartProps) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-muted-foreground">
        Geen data beschikbaar
      </div>
    );
  }

  const isVertical = layout === "vertical";

  return (
    <div className="relative">
      {/* Background glow effect */}
      <div className="absolute inset-0 opacity-20 blur-3xl pointer-events-none overflow-hidden">
        {series.slice(0, 2).map((s, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              background: `radial-gradient(ellipse at ${50 + i * 20}% 70%, ${s.shadowColor || s.color}30 0%, transparent 60%)`,
              inset: 0,
            }}
          />
        ))}
      </div>
      
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          layout={layout}
          margin={{ 
            top: 10, 
            right: 30, 
            left: isVertical ? 80 : 0, 
            bottom: 0 
          }}
        >
          {showGrid && (
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.4}
              vertical={!isVertical}
              horizontal={isVertical}
            />
          )}
          
          {isVertical ? (
            <>
              <XAxis 
                type="number"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={yAxisFormatter}
              />
              <YAxis 
                type="category"
                dataKey={xAxisKey}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={80}
              />
            </>
          ) : (
            <>
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
            </>
          )}
          
          <Tooltip
            content={<CustomTooltip formatter={tooltipFormatter} />}
            cursor={{
              fill: "hsl(var(--muted))",
              opacity: 0.3,
              radius: 4,
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

          {series.map((s, index) => (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name}
              fill={s.color}
              stackId={stacked ? "stack" : undefined}
              barSize={barSize}
              shape={(props) => (
                <RoundedBar
                  {...props}
                  shadowColor={s.shadowColor || s.color}
                  radius={barRadius}
                />
              )}
              animationDuration={800}
              animationEasing="ease-out"
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
});

RoundedBarChart.displayName = "RoundedBarChart";
