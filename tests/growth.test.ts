import assert from "node:assert/strict";
import {
  ALL_MILESTONE_IDS,
  daysKnown,
  eligibleMilestoneIds,
  GROWTH_STAGES,
  healthTotals,
  kindOfMilestone,
  normalizeGrowth,
  stageFor,
  stageRank,
  STAGE_ORDER
} from "../src/shared/growth";
import type { PetGrowth } from "../src/shared/types";

const DAY_MS = 86_400_000;

function growthFor(partial?: Partial<PetGrowth>): PetGrowth {
  return {
    bornAt: Date.now(),
    totalInteractions: 0,
    lastMilestone: null,
    stage: "acquaintance",
    stageChangedAt: null,
    milestones: [],
    ...partial
  };
}

export const tests = [
  {
    name: "daysKnown counts birth day as day 1",
    run(): void {
      const now = 1_700_000_000_000;
      assert.equal(daysKnown(now, now), 1);
      assert.equal(daysKnown(now - DAY_MS, now), 2);
      assert.equal(daysKnown(now - 13 * DAY_MS, now), 14);
      assert.equal(daysKnown(0, now), 0);
    }
  },
  {
    name: "stageFor requires both days and interactions",
    run(): void {
      assert.equal(stageFor(0, 0), "acquaintance");
      assert.equal(stageFor(2, 999), "acquaintance"); // not enough days
      assert.equal(stageFor(999, 24), "acquaintance"); // not enough interactions
      assert.equal(stageFor(3, 25), "companion");
      assert.equal(stageFor(14, 150), "closeFriend");
      assert.equal(stageFor(60, 600), "soulmate");
      assert.equal(stageFor(999, 9999), "soulmate");
    }
  },
  {
    name: "stageRank follows declaration order",
    run(): void {
      assert.equal(STAGE_ORDER.length, GROWTH_STAGES.length);
      assert.deepEqual(STAGE_ORDER, ["acquaintance", "companion", "closeFriend", "soulmate"]);
      assert.equal(stageRank("acquaintance"), 0);
      assert.equal(stageRank("soulmate"), 3);
    }
  },
  {
    name: "normalizeGrowth fills defaults for legacy records",
    run(): void {
      const now = 1_700_000_000_000;
      const legacy = normalizeGrowth({ bornAt: now - 5 * DAY_MS, totalInteractions: 40 }, now);
      assert.equal(legacy.stage, "acquaintance"); // normalize never auto-raises the stage
      assert.equal(legacy.stageChangedAt, null);
      assert.deepEqual(legacy.milestones, []);
      assert.equal(legacy.lastMilestone, null);
      const empty = normalizeGrowth(undefined, now);
      assert.ok(empty.bornAt > 0);
      assert.equal(empty.totalInteractions, 0);
      assert.equal(empty.stage, "acquaintance");
      const bad = normalizeGrowth({ bornAt: now, stage: "nope" as never }, now);
      assert.equal(bad.stage, "acquaintance");
    }
  },
  {
    name: "eligibleMilestoneIds matches age & interaction thresholds",
    run(): void {
      const now = 1_700_000_000_000;
      const g = growthFor({ bornAt: now - 6 * DAY_MS, totalInteractions: 105 });
      const ids = eligibleMilestoneIds(g, { breaks: 0, waters: 0, focusMinutes: 0 }, now);
      assert.ok(ids.includes("age-1"));
      assert.ok(ids.includes("age-3"));
      assert.ok(ids.includes("age-7")); // the 7th day of companionship
      assert.ok(!ids.includes("age-14"));
      assert.ok(ids.includes("interactions-10"));
      assert.ok(ids.includes("interactions-50"));
      assert.ok(ids.includes("interactions-100"));
      assert.ok(!ids.includes("interactions-250"));
    }
  },
  {
    name: "eligibleMilestoneIds includes health milestones from lifetime totals",
    run(): void {
      const now = 1_700_000_000_000;
      const g = growthFor({ bornAt: now });
      const ids = eligibleMilestoneIds(g, { breaks: 120, waters: 90, focusMinutes: 700 }, now);
      assert.ok(ids.includes("breaks-100"));
      assert.ok(!ids.includes("breaks-500"));
      assert.ok(!ids.includes("waters-100"));
      assert.ok(ids.includes("focus-600"));
      assert.ok(!ids.includes("focus-3000"));
    }
  },
  {
    name: "healthTotals adds today's stats to archived history",
    run(): void {
      const totals = healthTotals(
        { date: "2026-09-03", breaksTaken: 2, watersLogged: 3, focusMinutes: 15, focusWarnings: 1 },
        {
          "2026-09-02": { date: "2026-09-02", breaksTaken: 8, watersLogged: 8, focusMinutes: 50, focusWarnings: 0 },
          "2026-09-01": { date: "2026-09-01", breaksTaken: 5, watersLogged: 4, focusMinutes: 25, focusWarnings: 2 }
        }
      );
      assert.deepEqual(totals, { breaks: 15, waters: 15, focusMinutes: 90 });
    }
  },
  {
    name: "kindOfMilestone classifies by id prefix",
    run(): void {
      assert.equal(kindOfMilestone("age-7"), "age");
      assert.equal(kindOfMilestone("interactions-100"), "interaction");
      assert.equal(kindOfMilestone("breaks-500"), "health");
      assert.equal(kindOfMilestone("waters-200"), "health");
      assert.equal(kindOfMilestone("focus-600"), "health");
    }
  },
  {
    name: "milestone catalog is sorted, complete and unique",
    run(): void {
      assert.ok(ALL_MILESTONE_IDS.length >= 20);
      assert.equal(ALL_MILESTONE_IDS[0], "age-1");
      assert.ok(ALL_MILESTONE_IDS.includes("interactions-5000"));
      assert.ok(ALL_MILESTONE_IDS.includes("focus-3000"));
      assert.equal(new Set(ALL_MILESTONE_IDS).size, ALL_MILESTONE_IDS.length);
    }
  }
];
