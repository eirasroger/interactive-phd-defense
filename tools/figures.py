from __future__ import annotations

import sys
from pathlib import Path

import numpy
import pymupdf
from PIL import Image

sys.path.append(str(Path(__file__).resolve().parent))

from eps_to_svg import convert as eps_to_svg

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "assets" / "presentation" / "paper1figures"
OUTPUT = ROOT / "src" / "assets" / "figures"

WIDTH = 2000

def unmultiply_white(rgb: numpy.ndarray) -> numpy.ndarray:
    """Recover the alpha a drawing on white would have had, so the figure sits
    on the projection with no rectangle around it. `src = a*c + (1-a)*255`.
    """
    values = rgb.astype(numpy.float32)
    alpha = 1.0 - values.min(axis=2) / 255.0
    safe = numpy.maximum(alpha, 1e-4)[..., None]
    colour = (values - 255.0 * (1.0 - safe)) / safe
    out = numpy.zeros(rgb.shape[:2] + (4,), dtype=numpy.uint8)
    out[..., :3] = numpy.clip(colour, 0, 255).astype(numpy.uint8)
    out[..., 3] = numpy.clip(alpha * 255.0, 0, 255).astype(numpy.uint8)
    return out

def render_pdf(source: Path, destination: Path) -> None:
    doc = pymupdf.open(source)
    page = doc[0]
    zoom = WIDTH / page.rect.width
    pixmap = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
    rgb = numpy.frombuffer(pixmap.samples, dtype=numpy.uint8)
    rgb = rgb.reshape(pixmap.height, pixmap.width, pixmap.n)[..., :3]
    Image.fromarray(unmultiply_white(rgb), mode="RGBA").save(destination, optimize=True)
    doc.close()
    print(f"[figures] {source.name} -> {destination.name} "
          f"{pixmap.width}x{pixmap.height} "
          f"({destination.stat().st_size / 1024:.0f} KB, white keyed out)")

def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    found = 0

    for source in sorted(SOURCE.glob("*.pdf")):
        render_pdf(source, OUTPUT / f"{source.stem}.png")
        found += 1

    for source in sorted(SOURCE.glob("*.eps")):
        eps_to_svg(source, OUTPUT / f"{source.stem}.svg")
        found += 1

    if not found:
        print(f"[figures] nothing to do: no PDF or EPS in {SOURCE}", file=sys.stderr)

if __name__ == "__main__":
    main()
