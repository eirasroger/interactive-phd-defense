from __future__ import annotations

import math
import re
import sys
from pathlib import Path

Number = float
Token = object

def tokenize(source: str) -> list[Token]:
    tokens: list[Token] = []
    for raw in re.findall(r'%[^\n]*|\{|\}|\[|\]|/?[^\s{}\[\]/%]+|/', source):
        if raw.startswith('%'):
            continue
        try:
            tokens.append(float(raw))
        except ValueError:
            tokens.append(raw)
    return tokens

def parse(tokens: list[Token]) -> list[Token]:
    out: list[Token] = []
    stack: list[list[Token]] = [out]
    for token in tokens:
        if token == '{':
            block: list[Token] = []
            stack[-1].append(block)
            stack.append(block)
        elif token == '}':
            if len(stack) == 1:
                raise ValueError('unbalanced }')
            stack.pop()
        else:
            stack[-1].append(token)
    return out

class Graphics:
    __slots__ = ('ctm', 'colour', 'width')

    def __init__(self, ctm, colour, width):
        self.ctm = ctm
        self.colour = colour
        self.width = width

    def copy(self) -> 'Graphics':
        return Graphics(self.ctm, self.colour, self.width)

def multiply(m, n):
    a, b, c, d, e, f = m
    A, B, C, D, E, F = n
    return (a * A + b * C, a * B + b * D,
            c * A + d * C, c * B + d * D,
            e * A + f * C + E, e * B + f * D + F)

def apply(m, x, y):
    a, b, c, d, e, f = m
    return (a * x + c * y + e, b * x + d * y + f)

