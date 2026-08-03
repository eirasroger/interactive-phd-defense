"""Export the park's street furniture as templates at the origin."""

from __future__ import annotations

import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))

from exterior_building import (  # noqa: E402
    ASSET_DIR,
    FOLIAGE_SUMMER,
    FOLIAGE_TINT,
    apply_tint,
    is_foliage,
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT = PROJECT_ROOT / "src" / "assets" / "models" / "park-assets.glb"

TEXTURE = 512

# Furniture only. This file used to carry the park's trees as well — a jacaranda
# split into a trunk and loose leaf sprigs for the web to reassemble, plus two
# island trees — and that was 24 of its 25.5 MB for a canopy that never worked
# and for a species the site had already rejected as Mediterranean. The park now
# instances the conifers in `exterior-planting.glb`, which are modelled with
# their foliage on their branches and were already downloaded.
WANTED = {
    "lamp": "street_lamp_01",
    "lamp_tall": "street_lamp_02",
    "bench": "painted_wooden_bench",
}

# Flowers read as purple in the albedo, not as a separate slot.
FLOWER_NAMES = ("flower", "blossom", "petal", "bloom")


def clear() -> None:
    for collection in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for item in list(collection):
            collection.remove(item)


def load(asset: str) -> list:
    blends = sorted((ASSET_DIR / asset).glob("*.blend"))
    if not blends:
        print(f"[park] {asset}: no blend", file=sys.stderr)
        return []

    with bpy.data.libraries.load(str(blends[0]), link=False) as (source, loaded):
        loaded.objects = list(source.objects)
    return [obj for obj in loaded.objects if obj and obj.type == 'MESH']


def seat(objects, name: str) -> None:
    """Drop the group to the origin, base on the ground, transforms applied."""
    for index, obj in enumerate(objects):
        bpy.context.collection.objects.link(obj)
        obj.name = name if index == 0 else f"{name}_part{index}"

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    low = min(
        (obj.matrix_world @ Vector(corner)).z
        for obj in objects
        for corner in obj.bound_box
    )
    centre = sum(
        ((obj.matrix_world @ Vector(corner)) for obj in objects for corner in obj.bound_box),
        Vector((0.0, 0.0, 0.0)),
    ) / (len(objects) * 8)

    for obj in objects:
        obj.location -= Vector((centre.x, centre.y, low))
    bpy.ops.object.transform_apply(location=True)


# A lamp post is a pole and a lantern. Anything past this is scan detail nobody
# reads at the four metres a lamp is ever seen from.
PROP_BUDGET = 5000
CARD_FLOOR = 1500


def thin(objects, budget: int) -> int:
    removed = 0
    for obj in objects:
        faces = len(obj.data.polygons)
        # Genuine alpha-mapped cards are tiny and must survive untouched.
        if faces <= max(budget, CARD_FLOOR):
            continue

        modifier = obj.modifiers.new(name="thin", type='DECIMATE')
        modifier.ratio = budget / faces
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier="thin")
        removed += faces - len(obj.data.polygons)
    return removed


def grade(objects) -> int:
    seen: set[str] = set()
    images: set[str] = set()
    tinted = 0

    for obj in objects:
        for material in obj.data.materials:
            if material is None or material.name in seen or material.node_tree is None:
                continue
            seen.add(material.name)
            lowered = material.name.lower()
            foliage = is_foliage(material.name) or any(f in lowered for f in FLOWER_NAMES)

            for node in material.node_tree.nodes:
                image = getattr(node, "image", None)
                if image is None or image.name in images:
                    continue
                images.add(image.name)

                if foliage and image.colorspace_settings.name != 'Non-Color':
                    apply_tint(image, FOLIAGE_SUMMER, FOLIAGE_TINT, relevel=True)
                    tinted += 1

                if max(image.size) > TEXTURE:
                    image.scale(TEXTURE, TEXTURE)
                # Every image, not just the graded ones: an unpacked image is
                # re-read from its source file at export and the downscale is
                # thrown away.
                image.pack()
    return tinted


def main() -> None:
    clear()
    exported = []

    for name, asset in WANTED.items():
        meshes = load(asset)
        if not meshes:
            continue

        objects = [o for o in meshes if o.name.endswith("LOD1")] or meshes
        seat(objects, name)
        cut = thin(objects, PROP_BUDGET)
        tinted = grade(objects)
        size = max(max(obj.dimensions) for obj in objects)
        faces = sum(len(obj.data.polygons) for obj in objects)
        exported.extend(objects)
        print(
            f"[park] {name}: {len(objects)} mesh, {size:.1f} m, "
            f"{faces / 1000:.0f}k tris (-{cut / 1000:.0f}k), {tinted} maps graded"
        )

    if not exported:
        raise SystemExit("[park] nothing to export")

    # Strip every remaining modifier before export. The `_geometry_nodes` object
    # in each tree blend carries the scatter that builds the full canopy, and
    # `export_apply` evaluates it — which silently reinstates the two-million
    # triangle mesh that taking the parts was meant to avoid.
    for obj in exported:
        obj.modifiers.clear()

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in exported:
        obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format='GLB',
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_image_format='AUTO',
        export_jpeg_quality=72,
    )
    print(f"[park] wrote {OUTPUT} ({OUTPUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
