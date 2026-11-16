// Terrain-aware Marswalk planning engine. Pure functions over the elevation grid;
// no DOM access, so check.html can test it directly.
// Made by Team DuduBubu, with AI coding assistance (Anthropic Claude, OpenAI Codex).
(function (root) {
  "use strict";
  const MAX_GRADE = 0.3;      // steeper sampled edges are treated as unwalkable
  const GENTLE_PENALTY = 12;  // "gentler" routes weigh time by 1 + 12 × grade²
  const MOVES = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

  // Tobler's hiking function, normalised so flat ground = 1. Grade is signed
  // (uphill > 0). Fastest on a gentle downhill, slower on climbs and steep descents.
  // It is an Earth hiking model, used here as an illustrative assumption.
  function speedFactor(grade) {
    return Math.exp(-3.5 * Math.abs(grade + 0.05)) / Math.exp(-0.175);
  }

  function decodeElevation(data) {
    const bin = atob(data.elevation);
    const out = new Float32Array(bin.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = data.minElevation + (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) / 10;
    }
    return out;
  }

  // Minimal binary min-heap of (key, value) pairs.
  function Heap() { this.k = []; this.v = []; }
  Heap.prototype.push = function (key, val) {
    const k = this.k, v = this.v;
    let i = k.length;
    k.push(key); v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p]; v[i] = v[p]; i = p;
    }
    k[i] = key; v[i] = val;
  };
  Heap.prototype.pop = function () {
    const k = this.k, v = this.v;
    const topK = k[0], topV = v[0];
    const lastK = k.pop(), lastV = v.pop();
    const n = k.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= n) break;
        if (c + 1 < n && k[c + 1] < k[c]) c++;
        if (k[c] >= lastK) break;
        k[i] = k[c]; v[i] = v[c]; i = c;
      }
      k[i] = lastK; v[i] = lastV;
    }
    return [topK, topV];
  };
  Heap.prototype.size = function () { return this.k.length; };

  function createPlanner(data) {
    const W = data.width, H = data.height, N = W * H, M = data.pixelMeters;
    const elev = decodeElevation(data);
    const cache = new Map();
    const idx = (x, y) => y * W + x;

    // Walking minutes at 1 km/h for one grid edge a -> b (divide by speed later).
    function edgeMinutes(a, b) {
      const dx = (b % W) - (a % W), dy = ((b / W) | 0) - ((a / W) | 0);
      const dist = M * Math.hypot(dx, dy);
      const grade = (elev[b] - elev[a]) / dist;
      return Math.abs(grade) > MAX_GRADE ? Infinity : dist / 1000 / speedFactor(grade) * 60;
    }

    // Full-grid Dijkstra. Forward: cost from src to every cell. Reverse: cost from
    // every cell to src (prev then points toward src). Results are speed-independent.
    function search(src, gentle, reverse) {
      const key = (gentle ? "g" : "f") + (reverse ? "r" : "o") + src;
      if (cache.has(key)) return cache.get(key);
      const cost = new Float64Array(N).fill(Infinity);
      const time = new Float64Array(N).fill(Infinity);
      const prev = new Int32Array(N).fill(-1);
      const heap = new Heap();
      cost[src] = 0; time[src] = 0;
      heap.push(0, src);
      while (heap.size()) {
        const [c, u] = heap.pop();
        if (c > cost[u]) continue;
        const ux = u % W, uy = (u / W) | 0;
        for (const [mx, my] of MOVES) {
          const vx = ux + mx, vy = uy + my;
          if (vx < 0 || vy < 0 || vx >= W || vy >= H) continue;
          const v = idx(vx, vy);
          const dist = M * (mx && my ? Math.SQRT2 : 1);
          const grade = (reverse ? elev[u] - elev[v] : elev[v] - elev[u]) / dist;
          if (Math.abs(grade) > MAX_GRADE) continue;
          const t = dist / 1000 / speedFactor(grade) * 60;
          const nc = c + t * (gentle ? 1 + GENTLE_PENALTY * grade * grade : 1);
          if (nc < cost[v]) {
            cost[v] = nc; time[v] = time[u] + t; prev[v] = u;
            heap.push(nc, v);
          }
        }
      }
      const result = { time, prev };
      cache.set(key, result);
      return result;
    }

    function pathBetween(from, to, gentle) {
      const { prev, time } = search(from, gentle, false);
      if (!isFinite(time[to])) return null;
      const cells = [to];
      while (cells[cells.length - 1] !== from) cells.push(prev[cells[cells.length - 1]]);
      return cells.reverse();
    }

    // Minutes (at `speed` km/h) to walk home from every cell along the fastest route.
    function homeField(home, speed) {
      const { time } = search(home, false, true);
      return (cell) => time[cell] / speed;
    }

    // Visit `order` (stop cells) from `start`, then return home. Times are absolute
    // EVA minutes starting at `startTime`.
    function buildPlan({ start, home, startTime = 0, order, ids = [], gentle, speed, science }) {
      const samples = [];
      const visits = [];
      let t = startTime, d = 0, climb = 0, walk = 0;
      const waypoints = [start, ...order, home];
      samples.push({ c: start, t, d, z: elev[start] });
      for (let leg = 0; leg + 1 < waypoints.length; leg++) {
        const a = waypoints[leg], b = waypoints[leg + 1];
        if (a !== b) {
          const cells = pathBetween(a, b, gentle);
          if (!cells) return { reachable: false };
          for (let i = 1; i < cells.length; i++) {
            const p = cells[i - 1], q = cells[i];
            const m = edgeMinutes(p, q) / speed;
            t += m; walk += m;
            d += M * Math.hypot((q % W) - (p % W), ((q / W) | 0) - ((p / W) | 0));
            climb += Math.max(0, elev[q] - elev[p]);
            samples.push({ c: q, t, d, z: elev[q] });
          }
        }
        if (leg + 1 < waypoints.length - 1) {
          visits.push({ id: ids[leg], cell: b, arrive: t, leave: t + science });
          t += science;
          samples.push({ c: b, t, d, z: elev[b] });
        }
      }
      return { reachable: true, samples, visits, start, startTime, end: t,
        walk, science: science * order.length, distance: d, climb };
    }

    // Fastest visiting order for a set of stops (brute force; n <= 6).
    function bestOrder(start, home, cells, gentle) {
      const nodes = [start, home, ...cells];
      const leg = (a, b) => (a === b ? 0 : search(a, gentle, false).time[b]);
      const m = nodes.map((a) => nodes.map((b) => leg(a, b)));
      let best = { minutes: Infinity, order: [] };
      const used = new Array(cells.length).fill(false);
      const seq = [];
      (function recurse(last, acc) {
        if (acc >= best.minutes) return;
        if (seq.length === cells.length) {
          const total = acc + m[last][1];
          if (total < best.minutes) best = { minutes: total, order: seq.slice() };
          return;
        }
        for (let i = 0; i < cells.length; i++) {
          if (used[i]) continue;
          used[i] = true; seq.push(i);
          recurse(i + 2, acc + m[last][i + 2]);
          seq.pop(); used[i] = false;
        }
      })(0, 0);
      return best; // minutes at 1 km/h; order holds indexes into `cells`
    }

    // Highest science value that fits: tries every subset, returns indexes in visit order.
    function bestSubset({ start, home, startTime = 0, candidates, gentle, speed, science, limit }) {
      let best = { value: -1, minutes: Infinity, order: [] };
      const n = candidates.length;
      for (let mask = 0; mask < 1 << n; mask++) {
        const picked = [];
        let value = 0;
        for (let i = 0; i < n; i++) if (mask & (1 << i)) { picked.push(i); value += candidates[i].value; }
        if (value < best.value) continue;
        const route = bestOrder(start, home, picked.map((i) => candidates[i].cell), gentle);
        const minutes = startTime + route.minutes / speed + science * picked.length;
        if (minutes > limit) continue;
        if (value > best.value || minutes < best.minutes) {
          best = { value, minutes, order: route.order.map((j) => picked[j]) };
        }
      }
      return best.value < 0 ? null : best;
    }

    // Static "reach and return" zone: cells where a single stop could be visited
    // from home and still return inside the limit.
    function reachField(home, { gentle, speed, science, limit }) {
      const out = search(home, gentle, false).time;
      const back = search(home, false, true).time;
      const ok = new Uint8Array(N);
      for (let i = 0; i < N; i++) ok[i] = (out[i] + back[i]) / speed + science <= limit ? 1 : 0;
      return ok;
    }

    // First sample where the crew could no longer get home within the limit.
    function pointOfNoReturn(plan, home, speed, limit) {
      const toHome = homeField(home, speed);
      for (let i = 0; i < plan.samples.length; i++) {
        const s = plan.samples[i];
        if (s.t + toHome(s.c) > limit) return i;
      }
      return -1;
    }

    return { W, H, N, elev, idx, search, pathBetween, homeField, buildPlan, bestOrder,
      bestSubset, reachField, pointOfNoReturn, reachable: (home, cell) => isFinite(search(home, false, false).time[cell]) };
  }

  root.Planner = { createPlanner, speedFactor, decodeElevation, MAX_GRADE };
})(typeof window !== "undefined" ? window : globalThis);
