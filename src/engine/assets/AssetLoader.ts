import { LoadingManager, type Texture, TextureLoader } from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { quality } from '@/config/quality';

export type AssetKind = 'model' | 'texture';

export interface AssetEntry {
  readonly id: string;
  readonly url: string;
  readonly kind: AssetKind;
}

export type ProgressHandler = (loaded: number, total: number) => void;

/**
 * Loads and caches models and textures.
 *
 * Every asset is fetched at most once and kept for the lifetime of the
 * presentation: total payload is small enough to hold in memory, and a scene
 * revisited during questions must appear instantly rather than reload.
 *
 * The Draco decoder is emitted into the bundle by Vite and fetched lazily on
 * first compressed model, so nothing is loaded from the network at runtime.
 */
export class AssetLoader {
  private readonly manager = new LoadingManager();
  private readonly gltf: GLTFLoader;
  private readonly textures: TextureLoader;
  private readonly draco: DRACOLoader;

  private readonly entries = new Map<string, AssetEntry>();
  private readonly cache = new Map<string, Promise<GLTF | Texture>>();

  constructor() {
    // No setDecoderPath: three declares its decoder URLs with
    // `new URL(..., import.meta.url)`, which Vite rewrites at build time to
    // hashed, base-correct asset paths. Overriding it would mean shipping and
    // maintaining a second copy of the decoder for no gain.
    this.draco = new DRACOLoader(this.manager);

    this.gltf = new GLTFLoader(this.manager);
    this.gltf.setDRACOLoader(this.draco);

    this.textures = new TextureLoader(this.manager);
  }

  register(entries: readonly AssetEntry[]): void {
    for (const entry of entries) this.entries.set(entry.id, entry);
  }

  /** Resolves once every requested asset is available. */
  async load(ids: readonly string[], onProgress?: ProgressHandler): Promise<void> {
    const pending = ids.filter((id) => !this.cache.has(id));
    let completed = ids.length - pending.length;

    onProgress?.(completed, ids.length);

    await Promise.all(
      ids.map(async (id) => {
        const wasCached = this.cache.has(id);
        await this.request(id);
        if (!wasCached) {
          completed += 1;
          onProgress?.(completed, ids.length);
        }
      }),
    );
  }

  /** Warms the cache without blocking. Failures are deliberately swallowed. */
  prefetch(ids: readonly string[]): void {
    for (const id of ids) {
      void this.request(id).catch(() => undefined);
    }
  }

  model(id: string): GLTF {
    const value = this.resolved.get(id);
    if (!value) throw new Error(`Model "${id}" was not loaded before use.`);
    return value as GLTF;
  }

  texture(id: string): Texture {
    const value = this.resolved.get(id);
    if (!value) throw new Error(`Texture "${id}" was not loaded before use.`);
    return value as Texture;
  }

  has(id: string): boolean {
    return this.resolved.has(id);
  }

  private readonly resolved = new Map<string, GLTF | Texture>();

  private request(id: string): Promise<GLTF | Texture> {
    const existing = this.cache.get(id);
    if (existing) return existing;

    const entry = this.entries.get(id);
    if (!entry) {
      return Promise.reject(new Error(`Unknown asset "${id}". Register it in the manifest.`));
    }

    const promise =
      entry.kind === 'model' ? this.loadModel(entry.url) : this.loadTexture(entry.url);

    const tracked = promise.then((value) => {
      this.resolved.set(id, value);
      return value;
    });

    this.cache.set(id, tracked);
    return tracked;
  }

  private loadModel(url: string): Promise<GLTF> {
    return this.gltf.loadAsync(url);
  }

  private async loadTexture(url: string): Promise<Texture> {
    const texture = await this.textures.loadAsync(url);
    texture.anisotropy = quality.anisotropy;
    return texture;
  }

  dispose(): void {
    this.draco.dispose();
    for (const value of this.resolved.values()) {
      if ('isTexture' in value) (value as Texture).dispose();
    }
    this.resolved.clear();
    this.cache.clear();
  }
}
