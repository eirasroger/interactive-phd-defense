"""Shared Blender machinery: scene plumbing, tiling materials, occlusion bakes, GLB export."""

from __future__ import annotations

import json
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODELS = PROJECT_ROOT / "src" / "assets" / "models"
CONFIG = PROJECT_ROOT / "src" / "config"
WORK = PROJECT_ROOT / "work" / "blender"
ASSET_DIR = WORK / "assets"
DETAIL_DIR = WORK / "detail"
RENDERS = WORK / "renders"

DETAIL_SIZE = 2048
DETAIL_NORMAL_STRENGTH = 0.9
DETAIL_UV = "detail"
OCCLUSION_UV = "occlusion"
GLTF_SETTINGS = "glTF Material Output"

DETAIL_AXES = ((1, 2), (0, 2), (0, 1))
LUMA = (0.2126, 0.7152, 0.0722)


def use_scene(name: str):
    """Own the scene rather than inheriting whatever the file was last used for."""
    scene = bpy.data.scenes.get(name) or bpy.data.scenes.new(name)
    if bpy.context.window:
        bpy.context.window.scene = scene
    return scene


def collection(scene_name: str, name: str):
    """An emptied collection inside this script's own scene."""
    scene = use_scene(scene_name)

    existing = bpy.data.collections.get(name)
    if existing:
        for obj in list(existing.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
    else:
        existing = bpy.data.collections.new(name)

    if name not in scene.collection.children:
        scene.collection.children.link(existing)
    return existing


def add_box(target, name: str, size, location, rotation=None):
    """An axis-aligned box with outward normals."""
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


def add_span(target, name: str, x, y, z, rotation=None):
    """A box given as three (low, high) intervals rather than a size and a centre."""
    size = (x[1] - x[0], y[1] - y[0], z[1] - z[0])
    centre = ((x[0] + x[1]) / 2.0, (y[0] + y[1]) / 2.0, (z[0] + z[1]) / 2.0)
    return add_box(target, name, size, centre, rotation)


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


class Parts(dict):
    """Objects grouped by the material key they take."""

    def put(self, key: str, obj):
        self.setdefault(key, []).append(obj)
        return obj

    def extend(self, key: str, objects):
        self.setdefault(key, []).extend(objects)

    def all(self) -> list:
        return [obj for group in self.values() for obj in group]


def join_all(parts: list, name: str):
    """One multi-material object with its origin at the world origin."""
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


def principled(name: str, base_color, roughness: float, metallic: float = 0.0):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = base_color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return material


def emissive_material(name: str, color, strength: float):
    material = principled(name, (0.0, 0.0, 0.0, 1.0), 1.0)
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
    bsdf.inputs["Emission Strength"].default_value = strength
    return material


def glazing_material(name: str, base_color, alpha: float, roughness: float = 0.06):
    material = principled(name, base_color, roughness)
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Alpha"].default_value = alpha
    material.blend_method = 'BLEND'
    return material


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


class Surfaces:
    """A script's palette: flat colours, tiling detail maps, and the UVs that address them."""

    def __init__(self, tag: str, palette: dict, detail: dict, specials: dict | None = None,
                 size: int = DETAIL_SIZE, rough: bool = True):
        self.tag = tag
        self.palette = palette
        self.detail = detail
        self.specials = specials or {}
        self.size = size
        self.rough = rough
        self.built: dict[str, object] = {}

    def tile(self, key: str) -> float:
        return self.detail[key][1] if key in self.detail else 1.0

    def material(self, key: str):
        if key in self.built:
            return self.built[key]
        special = self.specials.get(key)
        if special:
            material = special()
        elif key in self.detail:
            material = self.detail_material(key)
        else:
            base_color, roughness, metallic = self.palette[key]
            material = principled(key, base_color, roughness, metallic)
        self.built[key] = material
        return material

    def detail_texture(self, key: str, slot: str, tint: float) -> Path:
        """A web-sized, palette-graded copy of one Poly Haven map."""
        asset = self.detail[key][0]
        source = next((ASSET_DIR / asset).glob(f"{slot}.*"), None)
        if source is None:
            raise RuntimeError(f"{key}: {asset}/{slot} is missing — run fetch_assets.py")

        DETAIL_DIR.mkdir(parents=True, exist_ok=True)
        destination = DETAIL_DIR / f"{self.tag}_{key}_{slot}.jpg"

        image = bpy.data.images.load(str(source), check_existing=False)
        if tint > 0.0:
            apply_tint(image, self.palette[key][0], tint, relevel=True)
        image.scale(self.size, self.size)

        settings = bpy.context.scene.render.image_settings
        settings.file_format = 'JPEG'
        settings.quality = 94
        image.save_render(str(destination), scene=bpy.context.scene)
        bpy.data.images.remove(image)
        return destination

    def detail_image(self, key: str, slot: str, tint: float, colour: bool):
        label = f"{self.tag}_{key}_{slot}"
        existing = bpy.data.images.get(label)
        if existing:
            bpy.data.images.remove(existing, do_unlink=True)

        image = bpy.data.images.load(str(self.detail_texture(key, slot, tint)), check_existing=False)
        image.name = label
        if not colour:
            image.colorspace_settings.name = 'Non-Color'
        return image

    def detail_material(self, key: str):
        """Tiling detail on a world-scale UV set. Fourth field False = relief only."""
        asset, tile, tint = self.detail[key][:3]
        diffuse = self.detail[key][3] if len(self.detail[key]) > 3 else True
        base_color, roughness, metallic = self.palette[key]
        material = principled(key, base_color, roughness, metallic)
        tree = material.node_tree
        bsdf = tree.nodes["Principled BSDF"]

        coords = tree.nodes.new("ShaderNodeUVMap")
        coords.uv_map = DETAIL_UV
        coords.location = (-1000, 100)

        if diffuse:
            base = tree.nodes.new("ShaderNodeTexImage")
            base.image = self.detail_image(key, "Diffuse", tint, colour=True)
            base.location = (-700, 220)
            tree.links.new(coords.outputs["UV"], base.inputs["Vector"])
            tree.links.new(base.outputs["Color"], bsdf.inputs["Base Color"])

        if self.rough:
            node = tree.nodes.new("ShaderNodeTexImage")
            node.image = self.detail_image(key, "Rough", 0.0, colour=False)
            node.location = (-700, 20)
            tree.links.new(coords.outputs["UV"], node.inputs["Vector"])
            tree.links.new(node.outputs["Color"], bsdf.inputs["Roughness"])

        normal = tree.nodes.new("ShaderNodeTexImage")
        normal.image = self.detail_image(key, "nor_gl", 0.0, colour=False)
        normal.location = (-700, -240)
        shaper = tree.nodes.new("ShaderNodeNormalMap")
        shaper.uv_map = DETAIL_UV
        shaper.location = (-400, -240)
        shaper.inputs["Strength"].default_value = DETAIL_NORMAL_STRENGTH
        tree.links.new(coords.outputs["UV"], normal.inputs["Vector"])
        tree.links.new(normal.outputs["Color"], shaper.inputs["Color"])
        tree.links.new(shaper.outputs["Normal"], bsdf.inputs["Normal"])

        print(f"[{self.tag}] detail {key}: {asset} at {tile:.2f} m "
              f"({self.size / tile:.0f} texels/m){'' if diffuse else ', relief only'}")
        return material

    def project(self, obj) -> None:
        """World coordinates, in metres, divided by each material's tile."""
        mesh = obj.data
        layer = mesh.uv_layers.get(DETAIL_UV) or mesh.uv_layers.new(name=DETAIL_UV)
        tiles = [
            self.tile(slot.material.name.split('.')[0]) if slot.material else 1.0
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

    def assign(self, objects, key: str) -> None:
        material = self.material(key)
        for obj in objects:
            obj.data.materials.clear()
            obj.data.materials.append(material)

    def apply(self, parts: Parts, skip=()) -> None:
        for key, group in parts.items():
            if key in skip:
                continue
            self.assign(group, key)
            for obj in group:
                self.project(obj)


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


def bake_into(obj, image, samples: int, distance: float) -> None:
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.bake.margin = 10
    scene.render.bake.margin_type = 'ADJACENT_FACES'
    scene.world.light_settings.distance = distance

    set_bake_target(obj, image)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='AO', use_clear=True)


def bake_image(name: str, size: int, hdr: bool = False):
    """Removed before creation (§6b). `hdr` is required if it will be measured (§47)."""
    existing = bpy.data.images.get(name)
    if existing:
        bpy.data.images.remove(existing, do_unlink=True)
    return bpy.data.images.new(name, size, size, float_buffer=hdr)


def report_levels(tag: str, name: str, image) -> None:
    """What an occlusion bake is worth checking for."""
    import numpy

    pixels = numpy.empty(len(image.pixels), dtype=numpy.float32)
    image.pixels.foreach_get(pixels)
    values = pixels.reshape(-1, 4)[:, 0]

    print(f"[{tag}] {name} occlusion: mean {values.mean():.3f}  "
          f"open {(values > 0.9).mean() * 100.0:.1f}%  "
          f"closed {(values < 0.1).mean() * 100.0:.1f}%")


def isolate_materials(obj) -> None:
    """Give this asset private copies of every material it uses."""
    for slot in obj.material_slots:
        if slot.material:
            slot.material = slot.material.copy()


def bake_irradiance(obj, image, samples: int) -> None:
    """Irradiance: DIFFUSE direct + indirect with the colour pass off."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.render.bake.margin = 10
    scene.render.bake.margin_type = 'ADJACENT_FACES'
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False

    set_bake_target(obj, image)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='DIFFUSE', use_clear=True)


def surface_area(obj) -> float:
    return float(sum(polygon.area for polygon in obj.data.polygons))


def atlas_size(area: float, texels: int, smallest: int, largest: int) -> int:
    """Atlas side for a target texels-per-metre over a measured area."""
    want = math.sqrt(max(area, 0.01)) * texels
    size = smallest
    while size < want and size < largest:
        size *= 2
    return size


LIGHT_PERCENTILES = (50.0, 75.0, 90.0, 99.0)


def report_light(tag: str, name: str, image) -> dict[float, float]:
    """Percentiles of a radiance bake. Grade against p75, not the max: §46."""
    import numpy

    pixels = numpy.empty(len(image.pixels), dtype=numpy.float32)
    image.pixels.foreach_get(pixels)
    values = pixels.reshape(-1, 4)[:, :3].max(axis=1)
    lit = values[values > 0.004]

    marks = {p: float(numpy.percentile(lit, p)) for p in LIGHT_PERCENTILES}
    report = "  ".join(f"p{int(p)} {value:.3f}" for p, value in marks.items())
    print(f"[{tag}] {name} light: mean {values.mean():.3f}  {report}  "
          f"max {values.max():.3f}  clipped {(values > 0.995).mean() * 100.0:.2f}%")
    return marks


def rescale(image, gain: float) -> None:
    import numpy

    pixels = numpy.empty(len(image.pixels), dtype=numpy.float32)
    image.pixels.foreach_get(pixels)
    rgba = pixels.reshape(-1, 4)
    rgba[:, :3] = numpy.clip(rgba[:, :3] * gain, 0.0, 1.0)
    image.pixels.foreach_set(rgba.reshape(-1))


def bake_lightmap(surfaces: Surfaces, obj, name: str, size: int, samples: int,
                  anchor: float = 75.0, target: float = 0.56,
                  gain: float | None = None) -> float:
    """Lightmap into glTF's occlusion channel. Pass `gain` to share one exposure."""
    surfaces.project(obj)
    unwrap_occlusion(obj)
    isolate_materials(obj)

    area = surface_area(obj)
    print(f"[{surfaces.tag}] {name} atlas: {size} over {area:.0f} m2 "
          f"({size / math.sqrt(max(area, 0.01)):.0f} texels/m)")

    light = bake_image(f"{name}_light", size, hdr=True)
    bake_irradiance(obj, light, samples)
    marks = report_light(surfaces.tag, name, light)

    if gain is None:
        reference = marks.get(anchor, 0.0)
        gain = target / reference if reference > 0.0 else 1.0
        print(f"[{surfaces.tag}] {name} exposure: p{int(anchor)} -> {target}, gain {gain:.3f}")
    rescale(light, gain)
    report_light(surfaces.tag, f"{name} graded", light)

    wire_occlusion(obj, light)
    light.pack()
    return gain


def bake_surface(surfaces: Surfaces, obj, name: str, size: int,
                 samples: int, distance: float):
    """Bake what real-time light cannot reach, and only that."""
    surfaces.project(obj)
    unwrap_occlusion(obj)
    isolate_materials(obj)

    occlusion = bake_image(f"{name}_occlusion", size)
    bake_into(obj, occlusion, samples, distance)
    report_levels(surfaces.tag, name, occlusion)
    wire_occlusion(obj, occlusion)

    occlusion.pack()
    print(f"[{surfaces.tag}] {name} polys: {len(obj.data.polygons)}")
    return occlusion


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


def export(tag: str, objects, destination: Path, occluded: bool = True) -> None:
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
    print(f"[{tag}] wrote {destination.name} ({destination.stat().st_size / 1024:.1f} KB)")


_TEMPLATES: dict[str, list] = {}


def asset_template(name: str) -> list:
    """The mesh objects of one Poly Haven blend, appended once and reused."""
    if name in _TEMPLATES:
        return _TEMPLATES[name]

    blends = sorted((ASSET_DIR / name).glob("*.blend"))
    if not blends:
        print(f"[assets] {name}: no blend — run fetch_assets.py")
        _TEMPLATES[name] = []
        return []

    with bpy.data.libraries.load(str(blends[0]), link=False) as (source, loaded):
        loaded.objects = list(source.objects)

    whole = [obj for obj in loaded.objects if obj and obj.type == 'MESH' and obj.parent is None]
    whole = whole or [obj for obj in loaded.objects if obj and obj.type == 'MESH']

    # Biggest first. A Poly Haven plant blend holds the whole plant *and* its
    # parts and LOD rungs in arbitrary order, so picking a template by index is
    # a coin toss between a full shrub and one sprig — and the sprig scaled to
    # the same height is a bare twig. Order the list and `variant=0` is always
    # the fullest plant there is.
    whole.sort(key=lambda obj: -len(obj.data.polygons))
    _TEMPLATES[name] = whole
    return whole


def place_asset(target, name: str, location, rotation, height: float,
                variant: int = 0):
    """Placed at a height in metres, never at a multiple of its own size."""
    templates = asset_template(name)
    if not templates:
        return None

    # A template that is a *part* of a plant — one leaf cluster, a bare stem —
    # measures a few centimetres, and scaling it to a metre of finished height
    # multiplies it by thirty. `learnings.md` §7f: normalising size is exactly
    # what hides how big the source is, so the source has to be reported.
    source = templates[variant % len(templates)]
    native = source.dimensions.z
    if native < 0.25:
        print(f"[assets] {name}: skipped {source.name}, only {native:.2f} m tall")
        return None

    obj = source.copy()
    obj.data = source.data
    obj.location = location
    obj.rotation_euler = rotation if isinstance(rotation, tuple) else (0.0, 0.0, rotation)
    factor = height / native
    obj.scale = (factor, factor, factor)
    target.objects.link(obj)
    print(f"[assets] {name}: {source.name} {native:.2f} m -> {height:.2f} m, "
          f"{len(source.data.polygons)} faces")
    return obj


def add_sun(target, vector: Vector, energy: float, color, angle: float = 0.02) -> None:
    light = bpy.data.lights.new("sun", type='SUN')
    light.energy = energy
    light.color = color
    light.angle = angle

    lamp = bpy.data.objects.new("sun", light)
    direction = vector.normalized()
    lamp.location = direction * 150.0
    lamp.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    target.objects.link(lamp)


def set_sky(name: str, color, strength: float) -> None:
    """A fresh world datablock, never the one the file was last used with."""
    world = bpy.data.worlds.new(name)
    bpy.context.scene.world = world
    world.use_nodes = True

    background = world.node_tree.nodes["Background"]
    background.inputs["Color"].default_value = (*color, 1.0)
    background.inputs["Strength"].default_value = strength


def add_camera(target, pose):
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


def configure_cycles(samples: int = 64, exposure: float = 0.0,
                     view: str = 'Standard') -> None:
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
    scene.view_settings.view_transform = view
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = exposure


def render(tag: str, target, name: str, pose, samples: int = 48,
           exposure: float = 0.0, view: str = 'Standard') -> Path:
    """Render to a file and read the file — the viewport screenshot is not a render."""
    add_camera(target, pose)
    configure_cycles(samples, exposure, view)

    RENDERS.mkdir(parents=True, exist_ok=True)
    destination = RENDERS / f"{tag}_{name}.png"
    bpy.context.scene.render.filepath = str(destination)
    bpy.context.scene.render.image_settings.file_format = 'PNG'
    bpy.ops.render.render(write_still=True)
    print(f"[{tag}] rendered {destination}")
    return destination


def save_blend(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(path), copy=True)
    print(f"saved {path}")
