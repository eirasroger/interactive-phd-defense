"""Act II corridor: an enfilade carved out of one solid, from src/config/corridorPlan.json."""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

sys.path.append(str(Path(__file__).resolve().parent))

import common
from common import Parts, Surfaces, add_span

TAG = "corridor"
SCENE = "corridor_build"
COLLECTION = "corridor"

SHELL_OUTPUT = common.MODELS / "corridor-shell.glb"
CEILING_OUTPUT = common.MODELS / "corridor-ceiling.glb"
BLEND = common.WORK / "corridor_shell.blend"

PLAN = json.loads((common.CONFIG / "corridorPlan.json").read_text())

SCALE = PLAN["metresPerUnit"]
SECTION = PLAN["section"]
FLOW = PLAN["flow"]
GARDEN = PLAN["garden"]
OPENING = PLAN["opening"]


def metres(units: float) -> float:
    return units * SCALE


def station(column: int) -> float:
    return metres(PLAN["columnX"][column] + PLAN["box"]["width"] / 2.0) + PLAN["lead"]


def lane(key: str) -> float:
    return metres(PLAN["laneY"][key] - PLAN["laneY"]["axis"])


ROOM_LENGTH = metres(PLAN["box"]["width"])
ROOM_HALF = metres(PLAN["box"]["height"]) / 2.0
LANE = abs(lane("high"))

C1, C2, C34, C5 = station(0), station(1), station(2), station(3)
RUN = C5 + ROOM_LENGTH / 2.0
CROSS_HALF = LANE + ROOM_HALF
SPINE_HALF = LANE - ROOM_HALF

FLOOR = SECTION["floor"]
BASE = FLOOR - 0.45
NEST = SECTION["nest"]
MOUTH_HALF = SECTION["mouthWidth"] / 2.0
LINK_HALF = SECTION["linkWidth"] / 2.0

LINK_TOP = FLOOR + SECTION["linkHeight"]
ROOM_TOP = FLOOR + SECTION["roomHeight"]
TERM_TOP = FLOOR + SECTION["terminalHeight"]

WALL = 0.30
LID = 0.22
DADO = FLOOR + 0.52

FLOW_LOW = FLOOR + FLOW["sill"]
FLOW_HIGH = FLOOR + FLOW["head"]

GARDEN_DEPTH = GARDEN["depth"]
GARDEN_WALL = GARDEN["wall"]
GARDEN_MARGIN = GARDEN["margin"]

OPENING_HEAD = OPENING["head"]
OPENING_RETURN = OPENING["return"]

# Cutters overlap what they cut. `learnings.md` §37: a boolean whose cutter ends
# flush with an existing face reports success and does nothing, so nothing here
# is ever allowed to stop exactly on a surface.
BLEED = 0.05

WEST, EAST = -1.0, 1.0

# Premium reads as restraint, not as material. Panelling a whole room in oak is
# a nineties boardroom; the same oak seen only in the thresholds, against pale
# stone and slim dark metal, is a detail you notice. The rooms are quiet and the
# links are warm, and the ratio is the point.
PALETTE = {
    "floor": ((0.402, 0.276, 0.152, 1.0), 0.40, 0.0),
    "slat": ((0.318, 0.208, 0.108, 1.0), 0.46, 0.0),
    "plaster": ((0.402, 0.386, 0.358, 1.0), 0.92, 0.0),
    "ceiling": ((0.512, 0.496, 0.468, 1.0), 0.94, 0.0),
    "bronze": ((0.052, 0.050, 0.048, 1.0), 0.34, 0.90),
    "garden": ((0.352, 0.338, 0.316, 1.0), 0.94, 0.0),
    "soil": ((0.082, 0.062, 0.044, 1.0), 0.96, 0.0),
    "glass": ((0.042, 0.050, 0.056, 1.0), 0.04, 0.0),
    "cove": ((0.0, 0.0, 0.0, 1.0), 1.0, 0.0),
    "recess": ((0.062, 0.060, 0.058, 1.0), 0.58, 0.0),
}

DETAIL = {
    "floor": ("oak_veneer_01", 2.30, 0.66),
    "slat": ("oak_veneer_01", 1.60, 0.70),
    "soil": ("park_dirt", 2.00, 0.70),
}

GLASS_ALPHA = 0.10
COVE_COLOR = (1.0, 0.86, 0.66)
COVE_STRENGTH = 3.0
GARDEN_COLOR = (1.0, 0.97, 0.90)
GARDEN_EMISSION = 0.16

