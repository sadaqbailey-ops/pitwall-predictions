import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { predictions, type Prediction, type PredictionMode } from "@/db/schema";
import { getEntryList, getQualifyingOrder, getRace, getResult, getSchedule, racePhase, SEASON } from "@/lib/f1";
import { outcomeFrom } from "@/lib/scoring";

export async function getPrediction(
  userId: string,
  round: number,
  mode: PredictionMode,
): Promise<Prediction | null> {
  const [row] = await db
    .select()
    .from(predictions)
    .where(
      and(
        eq(predictions.userId, userId),
        eq(predictions.season, SEASON),
        eq(predictions.round, round),
        eq(predictions.mode, mode),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Everything a race page needs, loaded in parallel. */
export async function loadRace(round: number) {
  const [race, schedule, result, entry] = await Promise.all([
    getRace(round),
    getSchedule(),
    getResult(round),
    getEntryList(round),
  ]);
  if (!race) return null;

  const qualifyingDone = race.qualifyingStart ? race.qualifyingStart < new Date() : false;
  const grid = qualifyingDone ? await getQualifyingOrder(round).catch(() => new Map<string, number>()) : new Map();

  const drivers = entry.map((d) => ({ ...d, gridPosition: grid.get(d.driverId) }));
  const driverMap = Object.fromEntries(
    [...drivers, ...(result?.classification ?? [])].map((d) => [d.driverId, d]),
  );

  return {
    race,
    totalRounds: schedule.length,
    result,
    outcome: result ? outcomeFrom(result.classification) : null,
    phase: racePhase(race, Boolean(result)),
    drivers,
    driverMap,
  };
}

export function picksOf(p: Prediction | null) {
  return {
    p1: p?.p1 ?? null,
    p2: p?.p2 ?? null,
    p3: p?.p3 ?? null,
    fastestLap: p?.fastestLap ?? null,
  };
}
