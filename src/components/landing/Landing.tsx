"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const reduced = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts a number up when it scrolls into view, e.g. "6s" or "0.3s". */
function CountUp({ value }: { value: string }) {
  const m = /^([\d.]+)(.*)$/.exec(value);
  const target = m ? parseFloat(m[1]) : 0;
  const decimals = m && m[1].includes(".") ? m[1].split(".")[1].length : 0;
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || Number.isNaN(target)) return;
    if (reduced()) {
      setN(target);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver((es) => {
      if (!es[0].isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / 900);
        setN(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target]);
  if (!m) return <span>{value}</span>;
  return (
    <span ref={ref} style={{ display: "inline-block", minWidth: "3.2em", textAlign: "right" }}>
      {n.toFixed(decimals)}
      {m[2]}
    </span>
  );
}

/** Splits a headline into words that rise in one after another. */
function Words({ text, start = 0 }: { text: string; start?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i} className="lp-word" style={{ animationDelay: `${start + i * 70}ms` }}>
          {w}
          {" "}
        </span>
      ))}
    </>
  );
}

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
.lp{overflow-x:clip;position:relative}
.lp-page{background:var(--bg,#F7F8F5);min-height:100dvh}
.lp-nav{display:flex;align-items:center;justify-content:space-between;max-width:1040px;margin:0 auto;padding:18px 20px 0}
.lp-logo{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:17px;color:var(--text);text-decoration:none}
.lp-logo i{width:22px;height:22px;border-radius:999px;border:2px solid var(--teal);position:relative;display:inline-block}
.lp-logo i::after{content:"";position:absolute;width:7px;height:7px;border-radius:99px;background:var(--orange,#E9772E);top:-4px;left:50%;margin-left:-3.5px;transform-origin:3.5px 13px;animation:lp-spin 6s linear infinite}
.lp-hero-wrap{position:relative}
.lp-orbits{position:absolute;inset:-120px -160px auto auto;width:620px;height:620px;pointer-events:none;opacity:.7;z-index:0}
.lp-orbits .r{transform-origin:310px 310px;animation:lp-spin 60s linear infinite}
.lp-orbits .r2{animation-duration:90s;animation-direction:reverse}
.lp-orbits .r3{animation-duration:40s}
@keyframes lp-spin{to{transform:rotate(360deg)}}
.lp-hero>*{position:relative;z-index:1}
.lp-word{display:inline-block;opacity:0;transform:translateY(.4em);animation:lp-word .7s cubic-bezier(.2,.7,.2,1) forwards}
@keyframes lp-word{to{opacity:1;transform:none}}
.lp-in{opacity:0;animation:lp-word .7s cubic-bezier(.2,.7,.2,1) forwards}
.lp-card{transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease}
.lp-card:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(23,48,42,.08)}
.lp-step.on{border-color:var(--teal);box-shadow:0 14px 34px rgba(31,74,64,.10)}
.lp-step.on .lp-num{background:var(--teal);color:#fff}
.lp-step .lp-num{transition:background .3s,color .3s}
.lp-par{transform:translateY(calc(var(--sy,0) * var(--k,0) * 1px));will-change:transform}
.lp-trail li{opacity:0;transform:translateX(-8px);transition:opacity .5s,transform .5s}
.lp-trail.in li{opacity:1;transform:none}
@media (max-width:860px){.lp-orbits{inset:-80px -260px auto auto;opacity:.45}}
@media (prefers-reduced-motion:reduce){.lp-word,.lp-in{animation:none;opacity:1;transform:none}.lp-orbits .r,.lp-logo i::after{animation:none}.lp-par{transform:none}.lp-trail li{opacity:1;transform:none;transition:none}.lp-card:hover{transform:none}}
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
  // Re-draw the wire every time the pointer enters the card.
  const [run, setRun] = useState(0);
  return (
    <div className="lp-card" onMouseEnter={() => setRun((r) => r + 1)} style={{ position: "relative", padding: 20, minHeight: 320, overflow: "hidden" }} aria-label="You reach Lena Park through Maya Chen">
      <svg viewBox="0 0 440 280" width="100%" height="100%" style={{ position: "absolute", inset: 0 }} aria-hidden="true">
        <circle cx="220" cy="140" r="118" fill="none" stroke="#E8EBE6" />
        <circle cx="220" cy="140" r="74" fill="none" stroke="#E8EBE6" />
        <path key={run} className="lp-path" d="M70 220 C 150 210, 170 150, 220 140 S 330 70, 372 58" fill="none" stroke="#E9772E" strokeWidth="3" strokeLinecap="round" />
        <circle cx="70" cy="220" r="7" fill="#1F4A40" />
        <circle cx="220" cy="140" r="7" fill="#3E8E86" />
        <circle cx="372" cy="58" r="7" fill="#fff" stroke="#E9772E" strokeWidth="2" strokeDasharray="3 3" />
      </svg>
      <div className="lp-par" style={{ position: "absolute", left: 16, bottom: 22, ["--k" as string]: -0.04 }}>
        <Chip initials="You" name="You" sub="goal: voice AI PM" color="#1F4A40" cls="" />
      </div>
      <div className="lp-par" style={{ position: "absolute", left: "34%", top: "54%", ["--k" as string]: -0.08 }}>
        <Chip initials="MC" name="Maya Chen" sub="inner circle" color="#3E8E86" cls="d2" />
      </div>
      <div className="lp-par" style={{ position: "absolute", right: 14, top: 14, ["--k" as string]: -0.12 }}>
        <Chip initials="LP" name="Lena Park" sub="Sonance" color="#E9772E" cls="d3" dashed />
      </div>
      <div key={`p${run}`} className="lp-pop" style={{ position: "absolute", right: 18, top: 62 }}>
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
  const root = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [step, setStep] = useState(0);

  // Scroll position drives the parallax chips (CSS var --sy).
  useEffect(() => {
    if (reduced()) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => root.current?.style.setProperty("--sy", String(window.scrollY)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Highlight the "How it works" step nearest the middle of the screen.
  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setStep(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    stepRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  // Trail rows slide in when the answer card is visible.
  const trailRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const el = trailRef.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es[0].isIntersecting && (el.classList.add("in"), io.disconnect()), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const smooth = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const id = e.currentTarget.getAttribute("href")?.slice(1);
    const el = id ? document.getElementById(id) : null;
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
  };

  return (
    <div className="lp-page">
      <nav className="lp-nav">
        <Link href="/landing" className="lp-logo">
          <i aria-hidden="true" /> Orbit
        </Link>
        <Link href="/" className="lp-btn" style={{ padding: "8px 14px", fontSize: 14 }}>
          Open app →
        </Link>
      </nav>
    <div className="lp" ref={root}>
      <style>{CSS}</style>

      <div className="lp-hero-wrap">
      <svg className="lp-orbits" viewBox="0 0 620 620" aria-hidden="true">
        <g className="r">
          <circle cx="310" cy="310" r="300" fill="none" stroke="#E2E7E1" />
          <circle cx="310" cy="10" r="5" fill="#E9772E" />
        </g>
        <g className="r r2">
          <circle cx="310" cy="310" r="220" fill="none" stroke="#E2E7E1" strokeDasharray="2 6" />
          <circle cx="90" cy="310" r="4" fill="#3E8E86" />
        </g>
        <g className="r r3">
          <circle cx="310" cy="310" r="140" fill="none" stroke="#E2E7E1" />
          <circle cx="410" cy="211" r="4" fill="#C9A24A" />
        </g>
      </svg>
      <section className="lp-hero">
        <div>
          <p className="lp-eyebrow lp-in" style={{ animationDelay: "0ms" }}>
            Orbit · your career brain
          </p>
          <h1 className="lp-h1 lp-serif">
            <Words text="Your network already knows your next job." start={120} />
          </h1>
          <p className="lp-sub lp-muted lp-in" style={{ animationDelay: "650ms" }}>
            Orbit is a personal career agent. It remembers everyone you meet and finds the warm path to the opportunity you want.
          </p>
          <div className="lp-btns lp-in" style={{ animationDelay: "800ms" }}>
            <Link href="/" className="lp-btn lp-btn-primary">
              Open Orbit →
            </Link>
            <a href="#how" className="lp-btn" onClick={smooth}>
              See how it works
            </a>
          </div>
        </div>
        <Reveal delay={300}>
          <IntroPath />
        </Reveal>
      </section>
      </div>

      <section id="how" className="lp-sec">
        <Reveal>
          <p className="lp-eyebrow">How it works</p>
          <h2 className="lp-h2 lp-serif">Capture once. Remember everything. Act at the right moment.</h2>
        </Reveal>
        <div className="lp-grid3">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 120}>
              <div
                className={`lp-card lp-step ${step === i ? "on" : ""}`}
                data-i={i}
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
              >
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
              <ul ref={trailRef} className="lp-trail" style={{ listStyle: "none", margin: 0, padding: "4px 0 0", borderTop: "1px solid var(--line)" }}>
                {TRAIL.map(([s, l, ms], i) => (
                  <li key={l} style={{ transitionDelay: `${i * 140}ms` }}>
                    <span className="lp-tag">{s}</span>
                    <span>{l}</span>
                    <span className="lp-ms">
                      <CountUp value={ms} />
                    </span>
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
          <p className="lp-muted" style={{ margin: "0 0 22px" }}>Set a goal. Orbit finds who can get you there.</p>
          <div className="lp-btns" style={{ justifyContent: "center" }}>
            <Link href="/" className="lp-btn lp-btn-primary">
              Open Orbit →
            </Link>
            <a href="https://github.com/wh0th3h3llam1/circleback" target="_blank" rel="noopener noreferrer" className="lp-btn">
              View on GitHub ↗
            </a>
          </div>
        </section>
      </Reveal>
    </div>
    </div>
  );
}
