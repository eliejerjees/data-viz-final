import {
  buildDataset,
  parseCSV,
  statLabel,
  statDescription,
  recommendedAxisKeys,
  canComparePositions,
  getPrimaryRole,
  PRESETS,
} from "./dataProcessing.js";
import { createRadarChart } from "./radarChart.js";
import { resolvePlayerPhoto } from "./playerImages.js";

const chartMount = document.getElementById("radar-mount");
const legendA = document.getElementById("legend-a");
const legendB = document.getElementById("legend-b");
const warnEl = document.getElementById("comparison-warning");
const statusEl = document.getElementById("load-status");

const searchA = document.getElementById("search-a");
const searchB = document.getElementById("search-b");
const listA = document.getElementById("list-a");
const listB = document.getElementById("list-b");
const imgA = document.getElementById("img-a");
const imgB = document.getElementById("img-b");
const nameA = document.getElementById("name-a");
const nameB = document.getElementById("name-b");
const metaA = document.getElementById("meta-a");
const metaB = document.getElementById("meta-b");

const axisSelects = Array.from({ length: 6 }, (_, i) => document.getElementById(`axis-${i}`));
const resetBtn = document.getElementById("reset-stats");

let dataset = null;
let catalog = [];
let playerA = null;
let playerB = null;
let axisKeys = [...PRESETS.FW];
let radar = null;

function formatRaw(key, raw) {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return "—";
  if (key.includes("%") || key === "SoT%" || key === "Cmp%" || key === "Save%" || key === "CS%") {
    return `${raw.toFixed(1)}%`;
  }
  if (Math.abs(raw) >= 100 || Number.isInteger(raw)) return String(Math.round(raw * 100) / 100);
  return raw.toFixed(2);
}

/** Dataset value with extra precision for chart tooltips */
function formatRawExact(key, raw) {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return "—";
  const n = Number(raw);
  const k = String(key);
  const pctCol =
    k.includes("%") ||
    ["SoT%", "Cmp%", "Save%", "CS%", "Stp%", "Launch%", "Min%", "Succ%", "Won%", "Tkl%"].includes(k);
  if (pctCol) return `${n.toFixed(3)}%`;
  if (Math.abs(n) >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (Math.abs(n) >= 100) return n.toFixed(3);
  if (Math.abs(n) >= 10) return n.toFixed(4);
  if (Math.abs(n) >= 1) return n.toFixed(5);
  return n.toFixed(6);
}

function setWarning(msg) {
  warnEl.textContent = msg || "";
  warnEl.hidden = !msg;
}

function filterPlayers(q) {
  if (!dataset || !q || q.length < 1) return [];
  const qq = q.toLowerCase();
  const out = [];
  for (const row of dataset.rows) {
    if (row.Player.toLowerCase().includes(qq)) {
      out.push(row);
      if (out.length >= 25) break;
    }
  }
  return out;
}

function renderList(ul, rows, pick) {
  ul.innerHTML = "";
  ul.hidden = rows.length === 0;
  for (const row of rows) {
    const li = document.createElement("li");
    li.innerHTML = `<span class="ac-name">${escapeHtml(row.Player)}</span><span class="ac-meta">${escapeHtml(
      row.Squad
    )} · ${escapeHtml(row.Comp)}</span>`;
    li.tabIndex = 0;
    li.setAttribute("role", "option");
    li.addEventListener("click", () => pick(row));
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        pick(row);
      }
    });
    ul.appendChild(li);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function fetchPlayerImage(name) {
  try {
    const res = await fetch(`/api/player?name=${encodeURIComponent(name)}`);
    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch {
      /* Live Server / static hosts often return HTML for unknown routes */
    }
    if (res.ok && data.imageUrl) return data.imageUrl;
  } catch (_) {
    /* offline */
  }
  try {
    const url = await resolvePlayerPhoto(name);
    return url;
  } catch (_) {
    return null;
  }
}

