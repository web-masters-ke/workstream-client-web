"use client";

// CSV helpers shared across list pages. Pure client, no deps.

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns?: { key: keyof T; header?: string }[],
): string {
  if (rows.length === 0 && !columns) return "";
  const cols =
    columns ??
    (Object.keys(rows[0] ?? {}) as (keyof T)[]).map((k) => ({ key: k, header: String(k) }));
  const head = cols.map((c) => csvEscape(c.header ?? String(c.key))).join(",");
  const body = rows
    .map((row) =>
      cols
        .map((c) => {
          const v = row[c.key];
          if (v == null) return "";
          if (typeof v === "object") return csvEscape(JSON.stringify(v));
          return csvEscape(String(v));
        })
        .join(","),
    )
    .join("\n");
  return `${head}\n${body}`;
}

function csvEscape(value: string): string {
  const needsQuote = /[",\n\r]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

export function downloadCsv(filename: string, csv: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportRowsAsCsv<T extends Record<string, unknown>>(
  filename: string,
  rows: T[],
  columns?: { key: keyof T; header?: string }[],
) {
  downloadCsv(filename, toCsv(rows, columns));
}

/** Parse a CSV string into rows of objects keyed by header row. */
export function parseCsv(input: string): Record<string, string>[] {
  const text = input.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") {
        cur.push(field);
        field = "";
      } else if (ch === "\n") {
        cur.push(field);
        rows.push(cur);
        cur = [];
        field = "";
      } else field += ch;
    }
  }
  cur.push(field);
  rows.push(cur);
  const [header, ...body] = rows;
  if (!header) return [];
  return body
    .filter((r) => r.some((c) => c.trim() !== ""))
    .map((r) => {
      const obj: Record<string, string> = {};
      header.forEach((h, i) => {
        obj[h.trim()] = (r[i] ?? "").trim();
      });
      return obj;
    });
}
