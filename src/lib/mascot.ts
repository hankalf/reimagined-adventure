/** Mascot character list shared by the server (validation) and the client (picker + renderer). */
export const MASCOT_KINDS = [
  { key: "elf", label: "Elf", emoji: "🧝" },
  { key: "santa", label: "Santa", emoji: "🎅" },
  { key: "snowman", label: "Snowman", emoji: "⛄" },
  { key: "reindeer", label: "Reindeer", emoji: "🦌" },
  { key: "gingerbread", label: "Gingerbread", emoji: "🍪" },
  { key: "banana", label: "Dancing banana", emoji: "🍌" },
  { key: "pineapple", label: "Dancing pineapple", emoji: "🍍" },
  { key: "strawberry", label: "Dancing strawberry", emoji: "🍓" },
] as const;

export type MascotKind = (typeof MASCOT_KINDS)[number]["key"];

export function isMascotKind(value: string | null | undefined): value is MascotKind {
  return MASCOT_KINDS.some((k) => k.key === value);
}

/** Props for <DancingMascot> from a stored CampaignMascot row. */
export function mascotFaceProps(m: { kind: string; imageId: string | null; faceZoom: number; faceOffsetX: number; faceOffsetY: number; faceRotate: number; faceFlip: boolean }) {
  return {
    kind: m.kind,
    faceSrc: m.imageId ? `/api/images/${m.imageId}?thumb=1` : null,
    faceZoom: m.faceZoom,
    faceOffsetX: m.faceOffsetX,
    faceOffsetY: m.faceOffsetY,
    faceRotate: m.faceRotate,
    faceFlip: m.faceFlip,
  };
}

/** Landing-page size per mascot so a row of them fits on a phone and a desktop. */
export function landingMascotSize(count: number): number {
  if (count <= 1) return 220;
  if (count === 2) return 170;
  if (count === 3) return 140;
  return 120;
}
