"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

/** Live countdown to `target`. Refreshes the page when it hits zero so the lock shows up. */
export function Countdown({ target, size = "lg" }: { target: string; size?: "lg" | "sm" }) {
  const router = useRouter();
  const end = new Date(target).getTime();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // Start ticking after mount so server and client render the same placeholder.
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);

  const remaining = now === null ? null : end - now;

  useEffect(() => {
    if (remaining !== null && remaining <= 0) router.refresh();
  }, [remaining !== null && remaining <= 0, router]); // eslint-disable-line react-hooks/exhaustive-deps

  if (remaining !== null && remaining <= 0) {
    return <span className="font-display text-accent font-bold uppercase">Lights out</span>;
  }

  const p = parts(remaining ?? 0);
  const cells: [string, number][] = [
    ["days", p.d],
    ["hrs", p.h],
    ["min", p.m],
    ["sec", p.s],
  ];

  if (size === "sm") {
    return (
      <span className="font-mono tabular text-sm" suppressHydrationWarning>
        {now === null ? "--" : `${p.d}d ${p.h}h ${String(p.m).padStart(2, "0")}m`}
      </span>
    );
  }

  return (
    <div className="flex gap-2" aria-live="off">
      {cells.map(([label, value]) => (
        <div key={label} className="min-w-16 rounded-md border border-line bg-surface-2 px-3 py-2 text-center">
          <div className="font-mono tabular text-3xl font-bold" suppressHydrationWarning>
            {now === null ? "--" : String(value).padStart(2, "0")}
          </div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted">{label}</div>
        </div>
      ))}
    </div>
  );
}
