import { describe, expect, it } from "vitest";
import { currentStreak, generateChallenges, levelFromXp, longestStreak, addDays } from "./evolve";

describe("evolve rules", () => {
  it("levels up every 100 XP", () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(250).into).toBe(50);
  });

  it("intensity sets daily challenge count (3/4/5)", () => {
    expect(generateChallenges(["fitness", "habitos"], "suave", "2026-01-01")).toHaveLength(3);
    expect(generateChallenges(["fitness", "habitos"], "media", "2026-01-01")).toHaveLength(4);
    expect(generateChallenges(["fitness", "habitos"], "intensa", "2026-01-01")).toHaveLength(5);
  });

  it("only picks challenges from chosen goals, without duplicates", () => {
    const list = generateChallenges(["nutricion"], "media", "2026-01-01");
    expect(list.every((c) => c.goal === "nutricion")).toBe(true);
    expect(new Set(list.map((c) => c.key)).size).toBe(list.length);
  });

  it("streak counts consecutive days, tolerating no activity yet today", () => {
    const today = "2026-03-10";
    expect(currentStreak([addDays(today, -1), addDays(today, -2)], today)).toBe(2);
    expect(currentStreak([today, addDays(today, -1)], today)).toBe(2);
    expect(currentStreak([addDays(today, -2)], today)).toBe(0);
    expect(longestStreak(["2026-02-27", "2026-02-28", "2026-03-01", "2026-03-05"])).toBe(3);
  });
});
