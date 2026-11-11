import { describe, expect, it } from "vitest";
import {
  CHALLENGE_LIBRARY, GOALS, addDays, currentStreak, generateChallenges, isPlausibleLocalDate, levelFromXp, longestStreak, normalizeGoals,
} from "./evolve";

describe("evolve rules", () => {
  it("levels up every 100 XP", () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(250).into).toBe(50);
  });

  it("always gives 4 daily challenges, whatever the intensity", () => {
    for (const level of ["suave", "media", "intensa"] as const) {
      expect(generateChallenges(["fitness"], level, "2026-01-01", "u1")).toHaveLength(4);
      expect(generateChallenges(["fitness", "bienestar", "estilo", "confianza", "disciplina", "nutricion"], level, "2026-01-01", "u1")).toHaveLength(4);
    }
  });

  it("intensity sets XP per challenge: Fácil 10, Media 20, Difícil 30", () => {
    expect(generateChallenges(["fitness"], "suave", "2026-01-01").every((c) => c.xp === 10)).toBe(true);
    expect(generateChallenges(["fitness"], "media", "2026-01-01").every((c) => c.xp === 20)).toBe(true);
    expect(generateChallenges(["fitness"], "intensa", "2026-01-01").every((c) => c.xp === 30)).toBe(true);
  });

  it("intensity picks the matching version of each challenge", () => {
    const easy = generateChallenges(["fitness"], "suave", "2026-01-01", "u1");
    const hard = generateChallenges(["fitness"], "intensa", "2026-01-01", "u1");
    expect(easy.every((c) => c.key.endsWith(":suave"))).toBe(true);
    expect(hard.every((c) => c.key.endsWith(":intensa"))).toBe(true);
    expect(easy[0]!.title).not.toBe(hard[0]!.title);
  });

  it("balances challenges across the chosen goals", () => {
    const two = generateChallenges(["fitness", "bienestar"], "media", "2026-01-01", "u1");
    expect(two.filter((c) => c.goal === "fitness")).toHaveLength(2);
    expect(two.filter((c) => c.goal === "bienestar")).toHaveLength(2);
    const four = generateChallenges(["fitness", "bienestar", "estilo", "disciplina"], "media", "2026-01-01", "u1");
    expect(new Set(four.map((c) => c.goal)).size).toBe(4);
  });

  it("only picks challenges from chosen goals, without duplicates", () => {
    const list = generateChallenges(["nutricion"], "media", "2026-01-01");
    expect(list.every((c) => c.goal === "nutricion")).toBe(true);
    expect(new Set(list.map((c) => c.key)).size).toBe(list.length);
  });

  it("is stable for the same user and day", () => {
    const a = generateChallenges(["fitness", "confianza"], "media", "2026-01-01", "u1");
    const b = generateChallenges(["confianza", "fitness"], "media", "2026-01-01", "u1");
    expect(a).toEqual(b);
  });

  it("every goal has at least 4 challenges with all three intensities", () => {
    for (const g of GOALS) {
      const items = CHALLENGE_LIBRARY.filter((t) => t.goal === g.id);
      expect(items.length).toBeGreaterThanOrEqual(4);
      for (const t of items) expect(Object.keys(t.levels).sort()).toEqual(["intensa", "media", "suave"]);
    }
  });

  it("reads the old Hábitos goal as Disciplina", () => {
    expect(normalizeGoals(["habitos", "fitness", "nope"])).toEqual(["disciplina", "fitness"]);
  });

  it("accepts a local date only within one day of the server date", () => {
    const now = new Date("2026-11-11T10:00:00Z");
    expect(isPlausibleLocalDate("2026-11-11", now)).toBe(true);
    expect(isPlausibleLocalDate("2026-11-10", now)).toBe(true);
    expect(isPlausibleLocalDate("2026-11-12", now)).toBe(true);
    expect(isPlausibleLocalDate("2026-11-13", now)).toBe(false);
    expect(isPlausibleLocalDate("ayer", now)).toBe(false);
  });

  it("marks challenges done from persisted completion ids and counts them", async () => {
    const { markCompleted, countCompleted } = await import("./evolve");
    const list = markCompleted([{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }], ["b", "d", "b"]);
    expect(list.map((c) => c.done)).toEqual([false, true, false, true]);
    expect(countCompleted(list)).toBe(2);
  });

  it("streak counts consecutive days, tolerating no activity yet today", () => {
    const today = "2026-03-10";
    expect(currentStreak([addDays(today, -1), addDays(today, -2)], today)).toBe(2);
    expect(currentStreak([today, addDays(today, -1)], today)).toBe(2);
    expect(currentStreak([addDays(today, -2)], today)).toBe(0);
    expect(longestStreak(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-05"])).toBe(3);
  });
});
