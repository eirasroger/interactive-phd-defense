"""Act I exterior building."""

from __future__ import annotations

import json
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODELS = PROJECT_ROOT / "src" / "assets" / "models"
OUTPUT = MODELS / "exterior-building.glb"
CONSTRUCTION_OUTPUT = MODELS / "exterior-construction.glb"
CANDIDATE_OUTPUT = MODELS / "facade-candidates.glb"
SLOT_FILL_OUTPUT = MODELS / "facade-slot-fill.glb"
PLANTING_OUTPUT = MODELS / "exterior-planting.glb"
TEXTURES_OUT = PROJECT_ROOT / "src" / "assets" / "textures"
WORK = PROJECT_ROOT / "work" / "blender"
BLEND = WORK / "exterior_building.blend"
RENDERS = WORK / "renders"
ASSET_DIR = WORK / "assets"
DETAIL_DIR = WORK / "detail"

# Conifers, not the island trees. `tree_small_02` was dropped: it ships no LOD2,
# so the cheapest rung it has is 376k triangles for a 4.5 m tree — the worst
# value in the library by an order of magnitude, and the park now instances
# whatever is here rather than shipping trees of its own.
TREE_ASSETS = ("fir_tree_01", "fir_tree_01", "fir_tree_01", "pine_tree_01")
# `pine_sapling_medium` is not here, and its absence is worth 6.9 M triangles.
# Its cheapest usable rung is 145k for an 11.5 m tree, and it was being planted
# 76 times at 1.3–2.1 m as hedge — a third of the whole site's geometry spent on
# waist-high shrubs, invisible because scaling to metres hides how big the
# source is. `fir_sapling_medium` is the same plant at 6k.
HEDGE_ASSETS = ("shrub_02", "fir_sapling_medium")
GROUND_ASSETS = ("shrub_01", "shrub_03", "shrub_04", "fern_02", "celandine_01", "nettle_plant")
GRASS_ASSETS = ("grass_medium_02", "grass_medium_01")

ASSET_LOD = "LOD1"

# Trees drop a rung. The park instances these rather than shipping its own, so a
# template is now paid for ~90 times instead of ~10.
ASSET_LOD_BY_NAME = {"fir_tree_01": "LOD2", "pine_tree_01": "LOD2"}

# Object-name fragments that mark a component of a plant rather than a whole one.
PART_NAMES = (
    "trunk", "twig", "needle", "branch", "leaves", "leaf",
    "stem", "root", "frond", "blossom", "cone",
)

# Above this a template is flagged in the build log. Not enforced: a specimen
# tree is legitimately expensive and a hedge plant is not, and only the call
# site knows which this is.
TEMPLATE_BUDGET = 60_000

# Poly Haven ships trees at two resolutions and neither is a web budget: the whole-tree mesh is half a million vertices, so eight of them are four million before anything else is in the scene.
LOD_RATIO: dict[str, float] = {}

COLLECTION = "exterior"
SCENE = "exterior_build"

# Sized for the finished presentation, not for a fast turnaround.
BAKE_SIZE = 4096
CANDIDATE_BAKE = 2048
BAKE_SAMPLES = 320

# How far occlusion reaches. Sized to the ground-floor setback, so the soffit
# under the oversail darkens across its full depth rather than only in the
# corners, without the whole elevation picking up a sky-visibility gradient.
AO_DISTANCE = 4.5
GLTF_SETTINGS = "glTF Material Output"

BAY = 4.2
BAYS = 8
WIDTH = BAY * BAYS
DEPTH = 16.0

GROUND_H = 4.0
STOREY = 3.1
UPPER = 4
TOP = GROUND_H + UPPER * STOREY

SKIN = 0.35
CORE_INSET = 0.5
GROUND_SETBACK = 1.6
BALCONY_PROUD = 1.45
PARAPET_H = 0.55

FRONT_Y = -DEPTH / 2.0
GROUND_Y = FRONT_Y + GROUND_SETBACK
BACK_Y = DEPTH / 2.0

WINDOW = (1.6, 1.8)
WINDOW_SILL = 0.95
GLASS_RECESS = 0.26

BAY_TYPES = ("pier", "slot", "pier", "balcony", "balcony", "screen", "balcony", "pier")
SLOT_BAY = 1
ENTRANCE_BAYS = (3, 4)

SLOT = {
    "angle_depth": 0.24,
    "angle_thickness": 0.06,
    "ties": (4, 5),
    "insulated_levels": 2,
    "board": 0.09,
}

# The options stand well west of the building on open promenade, square to a camera that has turned its back on the elevation.
REVIEW = {
    # Far west, well clear of the building.
    "centre": -95.0,
    "y": -27.0,
    "spacing": 5.6,
    "base": 0.06,
    "standoff": 30.0,
    # How far west of the row the camera aims, which is what puts the panels in
    # the right of frame and leaves the left for the caption column.
    "lead": 4.0,
}

# The wedge between the review camera and the row. Enforced in `place_asset()`.
REVIEW_CLEAR = {
    "x": (-118.0, -72.0),
    "y": (-62.0, -22.0),
}

CANDIDATE = {
    "width": BAY - 0.1,
    # Two storeys, not one.
    "height": 7.2,
    "thickness": 0.30,
    # Deliberately not the building's 75 mm course and 225 mm unit.
    "course": 0.22,
    "unit": 0.50,
    "relief": 0.10,
}

SCAFFOLD = {
    "bays": (5, 8),
    "overhang": 0.7,
    "lift": 2.0,
    "spacing": 2.1,
    "standoff": 1.75,
    "deck": 1.25,
    "tube": 0.05,
    "board": (0.225, 0.038),
    "headroom": 0.6,
}

ENTRANCE = {
    "width": 6.4,
    "height": 3.2,
    "leaf_gap": 0.06,
    "canopy_proud": 1.4,
    "canopy_thickness": 0.26,
    "frame": 0.22,
    "clear_bays": (2, 3, 4, 5),
}

SUN_VECTOR = Vector((-50.0, -64.0, 44.0))
SUN_ENERGY = 3.3
SUN_COLOR = (1.0, 0.95, 0.88)
SKY_STRENGTH = 0.038
SKY_DISPLAY = 0.16
SKY_COLOR = (0.32, 0.45, 0.68)

INTERIOR_COLOR = (1.0, 0.82, 0.6)
INTERIOR_STRENGTH = 0.05

PALETTE = {
    "brick": ((0.078, 0.064, 0.058, 1.0), 0.90, 0.0),
    "backing": ((0.15, 0.147, 0.140, 1.0), 0.85, 0.0),
    "frame": ((0.42, 0.415, 0.395, 1.0), 0.52, 0.0),
    "metal": ((0.048, 0.048, 0.052, 1.0), 0.42, 0.85),
    "screen": ((0.44, 0.31, 0.115, 1.0), 0.34, 0.80),
    "soffit": ((0.34, 0.33, 0.315, 1.0), 0.86, 0.0),
    "balustrade": ((0.17, 0.25, 0.235, 1.0), 0.09, 0.0),
    "paving": ((0.20, 0.198, 0.190, 1.0), 0.90, 0.0),
    "soil": ((0.055, 0.042, 0.032, 1.0), 0.95, 0.0),
    "steel": ((0.30, 0.31, 0.325, 1.0), 0.44, 0.70),
    "timber": ((0.26, 0.195, 0.115, 1.0), 0.80, 0.0),
    "insulation": ((0.40, 0.355, 0.245, 1.0), 0.86, 0.0),
    "stock": ((0.135, 0.078, 0.055, 1.0), 0.90, 0.0),
    "hoarding": ((0.055, 0.115, 0.185, 1.0), 0.62, 0.0),
    "bark": ((0.062, 0.052, 0.044, 1.0), 0.92, 0.0),
    "foliage": ((0.062, 0.132, 0.038, 1.0), 0.84, 0.0),
    # Muted, not emerald. A saturated green tint applied across a whole ground
    # plane reads as artificial turf, and it is the one surface large enough
    # that its hue sets the mood of every frame.
    "grass": ((0.098, 0.121, 0.064, 1.0), 0.90, 0.0),
}

LOBBY_COLOR = (1.0, 0.86, 0.66)
LOBBY_STRENGTH = 1.8

# Poly Haven map, real-world tile in metres, and how hard to pull the source
# photograph toward the palette hue. The tile is the asset's own published
# coverage, so a brick reads at the size a brick actually is.
DETAIL = {
    "brick": ("brick_wall_10", 1.9, 0.75),
    "backing": ("concrete_wall_005", 1.15, 0.55),
    "soffit": ("concrete_wall_005", 1.15, 0.65),
    "stock": ("brick_wall_10", 1.9, 0.5),
    "paving": ("square_concrete_pavers", 1.8, 0.8),
}
DETAIL_SIZE = 2048
DETAIL_NORMAL_STRENGTH = 0.9
DETAIL_UV = "detail"
OCCLUSION_UV = "occlusion"


# --------------------------------------------------------------------------
# scene plumbing
# --------------------------------------------------------------------------


def use_scene() -> bpy.types.Scene:
    scene = bpy.data.scenes.get(SCENE)
    if scene is None:
        scene = bpy.data.scenes.new(SCENE)
    if bpy.context.window:
        bpy.context.window.scene = scene
    return scene


def collection() -> bpy.types.Collection:
    scene = use_scene()

    existing = bpy.data.collections.get(COLLECTION)
    if existing:
        for obj in list(existing.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
    else:
        existing = bpy.data.collections.new(COLLECTION)

    if COLLECTION not in scene.collection.children:
        scene.collection.children.link(existing)
    return existing


def add_box(target, name: str, size, location, rotation=None):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)

    sx, sy, sz = (value / 2.0 for value in size)
    verts = [
        (-sx, -sy, -sz), (sx, -sy, -sz), (sx, sy, -sz), (-sx, sy, -sz),
        (-sx, -sy, sz), (sx, -sy, sz), (sx, sy, sz), (-sx, sy, sz),
    ]
    faces = [
        (0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1),
        (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0),
    ]
    mesh.from_pydata(verts, [], faces)
    mesh.update()

    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj.location = location
    if rotation:
        obj.rotation_euler = rotation
    target.objects.link(obj)
    return obj


