import type { Language, OutfitItem, OutfitSlot } from "./types";

const OUTFITS_BASE = "pet_assets/outfits";

export const OUTFIT_SLOTS: OutfitSlot[] = [
  {
    part: "hat",
    label: { "zh-CN": "帽子", en: "Hat" },
    items: [
      {
        id: "crown",
        part: "hat",
        label: { "zh-CN": "皇冠", en: "Crown" },
        relativePath: `${OUTFITS_BASE}/hat/crown.png`
      },
      {
        id: "beanie",
        part: "hat",
        label: { "zh-CN": "毛线帽", en: "Beanie" },
        relativePath: `${OUTFITS_BASE}/hat/beanie.png`
      }
    ]
  },
  {
    part: "glasses",
    label: { "zh-CN": "眼镜", en: "Glasses" },
    items: [
      {
        id: "sunglasses",
        part: "glasses",
        label: { "zh-CN": "墨镜", en: "Sunglasses" },
        relativePath: `${OUTFITS_BASE}/glasses/sunglasses.png`
      }
    ]
  },
  {
    part: "scarf",
    label: { "zh-CN": "围巾", en: "Scarf" },
    items: [
      {
        id: "red-scarf",
        part: "scarf",
        label: { "zh-CN": "红围巾", en: "Red Scarf" },
        relativePath: `${OUTFITS_BASE}/scarf/red-scarf.png`
      }
    ]
  },
  {
    part: "bow",
    label: { "zh-CN": "蝴蝶结", en: "Bow" },
    items: []
  }
];

export function outfitItemsForPart(part: string): OutfitItem[] {
  const slot = OUTFIT_SLOTS.find((entry) => entry.part === part);
  return slot?.items ?? [];
}

export function outfitItemById(part: string, id: string): OutfitItem | null {
  return outfitItemsForPart(part).find((item) => item.id === id) ?? null;
}

export function outfitPartLabel(part: string, language: Language): string {
  const slot = OUTFIT_SLOTS.find((entry) => entry.part === part);
  return slot?.label[language] ?? part;
}
export type SeasonalOutfit = {
  hat?: string;
  scarf?: string;
  bow?: string;
  glasses?: string;
  label: Record<Language, string>;
};

export type SeasonalCollection = {
  label: Record<Language, string>;
  outfits: SeasonalOutfit[];
};

