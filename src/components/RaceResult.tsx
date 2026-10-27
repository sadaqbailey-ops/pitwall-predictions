import type { RaceResult as Result } from "@/lib/f1";
import { isClassifiedFinish } from "@/lib/scoring";
import { DriverChip } from "./DriverChip";

/** Top of the classification with grid gains/losses and the fastest lap marked. */
export function RaceResult({ result, rows = 10 }: { result: Result; rows?: number }) {
  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2">
        <h3 className="font-display text-lg font-bold uppercase tracking-wide">Race result</h3>
        <span className="text-xs text-muted">
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-fuchsia-400 align-middle" /> fastest lap
        </span>
      </div>
      <ol className="divide-y divide-line text-sm">
        {result.classification.slice(0, rows).map((d) => {
          const gained = d.grid > 0 ? d.grid - d.position : 0;
          return (
            <li key={d.driverId} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 px-4 py-2">
              <span className="font-mono tabular text-muted">P{d.position}</span>
              <span className="flex items-center gap-2">
                <DriverChip driver={d} />
                {d.fastestLapRank === 1 && <span className="h-2 w-2 rounded-full bg-fuchsia-400" title="Fastest lap" />}
              </span>
              <span className="font-mono tabular text-xs">
                {!isClassifiedFinish(d.status) ? (
                  <span className="text-red-400">{d.status}</span>
                ) : gained > 0 ? (
                  <span className="text-emerald-400">▲{gained}</span>
                ) : gained < 0 ? (
                  <span className="text-red-400">▼{-gained}</span>
                ) : (
                  <span className="text-muted">–</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