def boolean_cut(obj, cutter) -> None:
    modifier = obj.modifiers.new(name="cut", type="BOOLEAN")
    modifier.operation = 'DIFFERENCE'
    modifier.object = cutter
    modifier.solver = 'EXACT'
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier=modifier.name)


def bevel(obj, width: float = 0.02, segments: int = 2) -> None:
    modifier = obj.modifiers.new(name="bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = 'ANGLE'
    modifier.angle_limit = 0.785
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier=modifier.name)


# --------------------------------------------------------------------------
# facade assembly
# --------------------------------------------------------------------------


class Parts(dict):
    def put(self, key: str, obj):
        self.setdefault(key, []).append(obj)
        return obj

    def extend(self, key: str, objects):
        self.setdefault(key, []).extend(objects)

    def all(self) -> list:
        return [obj for group in self.values() for obj in group]


def bay_x(index: int) -> float:
    return -WIDTH / 2.0 + BAY * (index + 0.5)


def level_base(level: int) -> float:
    return GROUND_H + level * STOREY


def place(axis: str, u: float, t: float, v: float):
    return (u, t, v) if axis == "y" else (t, u, v)


def spans(axis: str, along: float, through: float, up: float):
    return (along, through, up) if axis == "y" else (through, along, up)


def punched(parts: Parts, target, name: str, axis: str, u: float, face: float,
            base: float, along: float, height: float, inward: float) -> None:
    """A solid skin panel with a window opening built from four pieces."""
    opening_w, opening_h = WINDOW
    sill = base + WINDOW_SILL
    head = sill + opening_h
    top = base + height
    t = face + inward * SKIN / 2.0
    jamb = (along - opening_w) / 2.0

    for side, offset in (("l", -1.0), ("r", 1.0)):
        parts.put("brick", add_box(
            target, f"{name}_jamb_{side}", spans(axis, jamb, SKIN, height),
            place(axis, u + offset * (along - jamb) / 2.0, t, base + height / 2.0),
        ))

    parts.put("brick", add_box(
        target, f"{name}_under", spans(axis, opening_w, SKIN, sill - base),
        place(axis, u, t, (base + sill) / 2.0),
    ))
    parts.put("brick", add_box(
        target, f"{name}_over", spans(axis, opening_w, SKIN, top - head),
        place(axis, u, t, (head + top) / 2.0),
    ))
    parts.put("frame", add_box(
        target, f"{name}_cill", spans(axis, opening_w + 0.16, SKIN + 0.1, 0.09),
        place(axis, u, t - inward * 0.04, sill + 0.02),
    ))
    parts.put("glass", add_box(
        target, f"{name}_glass", spans(axis, opening_w - 0.06, 0.06, opening_h - 0.06),
        place(axis, u, face + inward * GLASS_RECESS, (sill + head) / 2.0),
    ))


def pier_bay(parts: Parts, target, index: int, level: int) -> None:
    punched(
        parts, target, f"bay{index}_l{level}", "y",
        bay_x(index), FRONT_Y, level_base(level), BAY, STOREY, 1.0,
    )


def slot_bay(parts: Parts, target, index: int, level: int) -> None:
    """One bay of brick cladding never placed."""
    base = level_base(level)
    x = bay_x(index)
    face = FRONT_Y + CORE_INSET
    name = f"bay{index}_l{level}"

    parts.put("backing", add_box(
        target, f"{name}_backing", (BAY, 0.1, STOREY),
        (x, face, base + STOREY / 2.0),
    ))

    depth = SLOT["angle_depth"]
    thickness = SLOT["angle_thickness"]
    parts.put("steel", add_box(
        target, f"{name}_angle", (BAY - 0.16, depth, thickness),
        (x, face - depth / 2.0, base + thickness / 2.0),
    ))
    for side, offset in (("l", -1.0), ("r", 1.0)):
        parts.put("steel", add_box(
            target, f"{name}_bracket_{side}", (0.09, depth, 0.34),
            (x + offset * (BAY - 0.6) / 2.0, face - depth / 2.0, base + 0.17),
        ))

    if level < SLOT["insulated_levels"]:
        board = SLOT["board"]
        parts.put("insulation", add_box(
            target, f"{name}_board", (BAY - 0.34, board, STOREY - 0.42),
            (x, face - board / 2.0 - 0.05, base + 0.24 + (STOREY - 0.42) / 2.0),
        ))
        return

    across, up = SLOT["ties"]
    reach, rise = BAY - 1.1, STOREY - 0.9
    for i in range(across):
        for j in range(up):
            parts.put("steel", add_box(
                target, f"{name}_tie_{i}_{j}", (0.05, 0.18, 0.05),
                (
                    x - reach / 2.0 + reach * i / (across - 1),
                    face - 0.09,
                    base + 0.45 + rise * j / (up - 1),
                ),
            ))


def balcony_bay(parts: Parts, target, index: int, level: int) -> None:
    base = level_base(level)
    x = bay_x(index)
    nose = FRONT_Y - BALCONY_PROUD

    parts.put("glass", add_box(
        target, f"bay{index}_l{level}_glazing", (BAY - 0.4, 0.06, STOREY - 0.5),
        (x, FRONT_Y + 0.12, base + 0.25 + (STOREY - 0.5) / 2.0),
    ))
    parts.put("frame", add_box(
        target, f"bay{index}_l{level}_mullion", (0.12, 0.14, STOREY - 0.5),
        (x, FRONT_Y + 0.06, base + 0.25 + (STOREY - 0.5) / 2.0),
    ))
    parts.put("soffit", add_box(
        target, f"bay{index}_l{level}_slab", (BAY, BALCONY_PROUD, 0.26),
        (x, FRONT_Y - BALCONY_PROUD / 2.0, base + 0.13),
    ))
    parts.put("soffit", add_box(
        target, f"bay{index}_l{level}_head", (BAY, BALCONY_PROUD, 0.26),
        (x, FRONT_Y - BALCONY_PROUD / 2.0, base + STOREY - 0.13),
    ))

    for side, offset in (("l", -1.0), ("r", 1.0)):
        parts.put("metal", add_box(
            target, f"bay{index}_l{level}_cheek_{side}", (0.16, BALCONY_PROUD, STOREY),
            (x + offset * (BAY - 0.16) / 2.0, FRONT_Y - BALCONY_PROUD / 2.0, base + STOREY / 2.0),
        ))

    parts.put("balustrade", add_box(
        target, f"bay{index}_l{level}_balustrade", (BAY - 0.36, 0.035, 1.05),
        (x, nose + 0.08, base + 0.26 + 0.55),
    ))
    parts.put("metal", add_box(
        target, f"bay{index}_l{level}_rail", (BAY - 0.32, 0.07, 0.06),
        (x, nose + 0.08, base + 0.26 + 1.1),
    ))


def screen_bay(parts: Parts, target, index: int, level: int) -> None:
    base = level_base(level)
    x = bay_x(index)

    parts.put("glass", add_box(
        target, f"bay{index}_l{level}_glazing", (BAY - 0.4, 0.06, STOREY - 0.4),
        (x, FRONT_Y + 0.14, base + 0.2 + (STOREY - 0.4) / 2.0),
    ))

    blades = 8
    pitch = (STOREY - 0.4) / blades
    for i in range(blades):
        parts.put("screen", add_box(
            target, f"bay{index}_l{level}_blade_{i}", (BAY - 0.5, 0.11, pitch * 0.62),
            (x, FRONT_Y - 0.14, base + 0.2 + (i + 0.5) * pitch),
        ))
    for side, offset in (("l", -1.0), ("r", 1.0)):
        parts.put("metal", add_box(
            target, f"bay{index}_l{level}_stile_{side}", (0.1, 0.16, STOREY - 0.3),
            (x + offset * (BAY - 0.5) / 2.0, FRONT_Y - 0.14, base + 0.15 + (STOREY - 0.3) / 2.0),
        ))


BAY_BUILDERS = {
    "pier": pier_bay,
    "slot": slot_bay,
    "balcony": balcony_bay,
    "screen": screen_bay,
}


def build_core(parts: Parts, target) -> None:
    inner = WIDTH - 2 * SKIN
    upper_front = FRONT_Y + CORE_INSET
    upper_back = BACK_Y - SKIN

    parts.put("brick", add_box(
        target, "core_upper", (inner, upper_back - upper_front, TOP - GROUND_H),
        (0.0, (upper_front + upper_back) / 2.0, (GROUND_H + TOP) / 2.0),
    ))
    parts.put("brick", add_box(
        target, "core_ground", (inner, upper_back - GROUND_Y, GROUND_H),
        (0.0, (GROUND_Y + upper_back) / 2.0, GROUND_H / 2.0),
    ))


def build_front(parts: Parts, target) -> None:
    for index, kind in enumerate(BAY_TYPES):
        builder = BAY_BUILDERS[kind]
        for level in range(UPPER):
            builder(parts, target, index, level)


def build_flanks(parts: Parts, target) -> None:
    columns = 3
    step = (DEPTH - 2 * SKIN) / columns
    start = -DEPTH / 2.0 + SKIN

    for side, x in (("w", -WIDTH / 2.0), ("e", WIDTH / 2.0)):
        inward = 1.0 if side == "w" else -1.0
        for column in range(columns):
            u = start + (column + 0.5) * step
            for level in range(UPPER):
                punched(
                    parts, target, f"flank_{side}_{column}_l{level}", "x",
                    u, x, level_base(level), step, STOREY, inward,
                )


