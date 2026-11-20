"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { SponsorStatus } from "@/lib/contracts";
import { usePoll } from "./hooks";
import { IconBrain, IconChat, IconPlug, IconSpark, IconUsers } from "./icons";

const NAV = [
  { href: "/", label: "Opportunities", short: "Home", icon: IconSpark },
  { href: "/brain", label: "Brain", short: "Brain", icon: IconBrain },
  { href: "/ask", label: "Ask", short: "Ask", icon: IconChat },
  { href: "/people", label: "People", short: "People", icon: IconUsers },
  { href: "/sources", label: "Sources", short: "Sources", icon: IconPlug },
];

const SPONSORS: { key: keyof SponsorStatus; label: string }[] = [
  { key: "sie", label: "SIE" },
  { key: "cognee", label: "Cognee" },
  { key: "singlestore", label: "SingleStore" },
  { key: "telegram", label: "Telegram" },
  { key: "airbyte", label: "Airbyte" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const status = usePoll<SponsorStatus>("/api/status", 60000);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("ask-input") as HTMLTextAreaElement | HTMLInputElement | null;
        if (el) el.focus();
        else router.push("/ask");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[208px_minmax(0,1fr)]">
      <aside className="hidden md:flex flex-col gap-1 px-4 py-6 border-r border-[var(--line)] sticky top-0 h-dvh">
        <Link href="/" className="px-2 mb-6 block" aria-label="Circleback home">
          <span className="text-[21px] font-semibold tracking-tight block">
            Circle<span style={{ color: "var(--orange)" }}>back</span>
          </span>
          <span className="text-[12px] text-[var(--muted)]">Your career brain</span>
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon }) => {
            const on = active(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-[14px] transition-colors"
                style={on ? { background: "var(--teal)", color: "var(--teal-ink)" } : { color: "#2d4a41" }}
              >
                <Icon />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-2">
          <div className="label mb-2">Connected</div>
          <ul className="flex flex-col gap-1.5 text-[12px]" style={{ color: "#2d4a41" }}>
            {SPONSORS.map((s) => {
              const on = !!status.data?.[s.key];
              return (
                <li key={s.key} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="inline-block w-2 h-2 rounded-full"
                    style={on ? { background: "var(--green)" } : { border: "1px solid #8aa096" }}
                  />
                  {s.label}
                  <span className="sr-only">{on ? "connected" : "not connected"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <header className="md:hidden flex items-center justify-between px-4 pt-4">
        <Link href="/" className="text-[20px] font-semibold tracking-tight">
          Circle<span style={{ color: "var(--orange)" }}>back</span>
        </Link>
        <span className="flex gap-1" aria-label="Connected services">
          {SPONSORS.map((s) => (
            <span
              key={s.key}
              title={s.label}
              className="inline-block w-2 h-2 rounded-full"
              style={status.data?.[s.key] ? { background: "var(--green)" } : { border: "1px solid #8aa096" }}
            />
          ))}
        </span>
      </header>

      <main className="min-w-0 pb-28 md:pb-0">{children}</main>

      <nav
        aria-label="Main"
        className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-full p-1.5"
        style={{ background: "var(--teal)", boxShadow: "0 8px 24px rgba(23,48,42,.25)" }}
      >
        {NAV.map(({ href, label, short, icon: Icon }) => {
          const on = active(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              aria-label={label}
              className="relative flex items-center gap-2 rounded-full px-3 py-2 text-[13px]"
              style={on ? { background: "var(--teal-ink)", color: "var(--teal)" } : { color: "var(--teal-ink)" }}
            >
              <Icon size={18} />
              {on && <span>{short}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
