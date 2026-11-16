"""Render a captioned demo using the simulator's routes and Mars assets."""
import json
import math
import subprocess
from itertools import accumulate
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent
ASSETS = ROOT / "dist" / "assets"
DATA = json.loads((ASSETS / "terrain-data.js").read_text().split(" = ", 1)[1].strip().rstrip(";"))
MAP = Image.open(ASSETS / "terrain.webp").convert("RGB")
W, H = 1280, 720
BG, WHITE, FADED, PEACH = "#171413", "#fff5ef", "#cbbab0", "#ffc09c"
GREEN, RED = "#b9ebbd", "#ffad94"
FONT_DIR = Path("C:/Windows/Fonts")

def draw_text(draw, xy, text, size, color=WHITE, bold=False, mono=False):
    name = "consola.ttf" if mono else "segoeuib.ttf" if bold else "segoeui.ttf"
    draw.text(xy, text, fill=color, font=ImageFont.truetype(str(FONT_DIR / name), size))

def minutes(key):
    distance = DATA["routes"][key]["direct"]["distance"]
    return math.ceil(distance * 2 / 1000 / 2.5 * 60 + 25)

def frame(title, lines, selected, budget, source_image, status=""):
    page = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(page)
    draw_text(draw, (48, 29), "TEAM EDIZ  /  MARSWALK SIMULATOR", 18, PEACH, mono=True)
    draw_text(draw, (47, 58), title, 55, bold=True)
    field = MAP.resize((702, 522), Image.Resampling.LANCZOS)
    page.paste(field, (48, 136))
    draw.rounded_rectangle((777, 136, 1231, 658), radius=15, fill="#241e1b", outline="#5c473c", width=2)
    def point(p):
        return (48 + p[0] / DATA["width"] * 702, 136 + p[1] / DATA["height"] * 522)
    for target in [key for key in DATA["routes"] if key != selected] + [selected]:
        coords = [point(p) for p in DATA["routes"][target]["direct"]["points"]]
        draw.line(coords, fill="#241410", width=8, joint="curve")
        draw.line(coords, fill=PEACH if target == selected else "#aaa29b", width=4, joint="curve")
    nodes = [
        ("A", DATA["routes"]["delta"]["direct"]["points"][-1], "West fan", "delta"),
        ("B", DATA["routes"]["floor"]["direct"]["points"][-1], "Crater floor", "floor"),
        ("H", DATA["routes"]["delta"]["direct"]["points"][0], "Habitat", "base"),
    ]
    for label, cell, name, key in nodes:
        px, py = point(cell)
        draw.ellipse((px - 13, py - 13, px + 13, py + 13),
                     fill=PEACH if selected == key else "#2c201d", outline=WHITE, width=1)
        draw_text(draw, (px - 6, py - 10), label, 16, BG if selected == key else WHITE, bold=True)
        text_x, text_y = (px + 19, py - 18) if key == "delta" else (px - 19 - len(name) * 10, py + 14)
        draw.rounded_rectangle((text_x - 4, text_y, text_x + len(name) * 10 + 8, text_y + 25),
                               radius=4, fill="#291d19")
        draw_text(draw, (text_x, text_y), name, 16)
    draw_text(draw, (801, 157), "ROUND-TRIP TIME BUDGET", 18, FADED, mono=True)
    draw_text(draw, (800, 179), f"{budget} min", 49, bold=True)
    stop_time = minutes(selected)
    left = budget - stop_time
    draw_text(draw, (801, 253), status or ("GO" if left >= 0 else "NO-GO"), 24,
              GREEN if left >= 0 else RED, bold=True, mono=True)
    draw_text(draw, (801, 292), f"{stop_time} min planned  /  {abs(left)} min {'extra' if left >= 0 else 'over'}",
              22, PEACH)
    for i, line in enumerate(lines):
        draw_text(draw, (801, 342 + 33 * i), line, 22)
    photo = ImageOps.fit(Image.open(ASSETS / source_image).convert("RGB"), (405, 165))
    page.paste(photo, (801, 448))
    draw_text(draw, (801, 620), "MARS 2020  /  PERSEVERANCE MASTCAM-Z", 14, FADED, mono=True)
    draw_text(draw, (48, 679), "Terrain: MRO CTX / USGS   ·   Photo: NASA/JPL-Caltech/ASU/MSSS", 15, FADED)
    draw_text(draw, (899, 680), "CREATED WITH OPENAI CODEX ASSISTANCE", 15, FADED, mono=True)
    return page

slides = [
    (7, frame("Jezero Go/No-Go", ["Can we reach the ancient delta,", "study it, and make it back?"], "delta", 150, "scarp.jpg")),
    (7, frame("Mission Control cuts 20 minutes", ["The west fan is now 16 minutes", "past the round-trip limit."], "delta", 130, "scarp.jpg")),
    (8, frame("Switch to the crater floor", ["The crew can study a closer", "geologic target and return", "with 41 minutes to spare."], "floor", 130, "floor.jpg")),
    (7, frame("Real terrain. A simulated decision.", ["20 m CTX elevation sets the routes.", "Perseverance shows the geology.", "Walking speed is adjustable."], "floor", 130, "floor.jpg")),
]
slides[0][1].save(ASSETS / "demo-poster.webp", quality=88)
process = subprocess.Popen([
    imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y",
    "-f", "rawvideo", "-pixel_format", "rgb24", "-video_size", f"{W}x{H}", "-framerate", "2",
    "-i", "-", "-vf", "fps=24", "-c:v", "libx264", "-crf", "21", "-pix_fmt", "yuv420p",
    "-movflags", "+faststart", "-metadata", "comment=Created with OpenAI Codex assistance",
    str(ASSETS / "jezero-demo.mp4"),
], stdin=subprocess.PIPE)
with process.stdin as pipe:
    for seconds, slide in slides:
        data = slide.tobytes()
        for _ in range(seconds * 2):
            pipe.write(data)
assert process.wait() == 0
