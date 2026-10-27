import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { DriverChip } from "@/components/DriverChip";
import { db } from "@/db";
import { predictions } from "@/db/schema";
import { getSchedule, getSeasonResults, racePhase, SEASON } from "@/lib/f1";
import { outcomesByRound } from "@/lib/leagues";
import { MAX_POINTS, scorePrediction } from "@/lib/scoring";
import { requirePlayer } from "@/lib/session";

export default async function MySeason() {
  const { userId, profile } = await requirePlayer("/me");
  const [schedule, results, mine] = await Promise.all([
    getSchedule(),
    getSeasonResults(),
    db
      .select()
      .from(predictions)
      .where(and(eq(predictions.userId, userId), eq(predictions.season, SEASON), eq(predictions.mode, "live"))),
  ]);
  const outcomes = outcomesByRound(results);
  const byRound = new Map(mine.map((p) => [p.round, p]));
  const drivers = Object.fromEntries(
    [...results.values()].flatMap((r) => r.classification).map((d) => [d.driverId, d]),
  );

  const rows = schedule.map((race) => {
    const p = byRound.get(race.round);
    const outcome = outcomes.get(race.round);
    const score = p?.status === "submitted" && outcome ? scorePrediction(p, outcome) : null;
    return { race, p, outcome, score, running: 0, phase: racePhase(race, Boolean(outcome)) };
  });
  rows.forEach((row, i) => {
    row.running = (rows[i - 1]?.running ?? 0) + (row.score?.total ?? 0);
  });
  const running = rows.at(-1)?.running ?? 0;
  const scored = rows.filter((r) => r.score);
  const best = scored.reduce<(typeof rows)[number] | null>((a, r) => (!a || r.score!.total > a.score!.total ? r : a), null);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted">{SEASON} season</p>
          <h1 className="font-display text-5xl font-extrabold uppercase">{profile.displayName}&apos;s season</h1>
        </div>
        <div className="flex gap-3">
          <Stat label="points" value={running} />
          <Stat label="races played" value={scored.length} />
          <Stat label="best weekend" value={best ? `${best.score!.total}` : "–"} sub={best?.race.locality} />
        </div>
      </div>

      <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {rows.map(({ race, p, outcome, score, running: total, phase }) => (
          <li key={race.round} className="grid gap-2 px-4 py-3 sm:grid-cols-[11rem_1fr_1fr_5rem] sm:items-center">
            <Link href={`/race/${race.round}`} className="hover:underline">
              <span className="block text-xs uppercase tracking-[0.2em] text-muted">Round {race.round}</span>
              <span className="font-display text-lg font-bold uppercase">{race.locality}</span>
            </Link>
            <span className="flex flex-wrap gap-3 text-sm">
              <span className="text-xs uppercase tracking-[0.15em] text-muted">You</span>
              {p ? (
                [p.p1, p.p2, p.p3].map((d, i) => <DriverChip key={i} driver={d ? drivers[d] : undefined} size="sm" />)
              ) : (
                <span className="text-muted">{phase === "open" ? "Not picked yet" : "No picks"}</span>
              )}
              {p?.status === "draft" && <span className="text-amber-300">draft</span>}
            </span>
            <span className="flex flex-wrap gap-3 text-sm">
              <span className="text-xs uppercase tracking-[0.15em] text-muted">Actual</span>
              {outcome ? (
                outcome.podium.map((d) => <DriverChip key={d} driver={drivers[d]} size="sm" />)
              ) : (
                <span className="text-muted">{phase === "locked" ? "Racing now" : "To come"}</span>
              )}
            </span>
            <span className="text-right font-mono tabular">
              {score ? (
                <>
                  <b className="text-lg">{score.total}</b>
                  <span className="block text-xs text-muted">Σ {total}</span>
                </>
              ) : (
                <span className="text-muted">–</span>
              )}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-muted">Maximum per race is {MAX_POINTS}. Replays live on the replay page.</p>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-3 text-right">
      <div className="font-mono tabular text-3xl font-bold">{value}</div>
      <div className="text-xs uppercase tracking-[0.2em] text-muted">
        {label}
        {sub && ` · ${sub}`}
      </div>
    </div>
  );
}