def build_back(parts: Parts, target) -> None:
    parts.put("brick", add_box(
        target, "back_skin", (WIDTH, SKIN, TOP),
        (0.0, BACK_Y - SKIN / 2.0, TOP / 2.0),
    ))


def build_ground(parts: Parts, target) -> None:
    parts.put("soffit", add_box(
        target, "ground_soffit", (WIDTH, GROUND_SETBACK, 0.34),
        (0.0, FRONT_Y + GROUND_SETBACK / 2.0, GROUND_H - 0.17),
    ))

    clear = ENTRANCE["width"] / 2.0 + 0.6
    for index in range(BAYS + 1):
        x = -WIDTH / 2.0 + BAY * index
        if abs(x) < clear:
            continue
        parts.put("metal", add_box(
            target, f"column_{index}", (0.3, 0.3, GROUND_H),
            (x, FRONT_Y + 0.3, GROUND_H / 2.0),
        ))

    parts.put("brick", add_box(
        target, "ground_skin", (WIDTH, SKIN, GROUND_H),
        (0.0, GROUND_Y - SKIN / 2.0, GROUND_H / 2.0),
    ))

    # The bays either side of the entrance stay solid. A door set in a
    # continuous run of identical shop glazing is not an entrance, it is one
    # more pane — which is exactly how it read before, at every distance.
    for index in range(BAYS):
        if index in ENTRANCE["clear_bays"]:
            continue
        parts.put("glass", add_box(
            target, f"ground_glass_{index}", (BAY - 1.2, 0.06, 2.3),
            (bay_x(index), GROUND_Y - GLASS_RECESS, 1.55),
        ))


def build_entrance(parts: Parts, target) -> None:
    w = ENTRANCE["width"]
    h = ENTRANCE["height"]

    cutter = add_box(
        target, "entrance_cutter", (w, SKIN + 0.6, h),
        (0.0, GROUND_Y - SKIN / 2.0, h / 2.0),
    )
    for obj in parts.get("brick", []):
        if obj.name in ("ground_skin", "core_ground"):
            boolean_cut(obj, cutter)
    bpy.data.objects.remove(cutter, do_unlink=True)

    frame = ENTRANCE["frame"]
    for side, offset in (("l", -1.0), ("r", 1.0)):
        parts.put("frame", add_box(
            target, f"entrance_jamb_{side}", (frame, SKIN + 0.16, h + frame),
            (offset * (w + frame) / 2.0, GROUND_Y - SKIN / 2.0, (h + frame) / 2.0),
        ))
    parts.put("frame", add_box(
        target, "entrance_head", (w + 2 * frame, SKIN + 0.16, frame),
        (0.0, GROUND_Y - SKIN / 2.0, h + frame / 2.0),
    ))

    # The one element that projects past the column line. It throws a hard
    # shadow across the recess and breaks the unbroken horizontal of the
    # oversail, which is what separates a doorway from a shopfront at distance.
    proud = ENTRANCE["canopy_proud"]
    depth = GROUND_Y - (FRONT_Y - proud)
    parts.put("soffit", add_box(
        target, "entrance_canopy", (w + 3.0, depth, ENTRANCE["canopy_thickness"]),
        (0.0, GROUND_Y - depth / 2.0, h + frame + ENTRANCE["canopy_thickness"] / 2.0),
    ))
    for side, offset in (("l", -1.0), ("r", 1.0)):
        parts.put("metal", add_box(
            target, f"entrance_hanger_{side}", (0.07, 0.07, 0.62),
            (offset * (w + 2.4) / 2.0, FRONT_Y - proud + 0.3, h + frame + 0.55),
        ))

    parts.put("paving", add_box(
        target, "threshold", (w + 3.4, 3.2, 0.14), (0.0, GROUND_Y - 1.6, 0.05),
    ))

    parts.put("lobby", add_box(
        target, "lobby", (w - 0.3, 0.2, h - 0.3),
        (0.0, GROUND_Y + 1.4, (h - 0.3) / 2.0 + 0.1),
    ))

    leaf = (w - ENTRANCE["leaf_gap"]) / 2.0
    for side, offset in (("l", -1.0), ("r", 1.0)):
        parts.put("glass", add_box(
            target, f"door_{side}", (leaf - 0.04, 0.07, h - 0.08),
            (offset * (leaf + ENTRANCE["leaf_gap"]) / 2.0, GROUND_Y - 0.1, h / 2.0),
        ))
        parts.put("metal", add_box(
            target, f"door_{side}_stile", (0.09, 0.1, h - 0.08),
            (offset * ENTRANCE["leaf_gap"], GROUND_Y - 0.1, h / 2.0),
        ))


def build_roof(parts: Parts, target) -> None:
    parts.put("brick", add_box(
        target, "parapet", (WIDTH + 0.12, DEPTH + 0.12, PARAPET_H),
        (0.0, 0.0, TOP + PARAPET_H / 2.0),
    ))
    parts.put("metal", add_box(
        target, "parapet_cap", (WIDTH + 0.34, DEPTH + 0.34, 0.09),
        (0.0, 0.0, TOP + PARAPET_H),
    ))
    parts.put("metal", add_box(
        target, "roof_plant", (7.0, 5.0, 2.2),
        (5.6, 1.6, TOP + 1.1),
    ))


def add_blob(target, name: str, radius: float, location, scale, subdivisions: int = 1):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdivisions, radius=radius)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    obj.scale = scale
    target.objects.link(obj)
    return obj


def add_taper(target, name: str, bottom: float, top: float, depth: float, location):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=8,
        radius1=bottom, radius2=top, depth=depth,
    )
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

    obj = bpy.data.objects.new(name, mesh)
    obj.location = location
    target.objects.link(obj)
    return obj


APRON = {"x": 25.0, "near": -17.0}
BED_DEPTH = 5.6
BED_NEAR = APRON["near"] - BED_DEPTH
PATH_HALF = 3.6

PROMENADE_DEPTH = 8.5
PROMENADE_NEAR = BED_NEAR - PROMENADE_DEPTH
PROMENADE_RUN = 600.0
VERGE_DEPTH = 3.0

MEADOW_NEAR = PROMENADE_NEAR - 34.0


def band(site: Parts, target, key: str, name: str, near: float, far: float,
         width: float, height: float, z: float = 0.0) -> None:
    site.put(key, add_box(
        target, name, (width, far - near, height), (0.0, (near + far) / 2.0, z),
    ))


def build_paving(site: Parts, target) -> None:
    site.put("paving", add_box(
        target, "forecourt", (2 * APRON["x"], FRONT_Y - BED_NEAR, 0.12),
        (0.0, (FRONT_Y + BED_NEAR) / 2.0, 0.02),
    ))

    for side, offset in (("w", -1.0), ("e", 1.0)):
        width = APRON["x"] - PATH_HALF
        site.put("soil", add_box(
            target, f"bed_{side}", (width, BED_DEPTH, 0.16),
            (offset * (PATH_HALF + width / 2.0), (APRON["near"] + BED_NEAR) / 2.0, 0.02),
        ))

    band(site, target, "paving", "promenade",
         PROMENADE_NEAR, BED_NEAR, PROMENADE_RUN, 0.12, 0.02)

    for side, offset in (("w", -1.0), ("e", 1.0)):
        site.put("soil", add_box(
            target, f"verge_{side}", (86.0, VERGE_DEPTH, 0.14),
            (offset * 62.0, PROMENADE_NEAR - VERGE_DEPTH / 2.0, 0.01),
        ))



_TEMPLATES: dict[str, list] = {}


def asset_template(name: str) -> list:
    if name in _TEMPLATES:
        return _TEMPLATES[name]

    blends = sorted((ASSET_DIR / name).glob("*.blend"))
    if not blends:
        _TEMPLATES[name] = []
        return []

    with bpy.data.libraries.load(str(blends[0]), link=False) as (source, loaded):
        loaded.objects = list(source.objects)

    _TEMPLATES[name] = [obj for obj in loaded.objects if obj and obj.type == 'MESH']
    return _TEMPLATES[name]


def split_lod(name: str) -> tuple[str, str]:
    head, _, tail = name.rpartition("_")
    return (head, tail) if head and tail.startswith("LOD") else (name, "")


_VARIANTS: dict[str, list] = {}


def is_part(name: str) -> bool:
    """Whether this object is a component of a plant rather than a whole one."""
    return any(hint in name for hint in PART_NAMES)


def asset_variants(name: str) -> list:
    """One placeable object per plant variant."""
    if name in _VARIANTS:
        return _VARIANTS[name]

    groups: dict[str, dict[str, object]] = {}
    for obj in asset_template(name):
        if "geometry_nodes" in obj.name or obj.name.endswith("_geo"):
            continue
        base, lod = split_lod(obj.name)
        groups.setdefault(base, {})[lod] = obj

    wanted = ASSET_LOD_BY_NAME.get(name, ASSET_LOD)
    picked = []
    for lods in groups.values():
        for key in (wanted, ASSET_LOD, "LOD0", ""):
            if key in lods:
                picked.append(lods[key])
                break

    # A whole tree is one that is not a component of one. The previous test was
    # `split_lod(obj.name)[0] == name`, which never matched: Poly Haven's
    # variants are `fir_tree_01_a_LOD1`, whose base is `fir_tree_01_a` and not
    # `fir_tree_01`. So every asset fell through to the height fallback below,
    # which happily admitted `fir_tree_01_trunk_c` — a 13 m bare trunk with no
    # foliage on it at all. Those were planted on the site as trees and
    # photographed onto the woodland belt's billboards as species, which is
    # where the dead-looking sticks in the park came from.
    whole = [obj for obj in picked if not is_part(obj.name)]
    if not whole and picked:
        tallest = max(obj.dimensions.z for obj in picked)
        whole = [obj for obj in picked if obj.dimensions.z > tallest * 0.5]
        print(f"[exterior] {name}: no assembled variant; falling back to "
              f"{[o.name for o in whole]}", file=sys.stderr)

    # Reported, because a template's cost is otherwise invisible at the call
    # site: `place_asset` scales to a height in metres, so a 257k-triangle
    # 11.5 m pine and a 6k fir look identical written as "1.6 m of hedge". One
    # of those was planted 76 times before anybody counted.
    for obj in whole:
        faces = len(obj.data.polygons)
        flag = "  <-- heavy" if faces > TEMPLATE_BUDGET else ""
        print(f"[exterior] template {obj.name}: {faces / 1000:.0f}k tris, "
              f"{obj.dimensions.z:.1f} m{flag}")

    ratio = LOD_RATIO.get(name)
    if ratio:
        for obj in whole:
            reduce_mesh(obj, ratio)

    _VARIANTS[name] = whole
    return whole


