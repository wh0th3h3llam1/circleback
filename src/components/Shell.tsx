"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SponsorStatus } from "@/lib/contracts";
import { usePoll } from "./hooks";
import { IconBrain, IconChat, IconGlobe, IconPlug, IconSearch, IconUsers } from "./icons";

const NAV = [
  { href: "/", label: "Home", short: "Home", icon: IconGlobe },
  { href: "/ask", label: "Ask", short: "Ask", icon: IconChat },
  { href: "/brain", label: "Brain", short: "Brain", icon: IconBrain },
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

function Logo() {
  return (
    <span aria-hidden="true" className="inline-flex items-center justify-center w-7 h-7 rounded-[8px]" style={{ background: "var(--teal)" }}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="5.2" stroke="#EAF1EC" strokeWidth="1.6" />
        <circle cx="12.4" cy="4.6" r="1.8" fill="#E9772E" />
      </svg>
    </span>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const status = usePoll<SponsorStatus>("/api/status", 60000);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, [contenteditable]");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("ask-input") as HTMLTextAreaElement | HTMLInputElement | null;
        if (el) el.focus();
        else router.push("/ask");
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden md:flex flex-col px-3 py-4 border-r sticky top-0 h-dvh" style={{ background: "var(--side)", borderColor: "var(--line)" }}>
        <Link href="/" className="flex items-center gap-2.5 px-2 mb-5" aria-label="Orbit home">
          <Logo />
          <span className="text-[16px] font-semibold tracking-tight">Orbit</span>
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const on = active(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={on ? "page" : undefined}
                className="flex items-center gap-2.5 rounded-[8px] px-2.5 py-[7px] text-[14px] transition-colors hover:bg-[var(--hover)]"
                style={on ? { background: "var(--sage-soft)", color: "var(--teal)", fontWeight: 500 } : { color: "#3a524a" }}
              >
                <Icon size={17} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-2.5">
          <div className="text-[11px] text-[var(--muted)] mb-1.5">Connected</div>
          <ul className="flex flex-col gap-1 text-[12px] text-[var(--muted)]">
            {SPONSORS.map((s) => {
              const on = !!status.data?.[s.key];
              return (
                <li key={s.key} className="flex items-center gap-2">
                  <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full" style={on ? { background: "var(--green)" } : { border: "1px solid #a9b8b0" }} />
                  {s.label}
                  <span className="sr-only">{on ? "connected" : "not connected"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      <div className="min-w-0 flex flex-col">
        <header className="flex items-center gap-3 px-4 md:px-6 h-14 border-b" style={{ borderColor: "var(--line)", background: "var(--side)" }}>
          <Link href="/" className="md:hidden flex items-center gap-2" aria-label="Orbit home">
            <Logo />
          </Link>
          <form
            role="search"
            className="flex-1 max-w-[420px]"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(`/people${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
            }}
          >
            <label htmlFor="global-search" className="sr-only">
              Search people and companies
            </label>
            <div className="flex items-center gap-2 rounded-[8px] px-3 h-9 text-[13.5px]" style={{ background: "#F1F4EF" }}>
              <IconSearch size={15} />
              <input
                id="global-search"
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search people, companies… (/)"
                className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-[#8a9b93]"
              />
            </div>
          </form>
        </header>
        <main className="min-w-0 flex-1 pb-28 md:pb-0">{children}</main>
      </div>

      <nav
        aria-label="Main"
        className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-full p-1.5"
        style={{ background: "var(--teal)", boxShadow: "0 8px 24px rgba(23,48,42,.22)" }}
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
