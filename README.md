# interactive-phd-defense

Interactive PhD defense presentation for _"Artificial Intelligence for Circular and Sustainable Product Decision-Support in Construction"_.

A browser-based presentation engine rather than a website: scenes replace
slides, camera movement replaces page transitions, and scientific figures are
rebuilt as live interactive visualisations. Fully static, deployable to GitHub
Pages, and runnable without a network connection.

## Stack

TypeScript · Vite · Three.js · GSAP · D3 (maths only)

## Requirements

Node 24 (see `.nvmrc`). Blender 5.2 is used to author GLB assets; asset scripts
run through Blender's bundled interpreter, not the project venv.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build      # -> dist/
npm run preview    # serve the production build
```

## Presenting

| Key | Action |
| --- | --- |
| `→` `↓` `Space` `PageDown` | Next scene |
| `←` `↑` `PageUp` | Previous scene |
| `Home` / `End` | First / last scene |
| `f` | Toggle fullscreen |
| `d` | Toggle frame-rate diagnostics |

`PageUp`/`PageDown` are what physical presenter remotes emit.

The current scene is stored in the URL hash, so a refresh returns to the same
place. Append `?safe=1` to force the lowest-fidelity rendering path if the
presentation hardware struggles.

### Running offline

Build once, then serve the output locally:

```bash
npm run build
npm run preview
```

Opening `dist/index.html` directly from disk does **not** work: the build uses
ES modules, which browsers block over `file://`. Serving the directory with any
static file server is sufficient — no network access is required, as the build
makes no external requests.

## Architecture

One persistent renderer, one 3D world, one camera. Scenes do not own a scene
graph — they attach content to the shared world and **declare a camera pose**.
Navigation flies the camera between poses, so moving through the presentation
is travel through a single continuous space rather than a sequence of slides.
Because a pose is data, direct navigation simply snaps to it.

Text renders in a DOM overlay above the canvas: crisp at any projector
resolution, accessible, and free to draw.

```
src/
  engine/
    camera/       pose model, rig, interpolation between poses
    render/       renderer, world, tier-gated post-processing
    assets/       manifest-driven loading and caching
    scene/        scene contract and lifecycle director
    diagnostics/  frame-rate driven adaptive quality
  scenes/         one directory per scene, self-contained
  components/     reusable UI and 3D primitives
  animations/     shared motion vocabulary
  content/        scientific and editorial text, typed
  config/         quality tiers and global constants
  styles/         design tokens and global styling
  utilities/      small shared helpers
tools/blender/    procedural asset generation (bpy)
```

The engine renders scenes, scenes use components, components consume content.

Current scenes are **architecture demos**, not thesis content — they exist to
validate the rendering pipeline, transitions, asset loading and interaction.

## Assets

3D assets are generated procedurally rather than modelled by hand, and run
through Blender's own interpreter so the `bpy` version always matches the
installed Blender:

```bash
blender --background --python tools/blender/generate_assembly.py
```

Output lands in `src/assets/models/` and is registered in
`src/assets/manifest.ts`. Models are imported through Vite so hashing and
base-path rewriting happen at build time; Draco decoding is handled by
Three.js's own bundled decoder, fetched lazily.

The Python venv is for tooling and `bpy` type stubs only — it is not used to
run Blender.
