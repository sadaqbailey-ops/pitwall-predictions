import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DriverChip } from "@/components/DriverChip";
import { db } from "@/db";
import { leagues, predictions } from "@/db/schema";
import { getSchedule, getSeasonResults, racePhase, SEASON } from "@/lib/f1";
import { getStandings, isMember, outcomesByRound } from "@/lib/leagues";
import { scorePrediction } from "@/lib/scoring";
import { requirePlayer } from "@/lib/session";

export default async function PlayerPage({ params }: PageProps<"/leagues/[id]/players/[userId]">) {
  const { id, userId: playerId } = await params;
  const { userId } = await requirePlayer(`/leagues/${id}`);
  const [league] = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
  if (!league || !(await isMember(id, userId)) || !(await isMember(id, playerId))) notFound();

  const [{ rows }, schedule, results, picks] = await Promise.all([
    getStandings(id),
    getSchedule(),
    getSeasonResults(),
    db
      .select()
      .from(predictions)
      .where(
        and(
          eq(predictions.userId, playerId),
          eq(predictions.season, SEASON),
          eq(predictions.mode, "live"),
          eq(predictions.status, "submitted"),
        ),
      )
      .orderBy(desc(predictions.round)),
  ]);
  const player = rows.find((r) => r.userId === playerId);
  if (!player) notFound();
  const outcomes = outcomesByRound(results);
  const drivers = Object.fromEntries(
    [...results.values()].flatMap((r) => r.classification).map((d) => [d.driverId, d]),
  );

  return (
    <div className="space-y-6">
      <Link href={`/leagues/${id}`} className="text-sm text-muted hover:text-foreground">
        ← {league.name}
      </Link>
      <div>
        <h1 className="font-display text-5xl font-extrabold uppercase">{player.displayName}</h1>
        <p className="text-muted">
          {player.total} pts · {player.racesPlayed} races · {player.exactHits} exact calls · {player.perfectPodiums}{" "}
          perfect podiums
        </p>
      </div>

      <ul className="space-y-2">
        {picks.map((p) => {
          const race = schedule.find((r) => r.round === p.round);
          if (!race) return null;
          const phase = racePhase(race, outcomes.has(p.round));
          const outcome = outcomes.get(p.round);
          // Picks for a race that's still open stay private, even to league mates.
          const hidden = phase === "open" && playerId !== userId;
          return (
            <li
              key={p.id}
              className="grid gap-3 rounded-lg border border-line bg-surface px-4 py-3 sm:grid-cols-[12rem_1fr_auto] sm:items-center"
            >
              <span>
                <span className="block text-xs uppercase tracking-[0.2em] text-muted">Round {race.round}</span>
                <span className="font-display text-lg font-bold uppercase">{race.name}</span>
              </span>
              {hidden ? (
                <span className="text-sm text-muted">Picks are in. You&apos;ll see them at lights out.</span>
              ) : (
                <span className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  {(["p1", "p2", "p3"] as const).map((k, i) => (
                    <span key={k} className="flex items-center gap-1.5">
                      <span className="text-muted">P{i + 1}</span>
                      <DriverChip driver={p[k] ? drivers[p[k]!] : undefined} size="sm" />
                    </span>
                  ))}
                  <span className="flex items-center gap-1.5">
                    <span className="text-muted">FL</span>
                    <DriverChip driver={p.fastestLap ? drivers[p.fastestLap] : undefined} size="sm" />
                  </span>
                </span>
              )}
              <span className="text-right font-mono tabular text-lg font-bold">
                {outcome ? scorePrediction(p, outcome).total : <span className="text-sm text-muted">pending</span>}
              </span>
            </li>
          );
        })}
        {picks.length === 0 && <li className="text-muted">No live picks yet.</li>}
      </ul>
    </div>
  );
}
