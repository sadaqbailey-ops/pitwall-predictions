"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserId } from "@/auth";
import { db } from "@/db";
import { predictions, type PredictionMode } from "@/db/schema";
import { getEntryList, getRace, getResult, racePhase, SEASON } from "@/lib/f1";
import { isComplete, validatePicks, type Picks } from "@/lib/scoring";

export type SaveResult =
  | { ok: true; status: "draft" | "submitted"; savedAt: string }
  | { ok: false; error: string };

const ERRORS = {
  incomplete: "Pick three drivers for the podium first.",
  duplicate: "A driver can only take one podium spot.",
  "unknown-driver": "That driver isn't on the entry list for this race.",
} as const;

function clean(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length < 64 ? value : null;
}

/**
 * Save picks for a race. `intent: "draft"` is the autosave; `intent: "submit"` confirms them.
 * Every rule is checked here, on the server: a disabled button in the UI is not a lock.
 */
export async function savePrediction(input: {
  round: number;
  mode: PredictionMode;
  intent: "draft" | "submit";
  picks: Picks;
}): Promise<SaveResult> {
  const userId = await requireUserId();
  const round = Number(input.round);
  const mode: PredictionMode = input.mode === "replay" ? "replay" : "live";
  const picks: Picks = {
    p1: clean(input.picks.p1),
    p2: clean(input.picks.p2),
    p3: clean(input.picks.p3),
    fastestLap: clean(input.picks.fastestLap),
  };

  const race = await getRace(round);
  if (!race) return { ok: false, error: "Unknown race." };
  const result = await getResult(round);
  const phase = racePhase(race, Boolean(result));

  if (mode === "live" && phase !== "open") {
    return { ok: false, error: "Picks locked at lights out. This one's out of your hands now." };
  }
  if (mode === "replay" && phase !== "finished") {
    return { ok: false, error: "Replays are only for races that have already run." };
  }

  const entry = await getEntryList(round);
  const invalid = validatePicks(picks, new Set(entry.map((d) => d.driverId)));
  if (invalid) return { ok: false, error: ERRORS[invalid] };
  if (input.intent === "submit" && !isComplete(picks)) return { ok: false, error: ERRORS.incomplete };

  const where = and(
    eq(predictions.userId, userId),
    eq(predictions.season, SEASON),
    eq(predictions.round, round),
    eq(predictions.mode, mode),
  );
  const [existing] = await db.select().from(predictions).where(where).limit(1);

  if (existing?.revealedAt) return { ok: false, error: "You've already revealed this replay." };
  // An autosave must never downgrade picks that were already submitted.
  const status = input.intent === "submit" || existing?.status === "submitted" ? "submitted" : "draft";
  if (status === "submitted" && !isComplete(picks)) return { ok: false, error: ERRORS.incomplete };

  const now = new Date();
  if (existing) {
    await db
      .update(predictions)
      .set({ ...picks, status, updatedAt: now })
      .where(eq(predictions.id, existing.id));
  } else {
    await db.insert(predictions).values({ userId, season: SEASON, round, mode, ...picks, status });
  }

  if (input.intent === "submit") revalidatePath(`/race/${round}`);
  return { ok: true, status, savedAt: now.toISOString() };
}

/**
 * Replay only: save the final picks, freeze them, and show the real result.
 * One action, so there is no window where picks are submitted but not revealed.
 */
export async function lockInAndReveal(input: { round: number; picks: Picks }): Promise<SaveResult> {
  const round = Number(input.round);
  const saved = await savePrediction({ round, mode: "replay", intent: "submit", picks: input.picks });
  if (!saved.ok) return saved;

  const userId = await requireUserId();
  await db
    .update(predictions)
    .set({ revealedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(predictions.userId, userId),
        eq(predictions.season, SEASON),
        eq(predictions.round, round),
        eq(predictions.mode, "replay"),
        isNull(predictions.revealedAt),
      ),
    );
  revalidatePath("/replay");
  redirect(`/replay/${round}`);
}

/** Replay only: wipe a revealed replay so it can be played again. */
export async function resetReplay(round: number): Promise<void> {
  const userId = await requireUserId();
  await db
    .delete(predictions)
    .where(
      and(
        eq(predictions.userId, userId),
        eq(predictions.season, SEASON),
        eq(predictions.round, Number(round)),
        eq(predictions.mode, "replay"),
      ),
    );
  revalidatePath(`/replay/${round}`);
  revalidatePath("/replay");
}
