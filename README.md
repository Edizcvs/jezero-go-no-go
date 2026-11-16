# Jezero Go/No-Go

Team DuduBubu's educational Marswalk simulator for the 2026 NASA Space Apps Interplanetary Survival Guide challenge.

Serve `dist/` over HTTP: run `py -m http.server 8294 --directory dist` and open `http://localhost:8294`. No backend is needed. Publish the contents of `dist/` to host it. Planner checks run at `http://localhost:8294/check.html` (the tab title reads PASS or FAIL).

Files: `dist/planner.js` is the routing engine (pure functions, tested by `check.html`), `dist/app.js` is the interface, `build-terrain.py` makes the hillshade and elevation grid.

## Try the scenario

Press **▶ Guided tour** (or open `index.html?tour`) for a hands-off walkthrough (the demo video is a 30-second sped-up recording of it). The map is keyboard-accessible: focus it, move the crosshair with the arrow keys (Shift for bigger steps) and press Enter to add a site.

1. The default plan visits the west fan: GO, 141 min against a 150 min safe return (160 min budget minus 10 min reserve).
2. Press **Mission Control: −30 min**. It is now NO-GO, and the map marks the point of no return where the crew must turn back. Apply the suggested best plan (crater floor, 84 min).
3. Click anywhere on the map to add your own site, give it a science value, and press **Best plan for this budget**.
4. Tick both preset sites, raise the budget to about 185 min and press **Start EVA**. Mission Control cuts the time at a random moment. Choose to continue, re-plan from where the crew stands, or turn back.

## Data and methods

- [Mars 2020 Science Investigation CTX DEM Mosaic](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic), USGS Astrogeology Science Center. The 20 m/pixel Mars Reconnaissance Orbiter Context Camera elevation mosaic supplies the basemap, graph nodes, sampled elevations and grade estimates.
- [The Scarps of Jezero Crater's Delta](https://science.nasa.gov/resource/the-scarps-of-jezero-craters-delta/) and [Perseverance Rover's View of South Séítah](https://science.nasa.gov/resource/perseverance-rovers-view-of-south-seitah/), NASA/JPL-Caltech/ASU/MSSS. Mastcam-Z images illustrate the two regional science objectives.
- [Geologic map of Jezero crater and Nili Planum](https://www.usgs.gov/maps/geologic-map-jezero-crater-and-nili-planum-region-mars), USGS. Regional geologic context.

The browser runs an eight-neighbour Dijkstra search on the 281 × 207 elevation grid, and each step costs walking time. Speed follows Tobler's hiking function (normalised to the chosen flat-ground speed), so climbs are slower and outbound and return times differ. Steps steeper than 30% are impassable. "Gentler slopes" weights time by `1 + 12 × grade²`. Multi-site plans try every visiting order. "Best plan" tries every subset and picks the highest science value that fits. The time limit is min(Mission Control budget, suit life support) minus 10 minutes of reserve. The point of no return is the first spot on the plan where the fastest route home would arrive late. Tobler's function is an Earth hiking model, and habitat and site positions are illustrative. The tool is educational and models time only.

## Rebuild

Download the [CTX elevation GeoTIFF](https://asc-pds-services.s3.us-west-2.amazonaws.com/mosaic/mars2020_trn/CTX/ScienceInvestigationMaps_JPL/M20_JezeroCrater_CTXDEM_20m.tif) as `terrain.tif` in this directory.

```powershell
py -m pip install numpy Pillow rasterio imageio-ffmpeg
py build-terrain.py
py build-demo.py
```

`build-demo.py` records the guided tour of the real app as `dist/assets/jezero-demo.mp4`. It uses headless Microsoft Edge with virtual time, so the recording is repeatable, and takes a few minutes. The app uses Newsreader, IBM Plex Sans and IBM Plex Mono from Google Fonts, with system fallbacks. Made by Team DuduBubu, with AI coding assistance for parts of the code, text, terrain processing and demo. The elevation observations and rover photos come from the credited missions.
