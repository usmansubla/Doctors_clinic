import React from "react";
import Svg, { Path, Circle, Line, Rect, G, Defs, LinearGradient, Stop } from "react-native-svg";
import { View, Text } from "react-native";
import { colors } from "@/src/theme/tokens";

type Point = { label: string; value: number };

/** Area/line chart. */
export function LineChart({
  data,
  width,
  height,
  color = colors.brand,
  showGrid = true,
}: {
  data: Point[];
  width: number;
  height: number;
  color?: string;
  showGrid?: boolean;
}) {
  const pad = { top: 20, right: 20, bottom: 28, left: 36 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const stepX = data.length > 1 ? w / (data.length - 1) : w;

  const points = data.map((d, i) => ({
    x: pad.left + i * stepX,
    y: pad.top + h - (d.value / max) * h,
    label: d.label,
    value: d.value,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath =
    linePath +
    ` L ${pad.left + w} ${pad.top + h} L ${pad.left} ${pad.top + h} Z`;

  const gridLines = 4;
  const gridStep = h / gridLines;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {showGrid &&
        Array.from({ length: gridLines + 1 }).map((_, i) => (
          <Line
            key={i}
            x1={pad.left}
            x2={pad.left + w}
            y1={pad.top + i * gridStep}
            y2={pad.top + i * gridStep}
            stroke={colors.divider}
            strokeWidth={1}
          />
        ))}
      <Path d={areaPath} fill="url(#areaGrad)" />
      <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={3.5} fill={colors.surface} stroke={color} strokeWidth={2} />
      ))}
    </Svg>
  );
}

/** Bar chart. */
export function BarChart({
  data,
  width,
  height,
  color = colors.brand,
}: {
  data: Point[];
  width: number;
  height: number;
  color?: string;
}) {
  const pad = { top: 16, right: 12, bottom: 28, left: 32 };
  const w = width - pad.left - pad.right;
  const h = height - pad.top - pad.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const barWidth = (w / data.length) * 0.55;
  const step = w / data.length;

  return (
    <Svg width={width} height={height}>
      {data.map((d, i) => {
        const bh = (d.value / max) * h;
        const x = pad.left + i * step + (step - barWidth) / 2;
        const y = pad.top + h - bh;
        return <Rect key={i} x={x} y={y} width={barWidth} height={bh} rx={4} ry={4} fill={color} />;
      })}
    </Svg>
  );
}

/** Sparkline: tiny inline chart for KPI cards. */
export function Sparkline({
  data,
  width,
  height,
  color = colors.brand,
}: {
  data: number[];
  width: number;
  height: number;
  color?: string;
}) {
  if (!data.length) return null;
  const max = Math.max(1, ...data);
  const min = Math.min(...data);
  const range = Math.max(1, max - min);
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((v, i) => ({
    x: i * stepX,
    y: height - ((v - min) / range) * (height - 4) - 2,
  }));
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <Svg width={width} height={height}>
      <Path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/** Donut chart. */
export function DonutChart({
  segments,
  size,
  strokeWidth = 22,
}: {
  segments: { value: number; color: string; label: string }[];
  size: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const total = Math.max(1, segments.reduce((a, b) => a + b.value, 0));
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={radius} stroke={colors.divider} strokeWidth={strokeWidth} fill="none" />
      {segments.map((s, i) => {
        const frac = s.value / total;
        const dash = frac * circumference;
        const el = (
          <Circle
            key={i}
            cx={cx}
            cy={cy}
            r={radius}
            stroke={s.color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += dash;
        return el;
      })}
    </Svg>
  );
}

/** Renders x-axis labels below any chart. */
export function AxisLabels({ labels, width, paddingLeft = 36, paddingRight = 20 }: { labels: string[]; width: number; paddingLeft?: number; paddingRight?: number }) {
  const w = width - paddingLeft - paddingRight;
  return (
    <View style={{ flexDirection: "row", paddingLeft, paddingRight, width, position: "absolute", bottom: 6 }}>
      {labels.map((l, i) => (
        <View key={i} style={{ width: w / labels.length, alignItems: "center" }}>
          <Text style={{ fontSize: 10, color: colors.muted }}>{l}</Text>
        </View>
      ))}
    </View>
  );
}
