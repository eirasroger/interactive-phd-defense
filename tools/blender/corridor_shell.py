"""Act II museum: an enfilade of galleries carved from one solid, per src/config/corridorPlan.json."""

from __future__ import annotations

import json
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
WING = PLAN["wing"]

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

WING_DEPTH = WING["depth"]
WING_ALCOVE = WING["alcove"]
WING_INSET = WING["inset"]
WING_RETURN = WING["return"]

# Cutters must never stop flush on a surface: learnings.md §37.
BLEED = 0.05

WEST, EAST = -1.0, 1.0

PALETTE = {
    "floor": ((0.560, 0.452, 0.318, 1.0), 0.50, 0.0),
    "slat": ((0.318, 0.208, 0.108, 1.0), 0.46, 0.0),
    "plaster": ((0.795, 0.780, 0.752, 1.0), 0.92, 0.0),
    "ceiling": ((0.838, 0.828, 0.808, 1.0), 0.94, 0.0),
    "bronze": ((0.052, 0.050, 0.048, 1.0), 0.34, 0.90),
    "recess": ((0.048, 0.040, 0.034, 1.0), 0.86, 0.0),
    "cove": ((0.0, 0.0, 0.0, 1.0), 1.0, 0.0),
    "wash": ((0.0, 0.0, 0.0, 1.0), 1.0, 0.0),
}

# Fourth field False = relief only, no diffuse: see learnings.md §48.
DETAIL = {
    "floor": ("herringbone_parquet", 3.40, 0.72),
    "slat": ("oak_veneer_01", 1.60, 0.70),
    "plaster": ("white_plaster_02", 0.85, 0.0, False),
    "ceiling": ("white_plaster_02", 1.05, 0.0, False),
}

COVE_COLOR = (1.0, 0.88, 0.70)
COVE_STRENGTH = 8.0
WASH_COLOR = (1.0, 0.95, 0.86)
WASH_STRENGTH = 9.0

SUN_VECTOR = Vector((-16.0, -40.0, 34.0))
SUN_ENERGY = 5.0
SUN_COLOR = (1.0, 0.94, 0.84)
SKY_COLOR = (0.66, 0.68, 0.70)
SKY_STRENGTH = 0.6

PREVIEW_VIEW = 'AgX'

DETAIL_SIZE = 1024
SHELL_SIZE = 4096
FITTING_SIZE = 2048
BAKE_SAMPLES = 384
LIGHT_TEXELS = 64
LID_SAMPLES = 192
LID_MIN, LID_MAX = 256, 2048

def surfaces() -> Surfaces:
    return Surfaces(
        TAG, PALETTE, DETAIL,
        {
            "cove": lambda: common.emissive_material("cove", COVE_COLOR, COVE_STRENGTH),
            "wash": lambda: common.emissive_material("wash", WASH_COLOR, WASH_STRENGTH),
        },
        size=DETAIL_SIZE, rough=False,
    )

class Wing:
    """A gallery's side volume: interior, one floor level, full-height opening."""

    def __init__(self, cell: "Cell", side: float, depth: float, inset: float):
        self.cell = cell
        self.side = side
        self.depth = depth
        self.y0 = cell.y0 + inset
        self.y1 = cell.y1 - inset
        self.near = cell.inner(side)
        self.far = self.near + side * depth

    def span(self, inward: float = 0.0, outward: float = 0.0) -> tuple[float, float]:
        a = self.near - self.side * inward
        b = self.far + self.side * outward
        return (min(a, b), max(a, b))

class Cell:
    """One member of the enfilade: a gallery, a link, or a flank of the cross."""

    def __init__(self, key: str, y0: float, y1: float, half: float, top: float,
                 centre: float = 0.0, opens: tuple[float, ...] = (),
                 wings: tuple[tuple[float, float, float], ...] = (),
                 washes: tuple[float, ...] = (), panels: tuple[float, ...] = ()):
        self.key = key
        self.y0 = y0
        self.y1 = y1
        self.half = half
        self.top = top
        self.centre = centre
        self.opens = opens
        self.washes = washes
        self.panels = panels
        self.wings = [Wing(self, side, depth, inset) for side, depth, inset in wings]

    def inner(self, side: float) -> float:
        return self.centre + side * self.half

    def reach(self) -> tuple[float, float]:
        low, high = self.centre - self.half, self.centre + self.half
        for wing in self.wings:
            low, high = min(low, wing.far), max(high, wing.far)
        return low, high

