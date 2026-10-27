// Pure scoring rules. No database or network access, so it is trivially testable
// and the same function scores real users, seeded rivals and replays.

export const POINTS = {
  exact: 10,
  onPodium: 5,
  fastestLap: 5,
  perfectPodium: 10,
} as const;

export const MAX_POINTS = POINTS.exact * 3 + POINTS.fastestLap + POINTS.perfectPodium;

export type Picks = {
  p1: string | null;
  p2: string | null;
  p3: string | null;
  fastestLap: string | null;
};

export type FinishingRow = {
  driverId: string;
  position: number;
  status: string;
  fastestLapRank: number | null;
};

export type RaceOutcome = {
  podium: [string, string, string];
  fastestLap: string | null;
  // driverId -> where they finished and how
  finish: Map<string, { position: number; status: string }>;
};

export type LineKind = "exact" | "podium" | "miss" | "dnf" | "empty" | "fl-hit" | "fl-miss" | "bonus";

export type ScoreLine = {
  slot: "P1" | "P2" | "P3" | "FL" | "BONUS";
  driverId: string | null;
  kind: LineKind;
  points: number;
  // Human-readable explanation for the scorecard.
  detail: string;
};

export type Score = {
  total: number;
  exactHits: number;
  perfectPodium: boolean;
  lines: ScoreLine[];
};

const SLOTS = ["P1", "P2", "P3"] as const;

/** Statuses meaning the car took the chequered flag (possibly lapped). */
export function isClassifiedFinish(status: string): boolean {
  return status === "Finished" || status === "Lapped" || /^\+\d+ Laps?$/.test(status);
}

export function outcomeFrom(rows: FinishingRow[]): RaceOutcome | null {
  const sorted = [...rows].sort((a, b) => a.position - b.position);
  if (sorted.length < 3) return null;
  return {
    podium: [sorted[0].driverId, sorted[1].driverId, sorted[2].driverId],
    fastestLap: sorted.find((r) => r.fastestLapRank === 1)?.driverId ?? null,
    finish: new Map(sorted.map((r) => [r.driverId, { position: r.position, status: r.status }])),
  };
}

export function scorePrediction(picks: Picks, outcome: RaceOutcome): Score {
  const lines: ScoreLine[] = [];
  const podiumPicks = [picks.p1, picks.p2, picks.p3];

  podiumPicks.forEach((driverId, i) => {
    const slot = SLOTS[i];
    if (!driverId) {
      lines.push({ slot, driverId, kind: "empty", points: 0, detail: "No pick" });
      return;
    }
    const finish = outcome.finish.get(driverId);
    const podiumIndex = outcome.podium.indexOf(driverId);

    if (podiumIndex === i) {
      lines.push({ slot, driverId, kind: "exact", points: POINTS.exact, detail: `Finished ${slot}` });
    } else if (podiumIndex >= 0) {
      lines.push({
        slot,
        driverId,
        kind: "podium",
        points: POINTS.onPodium,
        detail: `On the podium, but P${podiumIndex + 1}`,
      });
    } else if (!finish) {
      lines.push({ slot, driverId, kind: "dnf", points: 0, detail: "Did not start" });
    } else if (!isClassifiedFinish(finish.status)) {
      lines.push({ slot, driverId, kind: "dnf", points: 0, detail: `DNF (${finish.status})` });
    } else {
      lines.push({ slot, driverId, kind: "miss", points: 0, detail: `Finished P${finish.position}` });
    }
  });

  if (!picks.fastestLap) {
    lines.push({ slot: "FL", driverId: null, kind: "empty", points: 0, detail: "No pick" });
  } else if (outcome.fastestLap && picks.fastestLap === outcome.fastestLap) {
    lines.push({
      slot: "FL",
      driverId: picks.fastestLap,
      kind: "fl-hit",
      points: POINTS.fastestLap,
      detail: "Fastest lap of the race",
    });
  } else {
    lines.push({
      slot: "FL",
      driverId: picks.fastestLap,
      kind: "fl-miss",
      points: 0,
      detail: outcome.fastestLap ? "Someone else went quicker" : "No fastest lap recorded",
    });
  }

  const exactHits = lines.filter((l) => l.kind === "exact").length;
  const perfectPodium = exactHits === 3;
  if (perfectPodium) {
    lines.push({
      slot: "BONUS",
      driverId: null,
      kind: "bonus",
      points: POINTS.perfectPodium,
      detail: "Perfect podium",
    });
  }

  return {
    total: lines.reduce((sum, l) => sum + l.points, 0),
    exactHits,
    perfectPodium,
    lines,
  };
}

export type PickValidationError =
  | "incomplete"
  | "duplicate"
  | "unknown-driver";

/** Podium needs three different drivers; fastest lap is optional but must be a real driver. */
export function validatePicks(picks: Picks, allowedDriverIds: Set<string>): PickValidationError | null {
  const podium = [picks.p1, picks.p2, picks.p3];
  const chosen = [...podium, picks.fastestLap].filter((d): d is string => Boolean(d));
  if (chosen.some((d) => !allowedDriverIds.has(d))) return "unknown-driver";
  const podiumChosen = podium.filter(Boolean);
  if (new Set(podiumChosen).size !== podiumChosen.length) return "duplicate";
  return null;
}

export function isComplete(picks: Picks): boolean {
  return Boolean(picks.p1 && picks.p2 && picks.p3);
}
