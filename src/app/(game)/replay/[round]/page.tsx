import Link from "next/link";
import { notFound } from "next/navigation";
import { resetReplay } from "@/app/actions/predictions";
import { DriverChip } from "@/components/DriverChip";
import { PickBoard } from "@/components/PickBoard";
import { RaceHeader } from "@/components/RaceHeader";
import { RaceResult } from "@/components/RaceResult";
import { Scorecard } from "@/components/Scorecard";
import { getDemoLeagueId, getStandings } from "@/lib/leagues";
import { getPrediction, loadRace, picksOf } from "@/lib/races";
import { scorePrediction } from "@/lib/scoring";
import { requirePlayer } from "@/lib/session";

/** Animate the scorecard only on the reveal itself, not on every later visit. */
function isRecent(at: Date, ms: number): boolean {
  return Date.now() - at.getTime() < ms;
}

export default async function ReplayRace({ params }: PageProps<"/replay/[round]">) {
  const round = Number((await params).round);
  if (!Number.isInteger(round)) notFound();
  const { userId } = await requirePlayer(`/replay/${round}`);
  const [data, prediction] = await Promise.all([loadRace(round), getPrediction(userId, round, "replay")]);
  if (!data) notFound();
  const { race, totalRounds, result, outcome, phase, drivers, driverMap } = data;

  if (phase !== "finished" || !result || !outcome) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6">
        <h1 className="font-display text-4xl font-extrabold uppercase">{race.name} hasn&apos;t happened yet</h1>
        <p className="mt-1 text-muted">Replays are for races with a result. This one you can play for real.</p>
        <Link href={`/race/${round}`} className="mt-4 inline-block text-accent underline">
          Make live picks →
        </Link>
      </div>
    );
  }

  const picks = picksOf(prediction);

  if (!prediction?.revealedAt) {
    // The result never reaches the browser until the picks are locked and revealed.
    return (
      <div className="space-y-8">
        <RaceHeader race={race} totalRounds={totalRounds} basePath="/replay" eyebrow={`Replay · round ${race.round}`}>
          <p className="max-w-xs text-sm text-muted">
            No peeking. The result stays hidden until you lock in.
          </p>
        </RaceHeader>
        <PickBoard
          round={round}
          mode="replay"
          drivers={drivers}
          initialPicks={picks}
          initialStatus={prediction?.status ?? null}
        />
      </div>
    );
  }

  const score = scorePrediction(picks, outcome);
  const demoId = await getDemoLeagueId();
  const rivals = demoId
    ? (await getStandings(demoId)).rows
        .filter((r) => r.userId !== userId && r.byRound.has(round))
        .map((r) => ({ name: r.displayName, team: r.favoriteTeam, total: r.byRound.get(round)!.total }))
        .sort((a, b) => b.total - a.total)
    : [];
  const beaten = rivals.filter((r) => score.total > r.total).length;
  const justRevealed = isRecent(prediction.revealedAt, 15_000);

  return (
    <div className="space-y-8">
      <RaceHeader race={race} totalRounds={totalRounds} basePath="/replay" eyebrow={`Replay · round ${race.round}`}>
        <form action={resetReplay.bind(null, round)}>
          <button className="rounded-md border border-line px-4 py-2 text-sm text-muted hover:text-foreground">
            Play it again
          </button>
        </form>
      </RaceHeader>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <section className="space-y-6">
          <div>
            <h2 className="mb-3 font-display text-2xl font-bold uppercase">How you&apos;d have done</h2>
            <Scorecard score={score} drivers={driverMap} animate={justRevealed} />
          </div>

          {rivals.length > 0 && (
            <div className="rounded-lg border border-line bg-surface p-4">
              <h3 className="font-display text-lg font-bold uppercase">Against the Paddock Club</h3>
              <p className="text-sm text-muted">
                They made their picks live, before lights out. You&apos;d have beaten {beaten} of {rivals.length}.
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {rivals.map((r) => (
                  <li key={r.name} className="flex justify-between">
                    <span>{r.name}</span>
                    <span className="font-mono">{r.total}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <RaceResult result={result} />
          <p className="text-xs text-muted">
            Podium: {outcome.podium.map((id) => driverMap[id]?.code).join(" · ")} · Fastest lap:{" "}
            {outcome.fastestLap ? <DriverChip driver={driverMap[outcome.fastestLap]} size="sm" /> : "n/a"}
          </p>
        </aside>
      </div>
    </div>
  );
}
