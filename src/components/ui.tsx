"use client";

import { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg";

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  function Button({ variant = "primary", size = "md", className, ...props }, ref) {
    const variants: Record<Variant, string> = {
      primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300",
      secondary: "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900",
      ghost: "bg-transparent text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800",
      danger: "bg-red-600 text-white hover:bg-red-700",
      outline: "border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800",
    };
    const sizes: Record<Size, string> = {
      sm: "h-8 px-3 text-xs rounded-md",
      md: "h-10 px-4 text-sm rounded-lg",
      lg: "h-11 px-5 text-base rounded-lg",
    };
    return (
      <button
        ref={ref}
        className={clsx(
          "inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={clsx(
        "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
        "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-brand-900",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={clsx(
        "min-h-[96px] w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
        "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-brand-900",
        className,
      )}
      {...props}
    />
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={clsx(
        "h-10 w-full rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100",
        "dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <label className={clsx("mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-300", className)}>{children}</label>;
}

export function Card({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm",
        "dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "success" | "warning" | "danger" | "info" }) {
  const tones: Record<string, string> = {
    default: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    danger: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    info: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  };
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium", tones[tone])}>{children}</span>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-base font-medium text-zinc-700 dark:text-zinc-200">{title}</p>
      {message && <p className="mt-1 max-w-md text-sm text-zinc-500 dark:text-zinc-400">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-10 text-sm text-zinc-500 dark:text-zinc-400">
      <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
      <p className="font-medium">Something went wrong</p>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs font-medium underline">
          Retry
        </button>
      )}
    </div>
  );
}
