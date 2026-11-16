"use strict";
const data = window.JEZERO_DATA;
const P = Planner.createPlanner(data);
const byId = (id) => document.getElementById(id);
const HOME = P.idx(...data.habitat);
const CUT = 30;          // minutes Mission Control removes per cut
const RESERVE = 10;      // minutes that must remain when the crew is back
const MAX_STOPS = 6;
const EVA_SECONDS = 14;  // real seconds to play back a full EVA
const DEFAULTS = { budget: 160, suit: 240, speed: 2.5, science: 20, gentle: false };

const PRESETS = {
  delta: {
    name: "West fan", value: 5, image: "scarp.jpg",
    alt: "Perseverance Mastcam-Z panorama of scarps on the western delta",
    text: "Exposed layers in the ancient delta preserve clues about how rivers carried sediment into Jezero’s lake.",
    source: "https://science.nasa.gov/resource/the-scarps-of-jezero-craters-delta/",
  },
  floor: {
    name: "Crater floor", value: 3, image: "floor.jpg",
    alt: "Perseverance Mastcam-Z mosaic of rocks at South Séítah",
    text: "Perseverance studied and sampled igneous crater-floor rocks here to learn about Jezero’s early history.",
    source: "https://science.nasa.gov/resource/perseverance-rovers-view-of-south-seitah/",
  },
};

const state = {};
function resetState() {
  Object.assign(state, DEFAULTS, {
    stops: Object.entries(PRESETS).map(([id, s], i) => ({
      id, label: "AB"[i], name: s.name, value: s.value, on: id === "delta", preset: true,
      cell: P.idx(...data.stops[id]),
    })),
    focus: "delta", eva: null, nextLabel: 2, cuts: 0, notice: "",
  });
}

// ---------- helpers ----------
const limit = () => Math.min(state.budget, state.suit) - RESERVE;
const binding = () => (state.suit < state.budget ? "suit life support" : "Mission Control budget");
const fmt = (m) => Math.round(m) + " min";
const opts = () => ({ gentle: state.gentle, speed: state.speed, science: state.science });
const stopById = (id) => state.stops.find((s) => s.id === id);
const cellXY = (c) => [c % P.W + 0.5, Math.floor(c / P.W) + 0.5];
function cellLatLon(c) {
  const [w, s, e, n] = data.bounds; const [x, y] = cellXY(c);
  return [n - (y / P.H) * (n - s), w + (x / P.W) * (e - w)];
}
const esc = (t) => String(t).replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);

function planFor(start, startTime, stops) {
  const route = P.bestOrder(start, HOME, stops.map((s) => s.cell), state.gentle);
  const ordered = route.order.map((i) => stops[i]);
  return P.buildPlan({ start, home: HOME, startTime, order: ordered.map((s) => s.cell),
    ids: ordered.map((s) => s.id), ...opts() });
}
const currentPlan = () => (state.eva ? state.eva.plan : planFor(HOME, 0, state.stops.filter((s) => s.on)));
const planValue = (plan) => plan.visits.reduce((sum, v) => sum + (stopById(v.id)?.value || 0), 0);

// ---------- map ----------
const map = byId("map-canvas");
const chart = byId("profile-chart");
const hillshade = new Image();
let view = { x0: 0, y0: 0, scale: 1 };
let cursor = null; // keyboard crosshair cell [x, y]
let zone = { key: "", canvas: document.createElement("canvas") };

function sizeCanvas(canvas) {
  const { width, height } = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const ctx = canvas.getContext("2d");
  ctx.scale(ratio, ratio);
  return { ctx, width, height };
}

