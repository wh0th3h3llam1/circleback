import type { Metadata, Viewport } from "next";
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
import Shell from "@/components/Shell";
import "./globals.css";

const sans = Instrument_Sans({ variable: "--font-sans-app", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-app", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Circleback",
  description: "Who's your best call? A personal agent that remembers your people and finds the right intro.",
};

export const viewport: Viewport = {
  themeColor: "#DCE5DF",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable}`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
