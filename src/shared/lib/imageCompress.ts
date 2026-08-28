import sharp from "sharp";

const MAX_DIMENSION = 1600;
const MAX_GIF_DIMENSION = 800;
const JPEG_QUALITY = 82;

/**
 * Resizes + re-encodes an uploaded image so an oversized file (a multi-thousand-pixel photo, a
 * huge exported GIF) doesn't ship as-is in every outgoing signature/campaign email. Falls
 * through unchanged for anything that isn't a raster image sharp/libvips recognizes, or if
 * compression somehow produces a larger file than the original.
 */
export async function compressAsset(buffer: Buffer, contentType: string): Promise<{ buffer: Buffer; contentType: string }> {
  try {
    if (contentType === "image/gif") {
      // libvips reads/writes animated GIFs frame-by-frame, so this resizes and re-encodes every
      // frame rather than just the first — a real fix for an oversized animated banner, not a
      // silent "picks one frame" degradation.
      const out = await sharp(buffer, { animated: true })
        .resize({ width: MAX_GIF_DIMENSION, height: MAX_GIF_DIMENSION, fit: "inside", withoutEnlargement: true })
        .gif()
        .toBuffer();
      return out.length < buffer.length ? { buffer: out, contentType } : { buffer, contentType };
    }

    if (contentType === "image/png" || contentType === "image/webp") {
      // Keep the original format so any transparency (a logo, an icon) survives — re-encoding a
      // transparent PNG as JPEG would flatten it onto a black/white background.
      const resized = sharp(buffer).resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true });
      const out = await (contentType === "image/png" ? resized.png({ quality: JPEG_QUALITY }) : resized.webp({ quality: JPEG_QUALITY })).toBuffer();
      return out.length < buffer.length ? { buffer: out, contentType } : { buffer, contentType };
    }

    if (/^image\/(jpeg|jpg|heic|heif)$/.test(contentType)) {
      const out = await sharp(buffer)
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();
      return out.length < buffer.length ? { buffer: out, contentType: "image/jpeg" } : { buffer, contentType };
    }

    // Not a raster image type we handle (svg, fonts, etc.) — pass through untouched.
    return { buffer, contentType };
  } catch {
    // If sharp can't parse it for any reason, don't block the upload over it — store the original.
    return { buffer, contentType };
  }
}