def reduce_mesh(obj, ratio: float) -> None:
    """Decimate a template in place, before anything instances it."""
    root = bpy.context.scene.collection
    root.objects.link(obj)
    modifier = obj.modifiers.new(name="lod", type="DECIMATE")
    modifier.ratio = ratio
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    root.objects.unlink(obj)


def have_assets() -> bool:
    return any(asset_variants(name) for name in HEDGE_ASSETS + TREE_ASSETS)


def blocks_review(name: str, x: float, y: float) -> bool:
    """Whether a plant would stand in the review row's sightline."""
    if name in GRASS_ASSETS or name in GROUND_ASSETS:
        return False
    return (REVIEW_CLEAR["x"][0] <= x <= REVIEW_CLEAR["x"][1]
            and REVIEW_CLEAR["y"][0] <= y <= REVIEW_CLEAR["y"][1])


def place_asset(site: Parts, target, name: str, location, rotation: float,
                metres: float, rng) -> None:
    """Place one plant at a height in metres, not at a multiple of its own size."""
    if blocks_review(name, location[0], location[1]):
        print(f"[exterior] skipped {name} at {location[0]:.1f},{location[1]:.1f}: review sightline")
        return
    variants = asset_variants(name)
    if not variants:
        return

    source = rng.choice(variants)
    native = source.dimensions.z
    if native <= 0.0:
        return
    factor = metres / native

    obj = source.copy()
    obj.data = source.data
    obj.location = location
    obj.rotation_euler = (0.0, 0.0, rotation)
    obj.scale = (factor, factor, factor * rng.uniform(0.92, 1.12))
    target.objects.link(obj)
    site.put("flora", obj)


def spread(site: Parts, target, assets, count: int, bounds, height, rng) -> None:
    """`height` is a range in metres — the height the plant should stand."""
    x0, x1, y0, y1 = bounds
    low, high = height
    for _ in range(count):
        place_asset(
            site, target, rng.choice(assets),
            (rng.uniform(x0, x1), rng.uniform(y0, y1), 0.05),
            rng.uniform(0.0, math.tau),
            rng.uniform(low, high),
            rng,
        )


def scatter_planting(site: Parts, target, rng) -> None:
    near = APRON["near"]
    for offset in (-1.0, 1.0):
        inner = offset * PATH_HALF
        outer = offset * APRON["x"]
        bounds = (min(inner, outer), max(inner, outer), BED_NEAR + 0.5, near - 0.5)
        spread(site, target, HEDGE_ASSETS, 38, bounds, (1.3, 2.1), rng)
        spread(site, target, GROUND_ASSETS, 150, bounds, (0.35, 0.85), rng)

    # Nothing may stand between PROMENADE_NEAR and BED_NEAR: that band is the
    # pedestrian route, and a tree planted in it reads as an obstacle rather
    # than as landscape. Trees go in the beds, in the verges, or on open grass.
    # Heights in metres. A park conifer beside a five-storey slab is roughly
    # half its height; taller and the building stops being the subject.
    verge = PROMENADE_NEAR - VERGE_DEPTH / 2.0
    for x, y, metres in (
        (-23.5, BED_NEAR + 1.2, 9.5),
        (14.5, BED_NEAR + 0.6, 8.0),
        (-31.0, near + 2.4, 7.2),
        (27.5, near + 1.0, 7.8),
        (-30.0, verge, 8.6),
        (33.0, verge, 9.0),
        (-72.0, -20.0, 10.5),
        (42.0, PROMENADE_NEAR - 7.0, 9.2),
        (-58.0, PROMENADE_NEAR - 12.0, 8.4),
        (58.0, PROMENADE_NEAR - 10.0, 7.6),
    ):
        place_asset(
            site, target, rng.choice(TREE_ASSETS), (x, y, 0.0),
            rng.uniform(0.0, math.tau), metres, rng,
        )

    # Widened past the building's own frontage: the review camera stands out at
    # x = -95 and had nothing but bare lawn in its foreground.
    spread(
        site, target, GRASS_ASSETS, 900,
        (-135.0, 90.0, MEADOW_NEAR, PROMENADE_NEAR - VERGE_DEPTH - 0.5), (0.25, 0.55), rng,
    )
    spread(
        site, target, GROUND_ASSETS, 110,
        (-135.0, 90.0, MEADOW_NEAR + 6.0, PROMENADE_NEAR - VERGE_DEPTH - 1.5), (0.4, 0.9), rng,
    )


def add_shrub(site: Parts, target, name: str, x: float, y: float, radius: float, rng) -> None:
    for index in range(3):
        site.put("foliage", add_blob(
            target, f"{name}_{index}", radius,
            (
                x + rng.uniform(-radius, radius) * 0.7,
                y + rng.uniform(-radius, radius) * 0.5,
                radius * rng.uniform(0.6, 0.95),
            ),
            (rng.uniform(0.8, 1.3), rng.uniform(0.8, 1.2), rng.uniform(0.6, 0.95)),
        ))


def build_hedge(site: Parts, target, rng) -> None:
    y = (APRON["near"] + BED_NEAR) / 2.0
    for side, offset in (("w", -1.0), ("e", 1.0)):
        span = APRON["x"] - PATH_HALF
        count = 9
        for index in range(count):
            x = offset * (PATH_HALF + span * (index + 0.5) / count)
            add_shrub(
                site, target, f"shrub_{side}_{index}", x,
                y + rng.uniform(-1.3, 1.3), rng.uniform(0.75, 1.15), rng,
            )


def add_tree(site: Parts, target, name: str, x: float, y: float, height: float, rng) -> None:
    trunk = height * 0.42
    site.put("bark", add_taper(
        target, f"{name}_trunk", 0.24, 0.14, trunk, (x, y, trunk / 2.0),
    ))
    for index in range(4):
        radius = height * rng.uniform(0.17, 0.24)
        site.put("foliage", add_blob(
            target, f"{name}_canopy_{index}", radius,
            (
                x + rng.uniform(-0.6, 0.6),
                y + rng.uniform(-0.6, 0.6),
                trunk + height * rng.uniform(0.12, 0.34),
            ),
            (rng.uniform(0.9, 1.25), rng.uniform(0.9, 1.25), rng.uniform(0.8, 1.1)),
            subdivisions=2,
        ))


def build_trees(site: Parts, target, rng) -> None:
    placements = (
        (-15.5, BED_NEAR + 2.2, 8.6),
        (13.0, BED_NEAR + 1.6, 7.4),
        (-26.0, APRON["near"] + 3.0, 6.8),
        (24.5, APRON["near"] + 1.5, 7.0),
    )
    for index, (x, y, height) in enumerate(placements):
        add_tree(site, target, f"tree_{index}", x, y, height, rng)


FLORA_TEXTURE = 1024
# Normal is worth its payload under real-time light — it is what stops a canopy
# reading as a flat cut-out. Roughness is not: a leaf is matte, the map is
# nearly constant, and it was 14 textures for no visible difference.
FLORA_KEEP = ("Base Color", "Alpha", "Normal")

# Poly Haven's plants are photographed in whatever season they were scanned in, and several of them are late-summer dry.
FOLIAGE_SUMMER = (0.086, 0.176, 0.055)
FOLIAGE_TINT = 0.45
FOLIAGE_NAMES = (
    "leaf", "leaves", "needle", "foliage", "canopy", "frond",
    "shrub", "grass", "bush", "hedge", "fern", "plant", "celandine", "nettle",
)
BARK_NAMES = ("branch", "trunk", "bark", "stem", "wood", "twig", "root")


def is_foliage(name: str) -> bool:
    lowered = name.lower()
    if any(hint in lowered for hint in BARK_NAMES):
        return False
    return any(hint in lowered for hint in FOLIAGE_NAMES)


