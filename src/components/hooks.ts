"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getJson } from "./ui";

export function usePoll<T>(url: string | null, intervalMs = 0) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<number | undefined>(undefined);
  const alive = useRef(true);
  const last = useRef<string>("");

  const refresh = useCallback(async () => {
    if (!url) return;
    try {
      const d = await getJson<T>(url);
      if (!alive.current) return;
      // Keep the same object when nothing changed, so 3D geometry isn't rebuilt every poll.
      const sig = JSON.stringify(d);
      if (sig !== last.current) {
        last.current = sig;
        setData(d);
      }
      setError(undefined);
      setStatus(200);
    } catch (e) {
      if (!alive.current) return;
      setError((e as Error).message);
      setStatus((e as Error & { status?: number }).status);
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    refresh();
    if (!intervalMs) return () => void (alive.current = false);
    const id = setInterval(refresh, intervalMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [refresh, intervalMs]);

  return { data, error, status, refresh, loading: data === undefined && error === undefined };
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
  onerror: () => void;
  start: () => void;
  stop: () => void;
};

export function useSpeech(onText: (t: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  const cb = useRef(onText);
  cb.current = onText;

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      cb.current(t);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setSupported(true);
  }, []);

  const toggle = useCallback(() => {
    if (!rec.current) return;
    if (listening) {
      rec.current.stop();
      setListening(false);
    } else {
      try {
        rec.current.start();
        setListening(true);
      } catch {
        setListening(false);
      }
    }
  }, [listening]);

  return { supported, listening, toggle };
}

export function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return reduce;
}
