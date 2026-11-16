const data = window.JEZERO_DATA;
const byId = (id) => document.getElementById(id);
const map = byId("map-canvas");
const chart = byId("profile-chart");
const hillshade = new Image();
const budget = byId("budget");
const speed = byId("speed");
const verdict = byId("verdict");
const scienceMinutes = 20;
const reserveMinutes = 5;
const stops = {
  delta: {
    name: "West fan",
    image: "scarp.jpg",
    alt: "Perseverance Mastcam-Z panorama of scarps on the western delta",
    text: "Exposed layers in the ancient delta preserve clues about how rivers carried sediment into Jezero’s lake.",
    source: "https://science.nasa.gov/resource/the-scarps-of-jezero-craters-delta/",
  },
  floor: {
    name: "Crater floor",
    image: "floor.jpg",
    alt: "Perseverance Mastcam-Z mosaic of rocks at South Séítah",
    text: "Crater-floor rocks offer a second science objective. Perseverance studied and sampled igneous units here to learn about Jezero’s early history.",
    source: "https://science.nasa.gov/resource/perseverance-rovers-view-of-south-seitah/",
  },
};
let selectedStop = "delta";
let selectedRoute = "direct";
let appliedCut = false;
let renderedStop;

function planMinutes(route) {
  return Math.ceil((route.distance * 2 / 1000) / Number(speed.value) * 60
    + scienceMinutes + reserveMinutes);
}

function sizeCanvas(canvas) {
  const { width, height } = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  return { context, width, height };
}

function drawMap() {
  const { context: ctx, width, height } = sizeCanvas(map);
  const scale = Math.min(width / data.width, height / data.height);
  const x0 = (width - data.width * scale) / 2;
  const y0 = (height - data.height * scale) / 2;
  const x = (value) => x0 + value * scale;
  const y = (value) => y0 + value * scale;
  ctx.fillStyle = "#261c19";
  ctx.fillRect(0, 0, width, height);
  if (hillshade.complete && hillshade.naturalWidth) {
    ctx.drawImage(hillshade, x0, y0, data.width * scale, data.height * scale);
  }
  ctx.strokeStyle = "#fff2dc24";
  ctx.lineWidth = 1;
  for (let col = 25; col < data.width; col += 25) {
    ctx.beginPath();
    ctx.moveTo(x(col), y(0));
    ctx.lineTo(x(col), y(data.height));
    ctx.stroke();
  }
  for (let row = 25; row < data.height; row += 25) {
    ctx.beginPath();
    ctx.moveTo(x(0), y(row));
    ctx.lineTo(x(data.width), y(row));
    ctx.stroke();
  }
  function trace(route, color, lineWidth, dash = []) {
    ctx.beginPath();
    route.points.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(x(px), y(py));
      else ctx.lineTo(x(px), y(py));
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const alternateStop = selectedStop === "delta" ? "floor" : "delta";
  const otherRoute = selectedRoute === "direct" ? "gentle" : "direct";
  const current = data.routes[selectedStop][selectedRoute];
  trace(data.routes[alternateStop][selectedRoute], "#fff7ebad", 2, [4, 6]);
  trace(data.routes[selectedStop][otherRoute], "#fff7eb93", 2, [4, 6]);
  trace(current, "#28140d", 6);
  trace(current, "#ffc09c", 3.5);
  function position(id, point) {
    const pin = byId(id);
    pin.style.left = x(point[0]) + "px";
    pin.style.top = y(point[1]) + "px";
  }
  position("pin-base", current.points[0]);
  Object.keys(stops).forEach((id) => position("pin-" + id, data.routes[id].direct.points.at(-1)));
  byId("scale-line").style.width = (1000 / data.pixelMeters) * scale + "px";
}

function drawProfile() {
  const { context: ctx, width, height } = sizeCanvas(chart);
  const route = data.routes[selectedStop][selectedRoute];
  const allElevations = Object.values(data.routes[selectedStop]).flatMap((r) => r.points.map((p) => p[2]));
  const lo = Math.floor(Math.min(...allElevations) / 10) * 10;
  const hi = Math.ceil(Math.max(...allElevations) / 10) * 10;
  const maxDistance = Math.max(...Object.values(data.routes[selectedStop]).map((r) => r.distance));
  const left = 61;
  const bottom = height - 30;
  const top = 19;
  const x = (meters) => left + (width - left - 24) * meters / maxDistance;
  const y = (elevation) => bottom - (bottom - top) * (elevation - lo) / (hi - lo || 1);
  ctx.font = "10px monospace";
  ctx.fillStyle = "#c7b7af";
  ctx.strokeStyle = "#423834";
  [lo, (lo + hi) / 2, hi].forEach((elev) => {
    ctx.fillText(elev + " m", 9, y(elev) + 3);
    ctx.beginPath();
    ctx.moveTo(left, y(elev));
    ctx.lineTo(width - 24, y(elev));
    ctx.stroke();
  });
  ctx.fillText("0 km", left, bottom + 17);
  const endLabel = (maxDistance / 1000).toFixed(2) + " km";
  ctx.fillText(endLabel, width - 24 - ctx.measureText(endLabel).width, bottom + 17);
  ctx.beginPath();
  route.points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(x(p[3]), y(p[2]));
    else ctx.lineTo(x(p[3]), y(p[2]));
  });
  ctx.strokeStyle = "#ffc09c";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.lineTo(x(route.distance), bottom);
  ctx.lineTo(left, bottom);
  ctx.closePath();
  const fill = ctx.createLinearGradient(0, top, 0, bottom);
  fill.addColorStop(0, "#f9906c50");
  fill.addColorStop(1, "#f9906c06");
  ctx.fillStyle = fill;
  ctx.fill();
  chart.setAttribute("aria-label", "Outbound elevation ranges from "
    + Math.round(Math.min(...route.points.map((p) => p[2]))) + " to "
    + Math.round(Math.max(...route.points.map((p) => p[2]))) + " meters.");
}