SUN_VECTOR = Vector((-16.0, -40.0, 34.0))
SUN_ENERGY = 5.0
SUN_COLOR = (1.0, 0.94, 0.84)
SKY_COLOR = (0.66, 0.68, 0.70)
SKY_STRENGTH = 4.6

PREVIEW_VIEW = 'AgX'

DETAIL_SIZE = 1024
# 2048, not 4096. This atlas carries occlusion only — a low-frequency term
# that is happy at any density — and 4096 is four times the upload for a
# difference no projector resolves. The upload lands in one frame when the
# zone is warmed, so its size is a smoothness decision, not a sharpness one.
BAKE_SIZE = 2048
BAKE_SAMPLES = 256
AO_DISTANCE = 3.0


def daylit(palette: Surfaces):
    """A sunlit garden wall has to look bright; nothing in a rasteriser lights it."""
    def build():
        material = common.principled("garden", *PALETTE["garden"])
        bsdf = material.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Emission Color"].default_value = (*GARDEN_COLOR, 1.0)
        bsdf.inputs["Emission Strength"].default_value = GARDEN_EMISSION
        return material
    return build


def surfaces() -> Surfaces:
    palette = Surfaces(
        TAG, PALETTE, DETAIL,
        {
            "glass": lambda: common.glazing_material("glass", PALETTE["glass"][0], GLASS_ALPHA),
            "cove": lambda: common.emissive_material("cove", COVE_COLOR, COVE_STRENGTH),
        },
        size=DETAIL_SIZE, rough=False,
    )
    palette.specials["garden"] = daylit(palette)
    return palette


class Cell:
    """One member of the enfilade: a room, a link, or a flank of the cross."""

    def __init__(self, key: str, y0: float, y1: float, half: float, top: float,
                 opens: float = 0.0, centre: float = 0.0, garden: float = 0.0):
        self.key = key
        self.y0 = y0
        self.y1 = y1
        self.half = half
        self.top = top
        self.opens = opens
        self.centre = centre
        self.garden = garden

    def inner(self, side: float) -> float:
        return self.centre + side * self.half


def enfilade() -> list[Cell]:
    """Rooms on the figure's columns, links in the gaps. Gardens alternate sides."""
    half = ROOM_LENGTH / 2.0
    front, back = C34 - half, C34 + half
    return [
        Cell("mouth", 0.0, NEST, MOUTH_HALF, LINK_TOP),
        Cell("entry", NEST, C1 - half, LINK_HALF, LINK_TOP),
        Cell("room1", C1 - half, C1 + half, ROOM_HALF, ROOM_TOP, garden=WEST),
        Cell("link1", C1 + half, C2 - half, LINK_HALF, LINK_TOP),
        Cell("room2", C2 - half, C2 + half, ROOM_HALF, ROOM_TOP, garden=EAST),
        Cell("link2", C2 + half, front, LINK_HALF, LINK_TOP),
        Cell("spine", front, back, SPINE_HALF, LINK_TOP, opens=1.0),
        Cell("c3", front, back, ROOM_HALF, ROOM_TOP, WEST, -LANE, WEST),
        Cell("c4", front, back, ROOM_HALF, ROOM_TOP, EAST, LANE, EAST),
        Cell("link3", back, C5 - half, LINK_HALF, LINK_TOP),
        Cell("room5", C5 - half, RUN, ROOM_HALF, TERM_TOP, garden=WEST),
    ]


def opening_span(cell: Cell) -> tuple[float, float, float]:
    """The garden opening: how far along the room, and how high."""
    return cell.y0 + OPENING_RETURN, cell.y1 - OPENING_RETURN, cell.top - OPENING_HEAD


# --------------------------------------------------------------------------
# the shell, carved rather than assembled
# --------------------------------------------------------------------------


def solids(target, cells: list[Cell]) -> list:
    """The mass the corridor is cut out of: every cell grown by a wall thickness."""
    blocks = []
    for cell in cells:
        if cell.key in ("c3", "c4"):
            reach = CROSS_HALF + WALL
            span = (-reach, reach)
        else:
            span = (cell.centre - cell.half - WALL, cell.centre + cell.half + WALL)
        blocks.append(add_span(
            target, f"mass_{cell.key}", span,
            (cell.y0 - WALL, cell.y1 + WALL), (BASE, cell.top)))
    return blocks