function zoneCanvas() {
  const key = [limit(), state.speed, state.science, state.gentle].join();
  if (zone.key === key) return zone.canvas;
  const ok = P.reachField(HOME, { ...opts(), limit: limit() });
  const c = zone.canvas; c.width = P.W; c.height = P.H;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(P.W, P.H);
  const set = (i, r, g, b, a) => { img.data[i * 4] = r; img.data[i * 4 + 1] = g; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = a; };
  for (let i = 0; i < ok.length; i++) {
    if (!ok[i]) { set(i, 14, 8, 8, 150); continue; }
    // Outline: reachable cells that touch an unreachable one.
    const x = i % P.W;
    const edge = (x > 0 && !ok[i - 1]) || (x < P.W - 1 && !ok[i + 1]) || !ok[i - P.W] && i >= P.W || (i + P.W < ok.length && !ok[i + P.W]);
    if (edge) set(i, 255, 214, 190, 170);
  }
  ctx.putImageData(img, 0, 0);
  zone.key = key;
  return c;
}

function drawMap(plan, pnr) {
  const { ctx, width, height } = sizeCanvas(map);
  const scale = Math.min(width / P.W, height / P.H);
  view = { x0: (width - P.W * scale) / 2, y0: (height - P.H * scale) / 2, scale };
  const X = (v) => view.x0 + v * scale, Y = (v) => view.y0 + v * scale;
  ctx.fillStyle = "#1a1312"; ctx.fillRect(0, 0, width, height);
  if (hillshade.complete && hillshade.naturalWidth) ctx.drawImage(hillshade, X(0), Y(0), P.W * scale, P.H * scale);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(zoneCanvas(), X(0), Y(0), P.W * scale, P.H * scale);

  const line = (cells, color, w, dash = []) => {
    if (cells.length < 2) return;
    ctx.beginPath();
    cells.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y))));
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineJoin = ctx.lineCap = "round";
    ctx.setLineDash(dash); ctx.stroke(); ctx.setLineDash([]);
  };
  if (plan.reachable) {
    const pts = plan.samples.map((s) => cellXY(s.c));
    line(pts, "#28140d", 6);
    line(pts, "#ffc09c", 3);
    if (pnr >= 0) {
      const after = pts.slice(pnr);
      line(after, "#ff7a5c", 3, [5, 5]);
      const [px, py] = pts[pnr];
      ctx.beginPath(); ctx.arc(X(px), Y(py), 7, 0, Math.PI * 2);
      ctx.fillStyle = "#ff7a5c"; ctx.fill(); ctx.strokeStyle = "#1a1312"; ctx.lineWidth = 2; ctx.stroke();
      ctx.font = "600 11px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#1a1312"; ctx.lineWidth = 3;
      ctx.strokeText("TURN BACK", X(px) + 11, Y(py) + 4); ctx.fillText("TURN BACK", X(px) + 11, Y(py) + 4);
    }
  }
  const eva = state.eva;
  if (eva) {
    line(eva.trail, "#ffffff", 2.5);
    const at = eva.trail.at(-1);
    if (at) {
      ctx.beginPath(); ctx.arc(X(at[0]), Y(at[1]), 11, 0, Math.PI * 2); ctx.fillStyle = "#b9ebbd40"; ctx.fill();
      ctx.beginPath(); ctx.arc(X(at[0]), Y(at[1]), 5.5, 0, Math.PI * 2); ctx.fillStyle = "#b9ebbd"; ctx.fill();
    }
  }
  if (cursor && document.activeElement === map && !eva) {
    const cx = X(cursor[0] + 0.5), cy = Y(cursor[1] + 0.5);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx - 12, cy); ctx.lineTo(cx - 4, cy); ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 12, cy);
    ctx.moveTo(cx, cy - 12); ctx.lineTo(cx, cy - 4); ctx.moveTo(cx, cy + 4); ctx.lineTo(cx, cy + 12); ctx.stroke();
  }
  placePins();
  byId("scale-line").style.width = (1000 / data.pixelMeters) * scale + "px";
}

function placePins() {
  const put = (el, c) => { const [x, y] = cellXY(c); el.style.left = view.x0 + x * view.scale + "px"; el.style.top = view.y0 + y * view.scale + "px"; };
  put(byId("pin-base"), HOME);
  document.querySelectorAll(".pin[data-pin]").forEach((el) => put(el, stopById(el.dataset.pin).cell));
}

