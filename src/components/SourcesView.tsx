"use client";

import { useState } from "react";
import type { EventItem, IngestResult, TrailStep } from "@/lib/contracts";
import AirbyteCard from "./AirbyteCard";
import { usePoll, useSpeech } from "./hooks";
import { IconCalendar, IconMic, IconNote, IconTelegram } from "./icons";
import { postJson, shortDate } from "./ui";
import { Trail } from "./Why";

export default function SourcesView() {
  return (
    <div className="mx-auto w-full max-w-[860px] px-4 md:px-8 pt-6 md:pt-10 pb-10 flex flex-col gap-5">
      <header>
        <p className="label">Sources</p>
        <h1 className="text-[26px] md:text-[30px] font-semibold tracking-tight leading-tight mt-1">Everything that feeds your brain</h1>
        <p className="text-[14px] text-[var(--muted)] mt-2">LinkedIn, events and notes all land in one Cognee brain, tagged by source.</p>
      </header>
      <AirbyteCard />
      <EventsCard />
      <div className="grid md:grid-cols-2 gap-5">
        <TelegramCard />
        <NoteCard />
      </div>
    </div>
  );
}

function EventsCard() {
  const events = usePoll<EventItem[]>("/api/events", 30000);
  const [url, setUrl] = useState("");
  const [state, setState] = useState<{ busy: boolean; msg?: string; err?: boolean; trail?: TrailStep[] }>({ busy: false });

  const importIt = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = url.trim();
    if (!/^https?:\/\/(www\.)?(lu\.ma|luma\.com|partiful\.com)\//i.test(u)) {
      setState({ busy: false, err: true, msg: "Paste a Luma or Partiful event link." });
      return;
    }
    setState({ busy: true });
    try {
      const r = await postJson<{ event: EventItem; trail: TrailStep[] }>("/api/events/import", { url: u });
      setState({ busy: false, msg: `Imported "${r.event.title}"`, trail: r.trail });
      setUrl("");
      events.refresh();
    } catch (err) {
      setState({ busy: false, err: true, msg: (err as Error).message });
    }
  };

  const list = events.data ?? [];
  return (
    <section aria-labelledby="events-h" className="glass p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <IconCalendar size={18} />
        <h2 id="events-h" className="text-[16px] font-semibold">
          Events · Luma and Partiful
        </h2>
      </div>
      <p className="text-[13px] text-[var(--muted)]">Paste an event you&apos;re going to. Your agent finds who there can move your career.</p>
      <form className="flex gap-2 flex-wrap" onSubmit={importIt}>
        <label htmlFor="event-url" className="sr-only">
          Event link
        </label>
        <input
          id="event-url"
          className="field !rounded-full flex-1 min-w-[220px]"
          placeholder="https://luma.com/your-event"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (state.err) setState({ busy: false });
          }}
        />
        <button type="submit" className="btn btn-dark" disabled={state.busy || !url.trim()}>
          {state.busy ? "Importing…" : "Import"}
        </button>
      </form>
      {state.msg && (
        <p role="status" className="text-[13px]" style={{ color: state.err ? "var(--orange)" : "var(--green)" }}>
          {state.msg}
        </p>
      )}
      {state.trail && <Trail steps={state.trail} />}
      {events.loading && <p className="text-[13px] text-[var(--muted)]">Loading events…</p>}
      {events.error && <p className="text-[13px] text-[var(--muted)]">Events unavailable: {events.error}</p>}
      {!events.loading && !events.error && list.length === 0 && <p className="text-[13px] text-[var(--muted)]">No events yet.</p>}
      <ul className="flex flex-col gap-2">
        {list.map((ev) => (
          <li key={ev.id} className="rounded-[14px] bg-white/70 border border-white px-3.5 py-3">
            <div className="flex items-center gap-2 flex-wrap">
              <a href={ev.url} target="_blank" rel="noreferrer" className="text-[14px] font-medium hover:underline underline-offset-4">
                {ev.title}
              </a>
              <span className="chip !text-[11px] !py-1">{ev.source === "luma" ? "Luma" : "Partiful"}</span>
              {ev.seeded && <span className="tag-demo">demo data</span>}
            </div>
            <div className="text-[12.5px] text-[var(--muted)] mt-1">
              {[ev.start ? shortDate(ev.start) : "", ev.location, ev.hosts.length ? `Hosts: ${ev.hosts.slice(0, 4).join(", ")}` : "", ev.attendees ? `${ev.attendees} going` : ""].filter(Boolean).join(" · ")}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function TelegramCard() {
  return (
    <section aria-labelledby="tg-h" className="glass p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <IconTelegram size={18} />
        <h2 id="tg-h" className="text-[16px] font-semibold">
          Telegram notes
        </h2>
      </div>
      <p className="text-[13.5px]">
        Message <span className="mono">@mypersonalboibot</span> after a coffee chat or event. Send <span className="mono">/me</span> once to link your chat.
      </p>
      <p className="text-[12.5px] text-[var(--muted)]">Contacts can send /iam &lt;name&gt; so intro requests reach them directly.</p>
    </section>
  );
}

function NoteCard() {
  const [text, setText] = useState("");
  const [state, setState] = useState<{ busy: boolean; result?: IngestResult; err?: string }>({ busy: false });
  const speech = useSpeech((t) => setText(t));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setState({ busy: false, err: "Write a note first." });
      return;
    }
    setState({ busy: true });
    try {
      const r = await postJson<IngestResult>("/api/ingest", { text: text.trim(), source: "web" });
      setState({ busy: false, result: r });
      setText("");
    } catch (err) {
      setState({ busy: false, err: (err as Error).message });
    }
  };

  return (
    <section aria-labelledby="note-h" className="glass p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <IconNote size={18} />
        <h2 id="note-h" className="text-[16px] font-semibold">
          Quick note
        </h2>
      </div>
      <form onSubmit={save} className="flex flex-col gap-2">
        <label htmlFor="quick-note" className="sr-only">
          Note
        </label>
        <textarea
          id="quick-note"
          className="field min-h-[84px]"
          placeholder="Met Imani from Atlas Retail, she's hiring a checkout PM…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (state.err) setState({ busy: false });
          }}
        />
        <div className="flex gap-2">
          <button type="submit" className="btn btn-dark !py-2" disabled={state.busy}>
            {state.busy ? "Saving…" : "Save to brain"}
          </button>
          {speech.supported && (
            <button type="button" className="btn !py-2" onClick={speech.toggle} aria-pressed={speech.listening} aria-label={speech.listening ? "Stop dictation" : "Dictate"}>
              <IconMic size={15} /> {speech.listening ? "Listening…" : "Dictate"}
            </button>
          )}
        </div>
      </form>
      {state.err && (
        <p className="text-[13px]" style={{ color: "var(--orange)" }}>
          {state.err}
        </p>
      )}
      {state.result && (
        <div role="status" className="text-[13px] flex flex-col gap-1">
          <p style={{ color: "var(--green)" }}>
            ✅ Saved · {state.result.people.map((p) => p.name).join(", ") || "no new people"}
            {state.result.promises.length ? ` · ${state.result.promises.length} promise${state.result.promises.length > 1 ? "s" : ""}` : ""}
          </p>
          <Trail steps={state.result.trail} />
        </div>
      )}
    </section>
  );
}
