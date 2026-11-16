# Jezero Go/No-Go

Team Ediz · 2026 NASA Space Apps Challenge · Interplanetary Survival Guide: Martian Map

## High-level project summary

Jezero Go/No-Go is an interactive Marswalk planner that lets a visitor decide whether a crew can reach a science stop and return within a simulated time budget. It combines topography from the Mars Reconnaissance Orbiter with ground-level Perseverance imagery. When Mission Control cuts the available time, the visitor can inspect the impact on the planned route and switch to a closer science objective.

## Detailed project description

Start at a simulated habitat in western Jezero Crater. Choose a science stop and compare the shortest traverse with one that penalizes steeper terrain. The map and elevation profile show distance, climb, peak sampled grade, and estimated round-trip time. One click reduces the budget by 20 minutes. Under the default assumptions, the west fan needs 146 minutes, which exceeds the revised 130-minute budget. The crater-floor alternative takes 89 minutes, so the crew can still conduct fieldwork and return with time to spare.

We used Python, Rasterio, NumPy, and Pillow to crop the USGS elevation mosaic and calculate routes. The interactive app uses HTML, CSS, JavaScript, and Canvas. Dijkstra's algorithm searches an eight-neighbor elevation grid with either distance or grade-weighted distance as the cost. A constant walking speed, 20 minutes for science, and 5 minutes of return reserve are simulation assumptions. The app supports educational mission planning and illustrates how time, terrain, and science goals inform a decision.

## NASA data

- [Mars 2020 Science Investigation CTX DEM Mosaic](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic). The application uses the 20 m/pixel Mars Reconnaissance Orbiter Context Camera elevation mosaic to compute and visualize traverses.
- [The Scarps of Jezero Crater's Delta](https://science.nasa.gov/resource/the-scarps-of-jezero-craters-delta/) and [Perseverance Rover's View of South Séítah](https://science.nasa.gov/resource/perseverance-rovers-view-of-south-seitah/). Mastcam-Z photographs show the regional geology behind the science objectives. Credit NASA/JPL-Caltech/ASU/MSSS.

## Other references and tools

- [USGS Geologic map of Jezero crater and the Nili Planum region](https://www.usgs.gov/maps/geologic-map-jezero-crater-and-nili-planum-region-mars)
- [Rasterio](https://rasterio.readthedocs.io/), [NumPy](https://numpy.org/), [Pillow](https://python-pillow.org/), and [FFmpeg](https://ffmpeg.org/)
- [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans) and [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono)

## Super Intelligence disclosure

OpenAI Codex proposed the Marswalk-planning concept and helped research the sources, implement and test the simulator, process the terrain data, draft submission text, and produce the demo video. NASA and USGS supplied the underlying Mars observations and imagery. The project and video credit Codex assistance.

## Submission review

The [2026 Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) says AI may accelerate the project but should not originate the solution idea. The concept in this draft was proposed by Codex. Review this with your team and an organizer before submitting it as a judged entry. Update the description and disclosure to reflect the team’s actual contributions.

The Project Demo field requires a public link that opens without a sign-in. The included `dist/assets/jezero-demo.mp4` is 29 seconds. The bundled `dist/demo.html` player can be used if hosted publicly. For the Universal Event, submission closes on November 15 at 11:59 p.m. in the team owner's local time. The [Participant FAQ](https://www.spaceappschallenge.org/resources/participant-faqs/) requires at least two registered Universal Event participants for global judging.
