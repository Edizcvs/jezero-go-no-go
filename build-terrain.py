"""Crop the USGS CTX mosaic and calculate illustrative, terrain-aware traverses."""
import heapq
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.windows import from_bounds

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "dist" / "assets"
RADIUS = 3396190
XSCALE = math.pi / 180 * RADIUS * math.cos(math.radians(18.4663))
YSCALE = math.pi / 180 * RADIUS
WEST, SOUTH, EAST, NORTH = 77.365, 18.418, 77.465, 18.488

with rasterio.open(ROOT / "terrain.tif") as dataset:
    window = from_bounds(WEST * XSCALE, SOUTH * YSCALE, EAST * XSCALE, NORTH * YSCALE,
                         transform=dataset.transform).round_offsets().round_lengths()
    transform = dataset.window_transform(window)
    grid = dataset.read(1, window=window, masked=True).filled(np.nan)

height, width = grid.shape
assert np.isfinite(grid).all()
dy, dx = np.gradient(grid, 20)
light = np.clip((0.62 + dx * 1.15 - dy * 1.15) / np.sqrt(1 + dx**2 + dy**2), 0, 1)
low, high = np.percentile(grid, [3, 97])
elevation_tone = np.clip((grid - low) / (high - low), 0, 1)
tone = np.clip(light * .64 + elevation_tone * .21, 0, 1)
colors = np.stack([36 + 201 * tone, 27 + 145 * tone, 25 + 113 * tone], axis=-1)
Image.fromarray(colors.astype(np.uint8)).resize((width * 4, height * 4), Image.Resampling.BICUBIC).save(
    ASSETS / "terrain.webp", quality=92)

def cell(lon, lat):
    x, y = ~transform * (lon * XSCALE, lat * YSCALE)
    return int(y), int(x)

base = cell(77.447, 18.443)
stops = {
    "delta": cell(77.408, 18.457),
    "floor": cell(77.424, 18.445),
}
moves = [(dy, dx, 20 * math.hypot(dy, dx))
         for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]

def routes(penalty, maximum_grade):
    best = {base: 0}
    previous = {}
    queue = [(0, base)]
    pending = set(stops.values())
    while queue and pending:
        cost, point = heapq.heappop(queue)
        if cost != best[point]:
            continue
        pending.discard(point)
        y, x = point
        for dy, dx, distance in moves:
            yy, xx = y + dy, x + dx
            if not (0 <= yy < height and 0 <= xx < width):
                continue
            grade = abs(float(grid[yy, xx]) - float(grid[y, x])) / distance
            if grade > maximum_grade:
                continue
            neighbor = (yy, xx)
            score = cost + distance * (1 + penalty * grade**2)
            if score < best.get(neighbor, math.inf):
                best[neighbor] = score
                previous[neighbor] = point
                heapq.heappush(queue, (score, neighbor))
    assert not pending, pending
    result = {}
    for key, end in stops.items():
        points = [end]
        while points[-1] != base:
            points.append(previous[points[-1]])
        result[key] = list(reversed(points))
    return result

def serialize(points):
    total = 0
    peak = 0
    gain = 0
    vertices = []
    for y, x in points:
        z = float(grid[y, x])
        if vertices:
            step = 20 * math.hypot(y - last_y, x - last_x)
            total += step
            dz = z - last_z
            gain += max(dz, 0)
            peak = max(peak, math.degrees(math.atan(abs(dz) / step)))
        vertices.append([x + .5, y + .5, round(z, 2), round(total, 2)])
        last_y, last_x, last_z = y, x, z
    return {"points": vertices, "distance": round(total, 2), "gain": round(gain, 1),
            "peak": round(peak, 1)}

short = routes(0, .55)
gentle = routes(24, .22)
result = {"width": width, "height": height, "pixelMeters": 20,
          "bounds": [transform.c / XSCALE, (transform.f - height * 20) / YSCALE,
                     (transform.c + width * 20) / XSCALE, transform.f / YSCALE],
          "routes": {k: {"direct": serialize(short[k]), "gentle": serialize(gentle[k])}
                     for k in stops}}
(ASSETS / "terrain-data.js").write_text(
    "window.JEZERO_DATA = " + json.dumps(result, separators=(",", ":")) + ";\n", encoding="utf-8")
for name, options in result["routes"].items():
    print(name, {k: (v["distance"], v["gain"], v["peak"]) for k, v in options.items()})
