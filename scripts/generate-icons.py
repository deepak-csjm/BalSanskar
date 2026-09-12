#!/usr/bin/env python3
"""
Generate the PWA icons.

Written as a small pure-Python rasteriser rather than pulling in Pillow or a
headless browser: the icons are simple geometry, they change roughly never, and
a build that needs no native image toolchain is one less thing to install on a
government build server. Re-run with `python3 scripts/generate-icons.py` after
editing the shapes below.
"""

import struct
import zlib
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "apps" / "web" / "public"

GREEN = (0x1C, 0x4E, 0x40)
PAPER = (0xF7, 0xF3, 0xE8)
OCHRE = (0xE8, 0xA3, 0x3D)


def write_png(path: Path, size: int, pixels: list[list[tuple[int, int, int]]]) -> None:
    """Writes a minimal 8-bit RGB PNG. Filter type 0 on every scanline."""
    raw = bytearray()
    for row in pixels:
        raw.append(0)
        for r, g, b in row:
            raw.extend((r, g, b))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    header = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def blend(base: tuple[int, int, int], over: tuple[int, int, int], alpha: float):
    return tuple(round(b + (o - b) * alpha) for b, o in zip(base, over))


def coverage(cx: float, cy: float, inside, samples: int = 3) -> float:
    """Supersamples one pixel so the curves do not look like staircases."""
    hits = 0
    step = 1.0 / (samples + 1)
    for i in range(1, samples + 1):
        for j in range(1, samples + 1):
            if inside(cx + i * step, cy + j * step):
                hits += 1
    return hits / (samples * samples)


def render(size: int, maskable: bool) -> list[list[tuple[int, int, int]]]:
    """
    Draws an open book with a sun above it: literacy, and the morning assembly
    every one of these schools starts with.

    A maskable icon keeps its content inside the safe circle (40% radius from
    the centre) because Android will crop the corners into whatever shape the
    launcher uses.
    """
    unit = size / 64.0
    inset = 10 * unit if maskable else 0.0
    content = size - 2 * inset

    def u(value: float) -> float:
        return inset + value * content / 64.0

    corner = 0 if maskable else 14 * unit

    book_top, book_bottom = u(30), u(50)
    spine = u(32)
    book_left, book_right = u(10), u(54)
    sun_x, sun_y, sun_r = u(32), u(19), u(8)

    def in_background(x: float, y: float) -> bool:
        if corner == 0:
            return True
        # Rounded rectangle. Only the corner the point actually sits in matters;
        # testing all four would clip every corner into a square notch.
        in_x_corner = x < corner or x > size - corner
        in_y_corner = y < corner or y > size - corner
        if not (in_x_corner and in_y_corner):
            return True
        cx = corner if x < corner else size - corner
        cy = corner if y < corner else size - corner
        return (x - cx) ** 2 + (y - cy) ** 2 <= corner**2

    def in_sun(x: float, y: float) -> bool:
        return (x - sun_x) ** 2 + (y - sun_y) ** 2 <= sun_r**2

    def in_book(x: float, y: float) -> bool:
        if not (book_top <= y <= book_bottom and book_left <= x <= book_right):
            return False
        # An open book seen from the front: the page edges are widest at the
        # top and taper down to the closed spine at the bottom.
        progress = (y - book_top) / (book_bottom - book_top)
        half_width = (book_right - book_left) / 2
        edge = half_width * (1.0 - 0.45 * progress)
        return abs(x - spine) <= edge

    def in_spine(x: float, y: float) -> bool:
        return abs(x - spine) <= 1.1 * unit and book_top <= y <= book_bottom

    rows: list[list[tuple[int, int, int]]] = []
    for py in range(size):
        row: list[tuple[int, int, int]] = []
        for px in range(size):
            if coverage(px, py, in_background) < 0.5:
                # Transparent corners are not available in this 8-bit RGB
                # writer; paper matches the app background so it reads clean.
                row.append((0xFD, 0xFC, 0xFA))
                continue
            colour = GREEN
            book = coverage(px, py, in_book)
            if book > 0:
                colour = blend(colour, PAPER, book)
            sun = coverage(px, py, in_sun)
            if sun > 0:
                colour = blend(colour, OCHRE, sun)
            spine_cover = coverage(px, py, in_spine)
            if spine_cover > 0:
                colour = blend(colour, GREEN, spine_cover)
            row.append(colour)
        rows.append(row)
    return rows


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for size, maskable, name in (
        (192, False, "icon-192.png"),
        (512, False, "icon-512.png"),
        (512, True, "icon-maskable-512.png"),
    ):
        write_png(OUT_DIR / name, size, render(size, maskable))
        print(f"wrote {name} ({size}x{size})")


if __name__ == "__main__":
    main()
