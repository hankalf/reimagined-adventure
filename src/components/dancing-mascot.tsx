"use client";

import { useId, useState } from "react";

import { isMascotKind, MASCOT_KINDS, type MascotKind } from "@/lib/mascot";

export { MASCOT_KINDS, isMascotKind };
export type { MascotKind };

export type MascotFace = {
  faceSrc?: string | null;
  faceZoom?: number;
  faceOffsetX?: number;
  faceOffsetY?: number;
  faceRotate?: number;
  faceFlip?: boolean;
};

type Props = MascotFace & {
  kind?: string | null;
  caption?: string | null;
  size?: number;
  tapHint?: string;
  snow?: boolean;
  /** Render without animation or tap handling (pickers, print). */
  still?: boolean;
  className?: string;
};

const SKIN = "#fcd9b6";
const R = 40; // face radius; face centre is (100,118)

/**
 * A dancing holiday character drawn in SVG and animated with CSS keyframes (`.elf-*` classes in globals.css).
 * The head is a circular clip over an uploaded photo, so any face can be the mascot. Tapping makes it dance
 * faster; people who prefer reduced motion get a still character.
 */
export function DancingMascot({ kind, faceSrc, faceZoom = 100, faceOffsetX = 0, faceOffsetY = 0, faceRotate = 0, faceFlip = false, caption, size = 220, tapHint, snow = true, still = false, className }: Props) {
  const [fast, setFast] = useState(false);
  const id = useId().replace(/:/g, "");
  const clipId = `mascot-face-${id}`;
  const k: MascotKind = isMascotKind(kind) ? kind : "elf";
  const scale = Math.max(1, Math.min(2.5, faceZoom / 100));
  const imgSize = R * 2 * scale;
  const imgX = 100 - imgSize / 2 + (faceOffsetX / 100) * R * 2;
  const imgY = 118 - imgSize / 2 + (faceOffsetY / 100) * R * 2;
  const faceTransform = `${faceFlip ? "translate(200 0) scale(-1 1) " : ""}rotate(${faceRotate} 100 118)`;

  const face = (
    <g transform={faceTransform}>
      {faceSrc ? (
        <image href={faceSrc} x={imgX} y={imgY} width={imgSize} height={imgSize} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
      ) : (
        <g clipPath={`url(#${clipId})`}>
          <circle cx="100" cy="118" r={R} fill={SKIN} />
          <circle cx="86" cy="112" r="4" fill="#1f2937" />
          <circle cx="114" cy="112" r="4" fill="#1f2937" />
          <circle cx="80" cy="126" r="6" fill="#fda4af" opacity="0.7" />
          <circle cx="120" cy="126" r="6" fill="#fda4af" opacity="0.7" />
          <path d="M84 132 q16 14 32 0" fill="none" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </g>
  );

  return (
    <div data-elf data-mascot={k} data-fast={fast ? "1" : "0"} data-still={still ? "1" : "0"} className={`elf-stage relative inline-flex select-none flex-col items-center ${still ? "elf-still" : ""} ${className ?? ""}`} style={{ width: size }}>
      {snow && !still && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <span key={i} className="elf-snow" style={{ left: `${8 + i * 12}%`, animationDelay: `${(i * 0.7) % 4}s`, animationDuration: `${4 + (i % 3)}s`, fontSize: `${10 + (i % 3) * 4}px` }}>
              {k === "banana" || k === "pineapple" || k === "strawberry" ? "✦" : "❄"}
            </span>
          ))}
        </div>
      )}
      {still ? (
        <svg viewBox="0 0 200 300" width={size} height={size * 1.5} role="img" aria-label={`${k} mascot`}>
          <defs>
            <clipPath id={clipId}>
              <circle cx="100" cy="118" r={R} />
            </clipPath>
          </defs>
          <g className="elf-body">{renderBody(k, face)}</g>
        </svg>
      ) : (
        <button
          type="button"
          onClick={() => setFast((f) => !f)}
          className="relative cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
          aria-label={tapHint ?? "Tap to dance faster"}
          title={tapHint ?? "Tap to dance faster"}
          style={{ width: size, height: size * 1.5 }}
        >
          <svg viewBox="0 0 200 300" width={size} height={size * 1.5} role="img" aria-label={`Dancing ${k}`}>
            <defs>
              <clipPath id={clipId}>
                <circle cx="100" cy="118" r={R} />
              </clipPath>
            </defs>
            <g className="elf-body">{renderBody(k, face)}</g>
          </svg>
        </button>
      )}
      {caption && <p className="mt-1 max-w-[260px] text-center text-sm font-semibold text-slate-800">{caption}</p>}
    </div>
  );
}

