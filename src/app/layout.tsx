import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import Shell from "@/components/Shell";
import "./globals.css";

const sans = Instrument_Sans({ variable: "--font-sans-app", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-mono-app", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif-app", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Orbit",
  description: "Who's your best call? A personal agent that remembers your people and finds the right intro.",
};

export const viewport: Viewport = {
  themeColor: "#F7F8F5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
