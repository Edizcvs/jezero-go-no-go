# Jezero Go/No-Go

Team Ediz's educational Marswalk simulator for the 2026 NASA Space Apps Interplanetary Survival Guide challenge.

Open `dist/index.html` in a browser. The app runs locally without a backend. To serve it over HTTP, run `py -m http.server 8294 --directory dist` and open `http://localhost:8294`. The demo is at `dist/demo.html`. The site can be hosted by publishing the contents of `dist/`.

## Try the scenario

1. Start at the west fan with the default 150-minute budget and 2.5 km/h walking speed. The estimate is 146 minutes.
2. Apply the simulated 20-minute cut. The west fan is 16 minutes over budget.
3. Switch to the crater floor. The estimate drops to 89 minutes, leaving 41 minutes above the modeled reserve.
4. Switch between the shortest and lower-grade traverses to inspect changes in the elevation profile.

## Data and methods

- [Mars 2020 Science Investigation CTX DEM Mosaic](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic), USGS Astrogeology Science Center. The 20 m/pixel Mars Reconnaissance Orbiter Context Camera elevation mosaic supplies the basemap, graph nodes, sampled elevations and grade estimates.
- [The Scarps of Jezero Crater's Delta](https://science.nasa.gov/resource/the-scarps-of-jezero-craters-delta/) and [Perseverance Rover's View of South Séítah](https://science.nasa.gov/resource/perseverance-rovers-view-of-south-seitah/), NASA/JPL-Caltech/ASU/MSSS. Mastcam-Z images illustrate the two regional science objectives.
- [Geologic map of Jezero crater and Nili Planum](https://www.usgs.gov/maps/geologic-map-jezero-crater-and-nili-planum-region-mars), USGS. Regional geologic context.

The terrain builder uses an eight-neighbor Dijkstra search. The shortest traverse minimizes planar distance across edges with absolute grade no greater than 55%. The lower-grade traverse caps edge grade at 22% and minimizes the sum of distance multiplied by `1 + 24 × grade²`. These caps are illustrative routing settings. The simulator assumes the same walking speed in both directions and returns over the outbound path. It adds 20 minutes for fieldwork and 5 minutes of reserve. Habitat and science stop positions are illustrative. Photos give regional context. The educational decision models time only.

## Rebuild

Download the [CTX elevation GeoTIFF](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif) as `terrain.tif` in this directory.

```powershell
py -m pip install numpy Pillow rasterio imageio-ffmpeg
py build-terrain.py
py build-demo.py
```

The demo renderer uses Windows Segoe UI and Consolas fonts. The app uses Instrument Sans and IBM Plex Mono from Google Fonts, with system fallbacks. Code, copy, terrain processing, and demo production used OpenAI Codex assistance. The elevation observations and rover photos come from the credited missions.