function fillAxisDropdowns() {
  const byCat = {};
  for (const c of catalog) {
    if (!byCat[c.category]) byCat[c.category] = [];
    byCat[c.category].push(c);
  }

  for (const sel of axisSelects) {
    const cur = sel.value;
    sel.innerHTML = "";
    for (const cat of ["Attacking", "Midfield", "Defending", "Goalkeeping"]) {
      const items = byCat[cat];
      if (!items?.length) continue;
      const og = document.createElement("optgroup");
      og.label = cat;
      for (const item of items) {
        const o = document.createElement("option");
        o.value = item.key;
        o.textContent = `${item.label}`;
        o.title = statDescription(item.key);
        og.appendChild(o);
      }
      sel.appendChild(og);
    }
    if (catalog.some((c) => c.key === cur)) sel.value = cur;
  }

  axisKeys.forEach((key, i) => {
    if (axisSelects[i] && catalog.some((c) => c.key === key)) {
      axisSelects[i].value = key;
    }
  });
}

function syncSelectsFromAxisKeys() {
  axisKeys.forEach((key, i) => {
    const sel = axisSelects[i];
    if (sel && catalog.some((c) => c.key === key)) sel.value = key;
  });
}

function applyRecommendedAxes() {
  if (playerA && playerB && canComparePositions(playerA.Pos, playerB.Pos)) {
    axisKeys = recommendedAxisKeys(playerA, playerB);
  } else if (playerA) {
    const role = getPrimaryRole(playerA.Pos);
    axisKeys = [...(PRESETS[role] || PRESETS.MF)];
  } else if (playerB) {
    const role = getPrimaryRole(playerB.Pos);
    axisKeys = [...(PRESETS[role] || PRESETS.MF)];
  } else {
    axisKeys = [...PRESETS.FW];
  }
  syncSelectsFromAxisKeys();
}

function buildMeta(row, keys) {
  return keys.map((key) => {
    const raw = dataset.rawForPlayer(row, key);
    const p = dataset.percentileForPlayer(row, key);
    return {
      key,
      label: statLabel(key),
      rawExact: formatRawExact(key, raw),
      percentileExact:
        p == null ? "N/A (missing in dataset)" : `${Number(p).toFixed(2)} / 100`,
    };
  });
}

function updateChart() {
  if (!radar || !dataset) return;

  const invalid = playerA && playerB && !canComparePositions(playerA.Pos, playerB.Pos);
  if (invalid) {
    setWarning(
      "Goalkeepers can only be compared with other goalkeepers. Pick two outfield players or two goalkeepers."
    );
    radar.update({
      axisKeys,
      labels: axisKeys.map((k) => statLabel(k)),
      playerA: {
        name: playerA?.Player ?? "Player A",
        color: "var(--player-a)",
        values: axisKeys.map(() => 0),
        meta: axisKeys.map((k) => ({
          key: k,
          label: statLabel(k),
          rawExact: "—",
          percentileExact: "—",
        })),
      },
      playerB: {
        name: playerB?.Player ?? "Player B",
        color: "var(--player-b)",
        values: axisKeys.map(() => 0),
        meta: axisKeys.map((k) => ({
          key: k,
          label: statLabel(k),
          rawExact: "—",
          percentileExact: "—",
        })),
      },
      transitionMs: 400,
    });
    return;
  }

  setWarning("");

  const valsA = playerA
    ? axisKeys.map((k) => dataset.percentileForPlayer(playerA, k) ?? 0)
    : axisKeys.map(() => 0);
  const valsB = playerB
    ? axisKeys.map((k) => dataset.percentileForPlayer(playerB, k) ?? 0)
    : axisKeys.map(() => 0);

  radar.update({
    axisKeys,
    labels: axisKeys.map((k) => statLabel(k)),
    playerA: {
      name: playerA?.Player ?? "Player A",
      color: "var(--player-a)",
      values: valsA,
      meta: playerA ? buildMeta(playerA, axisKeys) : axisKeys.map(() => ({})),
    },
    playerB: {
      name: playerB?.Player ?? "Player B",
      color: "var(--player-b)",
      values: valsB,
      meta: playerB ? buildMeta(playerB, axisKeys) : axisKeys.map(() => ({})),
    },
    transitionMs: 450,
  });
}

function wireAxisSelects() {
  axisSelects.forEach((sel, i) => {
    sel.addEventListener("change", () => {
      axisKeys[i] = sel.value;
      updateChart();
    });
  });
}

