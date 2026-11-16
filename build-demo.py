"""Record the app's guided tour as the demo video.

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
from PIL import Image

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
    for _ in range(3):  # headless Edge occasionally exits without writing a frame
        subprocess.run([str(EDGE), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio",
                        f"--user-data-dir={profile}", f"--window-size={W},{H}",
                        f"--virtual-time-budget={ms}", f"--screenshot={path}", url],
                       capture_output=True, timeout=120)
        if path.exists():
            return
    raise RuntimeError(f"no frame at {ms} ms")


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

        Image.open(work / f"f{int(POSTER_AT * FPS):04d}.png").convert("RGB").save(
            ASSETS / "demo-poster.webp", quality=88)
        subprocess.run([
            imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y",
            "-framerate", str(FPS), "-i", str(work / "f%04d.png"),
            "-vf", "fps=24", "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            "-metadata", "comment=Screen recording of Jezero Go/No-Go by Team Ediz (built with AI coding assistance)",
            str(ASSETS / "jezero-demo.mp4"),
        ], check=True)
        print("wrote", ASSETS / "jezero-demo.mp4")
    finally:
        server.shutdown()
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    main()