def simplify_flora(objects) -> None:
    """Trim planting materials, and grade the foliage to summer."""
    seen: set[str] = set()
    images: set[str] = set()
    tinted = 0

    for obj in objects:
        for material in obj.data.materials:
            if material is None or material.name in seen or material.node_tree is None:
                continue
            seen.add(material.name)
            tree = material.node_tree
            foliage = is_foliage(material.name)

            bsdf = next((n for n in tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if bsdf:
                for link in list(tree.links):
                    if link.to_node is bsdf and link.to_socket.name not in FLORA_KEEP:
                        tree.links.remove(link)

            for node in tree.nodes:
                image = getattr(node, "image", None)
                if image is None or image.name in images:
                    continue
                images.add(image.name)

                # Colour space is the discriminator, not graph position.
                if foliage and image.colorspace_settings.name != 'Non-Color':
                    apply_tint(image, FOLIAGE_SUMMER, FOLIAGE_TINT, relevel=True)
                    image.pack()
                    tinted += 1

                if max(image.size) > FLORA_TEXTURE:
                    image.scale(FLORA_TEXTURE, FLORA_TEXTURE)

    print(f"[exterior] planting: {len(seen)} materials, {len(images)} textures, "
          f"{tinted} graded to summer")


def build_site(target) -> Parts:
    rng = random.Random(20260802)
    site = Parts()

    build_paving(site, target)
    if have_assets():
        scatter_planting(site, target, rng)
    else:
        print(f"[exterior] no library assets in {ASSET_DIR}; using massing planting")
        build_hedge(site, target, rng)
        build_trees(site, target, rng)
    return site


def scaffold_extent() -> tuple[float, float, int, float]:
    first, last = SCAFFOLD["bays"]
    over = SCAFFOLD["overhang"]
    start = -WIDTH / 2.0 + BAY * first - over
    end = -WIDTH / 2.0 + BAY * last + over
    count = max(round((end - start) / SCAFFOLD["spacing"]), 1)
    return start, end, count, (end - start) / count


def build_scaffold(parts: Parts, target) -> None:
    """Tube-and-fitting scaffold over the slot bay and its neighbours."""
    start, end, bays, pitch = scaffold_extent()
    lift = SCAFFOLD["lift"]
    tube = SCAFFOLD["tube"]
    deck = SCAFFOLD["deck"]
    inner = FRONT_Y - SCAFFOLD["standoff"]
    outer = inner - deck
    lifts = int((TOP + SCAFFOLD["headroom"]) // lift) + 1
    height = lifts * lift

    for index in range(bays + 1):
        x = start + index * pitch
        for row, y in (("i", inner), ("o", outer)):
            parts.put("steel", add_box(
                target, f"scaffold_standard_{row}_{index}", (tube, tube, height),
                (x, y, height / 2.0),
            ))
            parts.put("timber", add_box(
                target, f"scaffold_sole_{row}_{index}", (0.30, 0.30, 0.05),
                (x, y, 0.025),
            ))

    for level in range(1, lifts + 1):
        z = level * lift
        for row, y in (("i", inner), ("o", outer)):
            parts.put("steel", add_box(
                target, f"scaffold_ledger_{row}_{level}", (end - start, tube, tube),
                ((start + end) / 2.0, y, z),
            ))

        for index in range(bays + 1):
            x = start + index * pitch
            parts.put("steel", add_box(
                target, f"scaffold_transom_{index}_{level}", (tube, deck, tube),
                (x, (inner + outer) / 2.0, z + tube),
            ))

        boards = int(deck // SCAFFOLD["board"][0])
        for plank in range(boards):
            y = outer + (plank + 0.5) * deck / boards
            parts.put("timber", add_box(
                target, f"scaffold_board_{level}_{plank}",
                (end - start, SCAFFOLD["board"][0] - 0.01, SCAFFOLD["board"][1]),
                ((start + end) / 2.0, y, z + tube + SCAFFOLD["board"][1] / 2.0),
            ))

        for rail, offset in (("guard", 1.05), ("mid", 0.55)):
            parts.put("steel", add_box(
                target, f"scaffold_{rail}_{level}", (end - start, tube, tube),
                ((start + end) / 2.0, outer, z + offset),
            ))
        parts.put("timber", add_box(
            target, f"scaffold_toe_{level}", (end - start, 0.035, 0.16),
            ((start + end) / 2.0, outer - 0.04, z + 0.14),
        ))

    span = 2 * pitch
    angle = math.atan2(2 * lift, span)
    length = math.hypot(span, 2 * lift)
    for level in range(0, lifts - 1, 2):
        for index in range(0, bays - 1, 2):
            direction = 1.0 if (level // 2) % 2 == 0 else -1.0
            parts.put("steel", add_box(
                target, f"scaffold_brace_{index}_{level}", (length, tube, tube),
                (
                    start + (index + 1) * pitch,
                    outer - 0.06,
                    (level + 1) * lift,
                ),
                rotation=(0.0, -direction * angle, 0.0),
            ))

    for level in range(2, lifts, 2):
        for index in range(0, bays + 1, 2):
            parts.put("steel", add_box(
                target, f"scaffold_tie_{index}_{level}",
                (tube, SCAFFOLD["standoff"] + 0.2, tube),
                (start + index * pitch, FRONT_Y - SCAFFOLD["standoff"] / 2.0 + 0.1,
                 level * lift - 0.4),
            ))


def build_hoarding(parts: Parts, target) -> None:
    """Encloses the active work zone at the east end only.

    A run across the whole frontage would stand between the camera and the
    mock-up panels, which are the thing Act I is actually looking at.
    """
    y = APRON["near"] - 0.6
    for index in range(8):
        x = 2.6 + index * 2.45
        parts.put("hoarding", add_box(
            target, f"hoarding_{index}", (2.4, 0.08, 2.4), (x, y, 1.2),
        ))
        parts.put("steel", add_box(
            target, f"hoarding_post_{index}", (0.09, 0.09, 2.5), (x + 1.2, y - 0.06, 1.25),
        ))


def build_props(parts: Parts, target, rng) -> None:
    for stack in range(3):
        x = 6.0 + stack * 1.5
        y = APRON["near"] + 3.4
        courses = rng.randint(5, 8)
        parts.put("timber", add_box(
            target, f"pallet_{stack}", (1.15, 0.95, 0.14), (x, y, 0.07),
        ))
        for course in range(courses):
            parts.put("stock", add_box(
                target, f"pallet_{stack}_pack_{course}", (1.1, 0.9, 0.15),
                (x + rng.uniform(-0.03, 0.03), y + rng.uniform(-0.03, 0.03),
                 0.14 + 0.075 + course * 0.15),
            ))

    parts.put("steel", add_box(
        target, "skip", (3.6, 1.8, 1.25), (17.8, APRON["near"] + 2.6, 0.63),
    ))

    bench = (12.4, APRON["near"] + 3.8)
    parts.put("timber", add_box(
        target, "trestle", (2.4, 0.8, 0.08), (bench[0], bench[1], 0.85),
    ))
    for leg in range(4):
        parts.put("steel", add_box(
            target, f"trestle_leg_{leg}", (0.07, 0.07, 0.85),
            (
                bench[0] + (1.05 if leg % 2 else -1.05),
                bench[1] + (0.3 if leg < 2 else -0.3),
                0.42,
            ),
        ))


def candidate_place(index: int) -> float:
    """Evenly along the review row, centred on `REVIEW`."""
    span = (len(CANDIDATE_BUILDERS) - 1) * REVIEW["spacing"]
    return REVIEW["centre"] - span / 2.0 + index * REVIEW["spacing"]


def candidate_frame(parts: Parts, target, name: str, x: float) -> tuple[float, float]:
    """A thin carrier edge so each option reads as a discrete panel."""
    width = CANDIDATE["width"]
    height = CANDIDATE["height"]
    thickness = CANDIDATE["thickness"]
    y = REVIEW["y"]
    base = REVIEW["base"]

    for side, offset in (("l", -1.0), ("r", 1.0)):
        parts.put("steel", add_box(
            target, f"{name}_edge_{side}", (0.05, thickness + 0.06, height + 0.1),
            (x + offset * (width + 0.05) / 2.0, y, base + height / 2.0),
        ))
    for side, offset in (("b", -1.0), ("t", 1.0)):
        parts.put("steel", add_box(
            target, f"{name}_rim_{side}", (width + 0.1, thickness + 0.06, 0.05),
            (x, y, base + height / 2.0 + offset * (height + 0.05) / 2.0),
        ))
    return base, y - thickness / 2.0


def candidate_flat(parts: Parts, target, name: str, x: float) -> None:
    base, _ = candidate_frame(parts, target, name, x)
    parts.put("brick", add_box(
        target, f"{name}_face",
        (CANDIDATE["width"], CANDIDATE["thickness"], CANDIDATE["height"]),
        (x, REVIEW["y"], base + CANDIDATE["height"] / 2.0),
    ))


def candidate_relief(parts: Parts, target, name: str, x: float) -> None:
    base, face = candidate_frame(parts, target, name, x)
    width, height = CANDIDATE["width"], CANDIDATE["height"]
    parts.put("brick", add_box(
        target, f"{name}_face", (width, CANDIDATE["thickness"], height),
        (x, REVIEW["y"], base + height / 2.0),
    ))

    course = CANDIDATE["course"]
    unit = CANDIDATE["unit"]
    rows = int(height / (course * 3))
    columns = int(width / (unit * 2))
    for row in range(rows):
        for column in range(columns):
            offset = (unit if row % 2 else 0.0)
            cx = x - width / 2.0 + unit + column * unit * 2 + offset
            if abs(cx - x) > width / 2.0 - unit / 2.0:
                continue
            proud = CANDIDATE["relief"]
            parts.put("brick", add_box(
                target, f"{name}_header_{row}_{column}", (unit - 0.03, proud, course - 0.03),
                (cx, face - proud / 2.0, base + course * 1.5 + row * course * 3),
            ))


def candidate_screen(parts: Parts, target, name: str, x: float) -> None:
    base, _ = candidate_frame(parts, target, name, x)
    width, height = CANDIDATE["width"], CANDIDATE["height"]
    thickness = CANDIDATE["thickness"]
    course = CANDIDATE["course"]
    unit = CANDIDATE["unit"]
    rows = int(height / course)

    for side, offset in (("l", -1.0), ("r", 1.0)):
        parts.put("brick", add_box(
            target, f"{name}_pier_{side}", (unit, thickness, height),
            (x + offset * (width - unit) / 2.0, REVIEW["y"], base + height / 2.0),
        ))

    inner = width - 2 * unit
    perforated = max(int(inner / (unit * 1.6)), 2)
    for row in range(rows):
        z = base + course / 2.0 + row * course
        if row % 3 == 2:
            for column in range(perforated):
                cx = x - inner / 2.0 + inner * (column + 0.5) / perforated
                parts.put("brick", add_box(
                    target, f"{name}_slip_{row}_{column}", (unit, thickness, course - 0.008),
                    (cx, REVIEW["y"], z),
                ))
        else:
            parts.put("brick", add_box(
                target, f"{name}_course_{row}", (inner, thickness, course - 0.008),
                (x, REVIEW["y"], z),
            ))


def candidate_demountable(parts: Parts, target, name: str, x: float) -> None:
    """Panelised and unbonded: the option that can be taken back off."""
    base, _ = candidate_frame(parts, target, name, x)
    width, height = CANDIDATE["width"], CANDIDATE["height"]
    gap = 0.18
    columns_across, rows_up = 2, 3
    tile_w = (width - gap * (columns_across - 1)) / columns_across
    tile_h = (height - gap * (rows_up - 1)) / rows_up

    parts.put("steel", add_box(
        target, f"{name}_subframe", (width, 0.12, height),
        (x, REVIEW["y"] + 0.09, base + height / 2.0),
    ))
    for rail in range(rows_up + 1):
        parts.put("steel", add_box(
            target, f"{name}_rail_{rail}", (width + 0.1, 0.09, 0.06),
            (x, REVIEW["y"] + 0.02, base + rail * (tile_h + gap) + 0.03),
        ))

    for row in range(rows_up):
        for column in range(columns_across):
            parts.put("brick", add_box(
                target, f"{name}_tile_{row}_{column}", (tile_w, 0.11, tile_h),
                (
                    x - width / 2.0 + tile_w / 2.0 + column * (tile_w + gap),
                    REVIEW["y"] - 0.04,
                    base + tile_h / 2.0 + row * (tile_h + gap),
                ),
            ))
            for clip in (-1.0, 1.0):
                parts.put("steel", add_box(
                    target, f"{name}_clip_{row}_{column}_{int(clip)}", (0.05, 0.13, 0.05),
                    (
                        x - width / 2.0 + tile_w / 2.0 + column * (tile_w + gap)
                        + clip * (tile_w / 2.0 - 0.12),
                        REVIEW["y"] + 0.03,
                        base + tile_h / 2.0 + row * (tile_h + gap) + tile_h / 2.0 - 0.08,
                    ),
                ))


CANDIDATE_BUILDERS = (
    ("flat", candidate_flat),
    ("relief", candidate_relief),
    ("screen", candidate_screen),
    ("demountable", candidate_demountable),
)


def build_candidates(target) -> list[Parts]:
    """Four full-size mock-up panels standing in a row on open promenade."""
    panels = []
    for index, (label, builder) in enumerate(CANDIDATE_BUILDERS):
        parts = Parts()
        name = f"candidate_{index + 1}_{label}"
        builder(parts, target, name, candidate_place(index))
        for group in parts.values():
            for obj in group:
                bevel(obj, width=0.006)
        panels.append(parts)
    return panels


def build_slot_fill(target) -> Parts:
    """The cladding that fills the vacant bay once it has been specified.

    Act IV only. It is the neighbouring pier bay's own treatment, so the filled
    elevation reads as the building always intended rather than as a patch.
    """
    parts = Parts()
    for level in range(UPPER):
        pier_bay(parts, target, SLOT_BAY, level)
    for key, group in parts.items():
        if key == "glass":
            continue
        for obj in group:
            bevel(obj)
    return parts


def build_construction(target) -> Parts:
    rng = random.Random(20260803)
    parts = Parts()

    build_scaffold(parts, target)
    build_hoarding(parts, target)
    build_props(parts, target, rng)

    for group in parts.values():
        for obj in group:
            bevel(obj, width=0.008)

    return parts


def build_geometry(target) -> Parts:
    parts = Parts()

    build_core(parts, target)
    build_front(parts, target)
    build_flanks(parts, target)
    build_back(parts, target)
    build_ground(parts, target)
    build_entrance(parts, target)
    build_roof(parts, target)

    for key, group in parts.items():
        if key == "glass":
            continue
        for obj in group:
            bevel(obj)

    return parts


# --------------------------------------------------------------------------
# materials and lighting
# --------------------------------------------------------------------------


def principled(name: str, base_color, roughness: float, metallic: float = 0.0):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return material


def detail_texture(key: str, slot: str, tint: float) -> Path:
    """A web-sized, palette-graded copy of one Poly Haven map."""
    asset, _, _ = DETAIL[key]
    source = next((ASSET_DIR / asset).glob(f"{slot}.*"), None)
    if source is None:
        raise RuntimeError(f"{key}: {asset}/{slot} is missing — run fetch_assets.py")

    DETAIL_DIR.mkdir(parents=True, exist_ok=True)
    destination = DETAIL_DIR / f"{key}_{slot}.jpg"

    image = bpy.data.images.load(str(source), check_existing=False)
    if tint > 0.0:
        apply_tint(image, PALETTE[key][0], tint, relevel=True)
    image.scale(DETAIL_SIZE, DETAIL_SIZE)

    settings = bpy.context.scene.render.image_settings
    settings.file_format = 'JPEG'
    settings.quality = 94
    image.save_render(str(destination), scene=bpy.context.scene)
    bpy.data.images.remove(image)
    return destination


def detail_image(key: str, slot: str, tint: float, colour: bool):
    label = f"{key}_{slot}"
    existing = bpy.data.images.get(label)
    if existing:
        bpy.data.images.remove(existing, do_unlink=True)

    image = bpy.data.images.load(str(detail_texture(key, slot, tint)), check_existing=False)
    image.name = label
    if not colour:
        image.colorspace_settings.name = 'Non-Color'
    return image


def detail_material(key: str):
    """Surface detail as a tiling map on a real UV set, not as a baked atlas."""
    asset, tile, tint = DETAIL[key]
    base_color, roughness, metallic = PALETTE[key]
    material = principled(key, base_color, roughness, metallic)
    tree = material.node_tree
    bsdf = tree.nodes["Principled BSDF"]

    coords = tree.nodes.new("ShaderNodeUVMap")
    coords.uv_map = DETAIL_UV
    coords.location = (-1000, 100)

    base = tree.nodes.new("ShaderNodeTexImage")
    base.image = detail_image(key, "Diffuse", tint, colour=True)
    base.location = (-700, 220)
    tree.links.new(coords.outputs["UV"], base.inputs["Vector"])
    tree.links.new(base.outputs["Color"], bsdf.inputs["Base Color"])

    normal = tree.nodes.new("ShaderNodeTexImage")
    normal.image = detail_image(key, "nor_gl", 0.0, colour=False)
    normal.location = (-700, -180)
    shaper = tree.nodes.new("ShaderNodeNormalMap")
    shaper.uv_map = DETAIL_UV
    shaper.location = (-400, -180)
    shaper.inputs["Strength"].default_value = DETAIL_NORMAL_STRENGTH
    tree.links.new(coords.outputs["UV"], normal.inputs["Vector"])
    tree.links.new(normal.outputs["Color"], shaper.inputs["Color"])
    tree.links.new(shaper.outputs["Normal"], bsdf.inputs["Normal"])

    print(f"[exterior] detail {key}: {asset} at {tile:.2f} m "
          f"({DETAIL_SIZE / tile:.0f} texels/m)")
    return material


def tint_node(tree, source, color, amount: float):
    """Keep the texture's luminance detail, take the hue from the palette."""
    mix = tree.nodes.new("ShaderNodeMix")
    mix.data_type = 'RGBA'
    mix.blend_type = 'COLOR'
    mix.location = (-360, 160)
    mix.inputs[0].default_value = amount
    mix.inputs[7].default_value = color
    tree.links.new(source, mix.inputs[6])
    return mix.outputs[2]


def textured_material(name: str, texture: str, tile: float, fallback, tint: float = 0.0):
    """Ground surfaces, tiled in world metres so the scale is not guesswork."""
    root = ASSET_DIR / texture
    diffuse = next(root.glob("Diffuse.*"), None)
    if diffuse is None:
        return principled(name, fallback[0], fallback[1], fallback[2])

    material = principled(name, fallback[0], fallback[1])
    tree = material.node_tree
    bsdf = tree.nodes["Principled BSDF"]

    coords = tree.nodes.new("ShaderNodeNewGeometry")
    coords.location = (-1000, 0)
    mapping = tree.nodes.new("ShaderNodeMapping")
    mapping.location = (-820, 0)
    mapping.inputs["Scale"].default_value = (1.0 / tile, 1.0 / tile, 1.0 / tile)
    tree.links.new(coords.outputs["Position"], mapping.inputs["Vector"])

    base = tree.nodes.new("ShaderNodeTexImage")
    base.image = bpy.data.images.load(str(diffuse), check_existing=True)
    base.location = (-600, 160)
    tree.links.new(mapping.outputs["Vector"], base.inputs["Vector"])
    surface = base.outputs["Color"]
    if tint > 0.0:
        surface = tint_node(tree, surface, fallback[0], tint)
    tree.links.new(surface, bsdf.inputs["Base Color"])

    rough = next(root.glob("Rough.*"), None)
    if rough:
        node = tree.nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(str(rough), check_existing=True)
        node.image.colorspace_settings.name = 'Non-Color'
        node.location = (-600, -140)
        tree.links.new(mapping.outputs["Vector"], node.inputs["Vector"])
        tree.links.new(node.outputs["Color"], bsdf.inputs["Roughness"])

    normal = next(root.glob("nor_gl.*"), None)
    if normal:
        node = tree.nodes.new("ShaderNodeTexImage")
        node.image = bpy.data.images.load(str(normal), check_existing=True)
        node.image.colorspace_settings.name = 'Non-Color'
        node.location = (-600, -440)
        shaper = tree.nodes.new("ShaderNodeNormalMap")
        shaper.location = (-320, -440)
        shaper.inputs["Strength"].default_value = 0.6
        tree.links.new(mapping.outputs["Vector"], node.inputs["Vector"])
        tree.links.new(node.outputs["Color"], shaper.inputs["Color"])
        tree.links.new(shaper.outputs["Normal"], bsdf.inputs["Normal"])

    return material


def emissive_material(name: str, color, strength: float):
    material = principled(name, (0.0, 0.0, 0.0, 1.0), 1.0)
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
    bsdf.inputs["Emission Strength"].default_value = strength
    return material


def glazing_material(name: str, strength: float):
    """Near-mirror, because glass reads by what it reflects."""
    material = principled(name, (0.032, 0.045, 0.062, 1.0), 0.06)
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Emission Color"].default_value = (*INTERIOR_COLOR, 1.0)
    bsdf.inputs["Emission Strength"].default_value = strength
    return material


def assign(objects, material) -> None:
    for obj in objects:
        obj.data.materials.clear()
        obj.data.materials.append(material)


SPECIAL_MATERIALS = {
    "glass": lambda: glazing_material("glass", INTERIOR_STRENGTH),
    "lobby": lambda: emissive_material("lobby", LOBBY_COLOR, LOBBY_STRENGTH),
    "brick": lambda: detail_material("brick"),
    "backing": lambda: detail_material("backing"),
    "soffit": lambda: detail_material("soffit"),
    "stock": lambda: detail_material("stock"),
    "soil": lambda: textured_material("soil", "park_dirt", 2.0, PALETTE["soil"]),
    "grass": lambda: textured_material("grass", "leafy_grass", 2.5, PALETTE["grass"], tint=0.85),
    # On the detail path rather than the site path: the entrance threshold is
    # part of the building asset, and the site's raw 2K library maps rode into
    # the GLB with it — 6.8 MB of a 9.9 MB export, for a strip of paving under
    # the doors.
    "paving": lambda: detail_material("paving"),
}


def apply_palette(parts: Parts) -> None:
    for key, group in parts.items():
        if key == "flora":
            continue
        special = SPECIAL_MATERIALS.get(key)
        if special:
            assign(group, special())
        else:
            base_color, roughness, metallic = PALETTE[key]
            assign(group, principled(key, base_color, roughness, metallic))

        # Projected here rather than only at bake time so the preview renders
        # the same surface the browser will. A preview that shows flat colour
        # where the asset ships tiling detail sends you looking for a fault in
        # the material — see `learnings.md` §4.
        for obj in group:
            project_detail_uv(obj)


def add_sun(target) -> None:
    light = bpy.data.lights.new("sun", type='SUN')
    light.energy = SUN_ENERGY
    light.color = SUN_COLOR
    light.angle = 0.02

    lamp = bpy.data.objects.new("sun", light)
    direction = SUN_VECTOR.normalized()
    lamp.location = direction * 150.0
    lamp.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    target.objects.link(lamp)


def split_camera_ray(tree, lighting, display) -> None:
    """Light the scene at one sky strength and show the camera another."""
    output = next(n for n in tree.nodes if n.type == 'OUTPUT_WORLD')
    path = tree.nodes.new("ShaderNodeLightPath")
    path.location = (-320, 420)
    mix = tree.nodes.new("ShaderNodeMixShader")
    mix.location = (140, 240)

    tree.links.new(path.outputs["Is Camera Ray"], mix.inputs["Fac"])
    tree.links.new(lighting.outputs["Background"], mix.inputs[1])
    tree.links.new(display.outputs["Background"], mix.inputs[2])
    tree.links.new(mix.outputs["Shader"], output.inputs["Surface"])


def set_sky() -> None:
    world = bpy.data.worlds.new("exterior_sky")
    bpy.context.scene.world = world
    world.use_nodes = True

    tree = world.node_tree
    lighting = tree.nodes["Background"]
    lighting.inputs["Strength"].default_value = SKY_STRENGTH

    display = tree.nodes.new("ShaderNodeBackground")
    display.location = (-140, 40)
    display.inputs["Strength"].default_value = SKY_DISPLAY
    split_camera_ray(tree, lighting, display)

    direction = SUN_VECTOR.normalized()
    try:
        sky = tree.nodes.new("ShaderNodeTexSky")
    except RuntimeError:
        for node in (lighting, display):
            node.inputs["Color"].default_value = (*SKY_COLOR, 1.0)
        return

    sky.location = (-520, 200)
    for sky_type in ('MULTIPLE_SCATTERING', 'NISHITA'):
        try:
            sky.sky_type = sky_type
            break
        except TypeError:
            continue

    sky.sun_elevation = math.asin(max(-1.0, min(1.0, direction.z)))
    sky.sun_rotation = math.atan2(direction.y, direction.x)
    sky.sun_disc = False
    for attribute, value in (("dust_density", 1.1), ("air_density", 1.0)):
        if hasattr(sky, attribute):
            setattr(sky, attribute, value)

    for node in (lighting, display):
        tree.links.new(sky.outputs["Color"], node.inputs["Color"])


def add_shadow_catcher(target):
    ground = add_box(target, "bake_ground", (600.0, 600.0, 0.2), (0.0, 0.0, -0.1))
    assign([ground], textured_material("grass", "leafy_grass", 2.5, PALETTE["grass"], tint=0.85))
    return ground


def light_scene(target) -> None:
    add_sun(target)
    add_shadow_catcher(target)
    set_sky()


# --------------------------------------------------------------------------
# preview rendering
# --------------------------------------------------------------------------


PREVIEW_POSE = {
    "location": Vector((-24.0, -58.0, 4.0)),
    "target": Vector((-14.0, -12.0, 7.0)),
    "fov": 42.0,
}

SITE_POSE = {
    "location": Vector((-42.0, -82.0, 13.0)),
    "target": Vector((0.0, -6.0, 8.0)),
    "fov": 40.0,
}

BAY_POSE = {
    "location": Vector((-16.0, -32.0, 8.2)),
    "target": Vector((bay_x(SLOT_BAY), -8.0, 8.2)),
    "fov": 34.0,
}

ENTRANCE_POSE = {
    "location": Vector((0.0, -26.0, 3.4)),
    "target": Vector((0.0, -6.4, 3.0)),
    "fov": 38.0,
}

SCAFFOLD_POSE = {
    "location": Vector((22.0, -40.0, 7.0)),
    "target": Vector((10.5, -9.0, 9.0)),
    "fov": 40.0,
}

# Square to the review row and close, aimed `lead` metres west of it. Derived
# rather than typed: the row's own position decides where the camera stands.
# Mirrored by the `practice` pose in src/scenes.
CANDIDATES_POSE = {
    "location": Vector((REVIEW["centre"], REVIEW["y"] - REVIEW["standoff"], 4.2)),
    "target": Vector((REVIEW["centre"] - REVIEW["lead"], REVIEW["y"], 3.5)),
    "fov": 40.0,
}

POSES = {
    "exterior": PREVIEW_POSE,
    "candidates": CANDIDATES_POSE,
    "site": SITE_POSE,
    "bay": BAY_POSE,
    "entrance": ENTRANCE_POSE,
    "scaffold": SCAFFOLD_POSE,
}


def add_preview_camera(target, pose=None):
    pose = pose or PREVIEW_POSE

    data = bpy.data.cameras.get("preview_cam") or bpy.data.cameras.new("preview_cam")
    data.sensor_fit = 'VERTICAL'
    data.lens_unit = 'FOV'
    data.angle_y = math.radians(pose["fov"])
    data.clip_end = 600.0

    cam = bpy.data.objects.get("preview_cam")
    if cam is None:
        cam = bpy.data.objects.new("preview_cam", data)
        target.objects.link(cam)
    cam.data = data
    cam.location = pose["location"]
    cam.rotation_euler = (
        (pose["target"] - pose["location"]).to_track_quat('-Z', 'Y').to_euler()
    )
    bpy.context.scene.camera = cam
    return cam


def configure_cycles(samples: int = 64) -> None:
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    try:
        scene.cycles.device = 'GPU'
    except Exception:  # noqa: BLE001
        pass
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0


def render_preview(name: str = "exterior", samples: int = 48, pose=None) -> Path:
    target = bpy.data.collections.get(COLLECTION) or collection()
    add_preview_camera(target, pose or POSES.get(name))
    configure_cycles(samples)

    RENDERS.mkdir(parents=True, exist_ok=True)
    path = RENDERS / f"{name}.png"
    bpy.context.scene.render.filepath = str(path)
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    print(f"[exterior] rendered {path}")
    return path


def preview() -> Parts:
    target = collection()
    parts = build_geometry(target)
    site = build_site(target)
    construction = build_construction(target)
    candidates = build_candidates(target)
    apply_palette(parts)
    apply_palette(site)
    apply_palette(construction)
    for panel in candidates:
        apply_palette(panel)
    if "--filled" in sys.argv:
        fill = build_slot_fill(target)
        apply_palette(fill)

    light_scene(target)

    objects = parts.all() + site.all() + construction.all()
    objects += [obj for panel in candidates for obj in panel.all()]
    total = sum(len(obj.data.polygons) for obj in objects)
    print(f"[exterior] parts: {len(objects)}  polys: {total}")
    print(f"[exterior] size: {WIDTH:.1f} x {DEPTH:.1f} x {TOP + PARAPET_H:.1f}")
    print(f"[exterior] slot bay centre x: {bay_x(SLOT_BAY):.3f}")
    print(f"[exterior] construction parts: {len(construction.all())}")
    return parts


# --------------------------------------------------------------------------
# bake and export
# --------------------------------------------------------------------------


def join_all(parts: list, name: str):
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()

    obj = bpy.context.active_object
    obj.name = name
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return obj


DETAIL_AXES = ((1, 2), (0, 2), (0, 1))


def project_detail_uv(obj) -> None:
    """World coordinates, in metres, divided by each material's tile."""
    mesh = obj.data
    layer = mesh.uv_layers.get(DETAIL_UV) or mesh.uv_layers.new(name=DETAIL_UV)
    tiles = [
        DETAIL[slot.material.name][1] if slot.material and slot.material.name in DETAIL else 1.0
        for slot in obj.material_slots
    ]
    uvs = layer.data

    for polygon in mesh.polygons:
        tile = tiles[polygon.material_index] if polygon.material_index < len(tiles) else 1.0
        normal = polygon.normal
        axis = max(range(3), key=lambda i: abs(normal[i]))
        u_axis, v_axis = DETAIL_AXES[axis]
        for loop in polygon.loop_indices:
            position = mesh.vertices[mesh.loops[loop].vertex_index].co
            uvs[loop].uv = (position[u_axis] / tile, position[v_axis] / tile)


def unwrap_occlusion(obj) -> None:
    mesh = obj.data
    layer = mesh.uv_layers.get(OCCLUSION_UV) or mesh.uv_layers.new(name=OCCLUSION_UV)
    mesh.uv_layers.active = layer

    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.006)
    bpy.ops.object.mode_set(mode='OBJECT')

    if mesh.uv_layers[0].name != DETAIL_UV:
        raise RuntimeError(f"{obj.name}: detail UVs must be first, got {mesh.uv_layers[0].name}")


def gltf_settings_tree():
    """The one node group Blender's glTF exporter reads occlusion out of."""
    tree = bpy.data.node_groups.get(GLTF_SETTINGS)
    if tree:
        return tree
    tree = bpy.data.node_groups.new(GLTF_SETTINGS, "ShaderNodeTree")
    tree.interface.new_socket("Occlusion", in_out='INPUT', socket_type='NodeSocketFloat')
    tree.nodes.new("NodeGroupInput")
    return tree


def wire_occlusion(obj, image) -> None:
    for material in obj.data.materials:
        tree = material.node_tree
        coords = tree.nodes.new("ShaderNodeUVMap")
        coords.uv_map = OCCLUSION_UV
        coords.location = (-1000, -700)

        node = tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        node.location = (-700, -700)
        tree.links.new(coords.outputs["UV"], node.inputs["Vector"])

        settings = tree.nodes.new("ShaderNodeGroup")
        settings.node_tree = gltf_settings_tree()
        settings.location = (-380, -700)
        tree.links.new(node.outputs["Color"], settings.inputs["Occlusion"])


def set_bake_target(obj, image) -> None:
    for material in obj.data.materials:
        tree = material.node_tree
        for node in [n for n in tree.nodes if n.name.startswith("BAKE_TARGET")]:
            tree.nodes.remove(node)
        node = tree.nodes.new("ShaderNodeTexImage")
        node.name = "BAKE_TARGET"
        node.image = image
        node.location = (-500, 320)
        tree.nodes.active = node


def bake_into(obj, image) -> None:
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = BAKE_SAMPLES
    scene.cycles.use_denoising = True
    scene.render.bake.margin = 10
    # Bleed along mesh adjacency rather than outward in image space. The mesh is
    # built from overlapping boxes, so many islands are interior faces baking to
    # solid black; an image-space margin walks that black across whatever island
    # the packer happened to put next to it. Widening the gap instead only trades
    # the artifact for wasted atlas.
    scene.render.bake.margin_type = 'ADJACENT_FACES'
    scene.world.light_settings.distance = AO_DISTANCE

    set_bake_target(obj, image)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='AO', use_clear=True)


def bake_image(name: str, size: int = BAKE_SIZE):
    existing = bpy.data.images.get(name)
    if existing:
        bpy.data.images.remove(existing, do_unlink=True)
    return bpy.data.images.new(name, size, size)


def report_levels(name: str, image) -> None:
    """What an occlusion bake is worth checking for."""
    import numpy

    pixels = numpy.empty(len(image.pixels), dtype=numpy.float32)
    image.pixels.foreach_get(pixels)
    values = pixels.reshape(-1, 4)[:, 0]

    print(f"[exterior] {name} occlusion: mean {values.mean():.3f}  "
          f"open {(values > 0.9).mean() * 100.0:.1f}%  "
          f"closed {(values < 0.1).mean() * 100.0:.1f}%")


def isolate_materials(obj) -> None:
    """Give this asset private copies of every material it uses."""
    for slot in obj.material_slots:
        if slot.material:
            slot.material = slot.material.copy()


def save_blend() -> None:
    WORK.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND), copy=True)
    print(f"[exterior] saved {BLEND}")


def export(objects, destination: Path = OUTPUT, occluded: bool = True) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    group = objects if isinstance(objects, list) else [objects]

    for other in bpy.data.objects:
        try:
            other.select_set(False)
        except RuntimeError:
            pass
    for obj in group:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = group[0]

    bpy.ops.export_scene.gltf(
        filepath=str(destination),
        export_format="GLB",
        use_selection=True,
        use_active_scene=True,
        export_apply=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_image_format='JPEG',
        export_jpeg_quality=95,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )
    if occluded:
        verify_export(destination)
    print(f"[exterior] wrote {destination} ({destination.stat().st_size / 1024:.1f} KB)")


def verify_export(destination: Path) -> None:
    """Assert the exporter kept the occlusion map and its own UV set."""
    data = destination.read_bytes()
    length = int.from_bytes(data[12:16], "little")
    document = json.loads(data[20:20 + length])

    materials = document.get("materials", [])
    missing = [m.get("name", "?") for m in materials if "occlusionTexture" not in m]
    if missing:
        raise RuntimeError(f"{destination.name}: no occlusion on {', '.join(missing)}")

    coords = {m["occlusionTexture"].get("texCoord", 0) for m in materials}
    if coords != {1}:
        raise RuntimeError(f"{destination.name}: occlusion reads TEXCOORD {sorted(coords)}, want 1")


def bake_surface(obj, name: str, size: int = BAKE_SIZE):
    """Bake what real-time light cannot reach, and only that."""
    project_detail_uv(obj)
    unwrap_occlusion(obj)
    isolate_materials(obj)

    occlusion = bake_image(f"{name}_occlusion", size)
    bake_into(obj, occlusion)
    report_levels(name, occlusion)
    wire_occlusion(obj, occlusion)

    occlusion.pack()
    print(f"[exterior] {name} polys: {len(obj.data.polygons)}")
    return obj


def build_asset() -> None:
    """Bake the construction state first, then strike it and bake the building."""
    target = collection()
    parts = build_geometry(target)
    site = build_site(target)
    construction = build_construction(target)
    candidates = build_candidates(target)
    fill = build_slot_fill(target)

    apply_palette(parts)
    apply_palette(site)
    apply_palette(construction)
    apply_palette(fill)
    for panel in candidates:
        apply_palette(panel)
    light_scene(target)

    panels = []
    for index, panel in enumerate(candidates):
        label = CANDIDATE_BUILDERS[index][0]
        obj = join_all(panel.all(), f"candidate_{index + 1}_{label}")
        bake_surface(obj, f"candidate_{index + 1}", CANDIDATE_BAKE)
        panels.append(obj)
    export(panels, CANDIDATE_OUTPUT)
    for obj in panels:
        bpy.data.objects.remove(obj, do_unlink=True)

    filled = join_all(fill.all(), "facade_slot_fill")
    bake_surface(filled, "slot_fill", CANDIDATE_BAKE)
    export(filled, SLOT_FILL_OUTPUT)
    bpy.data.objects.remove(filled, do_unlink=True)

    scaffold = join_all(construction.all(), "exterior_construction")
    bake_surface(scaffold, "construction")
    export(scaffold, CONSTRUCTION_OUTPUT)
    bpy.data.objects.remove(scaffold, do_unlink=True)

    building = join_all(parts.all(), "exterior_building")
    bake_surface(building, "exterior")
    export(building, OUTPUT)

    # Planting ships unbaked, with its own library materials. Unwrapping and
    # lightmapping thousands of alpha-mapped leaf cards would cost far more
    # than lighting them in the browser, and their leaf shadow is already in
    # the building's bake because they stood in the scene while it ran.
    export_planting(site)


def requested_views() -> list[str]:
    views = [name for name in POSES if f"--{name}" in sys.argv]
    if "--preview" in sys.argv and not views:
        views = ["exterior"]
    return views


# The zone's ground and paving maps are written by `tools/web_textures.py`.
# They used to be written here, which meant resizing six JPEGs required
# launching Blender and building an entire apartment block first — and none of
# the step ever needed `bpy`.
LUMA = (0.2126, 0.7152, 0.0722)


def apply_tint(image, color, amount: float = 1.0, relevel: bool = False) -> None:
    """Take luminance from the texture and hue from the palette."""
    import numpy

    pixels = numpy.empty(len(image.pixels), dtype=numpy.float32)
    image.pixels.foreach_get(pixels)
    rgba = pixels.reshape(-1, 4)

    weights = numpy.array(LUMA, dtype=numpy.float32)
    target = numpy.array(color[:3], dtype=numpy.float32)
    reference = float(numpy.dot(target, weights))
    if reference <= 0.0:
        return

    luma = rgba[:, :3] @ weights
    if relevel:
        mean = float(luma.mean())
        if mean > 0.0:
            luma = luma * (reference / mean)

    tinted = numpy.outer(luma / reference, target)
    rgba[:, :3] = numpy.clip(rgba[:, :3] * (1.0 - amount) + tinted * amount, 0.0, 1.0)

    image.pixels.foreach_set(rgba.reshape(-1))


def export_planting(site: Parts) -> None:
    flora = site.get("flora", [])
    if not flora:
        return
    # Unbaked, and so carrying no occlusion. Unwrapping and baking thousands of
    # alpha-mapped leaf cards would cost far more than lighting them in the
    # browser, and their leaf shadow already reaches the building through the
    # real-time shadow map.
    simplify_flora(flora)
    export(flora, PLANTING_OUTPUT, occluded=False)


def main() -> None:
    if "--planting" in sys.argv:
        target = collection()
        site = build_site(target)
        apply_palette(site)
        export_planting(site)
        return

    views = requested_views()
    if views:
        preview()
        for name in views:
            render_preview(name)
        return

    build_asset()
    save_blend()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(f"[exterior] FAILED: {error}", file=sys.stderr)
        raise
