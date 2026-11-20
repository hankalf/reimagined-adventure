/**
 * US Letter poster layout. Pure so the tiers are unit-tested. Sizes are inches / points.
 * Gift thumbnails: 1–6 gifts sit in one row of bigger tiles; 7 or more use rows of 8, at most 3 rows.
 */
export const POSTER_COLS = 8;
export const POSTER_MAX_ROWS = 3;
export const POSTER_MAX_TILES = POSTER_COLS * POSTER_MAX_ROWS;

export type PosterLayout = { qrIn: number; mascotIn: number; cols: number; headlinePt: number; namePt: number; nameEsPt: number };

export function posterLayout(giftCount: number): PosterLayout {
  if (giftCount <= 0) return { qrIn: 4.6, mascotIn: 1.9, cols: 0, headlinePt: 40, namePt: 0, nameEsPt: 0 };
  if (giftCount <= 4) return { qrIn: 3.2, mascotIn: 1.5, cols: 4, headlinePt: 32, namePt: 10, nameEsPt: 8 };
  if (giftCount <= 6) return { qrIn: 3.0, mascotIn: 1.4, cols: giftCount, headlinePt: 30, namePt: 9.5, nameEsPt: 7.5 };
  if (giftCount <= POSTER_COLS * 2) return { qrIn: 2.7, mascotIn: 1.3, cols: POSTER_COLS, headlinePt: 28, namePt: 8, nameEsPt: 7 };
  return { qrIn: 2.4, mascotIn: 1.2, cols: POSTER_COLS, headlinePt: 26, namePt: 8, nameEsPt: 7 };
}

/** Up to 24 tiles; when there are more gifts, the last tile becomes "and more!". */
export function posterTiles<T>(gifts: T[]): { shown: T[]; more: boolean } {
  if (gifts.length <= POSTER_MAX_TILES) return { shown: gifts, more: false };
  return { shown: gifts.slice(0, POSTER_MAX_TILES - 1), more: true };
}
