import type { Metadata } from "next";
import "./globals.css";
import { storeName } from "@/lib/format";

export const metadata: Metadata = {
  title: {
    default: `Panel Admin — ${storeName()}`,
    template: `%s — Panel Admin`,
  },
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