function render() {
  const route = data.routes[selectedStop][selectedRoute];
  const estimate = planMinutes(route);
  const timeLeft = Number(budget.value) - estimate;
  const alternateStop = selectedStop === "delta" ? "floor" : "delta";
  const alternateTime = planMinutes(data.routes[alternateStop][selectedRoute]);
  byId("budget-out").value = budget.value + " min";
  byId("speed-out").value = Number(speed.value).toFixed(1) + " km/h";
  byId("cut").disabled = appliedCut || Number(budget.value) < Number(budget.min) + 20;
  byId("cut").lastChild.textContent = appliedCut ? " 20 min time cut applied" : " Simulate 20 min time cut";
  verdict.classList.toggle("no", timeLeft < 0);
  const headline = timeLeft >= 0 ? "GO · WITHIN BUDGET" : "NO-GO · OVER BUDGET";
  const details = timeLeft >= 0 ? estimate + " min planned · " + timeLeft + " min extra"
    : estimate + " min needed · " + Math.abs(timeLeft) + " min over";
  const offer = timeLeft < 0 && alternateTime <= Number(budget.value);
  const message = "<strong>" + headline + "</strong><p>" + details + "</p>"
    + (offer ? '<button type="button" data-stop="' + alternateStop + '">Switch to '
    + stops[alternateStop].name + " · " + alternateTime + " min ↗</button>" : "");
  if (verdict.innerHTML !== message) verdict.innerHTML = message;
  document.querySelectorAll("[data-stop]:not(.verdict button)").forEach((button) =>
    button.setAttribute("aria-pressed", button.dataset.stop === selectedStop));
  document.querySelectorAll("[data-route]").forEach((button) =>
    button.setAttribute("aria-pressed", button.dataset.route === selectedRoute));
  byId("profile-label").textContent = selectedRoute === "direct" ? "SHORTEST" : "LOWER GRADE";
  byId("stats").innerHTML = [
    ["One way", (route.distance / 1000).toFixed(2) + " km"],
    ["Climb", route.gain.toFixed(0) + " m"],
    ["Peak grade", route.peak.toFixed(1) + "°"],
    ["Round trip", estimate + " min"],
  ].map(([label, value]) => "<div><dt>" + label + "</dt><dd>" + value + "</dd></div>").join("");
  if (selectedStop !== renderedStop) {
    const stop = stops[selectedStop];
    byId("science-title").textContent = stop.name;
    byId("science-text").textContent = stop.text;
    byId("science-img").src = "assets/" + stop.image;
    byId("science-img").alt = stop.alt;
    byId("science-source").href = stop.source;
    renderedStop = selectedStop;
  }
  drawMap();
  drawProfile();
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (button?.dataset.stop) {
    const isSuggestion = verdict.contains(button);
    selectedStop = button.dataset.stop;
    render();
    if (isSuggestion) document.querySelector(".choice-row [data-stop='" + selectedStop + "']").focus();
  }
  if (button?.dataset.route) {
    selectedRoute = button.dataset.route;
    render();
  }
});
budget.addEventListener("input", () => { appliedCut = false; render(); });
speed.addEventListener("input", render);
byId("cut").addEventListener("click", () => {
  budget.value = Number(budget.value) - 20;
  appliedCut = true;
  render();
});
byId("reset").addEventListener("click", () => {
  selectedStop = "delta";
  selectedRoute = "direct";
  appliedCut = false;
  budget.value = "150";
  speed.value = "2.5";
  render();
});
hillshade.onload = drawMap;
hillshade.src = "assets/terrain.webp";
const resize = new ResizeObserver(() => { drawMap(); drawProfile(); });
resize.observe(map);
resize.observe(chart);
render();
