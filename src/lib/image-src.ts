/** Resolve where an item's picture lives: uploaded image (served by our API) or an external URL. */
export function imageSrc(item: { imageId: string | null; imageUrl: string | null }, thumb = false): string | null {
  if (item.imageId) return `/api/images/${item.imageId}${thumb ? "?thumb=1" : ""}`;
  if (item.imageUrl) return item.imageUrl;
  return null;
}