function renderPins() {
  document.querySelectorAll(".pin[data-pin]").forEach((el) => el.remove());
  const visited = state.eva ? state.eva.visited : new Set();
  for (const s of state.stops) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "pin" + (visited.has(s.id) ? " done" : "");
    b.dataset.pin = s.id;
    b.setAttribute("aria-pressed", s.on);
    b.setAttribute("aria-label", `${s.name}, science value ${s.value}, ${s.on ? "in plan" : "not in plan"}`);
    b.innerHTML = `${esc(s.label)} <span>${esc(s.name)}</span>`;
    byId("map").append(b);
  }
  placePins();
}

// ---------- profile ----------
function drawProfile(plan, pnr) {
  const { ctx, width, height } = sizeCanvas(chart);
  if (!plan.reachable || plan.samples.length < 2) return;
  const s = plan.samples, d0 = s[0].d, span = Math.max(1, s.at(-1).d - d0);
  const zs = s.map((p) => p.z);
  const lo = Math.floor(Math.min(...zs) / 10) * 10, hi = Math.ceil(Math.max(...zs) / 10) * 10;
  const left = 64, right = 18, top = 22, bottom = height - 28;
  const X = (d) => left + (width - left - right) * (d - d0) / span;
  const Y = (z) => bottom - (bottom - top) * (z - lo) / (hi - lo || 1);
  ctx.font = "10px 'IBM Plex Mono', monospace"; ctx.fillStyle = "#c7b7af"; ctx.strokeStyle = "#3b3330";
  [lo, (lo + hi) / 2, hi].forEach((z) => {
    ctx.fillText(Math.round(z) + " m", 8, Y(z) + 3);
    ctx.beginPath(); ctx.moveTo(left, Y(z)); ctx.lineTo(width - right, Y(z)); ctx.stroke();
  });
  ctx.fillText("0 km", left, bottom + 18);
  const end = (span / 1000).toFixed(2) + " km";
  ctx.fillText(end, width - right - ctx.measureText(end).width, bottom + 18);
  ctx.beginPath(); s.forEach((p, i) => (i ? ctx.lineTo(X(p.d), Y(p.z)) : ctx.moveTo(X(p.d), Y(p.z))));
  ctx.strokeStyle = "#ffc09c"; ctx.lineWidth = 2.2; ctx.stroke();
  ctx.lineTo(X(s.at(-1).d), bottom); ctx.lineTo(left, bottom); ctx.closePath();
  const g = ctx.createLinearGradient(0, top, 0, bottom); g.addColorStop(0, "#f9906c48"); g.addColorStop(1, "#f9906c05");
  ctx.fillStyle = g; ctx.fill();
  const marker = (d, color, label) => {
    ctx.strokeStyle = color; ctx.setLineDash([3, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(X(d), top - 6); ctx.lineTo(X(d), bottom); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = color; ctx.fillText(label, Math.min(X(d) + 4, width - right - ctx.measureText(label).width), top - 8);
  };
  plan.visits.forEach((v) => {
    const sample = s.find((p) => p.c === v.cell && p.t >= v.arrive - 1e-6);
    if (sample) marker(sample.d, "#e9dcd4", stopById(v.id)?.label || "");
  });
  if (pnr >= 0) marker(s[pnr].d, "#ff7a5c", "TURN BACK");
  const crew = state.eva && crewAt(state.eva.clock);
  if (crew) {
    ctx.beginPath(); ctx.arc(X(crew.d), Y(crew.z), 5, 0, Math.PI * 2); ctx.fillStyle = "#b9ebbd"; ctx.fill();
  }
  chart.setAttribute("aria-label", `Elevation along the plan, ${Math.round(Math.min(...zs))} to ${Math.round(Math.max(...zs))} m over ${end}.`);
}

// ---------- panels ----------
function renderTimeline(plan, pnr) {
  const total = Math.max(state.budget, plan.end, 1);
  const pct = (m) => (100 * m / total).toFixed(2) + "%";
  const parts = [];
  if (plan.startTime > 0) parts.push(`<i class="seg done" style="left:0;width:${pct(plan.startTime)}"></i>`);
  let t = plan.startTime;
  for (const v of plan.visits) {
    parts.push(`<i class="seg walk" style="left:${pct(t)};width:${pct(v.arrive - t)}"></i>`);
    parts.push(`<i class="seg sci" style="left:${pct(v.arrive)};width:${pct(v.leave - v.arrive)}" title="${esc(stopById(v.id)?.name)}"></i>`);
    t = v.leave;
  }
  parts.push(`<i class="seg walk" style="left:${pct(t)};width:${pct(plan.end - t)}"></i>`);
  if (plan.end > limit()) parts.push(`<i class="seg over" style="left:${pct(limit())};width:${pct(plan.end - limit())}"></i>`);
  parts.push(`<b class="mark reserve" style="left:${pct(limit())};width:${pct(Math.min(state.budget, state.suit) - limit())}"></b>`);
  parts.push(`<b class="mark limit" style="left:${pct(Math.min(state.budget, state.suit))}"></b>`);
  if (pnr >= 0) parts.push(`<b class="mark pnr" style="left:${pct(plan.samples[pnr].t)}" title="Point of no return"></b>`);
  if (state.eva) parts.push(`<b class="mark now" style="left:${pct(state.eva.clock)}"></b>`);
  byId("timeline").innerHTML = parts.join("");
  byId("timeline").setAttribute("aria-label", `Plan ends at minute ${Math.round(plan.end)}; latest safe return is minute ${limit()}.`);
}

function renderVerdict(plan, pnr) {
  const v = byId("verdict");
  const eva = state.eva;
  const lim = limit();
  if (eva?.done) {
    const margin = lim - eva.plan.end;
    v.className = "verdict" + (margin < 0 ? " no" : "");
    v.innerHTML = `<strong>${margin < 0 ? "EVA OVER LIMIT" : "CREW HOME SAFE"}</strong>
      <p class="big">${fmt(eva.plan.end)}</p>
      <p>${margin < 0 ? fmt(-margin) + " past the safe return time." : fmt(margin) + " to spare."}
      Science value collected: <b>${eva.collected}</b>.</p>`;
    return;
  }
  if (!plan.reachable) { v.className = "verdict no"; v.innerHTML = "<strong>NO ROUTE</strong><p>A stop cannot be reached.</p>"; return; }
  const go = plan.end <= lim;
  v.className = "verdict" + (go ? "" : " no");
  const value = planValue(plan);
  let extra = "";
  if (!go && pnr >= 0) extra += `<p>Point of no return at minute ${Math.round(plan.samples[pnr].t)}. After it, the crew can't get home in time.</p>`;
  if (!go && !eva) {
    const best = bestForBudget();
    if (best) extra += `<button type="button" class="link" id="apply-best">Best plan that fits: ${best.label} ↗</button>`;
  }
  v.innerHTML = `<strong>${go ? "GO" : "NO-GO"} <span>· ${go ? "within" : "over"} limit</span></strong>
    <p class="big">${fmt(plan.end)} <small>/ ${lim} safe</small></p>
    <p>${go ? fmt(lim - plan.end) + " margin" : fmt(plan.end - lim) + " over"} · science value ${value} ·
      limited by ${binding()}</p>${extra}`;
}

function bestForBudget() {
  const res = P.bestSubset({ start: HOME, home: HOME, candidates: state.stops, ...opts(), limit: limit() });
  if (!res) return null;
  const names = res.order.map((i) => state.stops[i].name);
  return { ...res, label: names.length ? names.join(" → ") + " · " + fmt(res.minutes) : "stay at the habitat" };
}

function renderStops() {
  const visited = state.eva ? state.eva.visited : new Set();
  byId("stops").innerHTML = state.stops.map((s) => `
    <li class="${s.id === state.focus ? "focus" : ""}${visited.has(s.id) ? " done" : ""}">
      <label><input type="checkbox" data-toggle="${s.id}" ${s.on ? "checked" : ""} ${state.eva ? "disabled" : ""}>
        <b>${esc(s.label)}</b> ${esc(s.name)}</label>
      <select data-value="${s.id}" aria-label="Science value for ${esc(s.name)}" ${state.eva ? "disabled" : ""}>
        ${[1, 2, 3, 4, 5].map((n) => `<option ${n === s.value ? "selected" : ""}>${n}</option>`).join("")}
      </select>
      ${s.preset ? "<span></span>" : `<button type="button" class="quiet" data-remove="${s.id}" aria-label="Remove ${esc(s.name)}" ${state.eva ? "disabled" : ""}>✕</button>`}
    </li>`).join("");
  byId("add-hint").textContent = state.notice ||
    (state.stops.length < MAX_STOPS ? "Click the map to add your own site." : "Site limit reached (6).");
}

function renderStats(plan) {
  if (!plan.reachable) { byId("stats").innerHTML = ""; return; }
  byId("stats").innerHTML = [
    ["Distance", (plan.distance / 1000).toFixed(2) + " km"],
    ["Climb", Math.round(plan.climb) + " m"],
    ["Walking", fmt(plan.walk)],
    ["Science", fmt(plan.science)],
  ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
}

function renderScience() {
  const s = stopById(state.focus) || state.stops[0];
  const preset = PRESETS[s.id];
  const img = byId("science-img");
  byId("science-title").textContent = `${s.label} · ${s.name}`;
  if (preset) {
    img.hidden = false; img.src = "assets/" + preset.image; img.alt = preset.alt;
    byId("science-text").textContent = preset.text;
    byId("science-source").hidden = false; byId("science-source").href = preset.source;
  } else {
    const [lat, lon] = cellLatLon(s.cell);
    img.hidden = true;
    byId("science-text").textContent = `Your site at ${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E, ${Math.round(P.elev[s.cell])} m elevation. Set its science value to tell the planner how much it matters.`;
    byId("science-source").hidden = true;
  }
}

function renderControls(plan) {
  const eva = state.eva;
  const go = plan.reachable && plan.end <= limit();
  byId("budget").value = state.budget; byId("budget-out").value = state.budget + " min";
  byId("suit").value = state.suit; byId("suit-out").value = state.suit + " min";
  byId("speed").value = state.speed; byId("speed-out").value = state.speed.toFixed(1) + " km/h";
  byId("science").value = state.science; byId("science-out").value = state.science + " min";
  ["budget", "suit", "speed", "science"].forEach((id) => (byId(id).disabled = !!eva));
  document.querySelectorAll("[data-route]").forEach((b) => {
    b.setAttribute("aria-pressed", (b.dataset.route === "gentle") === state.gentle); b.disabled = !!eva; });
  const start = byId("start");
  start.disabled = eva ? false : !go;
  start.textContent = !eva ? (go ? "▶ Start EVA" : "Plan is NO-GO") : eva.done ? "↺ New EVA" : eva.paused ? "Paused" : "■ Abort";
  if (eva && !eva.done && eva.paused) start.disabled = true;
  byId("cut").disabled = (eva && (eva.done || eva.paused)) || state.budget - CUT < RESERVE;
  byId("cut").lastChild.textContent = eva && !eva.done ? ` Cut ${CUT} min now` : ` Mission Control: −${CUT} min`;
  byId("surprise").disabled = !!eva;
  byId("best").disabled = !!eva;
  byId("clock").value = eva ? "T+" + Math.round(eva.clock) + " min" : "T+0";
}

function render() {
  const plan = currentPlan();
  const pnr = plan.reachable && plan.end > limit() ? P.pointOfNoReturn(plan, HOME, state.speed, limit()) : -1;
  renderVerdict(plan, pnr);
  renderTimeline(plan, pnr);
  renderStops();
  renderStats(plan);
  renderScience();
  renderControls(plan);
  renderPins();
  drawMap(plan, pnr);
  drawProfile(plan, pnr);
}

// ---------- EVA playback ----------
function crewAt(clock) {
  const s = state.eva.plan.samples;
  if (clock <= s[0].t) return { ...s[0], x: cellXY(s[0].c)[0], y: cellXY(s[0].c)[1], i: 0 };
  for (let i = 1; i < s.length; i++) {
    if (s[i].t >= clock) {
      const a = s[i - 1], b = s[i], f = b.t > a.t ? (clock - a.t) / (b.t - a.t) : 1;
      const [ax, ay] = cellXY(a.c), [bx, by] = cellXY(b.c);
      return { c: f < 0.5 ? a.c : b.c, x: ax + (bx - ax) * f, y: ay + (by - ay) * f,
        d: a.d + (b.d - a.d) * f, z: a.z + (b.z - a.z) * f, i };
    }
  }
  const last = s.at(-1);
  return { ...last, x: cellXY(last.c)[0], y: cellXY(last.c)[1], i: s.length - 1 };
}

let lastFrame = 0;
let forcedCutAt = null; // set by the guided tour so the demo is repeatable
// setTimeout rather than requestAnimationFrame so playback keeps time in background tabs too.
const schedule = () => setTimeout(() => tick(performance.now()), 33);
function tick(ts) {
  const eva = state.eva;
  if (!eva || eva.done || eva.paused) return;
  const dt = lastFrame ? Math.min(0.1, (ts - lastFrame) / 1000) : 0;
  lastFrame = ts;
  eva.clock = Math.min(eva.plan.end, eva.clock + dt * eva.rate);
  for (const v of eva.plan.visits) {
    if (v.arrive <= eva.clock && !eva.visited.has(v.id)) { eva.visited.add(v.id); eva.collected += stopById(v.id).value; state.focus = v.id; }
  }
  const crew = crewAt(eva.clock);
  eva.trail.push([crew.x, crew.y]);
  if (eva.surpriseAt !== null && !eva.cutDone && eva.clock >= eva.surpriseAt) { missionCut(true); return; }
  if (eva.clock >= eva.plan.end) { eva.done = true; render(); return; }
  if (Math.floor(eva.clock) !== eva.lastRendered) { eva.lastRendered = Math.floor(eva.clock); render(); }
  else { drawMap(eva.plan, -1); }
  schedule();
}

function startEva() {
  const plan = currentPlan();
  // The surprise cut lands on the way to the last site, while there is still a real choice to make.
  let surpriseAt = null;
  if (byId("surprise").checked) {
    const v = plan.visits;
    const lo = v.length ? 0.35 * v[0].arrive : 0.3 * plan.end;
    const hi = v.length ? 0.85 * v.at(-1).arrive : 0.6 * plan.end;
    surpriseAt = forcedCutAt ?? lo + Math.random() * Math.max(0, hi - lo);
  }
  state.eva = { plan, clock: 0, visited: new Set(), collected: 0, trail: [cellXY(HOME)],
    rate: plan.end / EVA_SECONDS, surpriseAt,
    cutDone: false, paused: false, done: false, lastRendered: -1 };
  lastFrame = 0;
  render();
  schedule();
}

function missionCut(surprise) {
  state.budget = Math.max(RESERVE, state.budget - CUT);
  state.cuts++;
  const eva = state.eva;
  if (!eva || eva.done) { render(); return; }
  eva.cutDone = true;
  eva.paused = true;
  const crew = crewAt(eva.clock);
  const t = eva.clock, lim = limit();
  const remaining = eva.plan.visits.filter((v) => !eva.visited.has(v.id)).map((v) => stopById(v.id));
  // Re-planning may swap in any site not yet visited, including ones left out of the original plan.
  const pending = state.stops.filter((s) => !eva.visited.has(s.id));
  const options = [];
  const add = (key, title, stops) => {
    const plan = P.buildPlan({ start: crew.c, home: HOME, startTime: t,
      order: stops.map((s) => s.cell), ids: stops.map((s) => s.id), ...opts() });
    if (!plan.reachable) return;
    const value = stops.reduce((sum, s) => sum + s.value, 0);
    options.push({ key, title, plan, value, ok: plan.end <= lim,
      detail: stops.length ? stops.map((s) => s.name).join(" → ") + " → home" : "Straight back to the habitat" });
  };
  if (remaining.length) add("continue", "Continue the plan", remaining);
  const best = P.bestSubset({ start: crew.c, home: HOME, startTime: t, candidates: pending, ...opts(), limit: lim });
  if (best && best.order.length) {
    const picked = best.order.map((i) => pending[i]);
    if (picked.map((s) => s.id).join() !== remaining.map((s) => s.id).join()) add("replan", "Re-plan from here", picked);
  }
  add("home", "Turn back now", []);
  eva.options = options;
  const rec = options.find((o) => o.ok) || options.at(-1);
  byId("decision-title").textContent = surprise ? `Mission Control: time cut by ${CUT} min` : `Time cut by ${CUT} min`;
  byId("decision-text").textContent = `T+${Math.round(t)} min. The crew must now be back by minute ${lim} (including the reserve). Choose how to proceed.`;
  byId("decision-options").innerHTML = options.map((o) => `
    <button type="button" data-choose="${o.key}" class="option ${o.ok ? "ok" : "bad"}${o === rec ? " rec" : ""}">
      <span class="o-title">${o.title}${o === rec ? " · recommended" : ""}</span>
      <span class="o-detail">${esc(o.detail)}</span>
      <span class="o-meta">${o.ok ? "GO" : "NO-GO"} · home at minute ${Math.round(o.plan.end)} · +${o.value} science</span>
    </button>`).join("");
  render();
  const dlg = byId("decision");
  dlg.show();
  dlg.querySelector(".rec")?.focus();
}

function choose(key) {
  const eva = state.eva;
  const option = eva.options.find((o) => o.key === key);
  eva.plan = option.plan;
  eva.paused = false;
  byId("decision").close();
  lastFrame = 0;
  render();
  schedule();
}

// ---------- events ----------
document.addEventListener("click", (e) => {
  const t = e.target.closest("button, [data-pin]");
  if (!t) return;
  if (t.dataset.pin && !state.eva) {
    const s = stopById(t.dataset.pin); s.on = !s.on; state.focus = s.id; state.notice = ""; render();
  } else if (t.dataset.pin) { state.focus = t.dataset.pin; renderScience(); }
  if (t.dataset.remove) {
    state.stops = state.stops.filter((s) => s.id !== t.dataset.remove);
    if (state.focus === t.dataset.remove) state.focus = state.stops[0].id;
    state.notice = ""; render();
  }
  if (t.dataset.route) { state.gentle = t.dataset.route === "gentle"; render(); }
  if (t.dataset.choose) choose(t.dataset.choose);
  if (t.id === "apply-best" || t.id === "best") {
    const best = bestForBudget();
    if (best) state.stops.forEach((s, i) => (s.on = best.order.includes(i)));
    state.notice = best ? "Applied the highest science value that fits." : "";
    render();
  }
});
byId("stops").addEventListener("change", (e) => {
  const el = e.target;
  if (el.dataset.toggle) { const s = stopById(el.dataset.toggle); s.on = el.checked; state.focus = s.id; }
  if (el.dataset.value) { stopById(el.dataset.value).value = Number(el.value); state.focus = el.dataset.value; }
  state.notice = "";
  render();
});
byId("stops").addEventListener("focusin", (e) => {
  const id = e.target.dataset?.toggle || e.target.dataset?.value;
  if (id && id !== state.focus) { state.focus = id; renderScience(); }
});
function addSite(x, y, value = 2) {
  if (state.eva || x < 0 || y < 0 || x >= P.W || y >= P.H) return false;
  if (state.stops.length >= MAX_STOPS) { state.notice = "Site limit reached (6). Remove one first."; render(); return false; }
  const c = P.idx(x, y);
  if (c === HOME || state.stops.some((s) => s.cell === c)) return false;
  if (!P.reachable(HOME, c)) { state.notice = "That spot is too steep to reach on foot."; render(); return false; }
  const used = new Set(state.stops.map((s) => s.label));
  const label = [..."CDEFGHIJKLMNOPQRSTUVWXYZ"].find((l) => !used.has(l));
  state.stops.push({ id: "site-" + label + state.nextLabel++, label, name: "Site " + label, value, on: true, preset: false, cell: c });
  state.focus = state.stops.at(-1).id;
  state.notice = "";
  render();
  return true;
}
map.addEventListener("click", (e) => {
  const r = map.getBoundingClientRect();
  addSite(Math.floor((e.clientX - r.left - view.x0) / view.scale), Math.floor((e.clientY - r.top - view.y0) / view.scale));
});
// Keyboard: arrows move a crosshair (Shift = 10 cells), Enter or Space adds a site there.
map.addEventListener("focus", () => { cursor ??= cellXY(HOME).map(Math.floor); render(); });
map.addEventListener("blur", () => render());
map.addEventListener("keydown", (e) => {
  cursor ??= cellXY(HOME).map(Math.floor);
  const step = e.shiftKey ? 10 : 1;
  const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (moves[e.key]) {
    e.preventDefault();
    cursor = [Math.min(P.W - 1, Math.max(0, cursor[0] + moves[e.key][0])), Math.min(P.H - 1, Math.max(0, cursor[1] + moves[e.key][1]))];
    render();
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    addSite(cursor[0], cursor[1]);
  }
});

// ---------- guided tour (also used to record the demo video) ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let touring = false;
function caption(text) {
  const el = byId("tour-caption");
  el.hidden = !text;
  el.textContent = text || "";
}
async function runTour() {
  if (touring) return;
  touring = true;
  document.body.classList.add("touring");
  byId("decision").close();
  resetState(); render();
  caption("Plan a walk across real Mars terrain. The west fan fits the time limit: GO.");
  await sleep(4500);
  missionCut(false);
  caption("Mission Control cuts 30 minutes. Now it’s NO-GO, and the map marks where the crew must turn back.");
  await sleep(5000);
  byId("apply-best").click();
  caption("The best plan that still fits swaps to the closer crater floor.");
  await sleep(4000);
  const [hx, hy] = cellXY(HOME).map(Math.floor);
  addSite(hx - 40, hy + 22, 4);
  caption("Add your own site anywhere on the map and give it a science value.");
  await sleep(3500);
  stopById("delta").on = true; render();
  caption("Add the west fan as well and the plan overruns the limit…");
  await sleep(3500);
  byId("best").click();
  caption("“Best plan” picks the most valuable set of sites that gets the crew home in time.");
  await sleep(4500);
  resetState(); render();
  forcedCutAt = 40;
  byId("surprise").checked = true;
  startEva();
  forcedCutAt = null;
  caption("Now run the EVA. The crew sets out for the west fan…");
  while (!state.eva.paused) await sleep(100);
  caption("Mission Control cuts the clock mid-walk. Continue, re-plan from here, or turn back?");
  await sleep(4500);
  const pick = state.eva.options.find((o) => o.key === "replan" && o.ok) || state.eva.options.find((o) => o.ok) || state.eva.options.at(-1);
  choose(pick.key);
  caption("The crew re-plans from where they stand and still brings science home.");
  while (!state.eva.done) await sleep(100);
  caption("Crew home safe. Real terrain, real trade-offs: that’s Jezero Go/No-Go.");
  await sleep(4000);
  document.body.classList.remove("touring");
  touring = false;
}
byId("tour").addEventListener("click", () => { runTour(); });
for (const id of ["budget", "suit", "speed", "science"]) {
  byId(id).addEventListener("input", (e) => { state[id] = Number(e.target.value); state.notice = ""; render(); });
}
byId("cut").addEventListener("click", () => missionCut(false));
byId("start").addEventListener("click", () => {
  if (!state.eva) startEva();
  else { state.eva = null; byId("decision").close(); render(); }
});
byId("reset").addEventListener("click", () => { byId("decision").close(); resetState(); render(); });

resetState();
hillshade.onload = () => render();
hillshade.src = "assets/terrain.webp";
new ResizeObserver(() => render()).observe(byId("map"));
render();
const params = new URLSearchParams(location.search);
if (params.has("record")) document.body.classList.add("recording"); // framing for build-demo.py
if (params.has("tour")) runTour();
