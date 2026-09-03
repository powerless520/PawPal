import assert from "node:assert/strict";
import {
  OUTFIT_SLOTS,
  outfitItemById,
  outfitItemsForPart,
  outfitPartLabel,
  seasonalOutfitsForDate
} from "../src/shared/outfits";

export const tests = [
  {
    name: "seasonal: New Year's Day",
    run(): void {
      const collection = seasonalOutfitsForDate(new Date(2025, 0, 1));
      assert.equal(collection?.label["zh-CN"], "元旦");
      assert.ok(collection?.outfits.some((o) => o.hat === "beanie"));
    }
  },
  {
    name: "seasonal: Spring Festival window",
    run(): void {
      const collection = seasonalOutfitsForDate(new Date(2025, 1, 5));
      assert.equal(collection?.label["zh-CN"], "新年");
      assert.ok(collection.outfits.length > 0);
    }
  },
  {
    name: "seasonal: Valentine's Day",
    run(): void {
      const collection = seasonalOutfitsForDate(new Date(2025, 1, 14));
      assert.equal(collection?.label["en"], "Valentine's Day");
      assert.ok(collection.outfits.length > 0);
    }
  },
  {
    name: "seasonal: Christmas includes a red-scarf combo",
    run(): void {
      const collection = seasonalOutfitsForDate(new Date(2025, 11, 25));
      assert.equal(collection?.label["zh-CN"], "圣诞");
      assert.ok(collection?.outfits.some((o) => o.hat === "beanie" && o.scarf === "red-scarf"));
    }
  },
  {
    name: "seasonal: user birthday overrides generic date",
    run(): void {
      const collection = seasonalOutfitsForDate(new Date(2025, 6, 15), { month: 7, day: 15 });
      assert.equal(collection?.label["zh-CN"], "你的生日");
      assert.ok(collection?.outfits.some((o) => o.hat === "crown" && o.glasses === "sunglasses"));
    }
  },
  {
    name: "seasonal: non-holiday returns null",
    run(): void {
      // 3月20日 没映射节日
      const collection = seasonalOutfitsForDate(new Date(2025, 2, 20));
      assert.equal(collection, null);
    }
  },
  {
    name: "outfit: hat slot has crown + beanie",
    run(): void {
      const items = outfitItemsForPart("hat");
      const ids = items.map((item) => item.id);
      assert.deepEqual(ids.sort(), ["beanie", "crown"]);
    }
  },
  {
    name: "outfit: bow slot is empty until user uploads",
    run(): void {
      assert.deepEqual(outfitItemsForPart("bow"), []);
    }
  },
  {
    name: "outfit: item lookup by id",
    run(): void {
      const item = outfitItemById("hat", "crown");
      assert.ok(item);
      assert.equal(item?.part, "hat");
    }
  },
  {
    name: "outfit: invalid id returns null",
    run(): void {
      assert.equal(outfitItemById("hat", "does-not-exist"), null);
    }
  },
  {
    name: "outfit: part labels are localized",
    run(): void {
      assert.equal(outfitPartLabel("hat", "zh-CN"), "帽子");
      assert.equal(outfitPartLabel("hat", "en"), "Hat");
    }
  },
  {
    name: "outfit: every slot has a label",
    run(): void {
      for (const slot of OUTFIT_SLOTS) {
        assert.ok(slot.label["zh-CN"]);
        assert.ok(slot.label.en);
      }
    }
  }
];
