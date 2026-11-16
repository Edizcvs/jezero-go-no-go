"""Made by Team DuduBubu, with AI coding assistance (Anthropic Claude, OpenAI Codex).

Record the app's guided tour as the demo video.

Serves dist/ locally, loads index.html?tour&record in headless Microsoft Edge, and
screenshots it at fixed points in (virtual) time. Each frame is a separate headless
run with --virtual-time-budget, so the recording is smooth and repeatable no matter
how fast this machine is. Then FFmpeg joins the frames into an MP4.

Needs: Windows with Microsoft Edge, and `py -m pip install imageio-ffmpeg Pillow`.
"""
import functools
import http.server
import shutil
import subprocess
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
ASSETS = DIST / "assets"
EDGE = Path("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")
W, H = 1280, 720
FPS = 8            # capture rate; the video is resampled to 24 fps
DURATION = 47      # seconds; the tour takes about 45
WORKERS = 6
POSTER_AT = 31.0   # seconds into the tour: the mid-walk decision


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            pass

    handler = functools.partial(Quiet, directory=str(DIST))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def capture(url, ms, path, profile):
    for _ in range(4):  # headless Edge occasionally hangs or exits without writing a frame
        try:
            subprocess.run([str(EDGE), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
                            f"--user-data-dir={profile}", f"--window-size={W},{H}",
                            f"--virtual-time-budget={ms}", f"--screenshot={path}", url],
                           capture_output=True, timeout=60)
        except subprocess.TimeoutExpired:
            continue
        if path.exists():
            return
    raise RuntimeError(f"no frame at {ms} ms")


WATERMARK = "AI-assisted"
FONT = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 12)


def watermark(path):
    """Small, semi-transparent corner label: visible, as Space Apps requires, but quiet."""
    img = Image.open(path).convert("RGBA")
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = draw.textbbox((0, 0), WATERMARK, font=FONT)
    w, h = x1 - x0, y1 - y0
    left, top = W - w - 22, H - h - 16
    draw.rectangle((left - 6, top - 4, left + w + 6, top + h + 5), fill=(30, 28, 25, 150))
    draw.text((left, top - y0), WATERMARK, font=FONT, fill=(244, 239, 229, 230))
    Image.alpha_composite(img, layer).convert("RGB").save(path)


def main():
    assert EDGE.exists(), "Microsoft Edge not found"
    server = serve()
    url = f"http://127.0.0.1:{server.server_address[1]}/index.html?tour&record"
    work = Path(tempfile.mkdtemp(prefix="jezero-demo-"))
    try:
        times = [round(1000 * i / FPS) + 300 for i in range(DURATION * FPS)]

        def job(i):
            capture(url, times[i], work / f"f{i:04d}.png", work / f"profile{i % WORKERS}")
            if i % 40 == 0:
                print(f"frame {i}/{len(times)}", flush=True)

        # One profile per worker slot; frames in a slot run one after another.
        with ThreadPoolExecutor(WORKERS) as pool:
            list(pool.map(lambda s: [job(i) for i in range(s, len(times), WORKERS)], range(WORKERS)))

        # Space Apps rule: SI-assisted videos carry a visible watermark.
        for frame in sorted(work.glob("f*.png")):
            watermark(frame)

        Image.open(work / f"f{int(POSTER_AT * FPS):04d}.png").convert("RGB").save(
            ASSETS / "demo-poster.webp", quality=88)
        subprocess.run([
            imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y",
            "-framerate", str(FPS), "-i", str(work / "f%04d.png"),
            "-vf", f"setpts=PTS*29.5/{DURATION},fps=24",  # Space Apps limit: demo video 30 s or less "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-metadata", "comment=Screen recording of Jezero Go/No-Go by Team DuduBubu (built with AI coding assistance)",
            str(ASSETS / "jezero-demo.mp4"),
        ], check=True)
        print("wrote", ASSETS / "jezero-demo.mp4")
    finally:
        server.shutdown()
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