def voids(target, cells: list[Cell]) -> list:
    """What the camera can stand in, plus the openings out of it."""
    cutters = []
    for cell in cells:
        front = cell.y0 - (0.8 if cell.key == "mouth" else BLEED)
        cutters.append(add_span(
            target, f"void_{cell.key}",
            (cell.centre - cell.half, cell.centre + cell.half),
            (front, cell.y1 + BLEED), (FLOOR, cell.top + BLEED)))

        if not cell.garden:
            continue
        y0, y1, head = opening_span(cell)
        side = cell.garden
        near = cell.inner(side) - side * BLEED
        far = cell.inner(side) + side * (WALL + BLEED)
        cutters.append(add_span(
            target, f"open_{cell.key}", (min(near, far), max(near, far)),
            (y0, y1), (FLOOR, head)))
    return cutters


def combine(objects: list, name: str, operation: str):
    base = objects[0]
    base.name = name
    for other in objects[1:]:
        modifier = base.modifiers.new(name="join", type="BOOLEAN")
        modifier.operation = operation
        modifier.object = other
        modifier.solver = 'EXACT'
        with bpy.context.temp_override(object=base, active_object=base,
                                       selected_objects=[base]):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.data.objects.remove(other, do_unlink=True)
    return base


def carve(target, cells: list[Cell]):
    """One watertight shell. Nothing overlaps because nothing is stacked."""
    mass = combine(solids(target, cells), "corridor_shell", 'UNION')
    cavity = combine(voids(target, cells), "corridor_void", 'UNION')

    modifier = mass.modifiers.new(name="carve", type="BOOLEAN")
    modifier.operation = 'DIFFERENCE'
    modifier.object = cavity
    modifier.solver = 'EXACT'
    with bpy.context.temp_override(object=mass, active_object=mass, selected_objects=[mass]):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    bpy.data.objects.remove(cavity, do_unlink=True)
    return mass


SHELL_KEYS = ("floor", "plaster", "ceiling")


def clad(obj, palette: Surfaces, cells: list[Cell]) -> None:
    """Three surfaces and one rule: you walk on wood, walls are walls, up is lighter.

    Wood is the floor and only the floor — one continuous plane the whole
    length. Changing material every three metres was the thing that made no
    sense; a floor you can follow from the door to C5 is what makes it one
    building.
    """
    obj.data.materials.clear()
    for key in SHELL_KEYS:
        obj.data.materials.append(palette.material(key))

    for polygon in obj.data.polygons:
        if polygon.normal.z > 0.5 and polygon.center.z < FLOOR + 0.02:
            polygon.material_index = 0
        elif polygon.normal.z < -0.5:
            polygon.material_index = 2
        else:
            polygon.material_index = 1


def verify(obj) -> None:
    """A carved shell either encloses the axis or it does not — ask it."""
    import bmesh

    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    open_edges = sum(1 for edge in mesh.edges if len(edge.link_faces) != 2)
    mesh.free()

    print(f"[{TAG}] shell {len(obj.data.polygons)} faces, {open_edges} open edges")
    if open_edges:
        raise RuntimeError(f"corridor shell is not watertight: {open_edges} open edges")


# --------------------------------------------------------------------------
# what is not carved
# --------------------------------------------------------------------------


def build_lids(target, cells: list[Cell]) -> list:
    """The only rigged geometry in the zone: one lid per member of the enfilade."""
    covers = []
    for cell in cells:
        if cell.key in ("c3", "c4"):
            span = (-(CROSS_HALF + WALL), CROSS_HALF + WALL)
        else:
            span = (cell.centre - cell.half - WALL, cell.centre + cell.half + WALL)
        parts = Parts()
        parts.put("ceiling", add_span(
            target, f"lid_{cell.key}", span, (cell.y0 - WALL, cell.y1 + WALL),
            (cell.top, cell.top + LID)))
        covers.append((cell.key, parts))
    return covers


def build_fittings(parts: Parts, target, cells: list[Cell]) -> None:
    """A bronze rail at the dado, and light from a slot you cannot see into."""
    for cell in cells:
        for side in (WEST, EAST):
            if cell.opens == side or cell.key == "spine" or cell.garden == side:
                continue
            inner = cell.inner(side)
            dado = min(DADO, cell.top - 0.4)
            parts.put("bronze", add_span(
                target, f"rail_{cell.key}_{'w' if side < 0 else 'e'}",
                (min(inner, inner + side * 0.03), max(inner - side * 0.045, inner + side * 0.03)),
                (cell.y0, cell.y1), (dado, dado + 0.05)))
            parts.put("cove", add_span(
                target, f"cove_{cell.key}_{'w' if side < 0 else 'e'}",
                (min(inner, inner + side * 0.03), max(inner - side * 0.07, inner + side * 0.03)),
                (cell.y0 + 0.2, cell.y1 - 0.2), (cell.top - 0.20, cell.top - 0.12)))
            parts.put("plaster", add_span(
                target, f"lip_{cell.key}_{'w' if side < 0 else 'e'}",
                (min(inner - side * 0.10, inner - side * 0.17),
                 max(inner - side * 0.10, inner - side * 0.17)),
                (cell.y0 + 0.2, cell.y1 - 0.2), (cell.top - 0.30, cell.top - 0.02)))




