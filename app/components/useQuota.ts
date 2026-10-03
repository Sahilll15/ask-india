'use client';

import { useCallback, useEffect, useState } from 'react';

export type Quota = { limit: number; remaining: number; resetAt: number | null; dailyExhausted?: boolean };

export function useQuota() {
  const [quota, setQuota] = useState<Quota | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/ask', { cache: 'no-store' });
      if (res.ok) setQuota(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch of server-held quota
    void refresh();
  }, [refresh]);

  const spent = quota !== null && quota.remaining <= 0;

  useEffect(() => {
    if (!spent) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [spent]);

  useEffect(() => {
    if (!spent || !quota?.resetAt) return;
    const id = setTimeout(() => void refresh(), Math.max(0, quota.resetAt - Date.now()) + 500);
    return () => clearTimeout(id);
  }, [spent, quota?.resetAt, refresh]);

  return { quota, setQuota, refresh, spent, now };
}

export function formatCountdown(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}
