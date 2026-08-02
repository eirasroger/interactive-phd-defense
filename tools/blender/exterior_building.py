"""Generate the Act I exterior building with two baked lighting states.

    blender --background --python tools/blender/exterior_building.py

Output: src/assets/models/exterior-building.glb

The building has to do something a static asset normally cannot: travel from an
unspecified massing model to a specified building over the course of Act I. It
does that with **one geometry and two bakes**.

    baseColorTexture  - specified. Concrete, glass, warm interiors, full GI.
    emissiveTexture   - massing. The same forms as white study-model card.

The web material mixes the two by a uniform, so the transition costs a texture
blend rather than a second mesh, and no transparency sorting is involved. It is
also the truer reading: a physical study model already has the reveals cut into
it, it simply is not made of anything yet.

Geometry notes:

- **Reveals are built, not cut.** Each volume is a core inset by REVEAL, wrapped
  in full-width spandrel bands. The gap between them is the window recess. No
  booleans, and the glazing self-shadows because the spandrel above genuinely
  overhangs it.
- **Edge conditions carry the realism.** Parapet caps, a plinth, a canopy and
  mullions with real depth. Buildings read as real through these long before
  anyone resolves a material.

Axis convention: glTF y-up export maps Blender (x, y, z) to (x, z, -y), so
Blender -Y is the web's +Z. The building faces -Y here, which is the direction
the camera approaches from in the web world.

Dimensions mirror src/world/exterior/site.ts. Blender (x, y, z) = web (x, -z, y).
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT = PROJECT_ROOT / "src" / "assets" / "models" / "exterior-building.glb"

COLLECTION = "exterior"
SCENE = "exterior_build"

BAKE_SIZE = 2048
BAKE_SAMPLES = 96

# Facade assembly. These are the numbers that decide whether the building reads
# as architecture or as boxes, so they are kept together and named.
# Reveal depth is a balance, not a free parameter. Deep enough and the glazing
# self-shadows convincingly; too deep and the jamb — the return face at each end
# of a ribbon, which no recessed window can be without — turns into an unlit
# black slot at every corner.
REVEAL = 0.18
SPANDREL_RATIO = 0.58  # share of a storey that is solid band
PIER = 1.1             # corner pier width
FIN_WIDTH = 0.16
FIN_DEPTH = 0.55       # projection proud of the facade
BAY = 3.6

# A string course at every floor line. Architecturally it ties the elevation
# together; practically its top face is the one horizontal surface inside the
# reveal, so it catches sky light and stops the recess reading as a void.
SILL_PROUD = 0.16
SILL_THICKNESS = 0.18
PARAPET_HEIGHT = 0.7
PARAPET_PROUD = 0.12
PLINTH_HEIGHT = 0.55
PLINTH_PROUD = 0.34

# Sun, matching EXTERIOR_ATMOSPHERE.keyOffset in the web world.
# blender (x, y, z) -> web (x, z, -y), so this is web [-58, 19, 22].
#
# Kept low and well round to the -X side: a sun near the camera's own axis
# flattens the massing, and a sun directly behind it throws the whole shadow out
# of frame. This rakes the two faces the camera sees and lays the shadow across
# the ground to the right, where it is visible.
# Elevation ~24°. At 9° the shadow cast by any projection is 6x its depth, so a
# 0.16 sill blacked out a whole glazing band and the corner piers read as holes.
# Shadow length scales as 1/tan(elevation), so this is the parameter that
# governs whether small architectural detail reads or swallows the facade.
SUN_VECTOR = Vector((-55.0, -21.0, 26.0))
# A COMBINED bake stores scene-referred radiance, not a tone-mapped image, so
# these are chosen for where they land in the texture rather than for how the
# preview looks. The face the camera sees takes the sun at about 0.34 incidence;
# at an albedo of 0.46 that puts the lit concrete near 0.5, shaded faces near
# 0.12, and leaves headroom before anything clips.
# The ratio between these two is the whole look. A sky that competes with the
# sun gives flat overcast daylight and a white styrofoam model; holding it well
# below leaves the sun to model the massing and lets the shaded faces go cool
# and dark, which is what dusk actually is.
# Absolute level is set by the *brightest* face, not the one being looked at.
# The face square to the sun takes it at 0.918 incidence; at energy 14 that
# baked to ~1.9 and clipped flat. Sun and sky drop together so the ratio — which
# is what the look depends on — is unchanged.
SUN_ENERGY = 4.0
SUN_COLOR = (1.0, 0.78, 0.55)
# The physical sky is far brighter than a flat colour at the same number. Left
# at 1.0 it washes out the lamp completely and the building loses every shadow.
SKY_STRENGTH = 0.087
SKY_COLOR = (0.20, 0.30, 0.46)  # fallback only, if the sky node is unavailable

# Windows are an accent, not a light source. At 2.4 they blew to white and took
# the entire facade with them; dusk photography sits them a little above the lit
# surface, not fifty times above it.
INTERIOR_COLOR = (1.0, 0.72, 0.42)
# Sits between sunlit concrete (~0.5) and shaded concrete (~0.08), so glazing
# reads as warm and occupied without becoming the brightest thing in frame. The
# web world dims the whole bake uniformly, so this ratio is what survives.
INTERIOR_STRENGTH = 0.22

# Warm grey, not white. A neutral high-albedo surface under a cool sky is
# exactly what reads as an untextured model.
CONCRETE = (0.40, 0.39, 0.37, 1.0)
# Card reads lighter than concrete but must still land inside the texture. At
# 0.80 the lit faces baked to ~1.25 radiance and clipped flat white in an 8-bit
# map, throwing away the shading that makes it a model rather than a silhouette.
CARD = (0.46, 0.46, 0.45, 1.0)

# size and location are given in Blender axes; levels 0 marks plant, which gets
# no floors and no glazing.
VOLUMES = [
    {"name": "podium", "size": (28.0, 20.0, 5.0), "location": (0.0, 0.0, 2.5), "levels": 1},
    {"name": "tower", "size": (14.0, 13.0, 13.0), "location": (-5.0, 1.0, 11.5), "levels": 4},
    {"name": "wing", "size": (10.0, 12.0, 5.5), "location": (8.0, -1.0, 7.75), "levels": 2},
    {"name": "plant", "size": (5.0, 5.0, 2.4), "location": (-5.0, 1.0, 19.2), "levels": 0},
]

ENTRANCE = {
    "width": 6.4,
    "height": 3.6,
    "setback": 1.5,
    "canopy_depth": 2.6,
    "canopy_thickness": 0.32,
}


# --------------------------------------------------------------------------
# scene plumbing
# --------------------------------------------------------------------------


def use_scene() -> bpy.types.Scene:
    """A dedicated scene, built from nothing.

    Run interactively, this script inherits whatever the open .blend was last
    used for — and scene-level state is not visible in the geometry. A session
    left over from the corridor bake had render settings that silently dropped
    both the sun and the world, which cost an hour to find and looked exactly
    like a modelling fault. Owning the scene removes the whole class of problem
    and makes the interactive path match `blender --background`.
    """
    scene = bpy.data.scenes.get(SCENE)
    if scene is None:
        scene = bpy.data.scenes.new(SCENE)
    if bpy.context.window:
        bpy.context.window.scene = scene
    return scene


def collection() -> bpy.types.Collection:
    """A dedicated collection, so running this never disturbs other work."""
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


def add_box(target, name: str, size, location):
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

    # Hand-wound faces are not reliably outward, and an inverted normal bakes as
    # a black facet. Recalculating is cheaper than getting the winding right by
    # inspection for every face.
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()

    obj.location = location
    target.objects.link(obj)
    return obj


def boolean_cut(obj, cutter) -> None:
    modifier = obj.modifiers.new(name="cut", type="BOOLEAN")
    modifier.operation = 'DIFFERENCE'
    modifier.object = cutter
    modifier.solver = 'EXACT'
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier=modifier.name)


def bevel(obj, width: float = 0.025, segments: int = 2) -> None:
    """A hard edge is the clearest tell that geometry is synthetic. Everything
    real has a radius, and at dusk the highlight it catches is most of what
    separates a building from a box."""
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


def storey_heights(volume) -> tuple[float, float, float]:
    height = volume["size"][2]
    levels = max(volume["levels"], 1)
    storey = height / levels
    spandrel = storey * SPANDREL_RATIO
    return storey, spandrel, storey - spandrel


def build_volume(target, volume) -> tuple[list, list]:
    """Returns (solid parts, glass parts)."""
    name = volume["name"]
    width, depth, height = volume["size"]
    cx, cy, cz = volume["location"]
    base = cz - height / 2.0
    levels = volume["levels"]

    solids: list = []
    glass: list = []

    if levels == 0:
        solids.append(add_box(target, f"{name}_solid", (width, depth, height), (cx, cy, cz)))
        solids.append(parapet(target, name, width, depth, cx, cy, base + height))
        return solids, glass

    storey, spandrel, glazing = storey_heights(volume)

    # The core is the wall the glazing sits against. Inset on all four sides, it
    # is what turns the spandrel bands into an overhang.
    solids.append(
        add_box(
            target,
            f"{name}_core",
            (width - 2 * REVEAL, depth - 2 * REVEAL, height),
            (cx, cy, cz),
        )
    )

    for level in range(levels):
        band_z = base + level * storey + spandrel / 2.0
        solids.append(
            add_box(target, f"{name}_spandrel_{level}", (width, depth, spandrel), (cx, cy, band_z))
        )

        glaze_z = base + level * storey + spandrel + glazing / 2.0
        glass.extend(glazing_ring(target, name, level, volume, glaze_z, glazing))

    solids.extend(sill_ring(target, volume))
    solids.extend(fin_ring(target, volume))

    for sign_x in (-1.0, 1.0):
        for sign_y in (-1.0, 1.0):
            solids.append(
                add_box(
                    target,
                    f"{name}_pier",
                    (PIER, PIER, height),
                    (
                        cx + sign_x * (width - PIER) / 2.0,
                        cy + sign_y * (depth - PIER) / 2.0,
                        cz,
                    ),
                )
            )

    solids.append(parapet(target, name, width, depth, cx, cy, base + height))
    return solids, glass


def parapet(target, name: str, width: float, depth: float, cx: float, cy: float, top: float):
    return add_box(
        target,
        f"{name}_parapet",
        (width + PARAPET_PROUD, depth + PARAPET_PROUD, PARAPET_HEIGHT),
        (cx, cy, top - PARAPET_HEIGHT / 4.0),
    )


def faces(volume):
    """The four facade planes: (span, plane offset, axis) per face."""
    width, depth, _ = volume["size"]
    cx, cy, _ = volume["location"]
    return [
        ("y", span := width - 2 * PIER, (cx, cy - depth / 2.0), depth),
        ("y", span, (cx, cy + depth / 2.0), depth),
        ("x", depth - 2 * PIER, (cx - width / 2.0, cy), width),
        ("x", depth - 2 * PIER, (cx + width / 2.0, cy), width),
    ]


def glazing_ring(target, name: str, level: int, volume, z: float, height: float) -> list:
    """Glass, set deep in the reveal.

    The glass carries its own emission rather than being lit by emitters placed
    behind it: the core is solid, so there is no interior for a light to sit in.
    An emissive pane bakes the same warm glow onto the surrounding reveal and
    still catches a specular highlight off the sky.
    """
    parts = []
    for index, (axis, span, plane, _) in enumerate(faces(volume)):
        if span <= 0:
            continue
        px, py = plane
        # Just proud of the core face, so it does not z-fight with it.
        inward = (REVEAL - 0.06) * (1.0 if index in (0, 2) else -1.0)
        if axis == "y":
            size = (span, 0.1, height)
            location = (px, py + inward, z)
        else:
            size = (0.1, span, height)
            location = (px + inward, py, z)
        parts.append(add_box(target, f"{name}_glass_{level}_{index}", size, location))
    return parts


def sill_ring(target, volume) -> list:
    """A continuous string course at each floor line, wrapping the volume."""
    name = volume["name"]
    width, depth, height = volume["size"]
    cx, cy, cz = volume["location"]
    base = cz - height / 2.0
    storey, spandrel, _ = storey_heights(volume)

    parts = []
    for level in range(volume["levels"]):
        z = base + level * storey + spandrel
        parts.append(
            add_box(
                target,
                f"{name}_sill_{level}",
                (width + 2 * SILL_PROUD, depth + 2 * SILL_PROUD, SILL_THICKNESS),
                (cx, cy, z),
            )
        )
    return parts


def fin_ring(target, volume) -> list:
    """Full-height vertical fins, proud of the facade.

    These do more for realism than any amount of surface detail. They give the
    elevation a rhythm at bay spacing, and because they project they catch the
    low sun and lay a hard shadow across the facade — which is the cue that
    reads as a real building rather than a textured box.
    """
    name = volume["name"]
    _, _, height = volume["size"]
    cz = volume["location"][2]
    parts = []

    for index, (axis, span, plane, _) in enumerate(faces(volume)):
        if span <= 0:
            continue
        px, py = plane
        outward = -FIN_DEPTH / 2.0 if index in (0, 2) else FIN_DEPTH / 2.0
        count = max(int(span // BAY), 1)
        step = span / count
        for i in range(1, count):
            offset = -span / 2.0 + i * step
            if axis == "y":
                size = (FIN_WIDTH, FIN_DEPTH, height)
                location = (px + offset, py + outward, cz)
            else:
                size = (FIN_DEPTH, FIN_WIDTH, height)
                location = (px + outward, py + offset, cz)
            parts.append(add_box(target, f"{name}_fin_{index}_{i}", size, location))
    return parts


def build_entrance(target, solids: list) -> tuple[list, list, list]:
    """A recessed entrance with a canopy, on the podium's -Y face.

    The opening is a real void, cut through the core, the ground-floor spandrel
    and the plinth. A recess faked by placing geometry in front of a solid wall
    reads as a sticker at exactly the angle the camera arrives from, and this is
    the one shot in the act that is square to the facade.

    The canopy is doing more work than it looks: it is the only element that
    projects far enough to throw a shadow across the facade, which is what tells
    the eye there is a real sun.
    """
    podium = VOLUMES[0]
    _, depth, _ = podium["size"]
    face_y = podium["location"][1] - depth / 2.0

    w = ENTRANCE["width"]
    h = ENTRANCE["height"]
    setback = ENTRANCE["setback"]
    back_y = face_y + setback

    cutter = add_box(
        target,
        "entrance_cutter",
        (w, setback + 1.0, h),
        (0.0, face_y + setback / 2.0 - 0.5, h / 2.0),
    )
    for part in solids:
        if part.name.startswith(("podium_core", "podium_spandrel_0", "plinth")):
            boolean_cut(part, cutter)
    bpy.data.objects.remove(cutter, do_unlink=True)

    new_solids = [
        add_box(
            target,
            "canopy",
            (w + 4.2, ENTRANCE["canopy_depth"], ENTRANCE["canopy_thickness"]),
            (0.0, face_y - ENTRANCE["canopy_depth"] / 2.0, h + 0.9),
        ),
    ]

    glass = [add_box(target, "entrance_glass", (w, 0.1, h), (0.0, back_y - 0.06, h / 2.0))]
    return new_solids, glass


def build_plinth(target) -> list:
    podium = VOLUMES[0]
    width, depth, _ = podium["size"]
    cx, cy, _ = podium["location"]
    return [
        add_box(
            target,
            "plinth",
            (width + PLINTH_PROUD, depth + PLINTH_PROUD, PLINTH_HEIGHT),
            (cx, cy, PLINTH_HEIGHT / 2.0),
        )
    ]


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


def assign(objects, material) -> None:
    for obj in objects:
        obj.data.materials.clear()
        obj.data.materials.append(material)


def add_sun(target) -> None:
    light = bpy.data.lights.new("sun", type='SUN')
    light.energy = SUN_ENERGY
    light.color = SUN_COLOR
    light.angle = 0.03

    lamp = bpy.data.objects.new("sun", light)
    direction = SUN_VECTOR.normalized()
    lamp.location = direction * 120.0
    lamp.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    target.objects.link(lamp)


def set_sky() -> None:
    """A physical sky, not a flat colour.

    A uniform world makes the glazing reflect one dead value across every pane,
    which is what made the facade read as plastic. A real sky gradient gives the
    glass something to vary against, warms the ambient near the horizon and
    cools it overhead — and it does all of that for the shaded faces too.

    Angles are derived from SUN_VECTOR so the sky and the shadow-casting lamp
    cannot drift apart.
    """
    # Always a fresh world for this scene: a reused one can carry ray-visibility
    # flags that stop it lighting anything, which reads as a black render.
    world = bpy.data.worlds.new("exterior_sky")
    bpy.context.scene.world = world
    world.use_nodes = True

    tree = world.node_tree
    background = tree.nodes["Background"]
    background.inputs["Strength"].default_value = SKY_STRENGTH

    direction = SUN_VECTOR.normalized()
    try:
        sky = tree.nodes.new("ShaderNodeTexSky")
    except RuntimeError:
        background.inputs["Color"].default_value = (*SKY_COLOR, 1.0)
        return

    # The physical sky model is named differently across versions — Blender 5
    # calls it MULTIPLE_SCATTERING, earlier releases NISHITA. Assigning a name
    # the build does not know raises, and silently losing the sky to a flat
    # colour is very hard to spot in a render, so each is tried in turn.
    for sky_type in ('MULTIPLE_SCATTERING', 'NISHITA'):
        try:
            sky.sky_type = sky_type
            break
        except TypeError:
            continue

    sky.sun_elevation = math.asin(max(-1.0, min(1.0, direction.z)))
    sky.sun_rotation = math.atan2(direction.y, direction.x)
    # The lamp casts the shadows; a second sun in the dome would double them.
    sky.sun_disc = False
    for attribute, value in (("dust_density", 2.2), ("air_density", 1.0)):
        if hasattr(sky, attribute):
            setattr(sky, attribute, value)

    tree.links.new(sky.outputs["Color"], background.inputs["Color"])


def add_shadow_catcher(target):
    """Ground exists only so the bake has something to bounce off and something
    to receive contact shadow. It is not exported — the web world owns the
    ground plane."""
    ground = add_box(target, "bake_ground", (600.0, 600.0, 0.2), (0.0, 0.0, -0.1))
    # Paving, not tarmac. Too dark and it returns no bounce to the underside of
    # the canopy or the reveals, which is where the ground's contribution is
    # actually visible.
    assign([ground], principled("bake_ground", (0.11, 0.115, 0.125, 1.0), 0.92))
    return ground


# --------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------


def build_geometry(target):
    solids: list = []
    glass: list = []

    for volume in VOLUMES:
        s, g = build_volume(target, volume)
        solids += s
        glass += g

    # The plinth exists before the entrance is cut, so the opening goes through
    # it rather than stopping on top of it.
    solids += build_plinth(target)

    s, g = build_entrance(target, solids)
    solids += s
    glass += g

    for part in solids:
        bevel(part)

    return solids, glass


def glazing_material(name: str, strength: float):
    """Dark, glossy and quietly emissive. Emission is what makes a dusk building
    look occupied; the low roughness is what lets it still reflect the sky."""
    # Deliberately not a mirror. A COMBINED bake stores one fixed view of the
    # world, so any specular reflection is baked from the viewpoint it was
    # rendered at and becomes wrong the moment the camera moves — which, in a
    # presentation built entirely on camera travel, is immediately. Mirror
    # glazing also swung from white to black across a single pane depending on
    # what each angle happened to reflect, which is what produced the black
    # corners. Tinted, near-diffuse glass bakes correctly and reads correctly
    # from every pose.
    material = principled(name, (0.035, 0.05, 0.072, 1.0), 0.35, metallic=0.0)
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Emission Color"].default_value = (*INTERIOR_COLOR, 1.0)
    bsdf.inputs["Emission Strength"].default_value = strength
    return material


def preview():
    """Geometry and lighting only — for looking at, not for exporting."""
    target = collection()
    solids, glass = build_geometry(target)

    assign(solids, principled("concrete", CONCRETE, 0.68))
    assign(glass, glazing_material("glass", INTERIOR_STRENGTH))

    add_sun(target)
    add_shadow_catcher(target)
    set_sky()

    total = sum(len(obj.data.polygons) for obj in solids + glass)
    print(f"[exterior] parts: {len(solids) + len(glass)}  polys: {total}")
    return solids, glass


# --------------------------------------------------------------------------
# preview rendering
#
# Kept in the script rather than typed into a live session, so that what the
# form was judged against is reproducible rather than remembered.
# --------------------------------------------------------------------------

# The web world's `leverage` pose, converted: web [-24, 2.2, 52] -> blender.
PREVIEW_POSE = {
    "location": Vector((-24.0, -52.0, 2.2)),
    "target": Vector((-16.0, -6.0, 12.0)),
    "fov": 46.0,
}


def add_preview_camera(target):
    import math

    data = bpy.data.cameras.get("preview_cam") or bpy.data.cameras.new("preview_cam")
    data.sensor_fit = 'VERTICAL'
    data.lens_unit = 'FOV'
    data.angle_y = math.radians(PREVIEW_POSE["fov"])
    data.clip_end = 600.0

    cam = bpy.data.objects.get("preview_cam")
    if cam is None:
        cam = bpy.data.objects.new("preview_cam", data)
        target.objects.link(cam)
    cam.data = data
    cam.location = PREVIEW_POSE["location"]
    cam.rotation_euler = (
        (PREVIEW_POSE["target"] - PREVIEW_POSE["location"]).to_track_quat('-Z', 'Y').to_euler()
    )
    bpy.context.scene.camera = cam
    return cam


def configure_cycles(samples: int = 64) -> None:
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    try:
        scene.cycles.device = 'GPU'
    except Exception:  # noqa: BLE001 - CPU-only machines are fine
        pass
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 6
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0.0


def render_preview(filepath: str, samples: int = 64) -> str:
    # Deliberately not collection(): that clears the collection, which would
    # delete the very geometry this is about to render.
    target = bpy.data.collections.get(COLLECTION) or collection()
    add_preview_camera(target)
    configure_cycles(samples)
    bpy.context.scene.render.filepath = filepath
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    return filepath


# --------------------------------------------------------------------------
# bake and export
# --------------------------------------------------------------------------


def join_all(parts: list):
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()

    obj = bpy.context.active_object
    obj.name = "exterior_building"
    # Origin at the site origin, so the web world can place it by zone position
    # rather than by an offset nobody can derive later.
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return obj


def unwrap(obj) -> None:
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.006)
    bpy.ops.object.mode_set(mode='OBJECT')


def set_bake_target(obj, image) -> None:
    """Point every material slot at the same image, so one bake covers them all."""
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
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.margin = 10

    set_bake_target(obj, image)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='COMBINED', use_clear=True)


def bake_image(name: str):
    """A bake target with a guaranteed name.

    `bpy.data.images.new` does not replace on collision, it suffixes — so a
    second run in the same session silently creates `name.001` and anything
    looking the image up by name reads the *previous* run's result. Removing
    first is what makes repeated interactive runs mean what they say.
    """
    existing = bpy.data.images.get(name)
    if existing:
        bpy.data.images.remove(existing, do_unlink=True)
    return bpy.data.images.new(name, BAKE_SIZE, BAKE_SIZE)


def make_card(obj) -> None:
    """Turn every surface into white study-model card for the second bake."""
    for material in obj.data.materials:
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if not bsdf:
            continue
        bsdf.inputs["Base Color"].default_value = CARD
        bsdf.inputs["Roughness"].default_value = 0.85
        bsdf.inputs["Metallic"].default_value = 0.0
        bsdf.inputs["Emission Strength"].default_value = 0.0


def finish_material(obj, specified, card):
    """One material carrying both bakes.

    glTF has a single base colour slot, so the second bake rides in the emissive
    slot. Neither is used as lighting by the web renderer — it mixes the two
    maps by a uniform — but this is the only way to get both through a GLB
    without exporting the geometry twice.
    """
    material = bpy.data.materials.new("exterior_building")
    material.use_nodes = True
    tree = material.node_tree
    bsdf = tree.nodes["Principled BSDF"]

    base = tree.nodes.new("ShaderNodeTexImage")
    base.image = specified
    base.location = (-500, 300)
    tree.links.new(base.outputs["Color"], bsdf.inputs["Base Color"])

    emissive = tree.nodes.new("ShaderNodeTexImage")
    emissive.image = card
    emissive.location = (-500, -60)
    tree.links.new(emissive.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.0

    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0

    obj.data.materials.clear()
    obj.data.materials.append(material)

    specified.pack()
    card.pack()
    return material


def export(obj) -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)

    # Selection state lives on the object and is shared between scenes, so
    # anything left selected in another scene rides along in the export. An
    # interactive run picked up the corridor bay this way. Clearing globally and
    # pinning to the active scene closes both routes.
    for other in bpy.data.objects:
        try:
            other.select_set(False)
        except RuntimeError:
            pass
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        use_selection=True,
        use_active_scene=True,
        export_apply=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        # Two 2048 bakes as PNG came to 4 MB. They are photographic, not line
        # art, so JPEG costs nothing visible and roughly quarters the payload.
        export_image_format='JPEG',
        export_jpeg_quality=82,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )
    print(f"[exterior] wrote {OUTPUT} ({OUTPUT.stat().st_size / 1024:.1f} KB)")


def build_asset():
    target = collection()
    solids, glass = build_geometry(target)

    assign(solids, principled("concrete", CONCRETE, 0.68))
    assign(glass, glazing_material("glass", INTERIOR_STRENGTH))

    add_sun(target)
    add_shadow_catcher(target)
    set_sky()

    obj = join_all(solids + glass)
    unwrap(obj)

    specified = bake_image("exterior_specified")
    bake_into(obj, specified)

    make_card(obj)
    card = bake_image("exterior_card")
    bake_into(obj, card)

    finish_material(obj, specified, card)
    print(f"[exterior] polys: {len(obj.data.polygons)}")
    return obj


def main() -> None:
    obj = build_asset()
    export(obj)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(f"[exterior] FAILED: {error}", file=sys.stderr)
        raise