SLAT = {"pitch": 0.21, "width": 0.055, "proud": 0.055}


def build_slats(parts: Parts, target, cells: list[Cell]) -> None:
    """A battened wall opposite each garden — the one piece of joinery in here."""
    for cell in cells:
        if not cell.garden:
            continue
        side = -cell.garden
        inner = cell.inner(side)
        face = (min(inner, inner - side * SLAT["proud"]),
                max(inner, inner - side * SLAT["proud"]))
        top = min(cell.top - 0.28, FLOOR + 3.1)
        count = int((cell.y1 - cell.y0 - 0.8) / SLAT["pitch"])
        start = cell.y0 + 0.4
        for index in range(count + 1):
            y = start + index * SLAT["pitch"]
            parts.put("slat", add_span(
                target, f"slat_{cell.key}_{index}", face,
                (y, y + SLAT["width"]), (FLOOR, top)))


def build_glazing(parts: Parts, target, cells: list[Cell]) -> None:
    for cell in cells:
        if not cell.garden:
            continue
        y0, y1, head = opening_span(cell)
        seat = cell.inner(cell.garden) + cell.garden * (WALL - 0.06)
        parts.put("glass", add_span(
            target, f"glass_{cell.key}",
            (min(seat, seat + cell.garden * 0.04), max(seat, seat + cell.garden * 0.04)),
            (y0, y1), (FLOOR, head)))


GREEN_BAYS = 7
GREEN_RELIEF = 0.16


def build_gardens(parts: Parts, target, cells: list[Cell]) -> None:
    """A living wall, not a scatter of shrubs.

    Loose planting in five gardens is five chances for a library asset to land
    at the wrong size in the wrong place, and it read as weeds in a yard. A
    planted wall is one surface: it is always the right size, it fills the
    opening edge to edge, and its depth comes from stepping the panels rather
    than from anything the library has to get right.
    """
    for cell in cells:
        if not cell.garden:
            continue
        side = cell.garden
        near = cell.inner(side) + side * WALL
        far = near + side * GARDEN_DEPTH
        y0, y1 = cell.y0 - GARDEN_MARGIN, cell.y1 + GARDEN_MARGIN

        parts.put("soil", add_span(
            target, f"garden_{cell.key}_ground",
            (min(near, far), max(near, far)), (y0, y1), (BASE, FLOOR - 0.18)))
        parts.put("garden", add_span(
            target, f"garden_{cell.key}_back",
            (min(far, far + side * 0.3), max(far, far + side * 0.3)),
            (y0 - 0.3, y1 + 0.3), (BASE, GARDEN_WALL)))
        for index, (a, b) in enumerate(((y0 - 0.3, y0), (y1, y1 + 0.3))):
            parts.put("garden", add_span(
                target, f"garden_{cell.key}_end_{index}",
                (min(near, far + side * 0.3), max(near, far + side * 0.3)),
                (a, b), (BASE, GARDEN_WALL)))

        # The living wall is not here yet, and a flat green panel is worse than
        # none: Poly Haven has no ivy or green-wall map, and a lawn texture
        # turned on its side reads as a mustard field. The garden is stepped
        # masonry until it can be planted properly.
        step = (y1 - y0) / GREEN_BAYS
        for index in range(GREEN_BAYS):
            depth = GREEN_RELIEF * (0.35 + 0.65 * ((index * 5) % GREEN_BAYS) / GREEN_BAYS)
            face = far - side * depth
            parts.put("garden", add_span(
                target, f"relief_{cell.key}_{index}",
                (min(face, far), max(face, far)),
                (y0 + step * index, y0 + step * (index + 1)),
                (FLOOR - 0.18, GARDEN_WALL - 0.35)))


# Two species, two variants each. Every extra variant is a distinct mesh in
# the GLB and therefore its own draw call once the runtime batches them, and
# at this density nobody can tell four ferns from forty.
def build_geometry(target) -> tuple:
    cells = enfilade()
    shell = carve(target, cells)

    parts = Parts()
    build_fittings(parts, target, cells)
    build_slats(parts, target, cells)
    build_glazing(parts, target, cells)
    build_gardens(parts, target, cells)

    covers = build_lids(target, cells)

    for key, group in parts.items():
        if key in ("glass", "cove"):
            continue
        for obj in group:
            common.bevel(obj)
    for _, cover in covers:
        for obj in cover.all():
            common.bevel(obj)

    return parts, covers, shell


