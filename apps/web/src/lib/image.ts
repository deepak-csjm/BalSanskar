/**
 * Client-side photograph compression.
 *
 * A modern phone camera produces a 4–6 MB JPEG. Uploading that over a rural 2G
 * link takes minutes and usually fails; it also costs the teacher real money in
 * data. Resizing in the browser to something a report or a showcase page can
 * actually use turns that into roughly 150–300 KB.
 *
 * Doing it here rather than on the server is deliberate: the expensive part is
 * the upload, not the resize, so the saving has to happen before the bytes
 * leave the phone. It also keeps `sharp` — a native dependency — out of a
 * server that may have to run on whatever hardware a state data centre offers.
 */

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  maxBytes?: number;
}

/**
 * Sized for what these photographs are actually for: a kitchen garden or a
 * reading corner, looked at on a phone or in a dashboard panel, never printed.
 *
 * 1280px at this quality lands around 150 KB. That is half what 1600px at 0.82
 * produced, which at state scale is the difference between a storage bill of a
 * few thousand rupees a month and a few tens of thousands — and nobody can tell
 * the two images apart on the screens either will ever be seen on. It is also
 * half the data out of a teacher's own pocket on the way up.
 */
const DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1280,
  quality: 0.75,
  maxBytes: 1024 * 1024,
};

export async function compressImage(file: File, options: CompressOptions = {}): Promise<Blob> {
  const settings = { ...DEFAULTS, ...options };

  // Anything that is not a raster image the canvas understands is passed
  // through untouched; the server validates the type regardless.
  if (!file.type.startsWith('image/')) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // An old WebView without createImageBitmap, or a corrupt file. Let the
    // server decide rather than blocking the teacher here.
    return file;
  }

  const scale = Math.min(1, settings.maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return file;
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = settings.quality;
  let blob = await toBlob(canvas, quality);

  // Step the quality down until it fits. Three attempts: past that the image is
  // too degraded to be worth publishing and the size is not the real problem.
  for (let attempt = 0; attempt < 3 && blob && blob.size > settings.maxBytes; attempt += 1) {
    quality -= 0.15;
    blob = await toBlob(canvas, Math.max(0.4, quality));
  }

  return blob && blob.size < file.size ? blob : file;
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((result) => resolve(result), 'image/jpeg', quality);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