def enfilade() -> list[Cell]:
    """Wing count and side encode the figure: C1 west, C2 east, cross both, C5 symmetric."""
    half = ROOM_LENGTH / 2.0
    front, back = C34 - half, C34 + half
    side_wing = (WING_DEPTH, WING_RETURN)
    alcove = (WING_ALCOVE, WING_INSET)
    return [
        Cell("mouth", 0.0, NEST, MOUTH_HALF, LINK_TOP),
        Cell("entry", NEST, C1 - half, LINK_HALF, LINK_TOP),
        Cell("room1", C1 - half, C1 + half, ROOM_HALF, ROOM_TOP,
             wings=((WEST, *side_wing),), washes=(WEST,), panels=(EAST,)),
        Cell("link1", C1 + half, C2 - half, LINK_HALF, LINK_TOP),
        Cell("room2", C2 - half, C2 + half, ROOM_HALF, ROOM_TOP,
             wings=((EAST, *side_wing),), washes=(EAST,), panels=(WEST,)),
        Cell("link2", C2 + half, front, LINK_HALF, LINK_TOP),
        Cell("spine", front, back, SPINE_HALF, ROOM_TOP, opens=(WEST, EAST)),
        Cell("c3", front, back, ROOM_HALF, ROOM_TOP, centre=-LANE,
             opens=(EAST,), washes=(WEST,)),
        Cell("c4", front, back, ROOM_HALF, ROOM_TOP, centre=LANE,
             opens=(WEST,), washes=(EAST,)),
        Cell("link3", back, C5 - half, LINK_HALF, LINK_TOP),
        Cell("room5", C5 - half, RUN, ROOM_HALF, TERM_TOP,
             wings=((WEST, *alcove), (EAST, *alcove)),
             washes=(WEST, EAST), panels=(WEST, EAST)),
    ]

class Face:
    """A solid wall bounding a member's void, with the room on its inward side."""

    def __init__(self, cell: Cell, x: float, side: float, y0: float, y1: float,
                 wing: bool):
        self.cell = cell
        self.x = x
        self.side = side
        self.y0 = y0
        self.y1 = y1
        self.top = cell.top
        self.wing = wing
        self.washed = side in cell.washes
        self.panelled = side in cell.panels

    def band(self, near: float, far: float) -> tuple[float, float]:
        a, b = self.x - self.side * near, self.x - self.side * far
        return (min(a, b), max(a, b))

    def name(self, prefix: str) -> str:
        return f"{prefix}_{self.cell.key}_{'w' if self.side < 0 else 'e'}"

def faces(cell: Cell) -> list[Face]:
    """Fittings hang off walls that exist; a wing's far wall replaces its room's."""
    winged = {wing.side for wing in cell.wings}
    found = []
    for side in (WEST, EAST):
        if side in cell.opens or side in winged:
            continue
        found.append(Face(cell, cell.inner(side), side, cell.y0, cell.y1, False))
    for wing in cell.wings:
        found.append(Face(cell, wing.far, wing.side, wing.y0, wing.y1, True))
    return found

def solids(target, cells: list[Cell]) -> list:
    blocks = []
    for cell in cells:
        span = (cell.centre - cell.half - WALL, cell.centre + cell.half + WALL)
        blocks.append(add_span(
            target, f"mass_{cell.key}", span,
            (cell.y0 - WALL, cell.y1 + WALL), (BASE, cell.top)))
        for wing in cell.wings:
            blocks.append(add_span(
                target, f"mass_{cell.key}_{'w' if wing.side < 0 else 'e'}",
                wing.span(outward=WALL),
                (wing.y0 - WALL, wing.y1 + WALL), (BASE, cell.top)))
    return blocks

def voids(target, cells: list[Cell]) -> list:
    cutters = []
    for cell in cells:
        front = cell.y0 - (0.8 if cell.key == "mouth" else BLEED)
        low = cell.centre - cell.half - (BLEED if WEST in cell.opens else 0.0)
        high = cell.centre + cell.half + (BLEED if EAST in cell.opens else 0.0)
        cutters.append(add_span(
            target, f"void_{cell.key}", (low, high),
            (front, cell.y1 + BLEED), (FLOOR, cell.top + BLEED)))
        for wing in cell.wings:
            cutters.append(add_span(
                target, f"void_{cell.key}_{'w' if wing.side < 0 else 'e'}",
                wing.span(inward=BLEED),
                (wing.y0, wing.y1), (FLOOR, cell.top + BLEED)))
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

