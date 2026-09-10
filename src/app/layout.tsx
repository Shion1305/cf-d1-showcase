import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fieldwork · D1 showcase",
  description:
    "A working path from local Next.js development to Cloudflare Workers, D1, and Secrets Store.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
