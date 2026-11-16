# Jezero Go/No-Go

Team Ediz · 2026 NASA Space Apps Challenge · Interplanetary Survival Guide: Martian Map

## High-level project summary

Jezero Go/No-Go is an interactive Marswalk planner. A visitor plans a walk to science sites across real Mars Reconnaissance Orbiter terrain and sees whether the crew can get home in time. The map shows where the crew must turn back. The visitor then runs the EVA. When Mission Control cuts the time mid-walk, they decide whether to continue, re-plan or turn back.

## Detailed project description

The crew starts at a simulated habitat in western Jezero Crater. Visitors pick science sites, including their own sites clicked anywhere on the map, and give each a science value. The planner computes terrain-aware routes live in the browser. Walking speed depends on slope, so climbs are slower and the trip back takes a different time from the trip out. The planner finds the fastest visiting order and gives a GO or NO-GO against the time limit. The limit is the Mission Control budget or the suit's life support, whichever is shorter, minus a 10-minute reserve. For a NO-GO plan the map marks the point of no return: the first spot where the fastest way home would arrive too late. A shaded overlay shows the area the crew could not reach and still return from. "Best plan" picks the most valuable set of sites that still fits.

Then the visitor starts the EVA. At an unexpected moment Mission Control cuts 30 minutes. The planner recalculates from the crew's current position and offers three choices: continue, re-plan to the most valuable remaining sites, or turn back now. Each choice shows its new return time. With the default settings, the west fan takes 141 minutes against a 150-minute safe return. After a 30-minute cut it becomes NO-GO, and the crater floor (84 minutes) is the plan that fits. A 45-second guided tour shows the whole flow without any clicks. The map also works with the keyboard and on phones.

We used Python, Rasterio, NumPy and Pillow to turn the USGS CTX elevation mosaic into a hillshade and a compact elevation grid. The app uses HTML, CSS, JavaScript and Canvas, with no backend. Routing runs Dijkstra's algorithm over each cell's eight neighbours, costed by walking time from Tobler's hiking function. The planner tries every visiting order and every subset of sites. A browser test page checks the engine. Tobler's function is an Earth hiking model, and the site positions are illustrative. The tool is meant for education and shows how terrain, time and science priorities shape a go/no-go call.

## NASA data

- [Mars 2020 Science Investigation CTX DEM Mosaic](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic). The application uses the 20 m/pixel Mars Reconnaissance Orbiter Context Camera elevation mosaic to compute and visualize traverses.
- [The Scarps of Jezero Crater's Delta](https://science.nasa.gov/resource/the-scarps-of-jezero-craters-delta/) and [Perseverance Rover's View of South Séítah](https://science.nasa.gov/resource/perseverance-rovers-view-of-south-seitah/). Mastcam-Z photographs show the regional geology behind the science objectives. Credit NASA/JPL-Caltech/ASU/MSSS.

## Other references and tools

- [USGS Geologic map of Jezero crater and the Nili Planum region](https://www.usgs.gov/maps/geologic-map-jezero-crater-and-nili-planum-region-mars)
- Tobler, W. (1993). Three presentations on geographical analysis and modeling. NCGIA Technical Report 93-1 (hiking function).
- [Rasterio](https://rasterio.readthedocs.io/), [NumPy](https://numpy.org/), [Pillow](https://python-pillow.org/), and [FFmpeg](https://ffmpeg.org/)
- [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) and [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono)

## Super Intelligence disclosure

The Marswalk Go/No-Go concept was conceived by Team Ediz. AI coding assistants (OpenAI Codex and Anthropic Claude) helped research sources, implement and test the simulator, process the terrain data, draft and edit submission text, and produce the demo video. NASA and USGS supplied the underlying Mars observations and imagery. The project and video credit this AI assistance.
