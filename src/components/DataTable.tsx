"use client";

import { ReactNode } from "react";
import clsx from "clsx";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  empty,
  onRowClick,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  rowKey: (row: T, index: number) => string;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900/40">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={clsx(
                    "px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400",
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
            {rows.map((row, idx) => (
              <tr
                key={rowKey(row, idx)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={clsx(
                  onRowClick && "cursor-pointer transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={clsx("px-4 py-3 text-sm text-zinc-700 dark:text-zinc-200", c.className)}
                  >
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
