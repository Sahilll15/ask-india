'use client';

import { useEffect, useRef, useState } from 'react';
import type { RemovedKind } from '../lib/redact.ts';

export const MAX_SECONDS = 30;

type Result = { text: string; removed: RemovedKind[] };

function pickType() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
}

export function useRecorder(onResult: (r: Result) => void) {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cb = useRef(onResult);
  useEffect(() => {
    cb.current = onResult;
  }, [onResult]);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      rec.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (rec.current?.state === 'recording') rec.current.stop();
  }

  async function start() {
    setError(null);
    const type = pickType();
    if (!type || !navigator.mediaDevices?.getUserMedia) {
      setError('Voice input is not supported in this browser.');
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone permission was denied.');
      return;
    }
    const chunks: Blob[] = [];
    const r = new MediaRecorder(stream, { mimeType: type, audioBitsPerSecond: 32_000 });
    rec.current = r;
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setState('transcribing');
      const base = type.split(';')[0];
      try {
        const res = await fetch('/api/transcribe', { method: 'POST', headers: { 'content-type': base }, body: new Blob(chunks, { type: base }) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? 'Could not transcribe that.');
        if (!json.text) throw new Error('No speech was heard. Try again a little closer to the mic.');
        cb.current({ text: json.text, removed: json.removed ?? [] });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setState('idle');
      }
    };
    r.start();
    setSeconds(0);
    setState('recording');
    const began = Date.now();
    timer.current = setInterval(() => {
      const s = Math.floor((Date.now() - began) / 1000);
      setSeconds(s);
      if (s >= MAX_SECONDS) stop();
    }, 250);
  }

  return { state, seconds, error, start, stop, clearError: () => setError(null) };
}
