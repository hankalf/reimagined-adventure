import type { CSSProperties } from "react";

/** Framing settings stored on a gift (see Item.thumb* in the schema). */
export type ThumbFraming = { thumbFit: string; thumbZoom: number; thumbFocusX: number; thumbFocusY: number };

export const DEFAULT_FRAMING: ThumbFraming = { thumbFit: "contain", thumbZoom: 100, thumbFocusX: 50, thumbFocusY: 50 };

/** Inline styles that make an <img> honour the gift's framing inside a fixed square frame. */
export function framingStyle(framing: Partial<ThumbFraming> | null | undefined): CSSProperties {
  const fit = framing?.thumbFit === "cover" ? "cover" : "contain";
  const zoom = Math.min(2.5, Math.max(1, (framing?.thumbZoom ?? 100) / 100));
  const fx = Math.min(100, Math.max(0, framing?.thumbFocusX ?? 50));
  const fy = Math.min(100, Math.max(0, framing?.thumbFocusY ?? 50));
  return {
    objectFit: fit,
    objectPosition: `${fx}% ${fy}%`,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
    transformOrigin: `${fx}% ${fy}%`,
  };
}

/**
 * The one square photo frame used across the catalog, campaign screens, employee cards, confirmation and kiosk,
 * so every gift occupies the same space regardless of the photo's shape.
 */
export function ItemThumb({
  src,
  alt = "",
  framing,
  className = "",
  imgClassName = "",
  placeholder = "🎁",
  loading = "lazy",
}: {
  src: string | null | undefined;
  alt?: string;
  framing?: Partial<ThumbFraming> | null;
  className?: string;
  imgClassName?: string;
  placeholder?: string;
  loading?: "lazy" | "eager";
}) {
  return (
    <div className={`relative aspect-square w-full overflow-hidden bg-white ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} loading={loading} className={`h-full w-full ${imgClassName}`} style={framingStyle(framing)} />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-slate-100 text-4xl">{placeholder}</div>
      )}
    </div>
  );
}
