"""Generate the demo construction assembly GLB.

Run through Blender's own interpreter so the bpy version always matches the
installed Blender:

    blender --background --python tools/blender/generate_assembly.py

Output: src/assets/models/assembly.glb

The asset exists to validate the loading pipeline end to end (Draco decode,
material handling, named-node addressing). Layers are named so the web scene
can address and explode them individually.
"""

from __future__ import annotations

import sys
from pathlib import Path

import bpy

PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT = PROJECT_ROOT / "src" / "assets" / "models" / "assembly.glb"

PANEL_WIDTH = 4.0
PANEL_DEPTH = 3.0

# name, thickness, colour (linear RGB), roughness, metallic
LAYERS = [
    ("structure", 0.36, (0.52, 0.54, 0.58), 0.65, 0.85),
    ("insulation", 0.28, (0.94, 0.82, 0.42), 0.95, 0.0),
    ("membrane", 0.06, (0.18, 0.62, 0.52), 0.55, 0.0),
    ("cladding", 0.16, (0.82, 0.84, 0.87), 0.35, 0.1),
]


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_material(name: str, colour: tuple[float, float, float], roughness: float, metallic: float):
    material = bpy.data.materials.new(name=f"mat_{name}")
    material.use_nodes = True
    bsdf = material.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*colour, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return material


def make_panel(name: str, thickness: float, z: float, material) -> None:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0.0, 0.0, z))
    panel = bpy.context.active_object
    panel.name = f"layer_{name}"
    panel.scale = (PANEL_WIDTH, PANEL_DEPTH, thickness)

    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # A small bevel catches the key light and keeps edges from reading as CG.
    bevel = panel.modifiers.new(name="bevel", type="BEVEL")
    bevel.width = 0.012
    bevel.segments = 2
    bpy.ops.object.modifier_apply(modifier=bevel.name)

    panel.data.materials.append(material)
    bpy.ops.object.shade_smooth_by_angle(angle=0.523599)


def build() -> None:
    reset_scene()

    z = 0.0
    for name, thickness, colour, roughness, metallic in LAYERS:
        z += thickness / 2.0
        make_panel(name, thickness, z, make_material(name, colour, roughness, metallic))
        z += thickness / 2.0


def export() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        export_apply=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )
    print(f"[assembly] wrote {OUTPUT} ({OUTPUT.stat().st_size / 1024:.1f} KB)")


def main() -> None:
    build()
    export()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:  # noqa: BLE001 - surface the reason to the CLI
        print(f"[assembly] FAILED: {error}", file=sys.stderr)
        raise