def clad(obj, palette: Surfaces) -> None:
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
    import bmesh

    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    open_edges = sum(1 for edge in mesh.edges if len(edge.link_faces) != 2)
    mesh.free()

    print(f"[{TAG}] shell {len(obj.data.polygons)} faces, {open_edges} open edges")
    if open_edges:
        raise RuntimeError(f"corridor shell is not watertight: {open_edges} open edges")

TROUGH = {
    "cove": (0.0, 0.50),
    "coveTop": (0.52, 0.34),
    "lip": (0.58, 0.68),
    "lipTop": (0.78, 0.02),
}
COVE = {
    "cove": (0.0, 0.20),
    "coveTop": (0.26, 0.14),
    "lip": (0.26, 0.34),
    "lipTop": (0.40, 0.02),
}

BASE_REVEAL = (0.022, 0.045)

def build_fittings(parts: Parts, target, cells: list[Cell]) -> None:
    """Bronze shadow gap at the floor; concealed cove at the head of every wall."""
    for cell in cells:
        for face in faces(cell):
            spec = TROUGH if face.washed else COVE
            key = "wash" if face.washed else "cove"
            inset = 0.34 if face.washed else 0.2

            depth, height = BASE_REVEAL
            parts.put("bronze", add_span(
                target, face.name("base"), face.band(0.0, depth),
                (face.y0, face.y1), (FLOOR, FLOOR + height)))

            near, far = spec["cove"]
            high, low = spec["coveTop"]
            parts.put(key, add_span(
                target, face.name("cove"), face.band(near, far),
                (face.y0 + inset, face.y1 - inset),
                (face.top - high, face.top - low)))

            near, far = spec["lip"]
            high, low = spec["lipTop"]
            parts.put("plaster", add_span(
                target, face.name("lip"), face.band(near, far),
                (face.y0 + inset, face.y1 - inset),
                (face.top - high, face.top - low)))

PANEL = {
    "pitch": 0.20,
    "width": 0.135,
    "backing": 0.012,
    "proud": 0.032,
    "foot": 0.055,
    "margin": 0.35,
    "reach": 3.4,
}

def build_panelling(parts: Parts, target, cells: list[Cell]) -> None:
    """Oak boarding on the quiet flank, opposite where the contribution lives."""
    for cell in cells:
        for face in faces(cell):
            if not face.panelled:
                continue
            spec = TROUGH if face.washed else COVE
            head = min(face.top - spec["lipTop"][0] - 0.06, FLOOR + PANEL["reach"])
            foot = FLOOR + PANEL["foot"]
            y0, y1 = face.y0 + PANEL["margin"], face.y1 - PANEL["margin"]

            parts.put("recess", add_span(
                target, face.name("backing"), face.band(0.0, PANEL["backing"]),
                (y0, y1), (foot - 0.03, head)))

            span = face.band(PANEL["backing"], PANEL["backing"] + PANEL["proud"])
            count = int((y1 - y0 - PANEL["width"]) / PANEL["pitch"])
            for index in range(count + 1):
                y = y0 + index * PANEL["pitch"]
                parts.put("slat", add_span(
                    target, f"{face.name('board')}_{index}", span,
                    (y, y + PANEL["width"]), (foot, head)))

# `into` seats the strip inside the lid so it cannot light the soffit: §49.
CEILING = {"width": 0.14, "high": 0.045, "into": 0.02, "pitch": 3.2, "inset": 0.9}

def bays(low: float, high: float, pitch: float) -> list[float]:
    count = max(1, int(round((high - low) / pitch)))
    step = (high - low) / (count + 1)
    return [low + step * (index + 1) for index in range(count)]

def build_ceiling_light(parts: Parts, target, cells: list[Cell]) -> None:
    """Recessed linear light, one rank per bay. On the shell, so the rise keeps it."""
    for cell in cells:
        rooms = [(cell.centre - cell.half, cell.centre + cell.half, cell.y0, cell.y1)]
        for wing in cell.wings:
            low, high = wing.span()
            rooms.append((low, high, wing.y0, wing.y1))

        for index, (low, high, y0, y1) in enumerate(rooms):
            for order, x in enumerate(bays(low, high, CEILING["pitch"])):
                parts.put("cove", add_span(
                    target, f"strip_{cell.key}_{index}_{order}",
                    (x - CEILING["width"] / 2.0, x + CEILING["width"] / 2.0),
                    (y0 + CEILING["inset"], y1 - CEILING["inset"]),
                    (cell.top - CEILING["high"], cell.top + CEILING["into"])))

TERMINAL = {
    "downstand": (1.25, 1.05),
    "drop": 1.5,
    "cove": (1.0, 0.25),
    "coveTop": (0.16, 0.06),
}

