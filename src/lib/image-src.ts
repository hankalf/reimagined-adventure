/** Resolve where an item's picture lives: uploaded image (served by our API) or an external URL. */
export function imageSrc(item: { imageId: string | null; imageUrl: string | null }, thumb = false): string | null {
  if (item.imageId) return `/api/images/${item.imageId}${thumb ? "?thumb=1" : ""}`;
  if (item.imageUrl) return item.imageUrl;
  return null;
}

/** The photo to show for a chosen option value: the per-value photo when one exists, else the main one. */
export function imageSrcForOption(
  item: { imageId: string | null; imageUrl: string | null; images?: Array<{ imageId: string; option1Value: string | null }> },
  option1Value: string | null | undefined,
  thumb = false,
): string | null {
  const match = option1Value ? item.images?.find((g) => g.option1Value === option1Value) : undefined;
  if (match) return `/api/images/${match.imageId}${thumb ? "?thumb=1" : ""}`;
  return imageSrc(item, thumb);
}
