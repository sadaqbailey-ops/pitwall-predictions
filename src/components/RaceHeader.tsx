import Link from "next/link";
import type { Race } from "@/lib/f1";

export function RaceHeader({
  race,
  totalRounds,
  basePath,
  eyebrow,
  children,
}: {
  race: Race;
  totalRounds: number;
  basePath: "/race" | "/replay";
  eyebrow?: string;
  children?: React.ReactNode;
}) {
  const date = race.raceStart.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div>
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.25em] text-muted">
          {race.round > 1 && (
            <Link href={`${basePath}/${race.round - 1}`} className="hover:text-foreground" aria-label="Previous round">
              ←
            </Link>
          )}
          <span>
            {eyebrow ?? `Round ${race.round} of ${totalRounds}`}
            {race.hasSprint && " · sprint weekend"}
          </span>
          {race.round < totalRounds && (
            <Link href={`${basePath}/${race.round + 1}`} className="hover:text-foreground" aria-label="Next round">
              →
            </Link>
          )}
        </div>
        <h1 className="mt-1 font-display text-5xl font-extrabold uppercase leading-none sm:text-6xl">{race.name}</h1>
        <p className="mt-1 text-muted">
          {race.circuit} · {race.locality}, {race.country} · {date}
        </p>
      </div>
      {children}
    </div>
  );
}