class Renderer:
    def __init__(self, glyphs: dict[str, list], origin: tuple[float, float],
                 top: float, page: float):
        self.glyphs = glyphs
        self.origin = origin
        self.top = top
        self.page = page
        self.bounds = None
        self.state = Graphics((1, 0, 0, 1, 0, 0), (0.0, 0.0, 0.0), 1.0)
        self.stack: list[Graphics] = []
        self.operands: list = []
        self.procs: dict[str, list] = {}
        self.path: list[str] = []
        self.point = (0.0, 0.0)
        self.start = (0.0, 0.0)
        self.font_size = 10.0
        self.out: list[str] = []

    def place(self, x, y):
        px, py = apply(self.state.ctm, x, y)
        x, y = px - self.origin[0], self.top - py
        if self.bounds is None:
            self.bounds = [x, y, x, y]
        else:
            self.bounds[0] = min(self.bounds[0], x)
            self.bounds[1] = min(self.bounds[1], y)
            self.bounds[2] = max(self.bounds[2], x)
            self.bounds[3] = max(self.bounds[3], y)
        return x, y

    def moveto(self, x, y):
        self.point = self.start = (x, y)
        self.path.append('M %.3f %.3f' % self.place(x, y))

    def lineto(self, x, y):
        self.point = (x, y)
        self.path.append('L %.3f %.3f' % self.place(x, y))

    def curveto(self, x1, y1, x2, y2, x3, y3):
        self.point = (x3, y3)
        self.path.append('C %.3f %.3f %.3f %.3f %.3f %.3f'
                         % (*self.place(x1, y1), *self.place(x2, y2), *self.place(x3, y3)))

    def close(self):
        if self.path:
            self.path.append('Z')
        self.point = self.start

    def emit(self, fill: bool, rule: str = 'nonzero'):
        if not self.path:
            return
        r, g, b = self.state.colour
        if fill and min(r, g, b) > 0.99 and self.bounds:
            x0, y0, x1, y1 = self.bounds
            if (x1 - x0) * (y1 - y0) > 0.05 * self.page:
                self.path = []
                self.bounds = None
                return
        colour = '#%02x%02x%02x' % (round(r * 255), round(g * 255), round(b * 255))
        d = ' '.join(self.path)
        if fill:
            extra = ' fill-rule="evenodd"' if rule == 'evenodd' else ''
            self.out.append(f'<path d="{d}" fill="{colour}"{extra}/>')
        else:
            scale = math.hypot(self.state.ctm[0], self.state.ctm[1]) or 1.0
            self.out.append(
                f'<path d="{d}" fill="none" stroke="{colour}" '
                f'stroke-width="{self.state.width * scale:.3f}" '
                f'stroke-linecap="butt" stroke-linejoin="round"/>')
        self.path = []
        self.bounds = None

    def run(self, program: list) -> None:
        index = 0
        while index < len(program):
            token = program[index]
            index += 1

            if isinstance(token, float):
                self.operands.append(token)
                continue
            if isinstance(token, list):
                self.operands.append(token)
                continue
            if isinstance(token, str) and token.startswith('/'):
                self.operands.append(token)
                continue

            index = self.execute(token, program, index)

    def pop(self, count: int) -> list[float]:
        if len(self.operands) < count:
            raise ValueError(f'stack underflow wanting {count}')
        values = self.operands[-count:]
        del self.operands[-count:]
        return values

    def execute(self, name: str, program: list, index: int) -> int:
        ops = self.operands

        if name in ('m', 'moveto'):
            x, y = self.pop(2); self.moveto(x, y)
        elif name in ('l', 'lineto'):
            x, y = self.pop(2); self.lineto(x, y)
        elif name in ('r', 'rlineto'):
            dx, dy = self.pop(2); self.lineto(self.point[0] + dx, self.point[1] + dy)
        elif name in ('c', 'curveto'):
            a, b, c, d, e, f = self.pop(6); self.curveto(a, b, c, d, e, f)
        elif name in ('cl', 'closepath'):
            self.close()
        elif name == 'ce':
            self.close(); self.emit(True, 'evenodd')
        elif name == 'box':
            w, h, x, y = self.pop(4)
            self.moveto(x, y); self.lineto(x + w, y); self.lineto(x + w, y + h)
            self.lineto(x, y + h); self.close()
        elif name == 'clipbox':
            self.pop(4); self.path = []          
        elif name == 'clip':
            self.path = []
        elif name == 'newpath':
            self.path = []
        elif name == 'translate':
            x, y = self.pop(2)
            self.state.ctm = multiply((1, 0, 0, 1, x, y), self.state.ctm)
        elif name == 'rotate':
            (angle,) = self.pop(1)
            t = math.radians(angle)
            self.state.ctm = multiply(
                (math.cos(t), math.sin(t), -math.sin(t), math.cos(t), 0, 0), self.state.ctm)
        elif name == 'scale':
            sx, sy = self.pop(2)
            self.state.ctm = multiply((sx, 0, 0, sy, 0, 0), self.state.ctm)
        elif name == 'gsave':
            self.stack.append(self.state.copy())
        elif name == 'grestore':
            if self.stack:
                self.state = self.stack.pop()
        elif name == 'setrgbcolor':
            r, g, b = self.pop(3); self.state.colour = (r, g, b)
        elif name == 'setgray':
            (v,) = self.pop(1); self.state.colour = (v, v, v)
        elif name == 'setlinewidth':
            (w,) = self.pop(1); self.state.width = w
        elif name in ('setlinejoin', 'setlinecap'):
            self.pop(1)
        elif name == '[':
            ops.append('[')
        elif name == ']':
            depth = len(ops) - 1 - ops[::-1].index('[')
            array = ops[depth + 1:]
            del ops[depth:]
            ops.append(array)
        elif name == 'setdash':
            self.pop(2)
        elif name == 'fill':
            self.emit(True)
        elif name == 'eofill':
            self.emit(True, 'evenodd')
        elif name == 'stroke':
            self.emit(False)
        elif name == 'selectfont':
            size, _font = self.pop(1), ops.pop() if ops else None
            self.font_size = size[0]
        elif name == 'glyphshow':
            glyph = ops.pop()
            self.show(glyph[1:] if isinstance(glyph, str) and glyph.startswith('/') else glyph)
        elif name == 'def':
            body = ops.pop(); key = ops.pop()
            if isinstance(key, str) and key.startswith('/') and isinstance(body, list):
                self.procs[key[1:]] = body
        elif name in ('bind', 'load', 'pop', 'showpage', 'begin', 'end', 'sc'):
            if name == 'pop' and ops:
                ops.pop()
            if name == 'sc':
                self.pop(6)
        elif name == 'exch':
            a, b = self.pop(2); ops.extend([b, a])
        elif name == 'dup':
            ops.append(ops[-1])
        elif name == 'neg':
            (v,) = self.pop(1); ops.append(-v)
        elif name == 'index':
            (n,) = self.pop(1); ops.append(ops[-int(n) - 1])
        elif name in self.procs:
            self.run(self.procs[name])
        else:
            raise ValueError(f'unsupported operator: {name}')
        return index

    def show(self, glyph: str) -> None:
        body = self.glyphs.get(glyph)
        if body is None:
            return
        scale = self.font_size / 2048.0
        saved_ctm, saved_path = self.state.ctm, self.path
        self.state.ctm = multiply(
            (scale, 0, 0, scale, self.point[0], self.point[1]), self.state.ctm)
        self.path = []
        self.run(body)
        self.emit(True, 'evenodd')
        self.state.ctm, self.path = saved_ctm, saved_path

# Type 3 glyphs are plain path procedures in 1/2048 font units.
def glyph_table(source: str) -> dict[str, list]:
    block = source[source.find('/CharStrings'):]
    table: dict[str, list] = {}
    for match in re.finditer(r'/(uni[0-9A-Fa-f]+)\s*\{([\s\S]*?)\}\s*_d', block):
        table[match.group(1)] = parse(tokenize(match.group(2)))
    return table

def convert(source_path: Path, destination: Path) -> None:
    source = source_path.read_text(encoding='latin-1')

    box = re.search(r'%%HiResBoundingBox:\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)', source)
    if not box:
        raise ValueError('no HiResBoundingBox')
    x0, y0, x1, y1 = (float(v) for v in box.groups())
    width, height = x1 - x0, y1 - y0

    content = source[source.find('%%EndProlog') + len('%%EndProlog'):]
    content = content.replace('mpldict begin', '', 1)

    renderer = Renderer(glyph_table(source), (x0, y0), y1, width * height)
    renderer.run(parse(tokenize(content)))

    body = '\n'.join(renderer.out)
    destination.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.2f} {height:.2f}" '
        f'width="{width:.2f}" height="{height:.2f}">\n{body}\n</svg>\n',
        encoding='utf-8')
    size = destination.stat().st_size / 1024
    print(f'[figures] {source_path.name} -> {destination.name} '
          f'{width:.0f}x{height:.0f} ({size:.0f} KB, {len(renderer.out)} paths)')

if __name__ == '__main__':
    convert(Path(sys.argv[1]), Path(sys.argv[2]))
