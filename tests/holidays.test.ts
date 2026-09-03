import assert from "node:assert/strict";
import { nextHolidayEvent } from "../src/shared/holidays";

export const tests = [
  {
    name: "returns today's festival with 0 days",
    run(): void {
      const event = nextHolidayEvent(new Date(2026, 0, 1));
      assert.ok(event);
      assert.equal(event!.key, "newYear");
      assert.equal(event!.daysUntil, 0);
      assert.equal(event!.isToday, true);
    }
  },
  {
    name: "counts down to the closest upcoming festival",
    run(): void {
      // Sept 3: Mid-Autumn (Sep 15) is 12 days away.
      const event = nextHolidayEvent(new Date(2026, 8, 3));
      assert.ok(event);
      assert.equal(event!.key, "midAutumn");
      assert.equal(event!.daysUntil, 12);
      assert.equal(event!.isToday, false);
    }
  },
  {
    name: "wraps across the year to January 1st",
    run(): void {
      const event = nextHolidayEvent(new Date(2026, 11, 26));
      assert.ok(event);
      assert.equal(event!.key, "newYear");
      assert.equal(event!.daysUntil, 6);
    }
  },
  {
    name: "prefers an upcoming user birthday when closer",
    run(): void {
      const event = nextHolidayEvent(new Date(2026, 8, 3), { month: 9, day: 5 });
      assert.ok(event);
      assert.equal(event!.key, "birthday");
      assert.equal(event!.daysUntil, 2);
    }
  },
  {
    name: "treats birthday that already passed as next year",
    run(): void {
      const event = nextHolidayEvent(new Date(2026, 10, 3), { month: 9, day: 5 });
      assert.ok(event);
      // Sep 5 passed; thanksgiving Nov 25 is nearer than next birthday.
      assert.equal(event!.key, "thanksgiving");
      assert.equal(event!.daysUntil, 22);
    }
  }
];
