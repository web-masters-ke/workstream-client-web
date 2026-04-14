"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7", "#f97316"];

export function LineTrend({ data, dataKey, xKey = "label", height = 220 }: { data: Record<string, unknown>[]; dataKey: string; xKey?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.6} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />
        <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={11} />
        <YAxis stroke="#94a3b8" fontSize={11} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
        <Area type="monotone" dataKey={dataKey} stroke="#6366f1" strokeWidth={2} fill="url(#g1)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function BarCompare({ data, bars, xKey = "label", height = 240 }: { data: Record<string, unknown>[]; bars: { key: string; label?: string }[]; xKey?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />
        <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={11} />
        <YAxis stroke="#94a3b8" fontSize={11} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.label ?? b.key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineSeries({ data, lines, xKey = "label", height = 240 }: { data: Record<string, unknown>[]; lines: { key: string; label?: string }[]; xKey?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,120,120,0.15)" />
        <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={11} />
        <YAxis stroke="#94a3b8" fontSize={11} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {lines.map((l, i) => (
          <Line key={l.key} type="monotone" dataKey={l.key} name={l.label ?? l.key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DonutBreakdown({ data, height = 220 }: { data: { name: string; value: number }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
