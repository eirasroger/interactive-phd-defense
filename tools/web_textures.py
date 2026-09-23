"""Web-sized ground and paving textures, from the fetched Poly Haven maps."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[1]
ASSETS = PROJECT_ROOT / "work" / "blender" / "assets"
OUTPUT = PROJECT_ROOT / "src" / "assets" / "textures"

SIZE = 1024
QUALITY = 88

# Rec. 709, must match the Blender grading script.
LUMA = (0.2126, 0.7152, 0.0722)

# Linear mean luminance of neutral maps.
NEUTRAL_MEAN = 0.5

NEUTRAL_CHROMA = 0.22

NORMALS = ("clay", "granite", "cobble")

TEXTURES: dict[str, tuple[str, str]] = {
    # Terrain. Hue comes from vertex colours in `terrain.ts`.
    "grass": ("leafy_grass", "neutral"),
    "meadow": ("sparse_grass", "neutral"),
    "soil": ("park_dirt", "neutral"),
    "clay": ("red_brick_pavers", "colour"),
    "granite": ("granite_tile_02", "colour"),
    "cobble": ("cobblestone_02", "colour"),
    "gravel": ("gravel_floor", "colour"),
    "riverbed": ("river_small_rocks", "colour"),
    # Building forecourt.
    "paving": ("square_concrete_pavers", "colour"),
}

def to_linear(srgb: numpy.ndarray) -> numpy.ndarray:
    return numpy.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)

def to_srgb(linear: numpy.ndarray) -> numpy.ndarray:
    return numpy.where(
        linear <= 0.0031308, linear * 12.92, 1.055 * numpy.clip(linear, 0.0, None) ** (1 / 2.4) - 0.055
    )

def neutralise(linear: numpy.ndarray) -> numpy.ndarray:
    """Strip hue to luminance and rescale the mean, keeping a little chroma."""
    luma = linear @ numpy.array(LUMA, dtype=numpy.float32)
    mean = float(luma.mean())
    if mean <= 0.0:
        return linear

    scale = NEUTRAL_MEAN / mean
    grey = numpy.repeat((luma * scale)[:, :, None], 3, axis=2)
    return grey * (1.0 - NEUTRAL_CHROMA) + linear * scale * NEUTRAL_CHROMA

def build(name: str, asset: str, mode: str) -> bool:
    source = next((ASSETS / asset).glob("Diffuse.*"), None)
    if source is None:
        print(f"[textures] {name}: no Diffuse map in {asset}", file=sys.stderr)
        return False

    with Image.open(source) as image:
        image = image.convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)
        pixels = numpy.asarray(image, dtype=numpy.float32) / 255.0

    if mode == "neutral":
        pixels = to_srgb(neutralise(to_linear(pixels)))

    OUTPUT.mkdir(parents=True, exist_ok=True)
    path = OUTPUT / f"{name}.jpg"
    Image.fromarray((numpy.clip(pixels, 0.0, 1.0) * 255).astype(numpy.uint8)).save(
        path, quality=QUALITY, optimize=True
    )
    print(f"[textures] {path.name}: {path.stat().st_size / 1024:.0f} KB ({mode})")
    return True

def build_normal(name: str, asset: str) -> bool:
    """Copy the OpenGL-convention normal map through at web size."""
    source = next((ASSETS / asset).glob("nor_gl.*"), None)
    if source is None:
        print(f"[textures] {name}: no nor_gl map in {asset}", file=sys.stderr)
        return False

    with Image.open(source) as image:
        image = image.convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)

    OUTPUT.mkdir(parents=True, exist_ok=True)
    path = OUTPUT / f"{name}-normal.jpg"
    image.save(path, quality=94, optimize=True)
    print(f"[textures] {path.name}: {path.stat().st_size / 1024:.0f} KB (normal)")
    return True

def main() -> None:
    written = sum(build(name, asset, mode) for name, (asset, mode) in TEXTURES.items())
    normals = sum(build_normal(name, TEXTURES[name][0]) for name in NORMALS)
    print(f"[textures] wrote {written}/{len(TEXTURES)} maps and {normals} normals into {OUTPUT}")

if __name__ == "__main__":
    main()