/** Backwards-compatible name used by earlier pages. */
export const DancingElf = DancingMascot;

// ---------- character parts ----------

function Legs({ pants, stripe, shoe }: { pants: string; stripe?: string; shoe: string }) {
  return (
    <>
      <g className="elf-leg elf-leg-l" style={{ transformOrigin: "86px 226px" }}>
        <rect x="78" y="224" width="16" height="44" rx="6" fill={pants} />
        {stripe && <rect x="78" y="236" width="16" height="8" fill={stripe} opacity="0.9" />}
        {stripe && <rect x="78" y="252" width="16" height="8" fill={stripe} opacity="0.9" />}
        <path d="M78 266 q-16 4 -14 14 q4 10 16 4 l16 0 l0 -18 z" fill={shoe} />
      </g>
      <g className="elf-leg elf-leg-r" style={{ transformOrigin: "114px 226px" }}>
        <rect x="106" y="224" width="16" height="44" rx="6" fill={pants} />
        {stripe && <rect x="106" y="236" width="16" height="8" fill={stripe} opacity="0.9" />}
        {stripe && <rect x="106" y="252" width="16" height="8" fill={stripe} opacity="0.9" />}
        <path d="M122 266 q16 4 14 14 q-4 10 -16 4 l-16 0 l0 -18 z" fill={shoe} />
      </g>
    </>
  );
}

function StickLegs() {
  return (
    <>
      <g className="elf-leg elf-leg-l" style={{ transformOrigin: "88px 226px" }}>
        <rect x="84" y="224" width="8" height="46" rx="4" fill="#1f2937" />
        <ellipse cx="80" cy="274" rx="14" ry="6" fill="#1f2937" />
      </g>
      <g className="elf-leg elf-leg-r" style={{ transformOrigin: "112px 226px" }}>
        <rect x="108" y="224" width="8" height="46" rx="4" fill="#1f2937" />
        <ellipse cx="120" cy="274" rx="14" ry="6" fill="#1f2937" />
      </g>
    </>
  );
}

function Arms({ sleeve, hand = SKIN }: { sleeve: string; hand?: string }) {
  return (
    <>
      <g className="elf-arm elf-arm-l" style={{ transformOrigin: "72px 168px" }}>
        <rect x="40" y="160" width="36" height="14" rx="7" fill={sleeve} transform="rotate(-35 72 168)" />
        <circle cx="40" cy="146" r="9" fill={hand} />
      </g>
      <g className="elf-arm elf-arm-r" style={{ transformOrigin: "128px 168px" }}>
        <rect x="124" y="160" width="36" height="14" rx="7" fill={sleeve} transform="rotate(35 128 168)" />
        <circle cx="160" cy="146" r="9" fill={hand} />
      </g>
    </>
  );
}

function StickArms({ color = "#1f2937", glove = "#fff" }: { color?: string; glove?: string }) {
  return (
    <>
      <g className="elf-arm elf-arm-l" style={{ transformOrigin: "72px 170px" }}>
        <rect x="36" y="165" width="40" height="8" rx="4" fill={color} transform="rotate(-35 72 170)" />
        <circle cx="38" cy="146" r="9" fill={glove} stroke={color} strokeWidth="2" />
      </g>
      <g className="elf-arm elf-arm-r" style={{ transformOrigin: "128px 170px" }}>
        <rect x="124" y="165" width="40" height="8" rx="4" fill={color} transform="rotate(35 128 170)" />
        <circle cx="162" cy="146" r="9" fill={glove} stroke={color} strokeWidth="2" />
      </g>
    </>
  );
}

function Head({ face, children, skin = SKIN, ears = true }: { face: React.ReactNode; children?: React.ReactNode; skin?: string; ears?: boolean }) {
  return (
    <g className="elf-head" style={{ transformOrigin: "100px 150px" }}>
      {ears && <path d="M62 112 l-14 2 l14 14 z" fill={skin} />}
      {ears && <path d="M138 112 l14 2 l-14 14 z" fill={skin} />}
      <circle cx="100" cy="118" r={R + 3} fill={skin} />
      {face}
      {children}
    </g>
  );
}