async function onPickPlayer(side, row) {
  if (side === "a") {
    playerA = row;
    searchA.value = row.Player;
    listA.hidden = true;
    nameA.textContent = row.Player;
    metaA.textContent = `${row.Squad} · ${row.Comp} · ${row.Pos}`;
    imgA.src =
      (await fetchPlayerImage(row.Player)) ||
      "data:image/svg+xml," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200"><rect fill="#e5e7eb" width="100%" height="100%"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="sans-serif" font-size="14">No photo</text></svg>`
        );
    imgA.alt = row.Player;
    legendA.textContent = row.Player;
  } else {
    playerB = row;
    searchB.value = row.Player;
    listB.hidden = true;
    nameB.textContent = row.Player;
    metaB.textContent = `${row.Squad} · ${row.Comp} · ${row.Pos}`;
    imgB.src =
      (await fetchPlayerImage(row.Player)) ||
      "data:image/svg+xml," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="200"><rect fill="#e5e7eb" width="100%" height="100%"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="sans-serif" font-size="14">No photo</text></svg>`
        );
    imgB.alt = row.Player;
    legendB.textContent = row.Player;
  }

  applyRecommendedAxes();
  fillAxisDropdowns();
  syncSelectsFromAxisKeys();
  updateChart();
}

function setupSearch(side) {
  const input = side === "a" ? searchA : searchB;
  const list = side === "a" ? listA : listB;

  input.addEventListener("input", () => {
    const rows = filterPlayers(input.value.trim());
    renderList(list, rows, (row) => onPickPlayer(side, row));
  });

  input.addEventListener("focus", () => {
    const rows = filterPlayers(input.value.trim());
    renderList(list, rows, (row) => onPickPlayer(side, row));
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !list.contains(e.target)) list.hidden = true;
  });
}

async function fetchDatasetCsv() {
  const filename = "players_data_cleaned_v2.csv";
  const attempts = [];
  if (typeof window !== "undefined" && window.location?.origin && window.location.origin !== "null") {
    attempts.push(`${window.location.origin}/data/${filename}`);
  }
  attempts.push(`/data/${filename}`, `./data/${filename}`, new URL(`data/${filename}`, import.meta.url).href);

  let lastErr;
  for (const url of attempts) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return await res.text();
      lastErr = new Error(`${res.status} ${res.statusText}`);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Could not load CSV");
}

async function init() {
  statusEl.textContent = "Loading dataset…";
  try {
    const text = await fetchDatasetCsv();
    const rows = parseCSV(text);
    dataset = buildDataset(rows);
    catalog = dataset.availableStatsCatalog();
    statusEl.textContent = `${rows.length} player-season rows · percentile-normalized stats`;

    fillAxisDropdowns();
    wireAxisSelects();
    radar = createRadarChart(chartMount, { width: 460, height: 460 });
    setupSearch("a");
    setupSearch("b");

    axisKeys.forEach((k, i) => {
      if (axisSelects[i]) axisSelects[i].value = k;
    });

    resetBtn.addEventListener("click", () => {
      applyRecommendedAxes();
      fillAxisDropdowns();
      syncSelectsFromAxisKeys();
      updateChart();
    });

    document.querySelectorAll(".axis-row").forEach((row) => {
      const sel = row.querySelector("select");
      const btn = row.querySelector(".stat-help");
      if (!sel || !btn) return;
      btn.addEventListener("click", () => {
        const key = sel.value;
        const desc = statDescription(key);
        const lab = statLabel(key);
        alert(`${lab}\n\n${desc}`);
      });
    });

    updateChart();
  } catch (err) {
    console.error(err);
    statusEl.innerHTML =
      `Could not load <code>players_data_cleaned_v2.csv</code> (${String(err?.message || err)}). ` +
      "From the project folder run <code>npm start</code> or <code>node scraper.js</code>, then open " +
      "<code>http://localhost:3000</code> — not a local <code>file://</code> path. " +
      "Ensure <code>data/players_data_cleaned_v2.csv</code> exists beside <code>scraper.js</code>.";
  }
}

init();
