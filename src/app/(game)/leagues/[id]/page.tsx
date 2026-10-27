import { and, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { leaveLeague } from "@/app/actions/leagues";
import { db } from "@/db";
import { leagueMembers, leagues, predictions } from "@/db/schema";
import { getNextRace, getSchedule, SEASON } from "@/lib/f1";
import { getStandings, isMember } from "@/lib/leagues";
import { requirePlayer } from "@/lib/session";
import { teamColor } from "@/lib/teams";
import { CopyInvite } from "../forms";

export default async function LeaguePage({ params, searchParams }: PageProps<"/leagues/[id]">) {
  const { id } = await params;
  const { created } = await searchParams;
  const { userId } = await requirePlayer(`/leagues/${id}`);

  const [league] = await db.select().from(leagues).where(eq(leagues.id, id)).limit(1);
  // Same 404 whether it doesn't exist or you're not in it: league ids don't leak.
  if (!league || !(await isMember(id, userId))) notFound();

  const [{ rows, rounds }, schedule, nextRace] = await Promise.all([getStandings(id), getSchedule(), getNextRace()]);

  // For the race that's still open, show who has picks in, never what they are.
  const memberIds = (
    await db.select({ userId: leagueMembers.userId }).from(leagueMembers).where(eq(leagueMembers.leagueId, id))
  ).map((m) => m.userId);
  const ready = nextRace
    ? new Set(
        (
          await db
            .select({ userId: predictions.userId })
            .from(predictions)
            .where(
              and(
                inArray(predictions.userId, memberIds),
                eq(predictions.season, SEASON),
                eq(predictions.round, nextRace.round),
                eq(predictions.mode, "live"),
                eq(predictions.status, "submitted"),
              ),
            )
        ).map((p) => p.userId),
      )
    : new Set<string>();

  const raceCode = (round: number) =>
    schedule.find((r) => r.round === round)?.locality.slice(0, 3).toUpperCase() ?? `R${round}`;
  const recent = rounds.slice(-8);
  const host = (await headers()).get("host");
  const proto = host?.startsWith("localhost") ? "http" : "https";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-muted">
            {league.isDemo ? "Demo league · everyone starts here" : "Private league"} · {rows.length} drivers
          </p>
          <h1 className="font-display text-5xl font-extrabold uppercase">{league.name}</h1>
        </div>
        {league.inviteCode && <CopyInvite code={league.inviteCode} url={`${proto}://${host}/join/${league.inviteCode}`} />}
      </div>

      {created && (
        <p className="rounded-md border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          League created. Send the code or link to your mates. Their live picks count from now on, and past rounds
          they played count too.
        </p>
      )}

      <section className="overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs uppercase tracking-[0.15em] text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-3 text-left">Pos</th>
              <th className="px-4 py-3 text-left">Driver</th>
              {nextRace && <th className="px-2 py-3 text-center">{raceCode(nextRace.round)} picks</th>}
              {recent.map((r) => (
                <th key={r} className="px-2 py-3 text-right font-mono" title={`Round ${r}`}>
                  {raceCode(r)}
                </th>
              ))}
              <th className="px-4 py-3 text-right">Exact</th>
              <th className="px-4 py-3 text-right">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, i) => (
              <tr key={row.userId} className={row.userId === userId ? "bg-accent/10" : undefined}>
                <td className="px-4 py-3 font-display text-xl font-bold">{i + 1}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/leagues/${id}/players/${row.userId}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <span className="h-5 w-1 rounded-full" style={{ background: teamColor(row.favoriteTeam) }} />
                    <span className="font-medium">{row.displayName}</span>
                    {row.userId === userId && <span className="text-xs text-muted">(you)</span>}
                  </Link>
                </td>
                {nextRace && (
                  <td className="px-2 py-3 text-center">
                    {ready.has(row.userId) ? (
                      <span className="text-emerald-400" title="Picks submitted">●</span>
                    ) : (
                      <span className="text-line">○</span>
                    )}
                  </td>
                )}
                {recent.map((r) => {
                  const s = row.byRound.get(r);
                  return (
                    <td key={r} className="px-2 py-3 text-right font-mono tabular">
                      {s ? (
                        <span className={s.perfectPodium ? "font-bold text-accent" : undefined}>{s.total}</span>
                      ) : (
                        <span className="text-muted">·</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right font-mono tabular text-muted">{row.exactHits}</td>
                <td className="px-4 py-3 text-right font-mono tabular text-lg font-bold">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-muted">
        Showing the last {recent.length} rounds. Ties go to whoever nailed more exact positions, then perfect podiums.
        Highlighted scores are perfect podiums.
      </p>

      {!league.isDemo && league.ownerId !== userId && (
        <form action={leaveLeague.bind(null, id)}>
          <button className="text-sm text-muted underline hover:text-red-400">Leave this league</button>
        </form>
      )}
    </div>
  );
}