export function seasonalOutfitsForDate(
  now: Date,
  userBirthday?: { month: number; day: number } | null
): SeasonalCollection | null {
  const m = now.getMonth() + 1; // 1-12
  const d = now.getDate();
  // New Year's Day
  if (m === 1 && d === 1) {
    return {
      label: { "zh-CN": "元旦", en: "New Year's Day" },
      outfits: [
        { hat: "beanie", label: { "zh-CN": "元旦 · 毛线帽", en: "New Year · Beanie" } },
        { hat: "crown", label: { "zh-CN": "元旦 · 皇冠", en: "New Year · Crown" } }
      ]
    };
  }
  // Valentine's Day (overrides the Feb 1-15 Spring window)
  if (m === 2 && d === 14) {
    return {
      label: { "zh-CN": "情人节", en: "Valentine's Day" },
      outfits: [
        { bow: "crown", label: { "zh-CN": "情人节 · 皇冠", en: "Valentine · Crown" } },
        {
          glasses: "sunglasses",
          label: { "zh-CN": "情人节 · 墨镜", en: "Valentine · Shades" }
        }
      ]
    };
  }
  // Spring Festival (lunar new year) — approximate using Feb 1-15 for now
  if (m === 2 && d <= 15) {
    return {
      label: { "zh-CN": "新年", en: "New Year" },
      outfits: [
        { hat: "beanie", label: { "zh-CN": "新年 · 毛线帽", en: "New Year · Beanie" } },
        {
          hat: "beanie",
          scarf: "red-scarf",
          label: { "zh-CN": "新年 · 全副武装", en: "New Year · All dressed" }
        },
        { hat: "crown", label: { "zh-CN": "新年 · 皇冠", en: "New Year · Crown" } }
      ]
    };
  }
  // Arbor Day (3/12, US tradition)
  if (m === 3 && d === 12) {
    return {
      label: { "zh-CN": "植树节", en: "Arbor Day" },
      outfits: [
        {
          glasses: "sunglasses",
          label: { "zh-CN": "植树节 · 墨镜", en: "Arbor Day · Shades" }
        },
        {
          hat: "beanie",
          glasses: "sunglasses",
          label: { "zh-CN": "植树节 · 墨镜帽", en: "Arbor Day · Cool set" }
        }
      ]
    };
  }
  // Easter (rough: first Sunday after first full moon after spring equinox — approximate Apr 15)
  if (m === 4 && d === 15) {
    return {
      label: { "zh-CN": "复活节", en: "Easter" },
      outfits: [
        { bow: "crown", label: { "zh-CN": "复活节 · 皇冠", en: "Easter · Crown" } },
        {
          hat: "beanie",
          bow: "crown",
          label: { "zh-CN": "复活节 · 全套", en: "Easter · All dressed" }
        }
      ]
    };
  }
  // Labor Day (5/1)
  if (m === 5 && d === 1) {
    return {
      label: { "zh-CN": "劳动节", en: "Labor Day" },
      outfits: [
        {
          glasses: "sunglasses",
          label: { "zh-CN": "劳动节 · 墨镜", en: "Labor Day · Shades" }
        },
        {
          hat: "beanie",
          glasses: "sunglasses",
          label: { "zh-CN": "劳动节 · 墨镜帽", en: "Labor Day · Cool set" }
        }
      ]
    };
  }
  // Dragon Boat Festival (端午, approximate 6/1)
  if (m === 6 && d === 1) {
    return {
      label: { "zh-CN": "端午", en: "Dragon Boat" },
      outfits: [
        {
          scarf: "red-scarf",
          label: { "zh-CN": "端午 · 红围巾", en: "Dragon Boat · Red Scarf" }
        },
        {
          hat: "beanie",
          scarf: "red-scarf",
          label: { "zh-CN": "端午 · 全副武装", en: "Dragon Boat · All dressed" }
        }
      ]
    };
  }
  // Mid-Autumn Festival (中秋, approximate 9/15)
  if (m === 9 && d === 15) {
    return {
      label: { "zh-CN": "中秋", en: "Mid-Autumn" },
      outfits: [
        { hat: "crown", label: { "zh-CN": "中秋 · 皇冠", en: "Mid-Autumn · Crown" } },
        {
          hat: "crown",
          glasses: "sunglasses",
          label: { "zh-CN": "中秋 · 全套", en: "Mid-Autumn · All dressed" }
        }
      ]
    };
  }
  // National Day (10/1)
  if (m === 10 && d === 1) {
    return {
      label: { "zh-CN": "国庆", en: "National Day" },
      outfits: [
        {
          hat: "crown",
          scarf: "red-scarf",
          label: { "zh-CN": "国庆 · 皇冠围巾", en: "National Day · Crown + Scarf" }
        },
        {
          hat: "beanie",
          glasses: "sunglasses",
          scarf: "red-scarf",
          label: { "zh-CN": "国庆 · 全套", en: "National Day · All dressed" }
        }
      ]
    };
  }
  // Halloween
  if (m === 10 && d >= 25) {
    return {
      label: { "zh-CN": "万圣节", en: "Halloween" },
      outfits: [
        { hat: "crown", label: { "zh-CN": "万圣节 · 皇冠", en: "Halloween · Crown" } },
        {
          hat: "crown",
          glasses: "sunglasses",
          label: { "zh-CN": "万圣节 · 神秘装扮", en: "Halloween · Mystery" }
        }
      ]
    };
  }
  // Thanksgiving (US, 4th Thursday of Nov — approximate Nov 25)
  if (m === 11 && d === 25) {
    return {
      label: { "zh-CN": "感恩节", en: "Thanksgiving" },
      outfits: [
        { hat: "beanie", label: { "zh-CN": "感恩节 · 毛线帽", en: "Thanksgiving · Beanie" } },
        {
          hat: "beanie",
          scarf: "red-scarf",
          label: { "zh-CN": "感恩节 · 全套", en: "Thanksgiving · All dressed" }
        }
      ]
    };
  }
  // Christmas
  if (m === 12 && d >= 20) {
    return {
      label: { "zh-CN": "圣诞", en: "Christmas" },
      outfits: [
        {
          hat: "beanie",
          scarf: "red-scarf",
          label: { "zh-CN": "圣诞 · 经典", en: "Christmas · Classic" }
        },
        {
          hat: "crown",
          glasses: "sunglasses",
          scarf: "red-scarf",
          label: { "zh-CN": "圣诞 · 派对王", en: "Christmas · Party King" }
        },
        { hat: "beanie", label: { "zh-CN": "圣诞 · 简约", en: "Christmas · Minimal" } }
      ]
    };
  }
  // User's own birthday
  if (userBirthday && m === userBirthday.month && d === userBirthday.day) {
    return {
      label: { "zh-CN": "你的生日", en: "Your birthday" },
      outfits: [
        {
          hat: "crown",
          glasses: "sunglasses",
          scarf: "red-scarf",
          label: { "zh-CN": "生日 · 全套", en: "Birthday · All dressed" }
        },
        {
          hat: "crown",
          scarf: "red-scarf",
          label: { "zh-CN": "生日 · 经典", en: "Birthday · Classic" }
        }
      ]
    };
  }
  return null;
}

// Back-compat: the old single-outfit picker used to return the first outfit.
// We keep returning a single SeasonalOutfit here so existing callers
// (PetView, SettingsView) only need a tiny change.
export function seasonalOutfitForDate(
  now: Date,
  userBirthday?: { month: number; day: number } | null
): SeasonalOutfit | null {
  const collection = seasonalOutfitsForDate(now, userBirthday);
  if (!collection) return null;
  const pool = collection.outfits;
  const index = pool.length > 0 ? Math.floor(Math.random() * pool.length) : 0;
  return pool[index] ?? null;
}
