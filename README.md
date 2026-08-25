# interactive-phd-defense

Interactive PhD defense presentation for _"Artificial Intelligence for Circular
and Sustainable Product Decision-Support in Construction"_.

A browser-based presentation engine built around a single continuous 3D world.
Scenes replace slides, camera travel replaces page transitions, and the figures
from the thesis are rebuilt as live compositions. The result is fully static,
deployable to GitHub Pages, and runnable with no network connection.

## Stack

TypeScript · Vite · Three.js · GSAP

Captions, figures and labels are DOM in an overlay layer above the WebGL canvas,
so typography stays native-sharp at any projector resolution while only the 3D
image is resampled.

## The talk

Twenty-two scenes in three acts, walked as one route through two built zones.

| Act | Zone | Scenes |
| --- | --- | --- |
| I: Exterior | The site: lake, river, park, building under construction | `overview` `lake` `leverage` `river` `park` `construction` `scaffold` `alternatives` `gaps` `objectives` `contributions` |
| II: The Corridor | Inside the building, five stations, one per paper | `c1` `c2` `c3` `c4` `c5` |
| III: The Overlook | The corridor read from above, as a plan | `whole` `ai` `conditions` `discussion` `conclusions` `close` |

Act boundaries are designed camera moves. Act II opens with a nine-second
crossing that carries the camera down the avenue and through the doors as they
slide apart. Act III begins with the ceiling lifting and the camera climbing out
of the corridor.

Scenes may declare **beats**, which are clicker steps that stay inside a single
scene for progressive builds and swaps. Each beat is implemented as the complete
state it represents, so it can be reached backwards or jumped to directly.

## Requirements

Node 24 (see `.nvmrc`). Every GLB and texture the deck loads is committed, so a
clean checkout runs and builds with Node alone.

Blender 5 and Python are used to regenerate assets. See [Assets](#assets).

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build      # -> dist/
npm run preview    # serve the production build
```

`npm run build` typechecks first, so a type error stops the build.

## Presenting

| Key | Action |
| --- | --- |
| `→` `↓` `Space` `PageDown` | Next beat or scene |
| `←` `↑` `PageUp` | Previous |
| `Home` / `End` | First / last scene |
| `f` | Toggle fullscreen |
| `d` | Toggle the frame-time overlay |

`PageUp` and `PageDown` are what physical presenter remotes emit. On touch
devices a tap advances and a swipe goes back.

The current scene is stored in the URL hash, so a refresh mid-defense returns to
the same place. Navigation clamps at both ends of the deck.

### Rendering quality

The deck composes onto a fixed 1920×1080 stage that is scaled to fit whatever it
is projected on. At startup it probes the machine and selects a quality tier
(`safe`, `standard`, `high`). A runtime ladder then releases bloom, shadow
resolution and render resolution in that order if frame times slip, so a
struggling machine holds a steady frame rate at a softer image.

Query flags override the probe:

| Flag | Effect |
| --- | --- |
| `?safe=1` | Force the lowest-fidelity path |
| `?quality=safe\|standard\|high` | Pin a tier explicitly |

### Running offline

```bash
npm run build
npm run preview
```

Serve `dist/` over HTTP with any static file server. The build uses ES modules,
which browsers block over `file://`. All requests stay local to the directory.

## Structure

```
src/
  engine/       navigation, scene lifecycle, camera direction, render pipeline,
                zone and world state, quality probing, diagnostics
  world/        the two built zones (exterior site, corridor) and their content
  scenes/       act1/ act2/ act3/, one module per scene, plus the ordered registry
  components/   the composition kit: Slide, Caption, and the figure library
  content/      scientific and editorial text, typed and held apart from rendering
  config/       stage, layout, corridor plan, quality tiers
  animations/   shared motion vocabulary and timing
  assets/       GLB models, textures, paper figures, and the addressed manifest
  styles/       design tokens and global styling
  utilities/    small shared helpers
tools/          Blender and Python asset generation
```

The engine renders scenes. Scenes use components. Components consume content.
Zones provide the world a scene is seen in.

## Assets

The 3D world is generated from parameters. Scripts under `tools/blender/` build
each zone from a shared plan file, bake lighting into the GLB occlusion channel,
and export to `src/assets/models/`. Textures derive from CC0 Poly Haven sources
and are resized for the web by `tools/web_textures.py`. Figures from the papers
are converted by `tools/figures.py`.

```bash
blender --background --python tools/blender/corridor_shell.py
blender --background --python tools/blender/exterior_building.py
python tools/web_textures.py
```

Outputs are committed, so this pipeline stays outside CI and outside a clean
checkout.

## Deployment

Pushing to `main` typechecks, builds and publishes `dist/` to GitHub Pages
(`.github/workflows/deploy.yml`). The Vite `base` is relative, so one build
serves both a GitHub Pages subpath and a local directory.
