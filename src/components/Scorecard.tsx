import type { Score, ScoreLine } from "@/lib/scoring";
import { MAX_POINTS } from "@/lib/scoring";
import { DriverChip, type DriverLite } from "./DriverChip";

const SLOT_LABEL: Record<ScoreLine["slot"], string> = {
  P1: "Winner",
  P2: "P2",
  P3: "P3",
  FL: "Fastest lap",
  BONUS: "Bonus",
};

const KIND_STYLE: Record<ScoreLine["kind"], string> = {
  exact: "text-emerald-400",
  podium: "text-amber-300",
  "fl-hit": "text-fuchsia-400",
  bonus: "text-accent",
  miss: "text-muted",
  "fl-miss": "text-muted",
  dnf: "text-red-400",
  empty: "text-muted",
};

export function Scorecard({
  score,
  drivers,
  animate = false,
}: {
  score: Score;
  drivers: Record<string, DriverLite>;
  animate?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface">
      <ul className="divide-y divide-line">
        {score.lines.map((line, i) => (
          <li
            key={line.slot}
            className={`grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 px-4 py-3 ${animate ? "reveal-in" : ""}`}
            style={animate ? { animationDelay: `${i * 140}ms` } : undefined}
          >
            <span className="text-xs uppercase tracking-[0.18em] text-muted">{SLOT_LABEL[line.slot]}</span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {line.driverId && <DriverChip driver={drivers[line.driverId]} />}
              <span className={`text-sm ${KIND_STYLE[line.kind]}`}>{line.detail}</span>
            </span>
            <span className={`font-mono tabular text-lg font-bold ${line.points ? KIND_STYLE[line.kind] : "text-muted"}`}>
              {line.points ? `+${line.points}` : "0"}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t border-line bg-surface-2 px-4 py-3">
        <span className="font-display text-lg font-bold uppercase tracking-wide">Total</span>
        <span className="font-mono tabular text-2xl font-bold">
          {score.total}
          <span className="text-sm text-muted"> / {MAX_POINTS}</span>
        </span>
      </div>
    </div>
  );
}
