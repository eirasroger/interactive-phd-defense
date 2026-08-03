"""Download the CC0 vegetation assets the exterior scene appends.

    python tools/blender/fetch_assets.py

Output: work/blender/assets/<id>/
Notes:  docs/blender/assets.md
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
ASSETS = PROJECT_ROOT / "work" / "blender" / "assets"

API = "https://api.polyhaven.com/files/{asset}"
RESOLUTION = "1k"
AGENT = "interactive-phd-defense/1.0 (asset fetch)"

WANTED = (
    # Conifers carry the north-European read. The island trees are gnarled
    # Mediterranean olives with sparse silver foliage — they were the reason the
    # site looked dry and dead, and no amount of grading fixes a wrong species.
    "pine_tree_01",
    "fir_tree_01",
    "pine_sapling_medium",
    "fir_sapling_medium",
    "tree_small_02",
    "island_tree_01",
    "island_tree_02",
    "jacaranda_tree",
    "shrub_01",
    "shrub_02",
    "shrub_03",
    "shrub_04",
    # Understorey. Bushiness at eye level is what a canopy alone cannot supply.
    "fern_02",
    "celandine_01",
    "periwinkle_plant",
    "nettle_plant",
    "grass_medium_01",
    "grass_medium_02",
    "grass_bermuda_01",
)

TEXTURES = (
    "leafy_grass",
    "park_dirt",
    "asphalt_02",
    "square_concrete_pavers",
    "concrete_wall_005",
    "brick_wall_10",
)

# Real-world coverage of one tile, in metres, from the Poly Haven `info` API.
# Tiling is authored in metres rather than in repeats, so these are what turn a
# texture into a material at the right scale.
TEXTURE_METRES = {
    "leafy_grass": 2.0,
    "park_dirt": 2.0,
    "asphalt_02": 2.0,
    "square_concrete_pavers": 1.8,
    "concrete_wall_005": 1.15,
    "brick_wall_10": 1.9,
}
TEXTURE_RESOLUTION = "2k"
MAPS = ("Diffuse", "nor_gl", "Rough")
FORMATS = ("jpg", "png", "exr")


def request(url: str, timeout: int):
    return urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": AGENT}), timeout=timeout
    )


def fetch_json(url: str) -> dict:
    with request(url, 60) as response:
        return json.load(response)


def download(url: str, destination: Path, size: int) -> bool:
    if destination.exists() and destination.stat().st_size == size:
        return False
    destination.parent.mkdir(parents=True, exist_ok=True)
    with request(url, 300) as response:
        destination.write_bytes(response.read())
    return True


def fetch_asset(asset: str) -> int:
    files = fetch_json(API.format(asset=asset))
    variants = files.get("blend", {})
    entry = variants.get(RESOLUTION) or next(iter(variants.values()), None)
    if not entry or "blend" not in entry:
        print(f"[assets] {asset}: no blend variant", file=sys.stderr)
        return 0

    blend = entry["blend"]
    root = ASSETS / asset
    written = 0

    if download(blend["url"], root / Path(blend["url"]).name, blend.get("size", -1)):
        written += blend.get("size", 0)

    for relative, info in blend.get("include", {}).items():
        if download(info["url"], root / relative, info.get("size", -1)):
            written += info.get("size", 0)

    print(f"[assets] {asset}: {written / 1e6:.1f} MB new")
    return written


def fetch_texture(asset: str) -> int:
    files = fetch_json(API.format(asset=asset))
    root = ASSETS / asset
    written = 0

    for name in MAPS:
        resolutions = files.get(name, {})
        entry = resolutions.get(TEXTURE_RESOLUTION) or next(iter(resolutions.values()), None)
        if not entry:
            continue
        chosen = next((entry[fmt] for fmt in FORMATS if fmt in entry), None)
        if not chosen:
            continue
        target = root / f"{name}{Path(chosen['url']).suffix}"
        if download(chosen["url"], target, chosen.get("size", -1)):
            written += chosen.get("size", 0)

    print(f"[assets] {asset}: {written / 1e6:.1f} MB new")
    return written


def main() -> None:
    total = sum(fetch_asset(asset) for asset in WANTED)
    total += sum(fetch_texture(asset) for asset in TEXTURES)
    print(f"[assets] downloaded {total / 1e6:.1f} MB into {ASSETS}")


if __name__ == "__main__":
    main()
