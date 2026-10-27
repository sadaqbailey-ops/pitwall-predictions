import Link from "next/link";
import { notFound } from "next/navigation";
import { Countdown } from "@/components/Countdown";
import { DriverChip } from "@/components/DriverChip";
import { PickBoard } from "@/components/PickBoard";
import { RaceHeader } from "@/components/RaceHeader";
import { RaceResult } from "@/components/RaceResult";
import { Scorecard } from "@/components/Scorecard";
import { getPrediction, loadRace, picksOf } from "@/lib/races";
import { scorePrediction } from "@/lib/scoring";
import { requirePlayer } from "@/lib/session";

export default async function RacePage({ params }: PageProps<"/race/[round]">) {
  const round = Number((await params).round);
  if (!Number.isInteger(round)) notFound();
  const { userId } = await requirePlayer(`/race/${round}`);
  const [data, prediction] = await Promise.all([loadRace(round), getPrediction(userId, round, "live")]);
  if (!data) notFound();
  const { race, totalRounds, result, outcome, phase, drivers, driverMap } = data;
  const picks = picksOf(prediction);

  return (
    <div className="space-y-8">
      <RaceHeader race={race} totalRounds={totalRounds} basePath="/race">
        {phase === "open" && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-[0.25em] text-muted">Picks lock at lights out</p>
            <Countdown target={race.raceStart.toISOString()} />
          </div>
        )}
        {phase === "locked" && <Badge tone="amber">Race in progress</Badge>}
        {phase === "finished" && <Badge tone="muted">Chequered flag</Badge>}
      </RaceHeader>

      {phase === "open" && (
        <PickBoard
          round={round}
          mode="live"
          drivers={drivers}
          initialPicks={picks}
          initialStatus={prediction?.status ?? null}
        />
      )}

      {phase === "locked" && (
        <section className="rounded-xl border border-line bg-surface p-6">
          <h2 className="font-display text-3xl font-extrabold uppercase">
            {prediction?.status === "submitted" ? "Locked in. Lights out." : "Too late for this one"}
          </h2>
          <p className="mt-1 text-muted">
            {prediction?.status === "submitted"
              ? "Results land shortly after the chequered flag. Scores update on their own."
              : "Picks closed when the race started. The next one opens straight after."}
          </p>
          {prediction && <PickSummary picks={picks} drivers={driverMap} />}
        </section>
      )}

      {phase === "finished" && result && outcome && (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <section>
            {prediction?.status === "submitted" ? (
              <>
                <h2 className="mb-3 font-display text-2xl font-bold uppercase">Your scorecard</h2>
                <Scorecard score={scorePrediction(picks, outcome)} drivers={driverMap} />
              </>
            ) : prediction ? (
              <MissedOut
                title="Never submitted"
                body={`Your draft didn't count. For the record, it would have scored ${
                  scorePrediction(picks, outcome).total
                }.`}
                round={round}
              />
            ) : (
              <MissedOut title="You sat this one out" body="No picks for this race." round={round} />
            )}
          </section>
          <RaceResult result={result} />
        </div>
      )}
    </div>
  );
}

function Badge({ tone, children }: { tone: "amber" | "muted"; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full border px-4 py-1.5 text-sm uppercase tracking-[0.2em] ${
        tone === "amber" ? "border-amber-300/40 text-amber-300" : "border-line text-muted"
      }`}
    >
      {children}
    </span>
  );
}

function PickSummary({
  picks,
  drivers,
}: {
  picks: ReturnType<typeof picksOf>;
  drivers: Record<string, Parameters<typeof DriverChip>[0]["driver"]>;
}) {
  const rows = [
    ["P1", picks.p1],
    ["P2", picks.p2],
    ["P3", picks.p3],
    ["FL", picks.fastestLap],
  ] as const;
  return (
    <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {rows.map(([label, id]) => (
        <div key={label} className="rounded-md border border-line bg-surface-2 px-3 py-2">
          <dt className="font-display text-sm font-bold text-muted">{label}</dt>
          <dd className="mt-1">{id ? <DriverChip driver={drivers[id]} /> : <span className="text-muted">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

function MissedOut({ title, body, round }: { title: string; body: string; round: number }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6">
      <h2 className="font-display text-3xl font-extrabold uppercase">{title}</h2>
      <p className="mt-1 text-muted">{body}</p>
      <Link
        href={`/replay/${round}`}
        className="mt-5 inline-block rounded-md bg-accent px-5 py-2 font-display text-lg font-bold uppercase tracking-wide text-black"
      >
        Play it as a replay
      </Link>
    </div>
  );
}
