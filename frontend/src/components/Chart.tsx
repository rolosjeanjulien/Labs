import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, {
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Circle,
  Text as SvgText,
} from "react-native-svg";

import { colors, mono, numeric } from "../theme";

type Point = { x: number; value: number; secondary?: number };

export type BaselineChartProps = {
  width: number;
  height: number;
  series: { value: number; day_index?: number; date?: string }[];
  band: { low: number; mid: number; high: number };
  overlay?: { value: number; day_index?: number; date?: string }[];
  overlayLabel?: string;
  showOverlay?: boolean;
  highlightLast?: boolean;
  yMinPad?: number;
  yMaxPad?: number;
  showDots?: boolean;
  showAxis?: boolean;
};

// Smooth bezier path
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export const BaselineChart: React.FC<BaselineChartProps> = ({
  width,
  height,
  series,
  band,
  overlay,
  showOverlay = false,
  highlightLast = true,
  yMinPad = 0.15,
  yMaxPad = 0.15,
  showDots = true,
  showAxis = true,
}) => {
  if (series.length < 2) return <View style={{ width, height }} />;

  const padL = showAxis ? 36 : 8;
  const padR = 12;
  const padT = 16;
  const padB = showAxis ? 22 : 8;
  const w = width - padL - padR;
  const h = height - padT - padB;

  // y range
  const values = series.map((s) => s.value);
  const yMinRaw = Math.min(...values, band.low);
  const yMaxRaw = Math.max(...values, band.high);
  const range = yMaxRaw - yMinRaw || 1;
  const yMin = yMinRaw - range * yMinPad;
  const yMax = yMaxRaw + range * yMaxPad;
  const yScale = (v: number) => padT + h - ((v - yMin) / (yMax - yMin)) * h;

  // x range — use day_index if present, else array index
  const xs = series.map((s, i) => s.day_index ?? i);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const xScale = (i: number, idx: number) => padL + ((i - xMin) / Math.max(1, xMax - xMin)) * w;

  const points = series.map((s, idx) => ({
    x: xScale(s.day_index ?? idx, idx),
    y: yScale(s.value),
  }));

  const last = points[points.length - 1];
  const linePath = smoothPath(points);

  // Baseline band
  const bandTop = yScale(band.high);
  const bandBot = yScale(band.low);
  const bandMid = yScale(band.mid);

  // Overlay (training load) — normalised to its own range
  let overlayPath = "";
  if (overlay && overlay.length > 1) {
    const ovValues = overlay.map((o) => o.value);
    const ovMax = Math.max(...ovValues, 1);
    const ovPts = overlay.map((o, idx) => ({
      x: xScale(o.day_index ?? idx, idx),
      y: padT + h - (o.value / ovMax) * h * 0.55,
    }));
    overlayPath = smoothPath(ovPts);
  }

  // Y-axis ticks (low / mid / high of band)
  const yTicks = [
    { v: band.high, label: band.high },
    { v: band.mid, label: band.mid },
    { v: band.low, label: band.low },
  ];

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="band-grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.teal} stopOpacity="0.16" />
            <Stop offset="1" stopColor={colors.teal} stopOpacity="0.06" />
          </LinearGradient>
          <LinearGradient id="line-grad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.teal} stopOpacity="1" />
            <Stop offset="1" stopColor={colors.teal} stopOpacity="0.7" />
          </LinearGradient>
        </Defs>

        {/* Baseline band (THE signature element) */}
        <Rect
          x={padL}
          y={bandTop}
          width={w}
          height={Math.max(2, bandBot - bandTop)}
          fill="url(#band-grad)"
          rx={4}
        />
        {/* Band midline */}
        <Line
          x1={padL}
          y1={bandMid}
          x2={padL + w}
          y2={bandMid}
          stroke={colors.teal}
          strokeOpacity={0.25}
          strokeDasharray="2 4"
          strokeWidth={1}
        />

        {/* Axis */}
        {showAxis && (
          <G>
            {yTicks.map((t, i) => (
              <SvgText
                key={i}
                x={padL - 6}
                y={yScale(t.v) + 3}
                fill={colors.textTertiary}
                fontSize={9}
                fontFamily={mono}
                textAnchor="end"
              >
                {t.label}
              </SvgText>
            ))}
          </G>
        )}

        {/* Overlay (training load) */}
        {showOverlay && overlayPath ? (
          <Path
            d={overlayPath}
            stroke={colors.watch}
            strokeWidth={1.2}
            strokeOpacity={0.65}
            fill="none"
            strokeDasharray="3 3"
          />
        ) : null}

        {/* Main line */}
        <Path d={linePath} stroke="url(#line-grad)" strokeWidth={2.4} fill="none" />

        {/* Dots */}
        {showDots &&
          points.map((p, i) => (
            <Circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={2.2}
              fill={colors.bg}
              stroke={colors.teal}
              strokeWidth={1.4}
            />
          ))}

        {/* Highlight last */}
        {highlightLast && last && (
          <G>
            <Circle cx={last.x} cy={last.y} r={6} fill={colors.teal} fillOpacity={0.18} />
            <Circle cx={last.x} cy={last.y} r={3.6} fill={colors.teal} />
          </G>
        )}
      </Svg>
    </View>
  );
};

export const Sparkline: React.FC<{
  width: number;
  height: number;
  series: number[];
  band?: { low: number; mid: number; high: number };
  color?: string;
}> = ({ width, height, series, band, color = colors.teal }) => {
  if (series.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...series, band?.low ?? series[0]);
  const max = Math.max(...series, band?.high ?? series[0]);
  const range = max - min || 1;
  const ys = series.map((v) => height - ((v - min) / range) * height);
  const xs = series.map((_, i) => (i / (series.length - 1)) * width);
  const pts = xs.map((x, i) => ({ x, y: ys[i] }));
  const d = smoothPath(pts);
  return (
    <Svg width={width} height={height}>
      {band && (
        <Rect
          x={0}
          y={height - ((band.high - min) / range) * height}
          width={width}
          height={Math.max(
            2,
            ((band.high - min) / range) * height - ((band.low - min) / range) * height,
          )}
          fill={color}
          fillOpacity={0.1}
        />
      )}
      <Path d={d} stroke={color} strokeWidth={1.5} fill="none" />
    </Svg>
  );
};
