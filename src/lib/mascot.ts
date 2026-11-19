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
