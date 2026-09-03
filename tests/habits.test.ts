import assert from "node:assert/strict";
import { createEmptyActionCounts, normalizeTodayStats } from "../src/shared/constants";
import {
  canMentionWorkStart,
  crossedFocusHour,
  favoriteAction,
  focusHourMilestone,
  focusNoteFor,
  markHabitNote,
  minuteOfDay,
  noteAlreadyTaken
} from "../src/shared/habits";
import type { PetAction, TodayStats } from "../src/shared/types";

function fullStats(overrides: Partial<TodayStats> = {}): TodayStats {
  return {
    date: "2026-09-03",
    breaksTaken: 0,
    watersLogged: 0,
    focusMinutes: 0,
    focusWarnings: 0,
    launches: 1,
    workStartMinute: null,
    actionCounts: createEmptyActionCounts(),
    habitNotes: [],
    ...overrides
  };
}

function at(minuteOfToday: number): Date {
  const d = new Date(2026, 8, 3);
  d.setHours(Math.floor(minuteOfToday / 60), minuteOfToday % 60, 0, 0);
  return d;
}

function actionCounts(overrides: Partial<Record<PetAction, number>>): Record<PetAction, number> {
  return { ...createEmptyActionCounts(), ...overrides };
}

export const tests = [
  {
    name: "minuteOfDay converts a clock time to minutes since midnight",
    run(): void {
      assert.equal(minuteOfDay(at(9 * 60 + 5)), 545);
      assert.equal(minuteOfDay(at(0)), 0);
      assert.equal(minuteOfDay(at(23 * 60 + 59)), 1439);
    }
  },
  {
    name: "canMentionWorkStart needs a recorded start, 90+ minutes ago, unsaid",
    run(): void {
      const base = { workStartMinute: 9 * 60 };
      assert.equal(canMentionWorkStart(fullStats(), at(12 * 60)), false, "no start yet");
      assert.equal(canMentionWorkStart(fullStats(base), at(10 * 60 + 10)), false, "too soon");
      assert.equal(canMentionWorkStart(fullStats(base), at(10 * 60 + 30)), true);
      assert.equal(canMentionWorkStart(fullStats(base), at(18 * 60)), true, "late is fine");
      assert.equal(
        canMentionWorkStart(fullStats({ ...base, habitNotes: ["workStart"] }), at(12 * 60)),
        false,
        "already said today"
      );
    }
  },
  {
    name: "focusHourMilestone floors whole hours",
    run(): void {
      assert.equal(focusHourMilestone(0), 0);
      assert.equal(focusHourMilestone(59), 0);
      assert.equal(focusHourMilestone(60), 1);
      assert.equal(focusHourMilestone(179), 2);
    }
  },
  {
    name: "crossedFocusHour only reports freshly crossed whole hours",
    run(): void {
      assert.equal(crossedFocusHour(0, 59), null);
      assert.equal(crossedFocusHour(0, 60), 1);
      assert.equal(crossedFocusHour(0, 119), 1);
      assert.equal(crossedFocusHour(0, 120), 2);
      assert.equal(crossedFocusHour(58, 124), 2, "session crossing the two-hour line");
      assert.equal(crossedFocusHour(120, 121), null, "same hour is not a new milestone");
      assert.equal(crossedFocusHour(115, 185), 3, "top milestone wins for a long session");
    }
  },
  {
    name: "focus notes are named and deduplicated",
    run(): void {
      assert.equal(focusNoteFor(2), "focus:2");
      const stats = fullStats();
      const noted = markHabitNote(stats, "focus:2");
      assert.ok(noteAlreadyTaken(noted.habitNotes, "focus:2"));
      assert.deepEqual(markHabitNote(noted, "focus:2").habitNotes, ["focus:2"], "no dupes");
    }
  },
  {
    name: "favoriteAction needs a clear minimum of uses",
    run(): void {
      assert.equal(favoriteAction(fullStats()), null, "no uses yet");
      assert.equal(
        favoriteAction(fullStats({ actionCounts: actionCounts({ wave: 2 }) })),
        null,
        "below threshold"
      );
      const fav = favoriteAction(fullStats({ actionCounts: actionCounts({ wave: 3, dance: 1 }) }));
      assert.deepEqual(fav, { action: "wave", count: 3 });
    }
  },
  {
    name: "favoriteAction tie resolves to the first action in order",
    run(): void {
      const fav = favoriteAction(fullStats({ actionCounts: actionCounts({ yawn: 3, dance: 3 }) }));
      assert.deepEqual(fav, { action: "dance", count: 3 });
    }
  },
  {
    name: "normalizeTodayStats back-fills missing legacy fields",
    run(): void {
      const legacy = {
        date: "2026-09-02",
        breaksTaken: 2,
        watersLogged: 1,
        focusMinutes: 90,
        focusWarnings: 0
      } as TodayStats;
      const normalized = normalizeTodayStats(legacy);
      assert.equal(normalized.launches, 0);
      assert.equal(normalized.workStartMinute, null);
      assert.equal(normalized.habitNotes.length, 0);
      assert.deepEqual(normalized.actionCounts, createEmptyActionCounts());
      assert.equal(normalized.focusMinutes, 90, "existing fields are kept");
    }
  },
  {
    name: "normalizeTodayStats keeps legacy field values and does not touch known notes",
    run(): void {
      const stats = fullStats({
        focusMinutes: 125,
        launches: 3,
        workStartMinute: 540,
        actionCounts: actionCounts({ heart: 4 }),
        habitNotes: ["focus:2"]
      });
      const normalized = normalizeTodayStats(stats);
      assert.equal(normalized.launches, 3);
      assert.equal(normalized.workStartMinute, 540);
      assert.equal(normalized.actionCounts.heart, 4);
      assert.equal(normalized.actionCounts.wave, 0);
      assert.deepEqual(normalized.habitNotes, ["focus:2"]);
    }
  }
];