function renderBody(kind: MascotKind, face: React.ReactNode): React.ReactNode {
  switch (kind) {
    case "santa":
      return (
        <>
          <Legs pants="#b91c1c" shoe="#1f2937" />
          <path d="M66 158 L134 158 L146 232 L54 232 Z" fill="#dc2626" />
          <rect x="54" y="226" width="92" height="10" fill="#fff" />
          <rect x="54" y="198" width="92" height="12" fill="#1f2937" />
          <rect x="92" y="196" width="16" height="16" rx="2" fill="#fbbf24" />
          <rect x="96" y="200" width="8" height="8" fill="#1f2937" />
          <path d="M66 158 l68 0 l0 8 l-68 0 z" fill="#fff" />
          <Arms sleeve="#dc2626" hand="#fff" />
          <Head face={face} ears={false}>
            <path d="M62 128 q38 48 76 0 q0 36 -38 40 q-38 -4 -38 -40 z" fill="#fff" />
            <path d="M58 92 Q100 40 142 92 Z" fill="#dc2626" />
            <path d="M100 56 Q118 24 146 36 Q136 48 126 52" fill="#dc2626" />
            <ellipse cx="100" cy="92" rx="48" ry="10" fill="#fff" />
            <circle className="elf-bell" cx="148" cy="36" r="8" fill="#fff" style={{ transformOrigin: "136px 44px" }} />
          </Head>
        </>
      );
    case "snowman":
      return (
        <>
          <StickLegs />
          <circle cx="100" cy="205" r="46" fill="#fff" stroke="#e2e8f0" strokeWidth="3" />
          <circle cx="100" cy="190" r="4" fill="#1f2937" />
          <circle cx="100" cy="208" r="4" fill="#1f2937" />
          <circle cx="100" cy="226" r="4" fill="#1f2937" />
          <StickArms color="#92400e" glove="#dc2626" />
          <Head face={face} skin="#fff" ears={false}>
            <path d="M58 150 q42 18 84 0 l0 12 q-42 18 -84 0 z" fill="#dc2626" />
            <path d="M126 154 l10 30 l-16 2 z" fill="#dc2626" />
            <rect x="60" y="84" width="80" height="10" rx="3" fill="#1f2937" />
            <rect x="72" y="36" width="56" height="52" rx="4" fill="#1f2937" />
            <rect x="72" y="74" width="56" height="8" fill="#dc2626" />
          </Head>
        </>
      );
    case "reindeer":
      return (
        <>
          <Legs pants="#7c4a1e" shoe="#3f2a14" />
          <path d="M68 158 L132 158 L142 232 L58 232 Z" fill="#92400e" />
          <ellipse cx="100" cy="200" rx="22" ry="26" fill="#d6b48c" />
          <Arms sleeve="#92400e" hand="#3f2a14" />
          <Head face={face} skin="#c4915e" ears={false}>
            <path d="M58 118 l-16 -4 l12 14 z" fill="#c4915e" />
            <path d="M142 118 l16 -4 l-12 14 z" fill="#c4915e" />
            <circle cx="100" cy="160" r="8" fill="#dc2626" />
            <path d="M74 86 l-8 -36 m8 36 l-22 -22 m22 22 l-2 -30" stroke="#7c4a1e" strokeWidth="7" strokeLinecap="round" fill="none" />
            <path d="M126 86 l8 -36 m-8 36 l22 -22 m-22 22 l2 -30" stroke="#7c4a1e" strokeWidth="7" strokeLinecap="round" fill="none" />
            <circle className="elf-bell" cx="100" cy="82" r="7" fill="#fbbf24" style={{ transformOrigin: "100px 90px" }} />
          </Head>
        </>
      );
    case "gingerbread":
      return (
        <>
          <Legs pants="#b45309" shoe="#92400e" />
          <path d="M66 158 L134 158 L142 232 L58 232 Z" fill="#b45309" />
          <path d="M70 166 q30 10 60 0" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeDasharray="8 8" />
          <circle cx="100" cy="190" r="6" fill="#dc2626" />
          <circle cx="100" cy="210" r="6" fill="#16a34a" />
          <Arms sleeve="#b45309" hand="#b45309" />
          <Head face={face} skin="#b45309" ears={false}>
            <path d="M60 96 q40 -34 80 0" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeDasharray="10 8" />
            <path d="M58 150 q42 16 84 0" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
          </Head>
        </>
      );
    case "banana":
      return (
        <>
          <StickLegs />
          <path d="M70 150 Q40 220 90 268 Q140 290 160 230 Q150 250 110 240 Q80 215 100 160 Z" fill="#fde047" stroke="#ca8a04" strokeWidth="3" />
          <path d="M100 160 Q84 212 110 240" fill="none" stroke="#facc15" strokeWidth="6" />
          <circle cx="160" cy="232" r="5" fill="#854d0e" />
          <StickArms />
          <Head face={face} skin="#fde047" ears={false}>
            <path d="M92 76 l8 -30 l8 30 z" fill="#854d0e" />
            <path d="M70 100 Q100 60 130 100" fill="#fde047" stroke="#ca8a04" strokeWidth="3" />
          </Head>
        </>
      );
    case "pineapple":
      return (
        <>
          <StickLegs />
          <ellipse cx="100" cy="200" rx="46" ry="48" fill="#f59e0b" stroke="#b45309" strokeWidth="3" />
          <path d="M60 180 l80 40 M60 220 l80 -40 M70 160 l60 80 M70 240 l60 -80 M100 152 l0 96 M54 200 l92 0" stroke="#b45309" strokeWidth="2" opacity="0.6" />
          <StickArms />
          <Head face={face} skin="#f59e0b" ears={false}>
            <path d="M100 82 l-10 -46 l12 20 l6 -30 l6 30 l12 -20 l-10 46 z" fill="#16a34a" />
            <path d="M80 86 l-26 -22 l30 8 z M120 86 l26 -22 l-30 8 z" fill="#15803d" />
            <path d="M64 88 Q100 60 136 88" fill="#f59e0b" stroke="#b45309" strokeWidth="3" />
          </Head>
        </>
      );
    case "strawberry":
      return (
        <>
          <StickLegs />
          <path d="M56 170 Q100 150 144 170 Q150 240 100 262 Q50 240 56 170 Z" fill="#ef4444" stroke="#b91c1c" strokeWidth="3" />
          {[[80, 185], [100, 178], [120, 185], [88, 205], [112, 205], [100, 225], [78, 222], [122, 222]].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx="3" ry="4.5" fill="#fde68a" />
          ))}
          <StickArms />
          <Head face={face} skin="#ef4444" ears={false}>
            <path d="M100 86 l-30 -14 l22 -2 l-14 -22 l20 12 l2 -24 l10 22 l14 -12 l-6 24 l20 -2 l-22 18 z" fill="#16a34a" />
          </Head>
        </>
      );
    case "elf":
    default:
      return (
        <>
          <Legs pants="#dc2626" stripe="#fff" shoe="#15803d" />
          <circle cx="63" cy="282" r="4" fill="#fbbf24" />
          <circle cx="137" cy="282" r="4" fill="#fbbf24" />
          <path d="M70 158 L130 158 L142 232 L58 232 Z" fill="#16a34a" />
          <path d="M70 158 L130 158 L136 190 L64 190 Z" fill="#22c55e" opacity="0.6" />
          <rect x="58" y="200" width="84" height="12" fill="#1f2937" />
          <rect x="92" y="198" width="16" height="16" rx="2" fill="#fbbf24" />
          <rect x="96" y="202" width="8" height="8" fill="#1f2937" />
          <path d="M70 158 l10 10 l10 -10 l10 10 l10 -10 l10 10 l10 -10" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" />
          <Arms sleeve="#16a34a" />
          <Head face={face}>
            <path d="M58 92 Q100 40 142 92 Z" fill="#16a34a" />
            <path d="M100 56 Q120 20 150 30 Q140 44 128 50" fill="#16a34a" />
            <ellipse cx="100" cy="92" rx="46" ry="9" fill="#fff" />
            <circle className="elf-bell" cx="152" cy="30" r="7" fill="#fbbf24" style={{ transformOrigin: "140px 38px" }} />
          </Head>
        </>
      );
  }
}
