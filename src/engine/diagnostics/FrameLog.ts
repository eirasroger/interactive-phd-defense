import type { WebGLRenderer } from 'three';

/**
 * Logs frames over the threshold with the likely cause: shader compiles,
 * texture uploads or new geometries, from `renderer.info` deltas.
 * Dev only; `main.ts` gates the import so Vite drops it from the build.
 */
export interface LongFrame {
  readonly at: number;
  readonly ms: number;
  readonly scene: string;
  readonly programs: number;
  readonly geometries: number;
  readonly textures: number;
}

const KEPT = 40;

export class FrameLog {
  private readonly frames: LongFrame[] = [];
  private previous = { programs: 0, geometries: 0, textures: 0 };

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly sceneId: () => string,
    private readonly thresholdMs = 50,
  ) {}

  update(dt: number): void {
    const { info } = this.renderer;
    const current = {
      programs: info.programs?.length ?? 0,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    };
    const previous = this.previous;
    this.previous = current;

    const ms = dt * 1000;
    if (ms < this.thresholdMs) return;

    const frame: LongFrame = {
      at: Math.round(performance.now()),
      ms: Math.round(ms),
      scene: this.sceneId(),
      programs: current.programs - previous.programs,
      geometries: current.geometries - previous.geometries,
      textures: current.textures - previous.textures,
    };

    this.frames.push(frame);
    if (this.frames.length > KEPT) this.frames.shift();

    const cause =
      frame.programs > 0
        ? `${frame.programs} shader${frame.programs > 1 ? 's' : ''} compiled`
        : frame.textures > 0
          ? `${frame.textures} texture${frame.textures > 1 ? 's' : ''} uploaded`
          : frame.geometries > 0
            ? `${frame.geometries} geometries created`
            : 'no renderer work — main thread, GC or decode';

    console.warn(`[frame] ${frame.ms} ms on "${frame.scene}" — ${cause}`);
  }

  get worst(): LongFrame[] {
    return [...this.frames].sort((a, b) => b.ms - a.ms);
  }

  get all(): LongFrame[] {
    return [...this.frames];
  }
}
