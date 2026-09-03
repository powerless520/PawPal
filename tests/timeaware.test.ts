import assert from "node:assert/strict";
import { timeAwareKind } from "../src/shared/timeaware";

/** 2026-09-06 is a Sunday; `dow` shifts to the requested weekday (0 = Sun). */
function dateAt(dow: number, hour: number, minute = 0): Date {
  const d = new Date(2026, 8, 6 + dow);
  d.setHours(hour, minute, 0, 0);
  return d;
}

export const tests = [
  {
    name: "Friday 5–8pm is fridayEvening",
    run(): void {
      assert.equal(timeAwareKind(dateAt(5, 17, 30)), "fridayEvening");
      assert.equal(timeAwareKind(dateAt(5, 19, 0)), "fridayEvening");
    }
  },
  {
    name: "Friday 4:59pm falls back to the clock instead",
    run(): void {
      assert.equal(timeAwareKind(dateAt(5, 16, 59)), "timeNow");
    }
  },
  {
    name: "late night and early morning are lateNight",
    run(): void {
      assert.equal(timeAwareKind(dateAt(4, 23, 10)), "lateNight");
      assert.equal(timeAwareKind(dateAt(4, 2, 0)), "lateNight");
    }
  },
  {
    name: "5–8am is morning",
    run(): void {
      assert.equal(timeAwareKind(dateAt(4, 6, 0)), "morning");
    }
  },
  {
    name: "lunchtime is noon",
    run(): void {
      assert.equal(timeAwareKind(dateAt(4, 12, 30)), "noon");
    }
  },
  {
    name: "weekday 5–8pm is evening",
    run(): void {
      assert.equal(timeAwareKind(dateAt(4, 18, 0)), "evening");
    }
  },
  {
    name: "weekend daytime is weekend",
    run(): void {
      assert.equal(timeAwareKind(dateAt(6, 11, 0)), "weekend");
      assert.equal(timeAwareKind(dateAt(0, 21, 30)), "weekend");
    }
  },
  {
    name: "weekend late night still wins as lateNight",
    run(): void {
      assert.equal(timeAwareKind(dateAt(6, 23, 0)), "lateNight");
    }
  },
  {
    name: "near the top of the hour states the time",
    run(): void {
      assert.equal(timeAwareKind(dateAt(4, 9, 5)), "timeNow");
      assert.equal(timeAwareKind(dateAt(4, 9, 50)), "timeNow");
    }
  },
  {
    name: "mid-hour falls back to generic chatter",
    run(): void {
      assert.equal(timeAwareKind(dateAt(4, 9, 30)), "chatter");
    }
  }
];
