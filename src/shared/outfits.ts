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