def build_terminal(parts: Parts, target, cell: Cell) -> None:
    """C5's end wall, washed head-on from a slot behind a downstand."""
    span = (cell.centre - cell.half, cell.centre + cell.half)

    near, far = TERMINAL["downstand"]
    parts.put("plaster", add_span(
        target, "terminal_downstand", span,
        (cell.y1 - near, cell.y1 - far),
        (cell.top - TERMINAL["drop"], cell.top)))

    near, far = TERMINAL["cove"]
    high, low = TERMINAL["coveTop"]
    parts.put("wash", add_span(
        target, "terminal_cove", span,
        (cell.y1 - near, cell.y1 - far),
        (cell.top - high, cell.top - low)))

def build_lids(target, cells: list[Cell]) -> list:
    """One lid per member, oversailing only where a wall exists so none overlap: §50."""
    covers = []
    for cell in cells:
        low, high = cell.reach()
        parts = Parts()
        parts.put("ceiling", add_span(
            target, f"lid_{cell.key}",
            (low - (0.0 if WEST in cell.opens else WALL),
             high + (0.0 if EAST in cell.opens else WALL)),
            (cell.y0 - WALL, cell.y1 + WALL),
            (cell.top, cell.top + LID)))
        covers.append((cell.key, parts))
    return covers

def build_geometry(target) -> tuple:
    cells = enfilade()
    shell = carve(target, cells)

    parts = Parts()
    build_fittings(parts, target, cells)
    build_ceiling_light(parts, target, cells)
    build_panelling(parts, target, cells)
    build_terminal(parts, target, cells[-1])

    covers = build_lids(target, cells)

    for key, group in parts.items():
        if key in ("cove", "wash"):
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
        low, high = cell.reach()
        wings = "".join("w" if wing.side < 0 else "e" for wing in cell.wings)
        print(f"[{TAG}]   {cell.key:<7} y {cell.y0:6.2f}..{cell.y1:6.2f}  "
              f"x {low:6.2f}..{high:6.2f}  top {cell.top:.2f}  "
              f"wings {wings or '-':<2} faces {len(faces(cell))}")

EYE = FLOOR + 1.58

SHOT_FOV = 54.0

def square_on(y: float, wall_x: float) -> dict:
    """Mirrors `shotAt` in src/config/corridor.ts; SHOT_FOV is its `SHOT.fov`."""
    return {
        "location": Vector((0.0, y, EYE)),
        "target": Vector((wall_x, y, EYE)),
        "fov": SHOT_FOV,
    }

WING_WALL = ROOM_HALF + WING_DEPTH

POSES = {
    "mouth": {
        "location": Vector((0.0, 0.9, EYE)),
        "target": Vector((0.0, 24.0, EYE - 0.13)),
        "fov": 56.0,
    },
    "c1": square_on(C1, WEST * WING_WALL),
    "c2": square_on(C2, EAST * WING_WALL),
    "cross": square_on(C34, WEST * CROSS_HALF),
    "c4": square_on(C34, EAST * CROSS_HALF),
    "c5": {
        "location": Vector((0.0, C5, EYE)),
        "target": Vector((0.0, RUN, EYE)),
        "fov": SHOT_FOV,
    },
    "plan": {
        "location": Vector((-38.0, RUN / 2.0, 44.0)),
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
    clad(shell, palette)
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
        common.render(TAG, target, name, POSES[name], samples=96, view=PREVIEW_VIEW)

def build_asset() -> None:
    _, parts, covers, shell, palette = scene()

    # Lids stay in the scene for the shell bake, or the galleries bake open-topped.
    ceiling = [common.join_all(cover.all(), f"lid_{index:02d}_{key}")
               for index, (key, cover) in enumerate(covers)]

    # Shell and joinery take separate atlases: packing is per-island, and the
    # joinery is thousands of small ones that would crowd out the galleries.
    fittings = common.join_all(parts.all(), "corridor_fittings")

    gain = common.bake_lightmap(palette, shell, "shell", SHELL_SIZE, BAKE_SAMPLES)
    common.bake_lightmap(palette, fittings, "fittings", FITTING_SIZE, BAKE_SAMPLES, gain=gain)
    for lid in ceiling:
        size = common.atlas_size(common.surface_area(lid), LIGHT_TEXELS, LID_MIN, LID_MAX)
        common.bake_lightmap(palette, lid, lid.name, size, LID_SAMPLES, gain=gain)

    whole = common.join_all([shell, fittings], "corridor_shell")

    common.export(TAG, ceiling, CEILING_OUTPUT)
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
