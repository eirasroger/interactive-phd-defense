export type RouteHandler = (id: string | null) => void;

/**
 * Hash-based routing.
 *
 * The hash is the single source of truth for presentation position: a
 * refresh or a crash mid-defense returns to the same scene, and the build
 * still works when opened from disk over file:// (which history routing
 * would break).
 */
export class Router {
  private handler: RouteHandler | null = null;

  start(handler: RouteHandler): void {
    this.handler = handler;
    window.addEventListener('hashchange', this.onHashChange);
    handler(this.read());
  }

  stop(): void {
    window.removeEventListener('hashchange', this.onHashChange);
    this.handler = null;
  }

  read(): string | null {
    const raw = window.location.hash.replace(/^#\/?/, '').trim();
    return raw.length > 0 ? raw : null;
  }

  navigate(id: string): void {
    if (this.read() === id) return;
    window.location.hash = `/${id}`;
  }

  /** Sets the hash without adding a history entry. */
  replace(id: string): void {
    const url = `${window.location.pathname}${window.location.search}#/${id}`;
    window.history.replaceState(null, '', url);
  }

  private readonly onHashChange = (): void => {
    this.handler?.(this.read());
  };
}
