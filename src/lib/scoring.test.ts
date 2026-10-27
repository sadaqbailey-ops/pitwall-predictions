import { describe, expect, it } from "vitest";
import {
  MAX_POINTS,
  outcomeFrom,
  scorePrediction,
  validatePicks,
  type FinishingRow,
  type RaceOutcome,
} from "./scoring";

// Austin 2026, top of the order: ANT, LEC, VER; LEC set the fastest lap; BEA retired.
const rows: FinishingRow[] = [
  { driverId: "antonelli", position: 1, status: "Finished", fastestLapRank: 4 },
  { driverId: "leclerc", position: 2, status: "Finished", fastestLapRank: 1 },
  { driverId: "max_verstappen", position: 3, status: "Finished", fastestLapRank: 5 },
  { driverId: "hamilton", position: 4, status: "Finished", fastestLapRank: 3 },
  { driverId: "stroll", position: 15, status: "Lapped", fastestLapRank: 12 },
  { driverId: "bearman", position: 22, status: "Retired", fastestLapRank: 22 },
];
const outcome = outcomeFrom(rows) as RaceOutcome;

describe("outcomeFrom", () => {
  it("derives podium and fastest lap", () => {
    expect(outcome.podium).toEqual(["antonelli", "leclerc", "max_verstappen"]);
    expect(outcome.fastestLap).toBe("leclerc");
  });

  it("returns null without a full podium", () => {
    expect(outcomeFrom(rows.slice(0, 2))).toBeNull();
  });
});

describe("scorePrediction", () => {
  it("scores a perfect podium plus fastest lap at the maximum", () => {
    const s = scorePrediction(
      { p1: "antonelli", p2: "leclerc", p3: "max_verstappen", fastestLap: "leclerc" },
      outcome,
    );
    expect(s.total).toBe(MAX_POINTS);
    expect(s.total).toBe(45);
    expect(s.perfectPodium).toBe(true);
    expect(s.exactHits).toBe(3);
    expect(s.lines.at(-1)?.kind).toBe("bonus");
  });

  it("gives 5 each for right drivers in the wrong order, no bonus", () => {
    const s = scorePrediction(
      { p1: "leclerc", p2: "max_verstappen", p3: "antonelli", fastestLap: null },
      outcome,
    );
    expect(s.total).toBe(15);
    expect(s.perfectPodium).toBe(false);
    expect(s.lines.slice(0, 3).map((l) => l.kind)).toEqual(["podium", "podium", "podium"]);
  });

  it("mixes exact and podium hits", () => {
    const s = scorePrediction(
      { p1: "antonelli", p2: "max_verstappen", p3: "hamilton", fastestLap: "hamilton" },
      outcome,
    );
    // 10 exact + 5 podium + 0 miss + 0 wrong fastest lap
    expect(s.total).toBe(15);
    expect(s.exactHits).toBe(1);
    expect(s.lines[2].detail).toBe("Finished P4");
  });

  it("scores zero for all-wrong picks", () => {
    const s = scorePrediction(
      { p1: "hamilton", p2: "stroll", p3: "bearman", fastestLap: "stroll" },
      outcome,
    );
    expect(s.total).toBe(0);
  });

  it("treats lapped cars as finishers and retirements as DNFs", () => {
    const s = scorePrediction({ p1: "stroll", p2: "bearman", p3: null, fastestLap: null }, outcome);
    expect(s.lines[0]).toMatchObject({ kind: "miss", detail: "Finished P15" });
    expect(s.lines[1]).toMatchObject({ kind: "dnf", detail: "DNF (Retired)", points: 0 });
    expect(s.lines[2].kind).toBe("empty");
  });

  it("awards the fastest lap point on its own", () => {
    const s = scorePrediction({ p1: null, p2: null, p3: null, fastestLap: "leclerc" }, outcome);
    expect(s.total).toBe(5);
  });

  it("handles a driver who is missing from the classification", () => {
    const s = scorePrediction({ p1: "someone_else", p2: null, p3: null, fastestLap: null }, outcome);
    expect(s.lines[0].kind).toBe("dnf");
  });
});

describe("validatePicks", () => {
  const allowed = new Set(rows.map((r) => r.driverId));

  it("accepts three different known drivers", () => {
    expect(
      validatePicks({ p1: "antonelli", p2: "leclerc", p3: "hamilton", fastestLap: "antonelli" }, allowed),
    ).toBeNull();
  });

  it("rejects the same driver twice on the podium", () => {
    expect(
      validatePicks({ p1: "antonelli", p2: "antonelli", p3: "hamilton", fastestLap: null }, allowed),
    ).toBe("duplicate");
  });

  it("rejects drivers not on the entry list", () => {
    expect(validatePicks({ p1: "senna", p2: null, p3: null, fastestLap: null }, allowed)).toBe(
      "unknown-driver",
    );
  });
});
