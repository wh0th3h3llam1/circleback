"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

const CSS = `
.lp{max-width:1040px;margin:0 auto;padding:40px 20px 80px;color:var(--text)}
.lp-serif{font-family:var(--font-serif-app),Georgia,serif;font-weight:400;letter-spacing:-.01em}
.lp-muted{color:var(--muted)}
.lp-hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:40px;align-items:center;padding:24px 0 56px}
.lp-h1{font-size:clamp(40px,5.4vw,64px);line-height:1.02;margin:0}
.lp-sub{font-size:18px;line-height:1.6;margin:20px 0 28px;max-width:34em}
.lp-btns{display:flex;gap:10px;flex-wrap:wrap}
.lp-btn{display:inline-flex;align-items:center;gap:8px;padding:12px 18px;border-radius:999px;font-size:15px;font-weight:500;border:1px solid var(--line);background:#fff;color:var(--text);text-decoration:none;transition:transform .15s ease,background .15s ease}
.lp-btn:hover{transform:translateY(-1px);background:var(--hover)}
.lp-btn-primary{background:var(--teal);color:var(--teal-ink);border-color:var(--teal)}
.lp-btn-primary:hover{background:#173a32}
.lp-btn:focus-visible{outline:2px solid var(--orange);outline-offset:2px}
.lp-card{background:#fff;border:1px solid var(--line);border-radius:16px}
.lp-eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
.lp-h2{font-size:clamp(30px,3.6vw,42px);line-height:1.1;margin:0 0 10px}
.lp-sec{padding:56px 0;border-top:1px solid var(--line)}
.lp-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:28px}
.lp-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:28px}
.lp-step{padding:22px}
.lp-num{width:28px;height:28px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:var(--sage-soft);color:var(--teal);font-size:13px;font-weight:600}
.lp-step h3{font-size:18px;margin:14px 0 8px}
.lp-step ul{margin:0;padding:0;list-style:none;font-size:14px;line-height:1.9;color:var(--muted)}
.lp-chip{display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 6px;border-radius:999px;background:#fff;border:1px solid var(--line);font-size:13px;box-shadow:0 6px 18px rgba(23,48,42,.06)}
.lp-av{width:26px;height:26px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff}
.lp-pill{display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:500}
.lp-tag{font-family:var(--font-mono-app),monospace;font-size:11px;padding:2px 7px;border-radius:6px;background:var(--sage-soft);color:var(--teal)}
.lp-trail li{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--line);font-size:14px}
.lp-trail li:first-child{border-top:none}
.lp-ms{margin-left:auto;font-family:var(--font-mono-app),monospace;font-size:12px;color:var(--muted)}
.lp-badges{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:24px}
.lp-badge{padding:16px;font-size:13px;line-height:1.5}
.lp-badge b{display:block;font-size:15px;font-weight:600;margin-bottom:4px;color:var(--teal)}
.lp-final{text-align:center;padding:72px 20px;margin-top:8px;border-radius:20px;background:#fff;border:1px solid var(--line)}
.lp-reveal{opacity:0;transform:translateY(14px);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.7,.2,1)}
.lp-reveal.in{opacity:1;transform:none}
.lp-float{animation:lp-float 6s ease-in-out infinite}
.lp-float.d2{animation-delay:-2s}.lp-float.d3{animation-delay:-4s}
@keyframes lp-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
.lp-path{stroke-dasharray:520;stroke-dashoffset:520;animation:lp-draw 1.8s .5s cubic-bezier(.6,0,.2,1) forwards}
@keyframes lp-draw{to{stroke-dashoffset:0}}
.lp-pop{opacity:0;animation:lp-pop .5s 2.1s ease forwards}
@keyframes lp-pop{from{opacity:0;transform:translateY(6px) scale(.96)}to{opacity:1;transform:none}}
@media (max-width:860px){.lp-hero{grid-template-columns:1fr;gap:28px}.lp-grid3,.lp-grid2{grid-template-columns:1fr}.lp-badges{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (prefers-reduced-motion:reduce){.lp-reveal{opacity:1;transform:none;transition:none}.lp-float,.lp-path,.lp-pop{animation:none}.lp-path{stroke-dashoffset:0}.lp-pop{opacity:1}}
`;

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) =>
        es.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add("in");
            io.disconnect();
          }
        }),
      { threshold: 0.15 },
    );
    io.observe(el);
    // Never leave content hidden: reveal anything already on screen right away, and everything after 1.5s.
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight) requestAnimationFrame(() => el.classList.add("in"));
    const t = setTimeout(() => el.classList.add("in"), 1500);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return (
    <div ref={ref} className={`lp-reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

function Chip({ initials, name, sub, color, cls, dashed }: { initials: string; name: string; sub: string; color: string; cls: string; dashed?: boolean }) {
  return (
    <span className={`lp-chip lp-float ${cls}`}>
      <span className="lp-av" style={dashed ? { background: "#fff", color, border: `1.5px dashed ${color}` } : { background: color }}>
        {initials}
      </span>
      <span>
        <b style={{ fontWeight: 600 }}>{name}</b> <span className="lp-muted">· {sub}</span>
      </span>
    </span>
  );
}

function IntroPath() {
  return (
    <div className="lp-card" style={{ position: "relative", padding: 20, minHeight: 320, overflow: "hidden" }} aria-label="You reach Lena Park through Maya Chen">
      <svg viewBox="0 0 440 280" width="100%" height="100%" style={{ position: "absolute", inset: 0 }} aria-hidden="true">
        <circle cx="220" cy="140" r="118" fill="none" stroke="#E8EBE6" />
        <circle cx="220" cy="140" r="74" fill="none" stroke="#E8EBE6" />
        <path className="lp-path" d="M70 220 C 150 210, 170 150, 220 140 S 330 70, 372 58" fill="none" stroke="#E9772E" strokeWidth="3" strokeLinecap="round" />
        <circle cx="70" cy="220" r="7" fill="#1F4A40" />
        <circle cx="220" cy="140" r="7" fill="#3E8E86" />
        <circle cx="372" cy="58" r="7" fill="#fff" stroke="#E9772E" strokeWidth="2" strokeDasharray="3 3" />
      </svg>
      <div style={{ position: "absolute", left: 16, bottom: 22 }}>
        <Chip initials="You" name="You" sub="goal: voice AI PM" color="#1F4A40" cls="" />
      </div>
      <div style={{ position: "absolute", left: "34%", top: "54%" }}>
        <Chip initials="MC" name="Maya Chen" sub="inner circle" color="#3E8E86" cls="d2" />
      </div>
      <div style={{ position: "absolute", right: 14, top: 14 }}>
        <Chip initials="LP" name="Lena Park" sub="Sonance" color="#E9772E" cls="d3" dashed />
      </div>
      <div className="lp-pop" style={{ position: "absolute", right: 18, top: 62 }}>
        <span className="lp-pill" style={{ background: "#E9772E", color: "#fff" }}>Intro ready</span>
      </div>
    </div>
  );
}

const STEPS = [
  { n: 1, t: "Capture", items: ["LinkedIn connections via Airbyte", "Luma and Partiful events", "Telegram and voice notes", "Gmail and Calendar"] },
  { n: 2, t: "Remember", items: ["One Cognee brain per person", "Node sets tag every source", "A career extraction prompt builds the graph"] },
  { n: 3, t: "Act", items: ["Ranks people and events against your goal", "Drafts the intro in your voice", "You approve, it sends on Telegram"] },
];

const TRAIL = [
  ["Superlinked SIE", "decide · GLiNER2.5-Decide", "0.3s"],
  ["SingleStore", "hybrid search", "0.1s"],
  ["Cognee", "recall · your brain", "6s"],
  ["Superlinked SIE", "draft · Qwen3.8-27B", "1.7s"],
];

const SPONSORS = [
  ["Cognee", "One memory graph per person"],
  ["Superlinked", "Extract, embed, rerank, route, draft"],
  ["SingleStore", "Vector + full-text search"],
  ["Airbyte", "LinkedIn and Gmail sync"],
  ["Telegram", "Capture notes, send intros"],
];

export default function Landing() {
  return (
    <div className="lp">
      <style>{CSS}</style>

      <section className="lp-hero">
        <Reveal>
          <p className="lp-eyebrow">Circleback · your career brain</p>
          <h1 className="lp-h1 lp-serif">Your network already knows your next job.</h1>
          <p className="lp-sub lp-muted">Circleback is a personal career agent. It remembers everyone you meet and finds the warm path to the opportunity you want.</p>
          <div className="lp-btns">
            <Link href="/" className="lp-btn lp-btn-primary">
              Open Circleback →
            </Link>
            <a href="#how" className="lp-btn">
              See how it works
            </a>
          </div>
        </Reveal>
        <Reveal delay={150}>
          <IntroPath />
        </Reveal>
      </section>

      <section id="how" className="lp-sec">
        <Reveal>
          <p className="lp-eyebrow">How it works</p>
          <h2 className="lp-h2 lp-serif">Capture once. Remember everything. Act at the right moment.</h2>
        </Reveal>
        <div className="lp-grid3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div className="lp-card lp-step">
                <span className="lp-num">{s.n}</span>
                <h3>{s.t}</h3>
                <ul>
                  {s.items.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="lp-sec">
        <div className="lp-grid2" style={{ marginTop: 0, alignItems: "center" }}>
          <Reveal>
            <p className="lp-eyebrow">Transparent by design</p>
            <h2 className="lp-h2 lp-serif">Every answer shows its work.</h2>
            <p className="lp-muted" style={{ fontSize: 16, lineHeight: 1.6 }}>
              See who the agent picked, the path to reach them, the evidence from your own notes, and every call it made to get there.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <div className="lp-card" style={{ padding: 20 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="lp-pill" style={{ background: "#e7f4ec", color: "var(--green)" }}>Best move</span>
                <span className="lp-muted" style={{ fontSize: 12, marginLeft: "auto", fontFamily: "var(--font-mono-app)" }}>88</span>
              </div>
              <h3 style={{ fontSize: 18, margin: "12px 0 6px" }}>Ask Maya for an intro to Lena Park</h3>
              <p style={{ fontSize: 14, margin: 0 }}>
                You <span style={{ color: "var(--orange)" }}>——</span> Maya <span style={{ color: "var(--orange)" }}>——</span> Lena
              </p>
              <ul className="lp-muted" style={{ fontSize: 14, lineHeight: 1.8, margin: "10px 0 14px", paddingLeft: 18 }}>
                <li>Head of Voice AI at Sonance, hiring product people</li>
                <li>Maya worked with her for 3 years</li>
                <li>Maya offered the intro two days ago</li>
              </ul>
              <ul className="lp-trail" style={{ listStyle: "none", margin: 0, padding: "4px 0 0", borderTop: "1px solid var(--line)" }}>
                {TRAIL.map(([s, l, ms]) => (
                  <li key={l}>
                    <span className="lp-tag">{s}</span>
                    <span>{l}</span>
                    <span className="lp-ms">{ms}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="lp-sec">
        <Reveal>
          <p className="lp-eyebrow">Decision-model routing</p>
          <h2 className="lp-h2 lp-serif">Fast when it can be. Deep when it matters.</h2>
        </Reveal>
        <div className="lp-grid2">
          <Reveal>
            <div className="lp-card lp-step">
              <h3 style={{ marginTop: 0 }}>⚡ Quick lookups</h3>
              <p className="lp-muted" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                &ldquo;Who works at Firedrill?&rdquo; A tiny decision model routes it to search and a small model. About 4 seconds.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="lp-card lp-step">
              <h3 style={{ marginTop: 0 }}>🧠 Intros and strategy</h3>
              <p className="lp-muted" style={{ fontSize: 14, lineHeight: 1.6, margin: 0 }}>
                &ldquo;Who&apos;s my best path into voice AI?&rdquo; Goes to your Cognee graph and a large model. About 13 seconds.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="lp-sec">
        <Reveal>
          <p className="lp-eyebrow">Built with</p>
          <h2 className="lp-h2 lp-serif">Real integrations, every call visible.</h2>
        </Reveal>
        <div className="lp-badges">
          {SPONSORS.map(([n, r], i) => (
            <Reveal key={n} delay={i * 80}>
              <div className="lp-card lp-badge">
                <b>{n}</b>
                <span className="lp-muted">{r}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal>
        <section className="lp-final">
          <h2 className="lp-h2 lp-serif">Find your next warm intro.</h2>
          <p className="lp-muted" style={{ margin: "0 0 22px" }}>Set a goal. Circleback finds who can get you there.</p>
          <div className="lp-btns" style={{ justifyContent: "center" }}>
            <Link href="/" className="lp-btn lp-btn-primary">
              Open Circleback →
            </Link>
            <a href="https://github.com/wh0th3h3llam1/circleback" target="_blank" rel="noopener noreferrer" className="lp-btn">
              View on GitHub ↗
            </a>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
