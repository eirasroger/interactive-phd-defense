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

# Rec. 709, the same weights the Blender script grades against.
LUMA = (0.2126, 0.7152, 0.0722)

# Where a neutral map's mean luminance lands, in linear light. Mid-grey rather
# than white: the vertex colour is a multiplier, so a map averaging 1.0 would
# leave no headroom for a surface to be *lighter* than its nominal colour.
NEUTRAL_MEAN = 0.5

# How much of the source's own chroma survives in a neutral map. Not zero —
# fully desaturated grass reads as ash, and the small residual is what keeps
# blades looking like blades rather than like noise.
NEUTRAL_CHROMA = 0.22

# Surfaces whose normal map ships as well.
#
# Paving without one is a photograph of paving: the joints are drawn into the
# albedo, so they never catch the light and never move as the camera does. The
# avenue read as a flat sheet of red plastic for exactly this reason, and no
# amount of resolution or tiling fixes it — a shadow in a texture is a shadow
# that points the wrong way half the time.
#
# Not the terrain, which is seen at grazing angles across a hundred metres where
# a 2 m tile's normal is below the threshold at which anything reads, and not
# roughness, which on these surfaces is near constant and is one uniform in the
# material instead.
NORMALS = ("clay", "granite", "cobble")

TEXTURES: dict[str, tuple[str, str]] = {
    # Terrain. Hue comes from the vertex colours in `terrain.ts`.
    "grass": ("leafy_grass", "neutral"),
    "meadow": ("sparse_grass", "neutral"),
    "soil": ("park_dirt", "neutral"),
    # Hardscape. The material is the whole description, so it keeps its colour.
    "clay": ("red_brick_pavers", "colour"),
    "granite": ("granite_tile_02", "colour"),
    "cobble": ("cobblestone_02", "colour"),
    "gravel": ("gravel_floor", "colour"),
    "riverbed": ("river_small_rocks", "colour"),
    # Kept for the building's own forecourt until the realm split lands.
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
    # A little more quality than the albedo gets. JPEG artefacts in a normal map
    # are not softness, they are wrong surface angles, and they show up as
    # blotches under a moving light rather than as blur.
    image.save(path, quality=94, optimize=True)
    print(f"[textures] {path.name}: {path.stat().st_size / 1024:.0f} KB (normal)")
    return True

def main() -> None:
    written = sum(build(name, asset, mode) for name, (asset, mode) in TEXTURES.items())
    normals = sum(build_normal(name, TEXTURES[name][0]) for name in NORMALS)
    print(f"[textures] wrote {written}/{len(TEXTURES)} maps and {normals} normals into {OUTPUT}")

if __name__ == "__main__":
    main()
