# interactive-phd-defense

Interactive PhD defense presentation for _"Artificial Intelligence for Circular and Sustainable Product Decision-Support in Construction"_.

A browser-based presentation engine: scenes replace
slides, camera movement replaces page transitions, and scientific figures are
rebuilt as live interactive visualisations. Fully static, deployable to GitHub
Pages, and runnable without a network connection.

## Stack

TypeScript · Vite · Three.js · GSAP · D3 

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

## Structure

```
src/
  engine/       navigation, scene lifecycle, timing, environment probing
  scenes/       one directory per scene, self-contained
  components/   reusable, presentation-agnostic UI
  animations/   shared motion vocabulary
  content/      scientific and editorial text, typed
  styles/       design tokens and global styling
  utilities/    small shared helpers
```

The engine renders scenes, scenes use components, components consume content.
