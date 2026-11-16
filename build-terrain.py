"""Crop the USGS CTX mosaic into a hillshade image and a compact elevation grid.

Routes are no longer precomputed here: the browser plans them live from the grid
(see dist/planner.js), so visitors can place their own science stops.
"""
import base64
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

# Hillshade basemap printed on paper: shading darkens a warm paper tone, and
# higher ground is washed slightly lighter, like a printed relief chart.
dy, dx = np.gradient(grid, 20)
light = np.clip((0.62 + dx * 1.15 - dy * 1.15) / np.sqrt(1 + dx**2 + dy**2), 0, 1)
low, high = np.percentile(grid, [3, 97])
elevation_tone = np.clip((grid - low) / (high - low), 0, 1)
shade = np.clip(0.80 + 0.32 * (light - 0.62) + 0.06 * elevation_tone, 0.55, 1.0)
paper = np.array([244, 239, 229], dtype=float)
colors = paper * shade[..., None]
Image.fromarray(colors.astype(np.uint8)).resize((width * 4, height * 4), Image.Resampling.BICUBIC).save(
    ASSETS / "terrain.webp", quality=92)


def cell(lon, lat):
    x, y = ~transform * (lon * XSCALE, lat * YSCALE)
    return [int(x), int(y)]


# Elevation as uint16 decimetres above the window minimum, little-endian, base64.
minimum = float(grid.min())
decimetres = np.round((grid - minimum) * 10)
assert decimetres.max() < 65535
encoded = base64.b64encode(decimetres.astype("<u2").tobytes()).decode("ascii")

result = {
    "width": width, "height": height, "pixelMeters": 20,
    "bounds": [transform.c / XSCALE, (transform.f - height * 20) / YSCALE,
               (transform.c + width * 20) / XSCALE, transform.f / YSCALE],
    "minElevation": round(minimum, 2),
    "elevation": encoded,
    "habitat": cell(77.447, 18.443),
    "stops": {"delta": cell(77.408, 18.457), "floor": cell(77.424, 18.445)},
}
(ASSETS / "terrain-data.js").write_text(
    "window.JEZERO_DATA = " + json.dumps(result, separators=(",", ":")) + ";\n", encoding="utf-8")
print(width, "x", height, "cells; elevation", round(minimum), "to", round(float(grid.max())), "m")
