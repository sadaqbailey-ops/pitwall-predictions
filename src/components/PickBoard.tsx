"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { lockInAndReveal, savePrediction } from "@/app/actions/predictions";
import type { PredictionMode, PredictionStatus } from "@/db/schema";
import type { Picks } from "@/lib/scoring";
import { teamColor, teamName } from "@/lib/teams";
import type { DriverLite } from "./DriverChip";

type Slot = keyof Picks;
const SLOTS: { key: Slot; label: string; hint: string }[] = [
  { key: "p1", label: "P1", hint: "Race winner" },
  { key: "p2", label: "P2", hint: "Second" },
  { key: "p3", label: "P3", hint: "Third" },
  { key: "fastestLap", label: "FL", hint: "Fastest lap" },
];

type Props = {
  round: number;
  mode: PredictionMode;
  drivers: (DriverLite & { gridPosition?: number })[];
  initialPicks: Picks;
  initialStatus: PredictionStatus | null;
};

type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "unsaved" }
  | { kind: "saved"; at: string; status: PredictionStatus }
  | { kind: "error"; message: string };

export function PickBoard({ round, mode, drivers, initialPicks, initialStatus }: Props) {
  const [picks, setPicks] = useState<Picks>(initialPicks);
  const [active, setActive] = useState<Slot>(() => SLOTS.find((s) => !initialPicks[s.key])?.key ?? "p1");
  const [status, setStatus] = useState<PredictionStatus | null>(initialStatus);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [pending, startTransition] = useTransition();
  const dirty = useRef(false);

  const byId = useMemo(() => Object.fromEntries(drivers.map((d) => [d.driverId, d])), [drivers]);
  const teams = useMemo(() => {
    const groups = new Map<string, typeof drivers>();
    for (const d of drivers) groups.set(d.teamId, [...(groups.get(d.teamId) ?? []), d]);
    return [...groups.values()];
  }, [drivers]);
  const hasGrid = drivers.some((d) => d.gridPosition);

  // Autosave a draft shortly after the last change. Submitted picks only change through
  // "Update picks", so a half-edited podium can never replace a valid submission.
  useEffect(() => {
    if (!dirty.current || status === "submitted") return;
    const id = setTimeout(async () => {
      setSave({ kind: "saving" });
      const res = await savePrediction({ round, mode, intent: "draft", picks });
      if (res.ok) {
        setStatus(res.status);
        setSave({ kind: "saved", at: res.savedAt, status: res.status });
      } else {
        setSave({ kind: "error", message: res.error });
      }
    }, 700);
    return () => clearTimeout(id);
  }, [picks, round, mode, status]);

  function markEdited() {
    dirty.current = true;
    if (status === "submitted") setSave({ kind: "unsaved" });
  }

  function choose(driverId: string) {
    markEdited();
    const next = { ...picks };
    // A driver can only hold one podium slot; picking them again moves them.
    if (active !== "fastestLap") {
      for (const s of ["p1", "p2", "p3"] as const) if (next[s] === driverId) next[s] = null;
    }
    next[active] = driverId;
    setPicks(next);
    const following = SLOTS.find((s) => s.key !== active && !next[s.key]);
    if (following) setActive(following.key);
  }

  function clearSlot(slot: Slot) {
    markEdited();
    setPicks((prev) => ({ ...prev, [slot]: null }));
    setActive(slot);
  }

  const podiumFull = Boolean(picks.p1 && picks.p2 && picks.p3);

  function submit() {
    startTransition(async () => {
      // A replay reveal redirects to the scorecard on success, so it only returns on error.
      const res =
        mode === "replay"
          ? await lockInAndReveal({ round, picks })
          : await savePrediction({ round, mode, intent: "submit", picks });
      if (!res.ok) {
        setSave({ kind: "error", message: res.error });
        return;
      }
      setStatus("submitted");
      setSave({ kind: "saved", at: res.savedAt, status: "submitted" });
    });
  }

  return (
    <div className="space-y-6">
      {/* The four pick slots */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SLOTS.map((slot) => {
          const d = picks[slot.key] ? byId[picks[slot.key]!] : undefined;
          const isActive = active === slot.key;
          return (
            <div
              key={slot.key}
              className={`relative rounded-lg border-2 bg-surface p-3 text-left transition ${
                isActive ? "border-accent" : "border-line hover:border-muted"
              }`}
            >
              <button type="button" onClick={() => setActive(slot.key)} className="block w-full text-left">
                <div className="flex items-baseline justify-between">
                  <span className="font-display text-2xl font-extrabold">{slot.label}</span>
                  <span className="text-[10px] uppercase tracking-[0.18em] text-muted">{slot.hint}</span>
                </div>
                <div className="mt-2 flex h-10 items-center gap-2">
                  {d ? (
                    <>
                      <span className="h-8 w-1.5 rounded-full" style={{ background: teamColor(d.teamId) }} />
                      <span>
                        <span className="block font-display text-xl font-bold leading-none">{d.code}</span>
                        <span className="text-xs text-muted">{d.familyName}</span>
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-muted">{isActive ? "Tap a driver below" : "Empty"}</span>
                  )}
                </div>
              </button>
              {d && (
                <button
                  type="button"
                  onClick={() => clearSlot(slot.key)}
                  className="absolute right-2 bottom-2 text-xs text-muted hover:text-foreground"
                  aria-label={`Clear ${slot.label}`}
                >
                  clear
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Save bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
        <p className="text-sm" aria-live="polite">
          {save.kind === "saving" && <span className="text-muted">Saving draft…</span>}
          {save.kind === "unsaved" && (
            <span className="text-amber-300">
              {podiumFull
                ? "Changes not saved yet. Your submitted picks still stand until you update."
                : "Fill the podium to update. Your submitted picks still stand."}
            </span>
          )}
          {save.kind === "error" && <span className="text-red-400">{save.message}</span>}
          {save.kind === "saved" && (
            <span className="text-muted">
              {save.status === "submitted" ? "Submitted" : "Draft saved"} at{" "}
              {new Date(save.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {save.kind === "idle" &&
            (status === "submitted" ? (
              <span className="text-emerald-400">Submitted. You can still change your mind until lights out.</span>
            ) : status === "draft" ? (
              <span className="text-amber-300">Draft only. Submit before lights out or it won&apos;t count.</span>
            ) : (
              <span className="text-muted">Pick your podium. Fastest lap is a bonus.</span>
            ))}
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={!podiumFull || pending}
          className="rounded-md bg-accent px-5 py-2 font-display text-lg font-bold uppercase tracking-wide text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending
            ? "Working…"
            : mode === "replay"
              ? "Lock in & reveal"
              : status === "submitted"
                ? "Update picks"
                : "Submit picks"}
        </button>
      </div>

      {/* The grid */}
      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">
            Choosing <span className="text-accent">{SLOTS.find((s) => s.key === active)?.hint}</span>
          </h2>
          {hasGrid && <span className="text-xs text-muted">Numbers show the starting grid</span>}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <div key={team[0].teamId} className="rounded-lg border border-line bg-surface">
              <div
                className="rounded-t-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em]"
                style={{ background: `color-mix(in srgb, ${teamColor(team[0].teamId)} 22%, transparent)` }}
              >
                {teamName(team[0].teamId)}
              </div>
              <div className="grid grid-cols-2 gap-px bg-line">
                {team.map((d) => {
                  const slotHeld = SLOTS.find((s) => picks[s.key] === d.driverId);
                  return (
                    <button
                      key={d.driverId}
                      type="button"
                      data-driver={d.driverId}
                      onClick={() => choose(d.driverId)}
                      className={`flex items-center justify-between gap-2 bg-surface px-3 py-3 text-left transition hover:bg-surface-2 ${
                        slotHeld ? "ring-2 ring-inset ring-accent" : ""
                      }`}
                    >
                      <span>
                        <span className="block font-display text-lg font-bold leading-none">
                          <span className="mr-1.5 font-mono text-xs text-muted">{d.number}</span>
                          {d.code}
                        </span>
                        <span className="text-xs text-muted">{d.familyName}</span>
                      </span>
                      <span className="text-right">
                        {slotHeld && (
                          <span className="block font-display text-sm font-bold text-accent">{slotHeld.label}</span>
                        )}
                        {d.gridPosition && <span className="font-mono text-xs text-muted">P{d.gridPosition}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
