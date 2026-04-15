"use client";

import Link from "next/link";
import { Badge } from "./ui";
import type { Task, TaskStatus } from "@/lib/types";
import { fmtRelative } from "@/lib/format";

const statusTone: Record<TaskStatus, "default" | "success" | "warning" | "danger" | "info"> = {
  PENDING: "default",
  ASSIGNED: "info",
  IN_PROGRESS: "warning",
  UNDER_REVIEW: "info",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "default",
  ON_HOLD: "warning",
};

export function TaskCard({ task }: { task: Task }) {
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-brand-400 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-600"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{task.title}</h3>
        <Badge tone={statusTone[task.status]}>{task.status.replace("_", " ")}</Badge>
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{task.assignedAgentName ?? "Unassigned"}</span>
        <span>SLA {task.slaMinutes}m</span>
      </div>
      <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Created {fmtRelative(task.createdAt)}</div>
    </Link>
  );
}
