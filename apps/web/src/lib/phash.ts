/**
 * A visual fingerprint for a photograph, computed on the phone.
 *
 * Reusing a photograph — last year's, a colleague's, one from the internet —
 * is the fraud that actually happens, because it is nearly free. This is the
 * cheapest thing that makes it expensive.
 *
 * The algorithm is a difference hash: shrink the image to 9x8 greyscale, then
 * emit one bit per adjacent pair of pixels saying whether the left is brighter
 * than the right. That yields 64 bits describing the image's structure rather
 * than its exact pixels, so it survives re-compression, resizing and light
 * cropping — which is what a recycled photograph has been through.
 *
 * Deliberately computed here rather than on the server: the server never
 * receives the bytes (uploads go straight to storage), and a phone can do this
 * in a few milliseconds. The server treats the result as a hint from an
 * untrusted client, which is fine — forging it only earns the sender a flag
 * they would otherwise have avoided, and a match is reviewed by a person
 * rather than acted on automatically.
 */

const WIDTH = 9;
const HEIGHT = 8;

/**
 * Returns 16 hexadecimal characters, or null when the browser cannot do it.
 *
 * Null is a normal outcome, not an error: an old Android WebView may lack
 * `createImageBitmap`, and a photograph without a fingerprint is simply one the
 * duplicate check cannot speak about.
 */
export async function perceptualHash(blob: Blob): Promise<string | null> {
  if (typeof createImageBitmap !== 'function') return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;

    context.drawImage(bitmap, 0, 0, WIDTH, HEIGHT);

    let pixels: Uint8ClampedArray;
    try {
      pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data;
    } catch {
      // A tainted canvas. Cannot happen for a local file, but a cross-origin
      // image would land here.
      return null;
    }

    // Rec. 601 luma: the weights the eye actually uses, so a colour shift from
    // re-encoding moves the value less than a flat average would.
    const grey = new Array<number>(WIDTH * HEIGHT);
    for (let i = 0; i < WIDTH * HEIGHT; i += 1) {
      const r = pixels[i * 4] ?? 0;
      const g = pixels[i * 4 + 1] ?? 0;
      const b = pixels[i * 4 + 2] ?? 0;
      grey[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    // One bit per adjacent pair, left to right, top to bottom: 8 comparisons
    // across 8 rows.
    const bits: number[] = [];
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH - 1; x += 1) {
        const left = grey[y * WIDTH + x] ?? 0;
        const right = grey[y * WIDTH + x + 1] ?? 0;
        bits.push(left > right ? 1 : 0);
      }
    }

    let hex = '';
    for (let i = 0; i < bits.length; i += 4) {
      const nibble =
        ((bits[i] ?? 0) << 3) |
        ((bits[i + 1] ?? 0) << 2) |
        ((bits[i + 2] ?? 0) << 1) |
        (bits[i + 3] ?? 0);
      hex += nibble.toString(16);
    }
    return hex;
  } finally {
    bitmap.close();
  }
}
