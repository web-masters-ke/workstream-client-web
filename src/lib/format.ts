export function fmtDate(d: string | Date | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, opts ?? { dateStyle: "medium", timeStyle: "short" });
}

export function fmtMoney(amount: number, currency = "KES"): string {
  try {
    return new Intl.NumberFormat("en-KE", { style: "currency", currency }).format(amount);
  } catch {
    return `KES ${amount.toFixed(2)}`;
  }
}

export function fmtNumber(n: number): string {
  return new Intl.NumberFormat().format(n);
}

export function fmtRelative(d: string | Date | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const diffMs = Date.now() - date.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}
