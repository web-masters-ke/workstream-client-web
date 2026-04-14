import { ReactNode } from "react";
import clsx from "clsx";

export function StatCard({
  label,
  value,
  trend,
  icon,
  hint,
}: {
  label: string;
  value: string | number;
  trend?: { value: number; positive?: boolean };
  icon?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
        {icon && <span className="text-zinc-400">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
        {trend && (
          <span
            className={clsx(
              "text-xs font-medium",
              trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400",
            )}
          >
            {trend.positive ? "+" : ""}
            {trend.value}%
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>}
    </div>
  );
}
