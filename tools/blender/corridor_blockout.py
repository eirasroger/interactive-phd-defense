"""Spatial blockout of the corridor described in docs/narrative.md."""

from __future__ import annotations

import sys
from pathlib import Path

import math

import bpy
from mathutils import Euler

CORRIDOR_WIDTH = 14.0
CORRIDOR_HEIGHT = 9.0
POST = 0.55

APPROACH_END = -40.0
STATION_GAP = -26.0
STATIONS = ["c1", "c2", "c3", "c4", "c5"]

APPROACH_RUNUP = 30.0
HORIZON_RUNOFF = 45.0

EYE_HEIGHT = 2.5
LENS_MM = 28.0

ACCENT = (0.10, 0.66, 0.80)


def station_y(index: int) -> float:
    return APPROACH_END + STATION_GAP * index


def purge() -> None:
    """Empty the scene without `read_factory_settings`, which unregisters
    addons and would kill a live blender-mcp session."""
    for collection in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.lights):
        for datablock in list(collection):
            collection.remove(datablock, do_unlink=True)
    bpy.context.scene.unit_settings.scale_length = 1.0


def make_material(name, colour, roughness=0.8, metallic=0.0, emission=None, strength=4.0):
    material = bpy.data.materials.new(f"mat_{name}")
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*colour, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    return material


def make_box(name, size, location, material):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    box = bpy.context.active_object
    box.name = name
    box.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    box.data.materials.append(material)
    return box


def build_floor(material) -> None:
    near = APPROACH_RUNUP
    far = station_y(len(STATIONS) - 1) - HORIZON_RUNOFF
    make_box("floor", (CORRIDOR_WIDTH + 12.0, near - far, 0.4), (0, (near + far) / 2.0, -0.2), material)


def build_station(index: int, frame, edge) -> None:
    sid = STATIONS[index]
    y = station_y(index)
    half = CORRIDOR_WIDTH / 2.0
    inset = POST * 0.28
    face = y - POST * 0.4

    make_box(f"{sid}_post_l", (POST, POST, CORRIDOR_HEIGHT), (-half, y, CORRIDOR_HEIGHT / 2), frame)
    make_box(f"{sid}_post_r", (POST, POST, CORRIDOR_HEIGHT), (half, y, CORRIDOR_HEIGHT / 2), frame)
    make_box(f"{sid}_lintel", (CORRIDOR_WIDTH + POST, POST, POST), (0, y, CORRIDOR_HEIGHT), frame)

    make_box(f"{sid}_edge_l", (inset, inset, CORRIDOR_HEIGHT), (-half + POST * 0.5, face, CORRIDOR_HEIGHT / 2), edge)
    make_box(f"{sid}_edge_r", (inset, inset, CORRIDOR_HEIGHT), (half - POST * 0.5, face, CORRIDOR_HEIGHT / 2), edge)
    make_box(f"{sid}_edge_t", (CORRIDOR_WIDTH - POST, inset, inset), (0, face, CORRIDOR_HEIGHT - POST * 0.5), edge)
    make_box(f"{sid}_sill", (CORRIDOR_WIDTH + POST, POST, 0.12), (0, y, 0.06), edge)


def add_light(name: str, y: float, energy: float) -> None:
    data = bpy.data.lights.new(name, type='AREA')
    data.energy = energy
    data.size = 10.0
    data.color = (0.85, 0.90, 1.0)
    lamp = bpy.data.objects.new(name, data)
    # Above the lintel: at station height the fixture itself is in shot.
    lamp.location = (0, y, CORRIDOR_HEIGHT + 1.6)
    bpy.context.collection.objects.link(lamp)


def build_world() -> None:
    scene = bpy.context.scene
    engines = [e.identifier for e in type(scene.render).bl_rna.properties['engine'].enum_items]
    scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else engines[0]

    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    tree = world.node_tree
    for node in list(tree.nodes):
        if node.type != 'OUTPUT_WORLD':
            tree.nodes.remove(node)
    output = next(n for n in tree.nodes if n.type == 'OUTPUT_WORLD')

    background = tree.nodes.new("ShaderNodeBackground")
    background.inputs["Color"].default_value = (0.010, 0.012, 0.018, 1.0)
    background.inputs["Strength"].default_value = 0.35
    tree.links.new(background.outputs["Background"], output.inputs["Surface"])

    scatter = tree.nodes.new("ShaderNodeVolumeScatter")
    scatter.inputs["Color"].default_value = (0.20, 0.28, 0.40, 1.0)
    scatter.inputs["Density"].default_value = 0.0075
    tree.links.new(scatter.outputs["Volume"], output.inputs["Volume"])

    for attribute, value in (("volumetric_start", 0.1), ("volumetric_end", 320.0), ("volumetric_samples", 96)):
        if hasattr(scene.eevee, attribute):
            setattr(scene.eevee, attribute, value)


def add_camera(y: float) -> bpy.types.Object:
    data = bpy.data.cameras.new("presenter")
    data.lens = LENS_MM
    data.clip_end = 1000.0
    camera = bpy.data.objects.new("presenter", data)
    camera.location = (0, y, EYE_HEIGHT)
    # A camera looks down its local -Z, so X=90 alone faces +Y — back up the
    # corridor. The 180 roll turns it around without inverting the horizon.
    camera.rotation_euler = Euler((math.radians(88.0), 0.0, math.radians(180.0)), 'XYZ')
    bpy.context.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    return camera


def build() -> None:
    purge()

    floor = make_material("floor", (0.16, 0.175, 0.20), roughness=0.5)
    frame = make_material("frame", (0.26, 0.28, 0.32), roughness=0.4, metallic=0.4)
    edge = make_material("edge", (0.02, 0.02, 0.02), roughness=0.4, emission=ACCENT)

    build_floor(floor)
    for index in range(len(STATIONS)):
        build_station(index, frame, edge)
        add_light(f"key_{STATIONS[index]}", station_y(index) + STATION_GAP / 2, 5200)

    # The approach has no station of its own, so nothing lights Act I without this.
    add_light("key_approach", APPROACH_END / 2, 3600)

    build_world()
    add_camera(-12.0)


def render(path: Path) -> None:
    scene = bpy.context.scene
    scene.render.filepath = str(path)
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.image_settings.file_format = 'PNG'
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)
    print(f"[corridor] wrote {path}")


def main() -> None:
    build()
    print(f"[corridor] stations at y: {[station_y(i) for i in range(len(STATIONS))]}")
    print(f"[corridor] objects: {len(bpy.data.objects)}")

    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    if "--render" in argv:
        render(Path(argv[argv.index("--render") + 1]).resolve())


if __name__ == "__main__":
    main()
