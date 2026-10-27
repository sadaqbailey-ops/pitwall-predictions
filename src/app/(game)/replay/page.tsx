import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { predictions } from "@/db/schema";
import { getSchedule, getSeasonResults, SEASON } from "@/lib/f1";
import { outcomesByRound } from "@/lib/leagues";
import { MAX_POINTS, scorePrediction } from "@/lib/scoring";
import { requirePlayer } from "@/lib/session";

export default async function ReplayList() {
  const { userId } = await requirePlayer("/replay");
  const [schedule, results, mine] = await Promise.all([
    getSchedule(),
    getSeasonResults(),
    db
      .select()
      .from(predictions)
      .where(and(eq(predictions.userId, userId), eq(predictions.season, SEASON), eq(predictions.mode, "replay"))),
  ]);
  const outcomes = outcomesByRound(results);
  const byRound = new Map(mine.map((p) => [p.round, p]));
  const finished = schedule.filter((r) => outcomes.has(r.round)).reverse();

  const revealed = mine
    .filter((p) => p.revealedAt && outcomes.has(p.round))
    .map((p) => scorePrediction(p, outcomes.get(p.round)!).total);
  const avg = revealed.length ? Math.round(revealed.reduce((a, b) => a + b, 0) / revealed.length) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted">Practice mode</p>
          <h1 className="font-display text-5xl font-extrabold uppercase">Replay the season</h1>
          <p className="mt-1 max-w-2xl text-muted">
            Pick a race you think you remember. Call the podium blind, reveal, and see how you&apos;d have scored.
            Replays don&apos;t count towards league tables.
          </p>
        </div>
        {avg !== null && (
          <div className="rounded-lg border border-line bg-surface px-5 py-3 text-right">
            <div className="font-mono tabular text-3xl font-bold">{avg}</div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted">
              avg over {revealed.length} replay{revealed.length === 1 ? "" : "s"}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {finished.map((race) => {
          const p = byRound.get(race.round);
          const score = p?.revealedAt ? scorePrediction(p, outcomes.get(race.round)!).total : null;
          return (
            <Link
              key={race.round}
              href={`/replay/${race.round}`}
              className="group rounded-lg border border-line bg-surface p-4 transition hover:border-accent"
            >
              <div className="flex items-baseline justify-between text-xs uppercase tracking-[0.2em] text-muted">
                <span>Round {race.round}</span>
                <span>{race.locality}</span>
              </div>
              <div className="mt-1 font-display text-2xl font-bold uppercase leading-tight group-hover:text-accent">
                {race.name}
              </div>
              <div className="mt-3 text-sm">
                {score !== null ? (
                  <span>
                    Scored <b className="font-mono">{score}</b>
                    <span className="text-muted"> / {MAX_POINTS}</span>
                  </span>
                ) : p ? (
                  <span className="text-amber-300">Picks in progress</span>
                ) : (
                  <span className="text-muted">Not played</span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
