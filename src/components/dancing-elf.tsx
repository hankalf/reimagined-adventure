"use client";

import { useId, useState } from "react";

type Props = {
  /** URL of the face photo; when missing a friendly cartoon face is drawn instead. */
  faceSrc?: string | null;
  /** 100 = fit the face circle; larger zooms in. */
  faceZoom?: number;
  /** Vertical nudge in percent of the face circle (negative = up). */
  faceOffsetY?: number;
  caption?: string | null;
  /** Approximate rendered width in px (height follows the 2:3 aspect ratio). */
  size?: number;
  tapHint?: string;
  snow?: boolean;
  className?: string;
};

/**
 * A dancing Christmas elf drawn in SVG and animated with CSS keyframes (see globals.css, `.elf-*`).
 * The head is a circular clip over an uploaded photo, so any face can be the elf. Tapping makes it dance
 * faster; people who prefer reduced motion get a still elf.
 */
export function DancingElf({ faceSrc, faceZoom = 100, faceOffsetY = 0, caption, size = 220, tapHint, snow = true, className }: Props) {
  const [fast, setFast] = useState(false);
  const id = useId().replace(/:/g, "");
  const clipId = `elf-face-${id}`;
  const scale = Math.max(1, Math.min(2.5, faceZoom / 100));
  // Face circle: centre (100,118), radius 40. The image is 80x80 at zoom 100, scaled around the centre.
  const r = 40;
  const imgSize = r * 2 * scale;
  const imgX = 100 - imgSize / 2;
  const imgY = 118 - imgSize / 2 + (faceOffsetY / 100) * r * 2;

  return (
    <div
      data-elf
      data-fast={fast ? "1" : "0"}
      className={`elf-stage relative inline-flex select-none flex-col items-center ${className ?? ""}`}
      style={{ width: size }}
    >
      {snow && (
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <span key={i} className="elf-snow" style={{ left: `${8 + i * 12}%`, animationDelay: `${(i * 0.7) % 4}s`, animationDuration: `${4 + (i % 3)}s`, fontSize: `${10 + (i % 3) * 4}px` }}>
              ❄
            </span>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setFast((f) => !f)}
        className="relative cursor-pointer rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300"
        aria-label={tapHint ?? "Tap the elf"}
        title={tapHint ?? "Tap the elf"}
        style={{ width: size, height: size * 1.5 }}
      >
        <svg viewBox="0 0 200 300" width={size} height={size * 1.5} role="img" aria-label="Dancing elf">
          <defs>
            <clipPath id={clipId}>
              <circle cx="100" cy="118" r={r} />
            </clipPath>
          </defs>

          <g className="elf-body">
            {/* legs (behind the body) */}
            <g className="elf-leg elf-leg-l" style={{ transformOrigin: "86px 226px" }}>
              <rect x="78" y="224" width="16" height="44" rx="6" fill="#dc2626" />
              <rect x="78" y="236" width="16" height="8" fill="#fff" opacity="0.9" />
              <rect x="78" y="252" width="16" height="8" fill="#fff" opacity="0.9" />
              <path d="M78 266 q-16 4 -14 14 q4 10 16 4 l16 0 l0 -18 z" fill="#15803d" />
              <circle cx="63" cy="282" r="4" fill="#fbbf24" />
            </g>
            <g className="elf-leg elf-leg-r" style={{ transformOrigin: "114px 226px" }}>
              <rect x="106" y="224" width="16" height="44" rx="6" fill="#dc2626" />
              <rect x="106" y="236" width="16" height="8" fill="#fff" opacity="0.9" />
              <rect x="106" y="252" width="16" height="8" fill="#fff" opacity="0.9" />
              <path d="M122 266 q16 4 14 14 q-4 10 -16 4 l-16 0 l0 -18 z" fill="#15803d" />
              <circle cx="137" cy="282" r="4" fill="#fbbf24" />
            </g>

            {/* tunic */}
            <path d="M70 158 L130 158 L142 232 L58 232 Z" fill="#16a34a" />
            <path d="M70 158 L130 158 L136 190 L64 190 Z" fill="#22c55e" opacity="0.6" />
            <rect x="58" y="200" width="84" height="12" fill="#1f2937" />
            <rect x="92" y="198" width="16" height="16" rx="2" fill="#fbbf24" />
            <rect x="96" y="202" width="8" height="8" fill="#1f2937" />
            {/* collar */}
            <path d="M70 158 l10 10 l10 -10 l10 10 l10 -10 l10 10 l10 -10" fill="none" stroke="#fff" strokeWidth="5" strokeLinejoin="round" />

            {/* arms */}
            <g className="elf-arm elf-arm-l" style={{ transformOrigin: "72px 168px" }}>
              <rect x="40" y="160" width="36" height="14" rx="7" fill="#16a34a" transform="rotate(-35 72 168)" />
              <circle cx="40" cy="146" r="9" fill="#fcd9b6" />
            </g>
            <g className="elf-arm elf-arm-r" style={{ transformOrigin: "128px 168px" }}>
              <rect x="124" y="160" width="36" height="14" rx="7" fill="#16a34a" transform="rotate(35 128 168)" />
              <circle cx="160" cy="146" r="9" fill="#fcd9b6" />
            </g>

            {/* head */}
            <g className="elf-head" style={{ transformOrigin: "100px 150px" }}>
              <path d="M62 112 l-14 2 l14 14 z" fill="#fcd9b6" />
              <path d="M138 112 l14 2 l-14 14 z" fill="#fcd9b6" />
              <circle cx="100" cy="118" r={r + 3} fill="#fcd9b6" />
              {faceSrc ? (
                <image href={faceSrc} x={imgX} y={imgY} width={imgSize} height={imgSize} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${clipId})`} />
              ) : (
                <g clipPath={`url(#${clipId})`}>
                  <circle cx="100" cy="118" r={r} fill="#fcd9b6" />
                  <circle cx="86" cy="112" r="4" fill="#1f2937" />
                  <circle cx="114" cy="112" r="4" fill="#1f2937" />
                  <circle cx="80" cy="126" r="6" fill="#fda4af" opacity="0.7" />
                  <circle cx="120" cy="126" r="6" fill="#fda4af" opacity="0.7" />
                  <path d="M84 132 q16 14 32 0" fill="none" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
                </g>
              )}
              {/* hat */}
              <path d="M58 92 Q100 40 142 92 Z" fill="#16a34a" />
              <path d="M100 56 Q120 20 150 30 Q140 44 128 50" fill="#16a34a" />
              <ellipse cx="100" cy="92" rx="46" ry="9" fill="#fff" />
              <circle className="elf-bell" cx="152" cy="30" r="7" fill="#fbbf24" style={{ transformOrigin: "140px 38px" }} />
            </g>
          </g>
        </svg>
      </button>
      {caption && <p className="mt-1 max-w-[260px] text-center text-sm font-semibold text-slate-800">{caption}</p>}
    </div>
  );
}
