import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Employee Gift Portal",
  description: "Choose your gift",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
