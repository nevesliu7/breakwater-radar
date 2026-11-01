import type { Metadata } from "next";
import { IBM_Plex_Mono, Sora, Work_Sans } from "next/font/google";

import "./globals.css";

const display = Sora({
  subsets: ["latin"],
  variable: "--font-display",
});

const body = Work_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Breakwater Radar",
  description:
    "Operational risk control for distributed commerce teams. Track natural disasters and social policy shifts, then turn them into asset-specific actions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} ${mono.variable}`}>
        {children}
      </body>
    </html>
  );
}