def light_scene(target) -> None:
    common.add_sun(target, SUN_VECTOR, SUN_ENERGY, SUN_COLOR)
    common.set_sky("corridor_sky", SKY_COLOR, SKY_STRENGTH)


def report(cells: list[Cell]) -> None:
    print(f"[{TAG}] room {ROOM_LENGTH:.2f} x {ROOM_HALF * 2:.2f} m, "
          f"link {LINK_HALF * 2:.2f} m, run {RUN:.2f} m")
    for cell in cells:
        note = "garden" if cell.garden else ("open" if cell.opens else "")
        print(f"[{TAG}]   {cell.key:<7} y {cell.y0:6.2f}..{cell.y1:6.2f}  "
              f"half {cell.half:.2f}  top {cell.top:.2f}  {note}")


POSES = {
    "mouth": {
        "location": Vector((0.0, 0.9, FLOOR + 1.58)),
        "target": Vector((0.0, 24.0, FLOOR + 1.45)),
        "fov": 56.0,
    },
    "link": {
        "location": Vector((0.0, C1 + ROOM_LENGTH / 2.0 - 1.0, FLOOR + 1.58)),
        "target": Vector((0.0, C2 - 2.0, FLOOR + 1.50)),
        "fov": 56.0,
    },
    "c2": {
        "location": Vector((0.0, C2 - ROOM_LENGTH / 2.0 + 0.6, FLOOR + 1.58)),
        "target": Vector((1.4, C2 + 4.0, FLOOR + 1.42)),
        "fov": 56.0,
    },
    "c1": {
        "location": Vector((0.0, C1 - ROOM_LENGTH / 2.0 + 0.6, FLOOR + 1.58)),
        "target": Vector((-1.4, C1 + 4.0, FLOOR + 1.42)),
        "fov": 56.0,
    },
    "cross": {
        "location": Vector((1.1, C34 - 2.2, FLOOR + 1.58)),
        "target": Vector((-7.0, C34 + 1.4, FLOOR + 1.40)),
        "fov": 58.0,
    },
    "c5": {
        "location": Vector((0.0, C5 - ROOM_LENGTH / 2.0 + 0.6, FLOOR + 1.58)),
        "target": Vector((-1.6, C5 + 4.0, FLOOR + 1.90)),
        "fov": 56.0,
    },
    "plan": {
        "location": Vector((-32.0, RUN / 2.0, 38.0)),
        "target": Vector((0.0, RUN / 2.0, 0.0)),
        "fov": 42.0,
    },
}


def scene():
    target = common.collection(SCENE, COLLECTION)
    cells = enfilade()
    parts, covers, shell = build_geometry(target)
    palette = surfaces()
    palette.apply(parts)
    for _, cover in covers:
        palette.apply(cover)
    clad(shell, palette, cells)
    palette.project(shell)
    light_scene(target)
    report(cells)
    verify(shell)
    return target, parts, covers, shell, palette


def preview(views: list[str]) -> None:
    target, _, covers, _, _ = scene()
    lifted = [obj for _, cover in covers for obj in cover.all()]
    for name in views:
        for obj in lifted:
            obj.hide_render = name == "plan"
        common.render(TAG, target, name, POSES[name], samples=64, view=PREVIEW_VIEW)


def build_asset() -> None:
    target, parts, covers, shell, palette = scene()

    ceiling = [common.join_all(cover.all(), f"lid_{index:02d}_{key}")
               for index, (key, cover) in enumerate(covers)]
    common.export(TAG, ceiling, CEILING_OUTPUT, occluded=False)
    for obj in ceiling:
        bpy.data.objects.remove(obj, do_unlink=True)

    whole = common.join_all([shell] + parts.all(), "corridor_shell")
    common.bake_surface(palette, whole, "shell", BAKE_SIZE, BAKE_SAMPLES, AO_DISTANCE)
    common.export(TAG, whole, SHELL_OUTPUT)


def requested_views() -> list[str]:
    views = [name for name in POSES if f"--{name}" in sys.argv]
    if "--preview" in sys.argv and not views:
        views = ["c1", "cross", "c5"]
    return views


def main() -> None:
    views = requested_views()
    if views:
        preview(views)
        return

    build_asset()
    common.save_blend(BLEND)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(f"[{TAG}] FAILED: {error}", file=sys.stderr)
        raise
