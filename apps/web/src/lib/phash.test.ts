import { afterEach, describe, expect, it, vi } from 'vitest';
import { hammingDistance, PHASH_MATCH_DISTANCE } from '@balsanskar/shared';
import { perceptualHash } from './phash.js';

/**
 * The fingerprint is compared against fingerprints computed months earlier on
 * other people's phones, so its exact bit layout is a wire format, not an
 * implementation detail. A silent change here would not fail anywhere else: it
 * would simply stop every duplicate ever matching again, and the platform would
 * look like it was working.
 *
 * jsdom has neither `createImageBitmap` nor a real canvas, so both are stubbed
 * with a grid of known greys. That is the point — what is under test is the
 * comparison and packing, not the browser's image decoder.
 */

const WIDTH = 9;
const HEIGHT = 8;

/** Installs a canvas whose `getImageData` returns the given greys, row-major. */
function stubCanvas(greys: number[]): void {
  const data = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  greys.forEach((value, index) => {
    data[index * 4] = value;
    data[index * 4 + 1] = value;
    data[index * 4 + 2] = value;
    data[index * 4 + 3] = 255;
  });

  vi.stubGlobal('createImageBitmap', () => Promise.resolve({ close: () => {} }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: () => {},
    getImageData: () => ({ data }),
  } as unknown as CanvasRenderingContext2D);
}

/** Brightness falling steadily left to right, so every comparison is "brighter". */
function fallingGradient(): number[] {
  const greys: number[] = [];
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) greys.push(240 - x * 20);
  }
  return greys;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('perceptual hash', () => {
  it('returns sixteen hexadecimal characters', async () => {
    stubCanvas(fallingGradient());
    const hash = await perceptualHash(new Blob());
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('emits a one bit where the left pixel is brighter', async () => {
    stubCanvas(fallingGradient());
    expect(await perceptualHash(new Blob())).toBe('ffffffffffffffff');
  });

  it('emits a zero bit where it is not', async () => {
    // A flat image has no pixel brighter than its neighbour anywhere.
    stubCanvas(new Array(WIDTH * HEIGHT).fill(128));
    expect(await perceptualHash(new Blob())).toBe('0000000000000000');
  });

  it('packs the first comparison into the most significant bit', async () => {
    // Flattening exactly one pair must move exactly the leading bit, which is
    // what pins the byte order the server compares against.
    const greys = fallingGradient();
    greys[0] = greys[1] as number;
    stubCanvas(greys);
    const hash = await perceptualHash(new Blob());
    expect(hash).toBe('7fffffffffffffff');
    expect(hammingDistance(hash as string, 'ffffffffffffffff')).toBe(1);
  });

  it('keeps a lightly altered image inside the match threshold', async () => {
    const greys = fallingGradient();
    // Three pairs disturbed, as a re-compression might: still the same photo.
    greys[0] = greys[1] as number;
    greys[10] = greys[11] as number;
    greys[20] = greys[21] as number;
    stubCanvas(greys);
    const hash = await perceptualHash(new Blob());
    expect(hammingDistance(hash as string, 'ffffffffffffffff')).toBeLessThanOrEqual(
      PHASH_MATCH_DISTANCE,
    );
  });

  it('gives up quietly when the browser cannot decode images', async () => {
    // An old Android WebView. A photograph without a fingerprint is one the
    // duplicate check cannot speak about, which is not an error.
    vi.stubGlobal('createImageBitmap', undefined);
    expect(await perceptualHash(new Blob())).toBeNull();
  });

  it('gives up quietly when the image itself is unreadable', async () => {
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('not an image')));
    expect(await perceptualHash(new Blob())).toBeNull();
  });
});
