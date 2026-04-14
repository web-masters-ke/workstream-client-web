import { Badge } from "./ui";
import type { Agent } from "@/lib/types";

const statusTone = {
  ONLINE: "success",
  BUSY: "warning",
  OFFLINE: "default",
} as const;

export function AgentCard({ agent }: { agent: Agent }) {
  const initials = agent.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700 dark:bg-brand-900 dark:text-brand-200">
          {initials}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{agent.name}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{agent.email}</p>
        </div>
        <Badge tone={statusTone[agent.status]}>{agent.status}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {agent.skills.map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
          >
            {skill}
          </span>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <Stat label="Rating" value={agent.rating.toFixed(1)} />
        <Stat label="Active" value={agent.activeTasks} />
        <Stat label="Success" value={`${Math.round(agent.successRate * 100)}%`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{value}</p>
    </div>
  );
}
