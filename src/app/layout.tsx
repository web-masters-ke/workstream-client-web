import type { Metadata } from "next";
import { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";

export const metadata: Metadata = {
  title: "WorkStream — Business Portal",
  description: "WorkStream business portal for managing jobs, tasks, and agents.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
