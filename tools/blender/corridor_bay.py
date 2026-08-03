"""Generate one corridor bay with baked lighting."""

from __future__ import annotations

import sys
from pathlib import Path

import bpy

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT = PROJECT_ROOT / "src" / "assets" / "models" / "corridor-bay.glb"

WIDTH = 7.0
HEIGHT = 4.5
BAY_LENGTH = 13.0
POST = 0.275

RIB_COUNT = 9
BAKE_SIZE = 1024
BAKE_SAMPLES = 48

ACCENT = (0.10, 0.42, 0.95)

# A COMBINED bake stores scene-referred radiance, not a tone-mapped image: any
# texel above 1.0 is simply clipped once the web renderer applies its own ACES
# curve. These are tuned so the baked map lands inside 0..1 with headroom.
KEY_ENERGY = 45.0
EMIT_STRENGTH = 2.6
ALBEDO = 0.46


def purge() -> None:
    for collection in (
        bpy.data.objects,
        bpy.data.meshes,
        bpy.data.materials,
        bpy.data.lights,
        bpy.data.images,
    ):
        for datablock in list(collection):
            collection.remove(datablock, do_unlink=True)
    bpy.context.scene.unit_settings.scale_length = 1.0


def add_box(name: str, size, location):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    box = bpy.context.active_object
    box.name = name
    box.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return box


def bevel(obj, width: float = 0.02, segments: int = 2) -> None:
    modifier = obj.modifiers.new(name="bevel", type="BEVEL")
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = 'ANGLE'
    modifier.angle_limit = 0.785
    with bpy.context.temp_override(object=obj, active_object=obj, selected_objects=[obj]):
        bpy.ops.object.modifier_apply(modifier=modifier.name)


def build_shell() -> list:
    """Floor, walls and ceiling — the enclosure the camera flies through."""
    half = WIDTH / 2.0
    mid_y = BAY_LENGTH / 2.0
    parts = []

    parts.append(add_box("floor", (WIDTH, BAY_LENGTH, 0.2), (0, mid_y, -0.1)))
    parts.append(add_box("ceiling", (WIDTH + 0.6, BAY_LENGTH, 0.25), (0, mid_y, HEIGHT + 0.125)))

    for sign, side in ((-1.0, "l"), (1.0, "r")):
        wall = add_box(f"wall_{side}", (0.3, BAY_LENGTH, HEIGHT), (sign * (half + 0.15), mid_y, HEIGHT / 2))
        parts.append(wall)

        # Ribs: an array modifier gives evenly spaced relief that catches the
        # bake's contact shadows. This is the detail hand-written geometry
        # would not be worth the arithmetic.
        rib = add_box(f"rib_{side}", (0.12, 0.34, HEIGHT - 0.5), (sign * half, 0.6, HEIGHT / 2))
        array = rib.modifiers.new(name="array", type="ARRAY")
        array.count = RIB_COUNT
        array.use_relative_offset = False
        array.use_constant_offset = True
        array.constant_offset_displace = (0.0, (BAY_LENGTH - 1.2) / (RIB_COUNT - 1), 0.0)
        with bpy.context.temp_override(object=rib, active_object=rib, selected_objects=[rib]):
            bpy.ops.object.modifier_apply(modifier=array.name)
        parts.append(rib)

    for part in parts:
        bevel(part)

    return parts


def build_portal() -> list:
    """The station frame at the bay entrance."""
    half = WIDTH / 2.0
    parts = [
        add_box("post_l", (POST, POST, HEIGHT), (-half, 0.0, HEIGHT / 2)),
        add_box("post_r", (POST, POST, HEIGHT), (half, 0.0, HEIGHT / 2)),
        add_box("lintel", (WIDTH + POST, POST, POST), (0.0, 0.0, HEIGHT)),
    ]
    for part in parts:
        bevel(part, width=0.03)
    return parts


def add_accent_emitters() -> None:
    """Emissive strips that exist only to be baked."""
    material = bpy.data.materials.new("emitter")
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.remove(tree.nodes["Principled BSDF"])
    emission = tree.nodes.new("ShaderNodeEmission")
    emission.inputs["Color"].default_value = (*ACCENT, 1.0)
    emission.inputs["Strength"].default_value = EMIT_STRENGTH
    tree.links.new(emission.outputs["Emission"], tree.nodes["Material Output"].inputs["Surface"])

    half = WIDTH / 2.0
    mid_y = BAY_LENGTH / 2.0
    for sign, side in ((-1.0, "l"), (1.0, "r")):
        strip = add_box(f"emit_{side}", (0.06, BAY_LENGTH - 0.4, 0.07), (sign * (half - 0.1), mid_y, 0.16))
        strip.data.materials.append(material)

    top = add_box("emit_top", (WIDTH - 1.2, BAY_LENGTH - 0.4, 0.07), (0, mid_y, HEIGHT - 0.18))
    top.data.materials.append(material)


def add_bake_lights() -> None:
    key = bpy.data.lights.new("key", type='AREA')
    key.energy = KEY_ENERGY
    key.size = 5.0
    key.color = (0.86, 0.91, 1.0)
    lamp = bpy.data.objects.new("key", key)
    lamp.location = (0, BAY_LENGTH / 2.0, HEIGHT - 0.5)
    bpy.context.collection.objects.link(lamp)


def join(parts: list):
    bpy.ops.object.select_all(action='DESELECT')
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    joined = bpy.context.active_object
    joined.name = "corridor_bay"

    # Join inherits the first part's origin, which lands mid-bay. The web side
    # instances the raw geometry, so the origin has to be the portal or every
    # bay sits half a length off its station.
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    return joined


def prepare_bake_material(obj):
    material = bpy.data.materials.new("bay")
    material.use_nodes = True
    tree = material.node_tree
    bsdf = tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (ALBEDO, ALBEDO * 1.03, ALBEDO * 1.10, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.72
    bsdf.inputs["Metallic"].default_value = 0.0

    obj.data.materials.clear()
    obj.data.materials.append(material)

    image = bpy.data.images.new("bay_baked", BAKE_SIZE, BAKE_SIZE)
    texture_node = tree.nodes.new("ShaderNodeTexImage")
    texture_node.image = image
    texture_node.location = (-400, 300)
    tree.nodes.active = texture_node
    return material, image, texture_node


def unwrap(obj) -> None:
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.012)
    bpy.ops.object.mode_set(mode='OBJECT')


def bake(obj) -> None:
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = BAKE_SAMPLES
    scene.cycles.use_denoising = True
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.margin = 8

    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='COMBINED', use_clear=True)


def finish_material(material, image, texture_node) -> None:
    """Route the bake into Base Color so glTF carries it, and drop the shading
    inputs the web material will not use."""
    tree = material.node_tree
    bsdf = tree.nodes["Principled BSDF"]
    tree.links.new(texture_node.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    image.pack()


def export() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )
    print(f"[bay] wrote {OUTPUT} ({OUTPUT.stat().st_size / 1024:.1f} KB)")


def build():
    purge()
    parts = build_shell() + build_portal()
    add_accent_emitters()
    add_bake_lights()

    bay = join(parts)
    material, image, texture_node = prepare_bake_material(bay)
    unwrap(bay)
    bake(bay)
    finish_material(material, image, texture_node)
    return bay


def main() -> None:
    bay = build()
    bpy.ops.object.select_all(action='DESELECT')
    bay.select_set(True)
    bpy.context.view_layer.objects.active = bay
    print(f"[bay] polys: {len(bay.data.polygons)}")
    export()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001
        print(f"[bay] FAILED: {error}", file=sys.stderr)
        raise
