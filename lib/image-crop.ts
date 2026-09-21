import type { PercentCrop } from 'react-image-crop';

/**
 * The pure half of ImageField's crop step: what it accepts, and how a crop
 * drawn on screen becomes the Blob that is uploaded.
 *
 * No video, anywhere (owner decision) — and no HEIC either: no browser can
 * draw one to a canvas, so it could never reach the crop step.
 */
export const IMAGE_FIELD_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const IMAGE_FIELD_ACCEPT = IMAGE_FIELD_TYPES.join(',');
/** Same ceiling as the backend's multer limit on every image endpoint. */
export const IMAGE_FIELD_MAX_BYTES = 15 * 1024 * 1024;
/** High enough that the backend's own WebP re-encode is the only visible loss. */
export const CROP_QUALITY = 0.92;

export type ImageFileProblem = 'type' | 'tooLarge';

export function checkImageFile(file: File): ImageFileProblem | null {
  if (!(IMAGE_FIELD_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size > IMAGE_FIELD_MAX_BYTES) return 'tooLarge';
  return null;
}

export interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A percent crop → a rectangle in the image's natural pixels.
 *
 * With an aspect, the height is recomputed from the width, so width / height
 * is that aspect to the nearest pixel (a 4:3 crop 1200 wide is 900 high, not
 * the 901 independent rounding of both edges can give): the stored row's
 * imageWidth/imageHeight is what the storefront lays out against.
 */
export function naturalCropRect(
  crop: PercentCrop,
  naturalWidth: number,
  naturalHeight: number,
  aspect?: number,
): SourceRect {
  const x = Math.max(0, Math.round((crop.x / 100) * naturalWidth));
  const y = Math.max(0, Math.round((crop.y / 100) * naturalHeight));
  let width = Math.max(1, Math.min(naturalWidth - x, Math.round((crop.width / 100) * naturalWidth)));
  let height = Math.max(1, Math.min(naturalHeight - y, Math.round((crop.height / 100) * naturalHeight)));

  if (aspect) {
    height = Math.round(width / aspect);
    if (y + height > naturalHeight) {
      height = naturalHeight - y;
      width = Math.round(height * aspect);
    }
    width = Math.max(1, width);
    height = Math.max(1, height);
  }
  return { x, y, width, height };
}

/**
 * JPEG for photographs; WebP for PNG/WebP sources so transparency survives
 * (a JPEG would turn it black). A browser without a WebP encoder hands back
 * PNG instead — that is re-encoded as JPEG rather than uploaded at PNG size.
 */
export function cropOutputType(sourceType: string): 'image/jpeg' | 'image/webp' {
  return sourceType === 'image/png' || sourceType === 'image/webp' ? 'image/webp' : 'image/jpeg';
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob returned null'))),
      type,
      CROP_QUALITY,
    );
  });
}

export async function cropToBlob(
  image: HTMLImageElement,
  crop: PercentCrop,
  sourceType: string,
  aspect?: number,
): Promise<Blob> {
  const rect = naturalCropRect(crop, image.naturalWidth, image.naturalHeight, aspect);
  const canvas = document.createElement('canvas');
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas context');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);

  const wanted = cropOutputType(sourceType);
  const blob = await canvasToBlob(canvas, wanted);
  if (blob.type === wanted) return blob;
  return canvasToBlob(canvas, 'image/jpeg');
}

/**
 * A filename for a multipart part. A cropped Blob has none, and FormData would
 * send it as "blob"; the backend goes by the part's MIME type either way, but
 * a real extension keeps its logs readable.
 */
export function uploadFileName(file: Blob): string {
  if (typeof File !== 'undefined' && file instanceof File) return file.name;
  const extension = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg';
  return `image.${extension}`;
}
