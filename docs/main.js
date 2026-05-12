import {
  buildDataset,
  parseCSV,
  statLabel,
  recommendedAxisKeys,
  canComparePositions,
  getPrimaryRole,
  PRESETS,
} from "./dataProcessing.js";
import { createRadarChart } from "./radarChart.js";
import { asciiSearchText, resolvePlayerPhoto } from "./playerImages.js";

const chartMount = document.getElementById("radar-mount");
const legendA = document.getElementById("legend-a");
const legendB = document.getElementById("legend-b");
const warnEl = document.getElementById("comparison-warning");
const statusEl = document.getElementById("load-status");
const headlineA = document.getElementById("headline-a");
const headlineB = document.getElementById("headline-b");
const leagueStatusEl = document.getElementById("league-filter-status");
const positionStatusEl = document.getElementById("position-filter-status");
const roleStatusEl = document.getElementById("role-filter-status");
const leagueTabs = Array.from(document.querySelectorAll(".league-tab"));
const positionTabs = Array.from(document.querySelectorAll(".position-tab"));
const roleTabs = Array.from(document.querySelectorAll(".role-tab"));
const roleFilterBlock = document.getElementById("role-filter-block");
const toggleRoleFilterBtn = document.getElementById("toggle-role-filter");

const searchA = document.getElementById("search-a");
const searchB = document.getElementById("search-b");
const listA = document.getElementById("list-a");
const listB = document.getElementById("list-b");
const imgA = document.getElementById("img-a");
const imgB = document.getElementById("img-b");
const nameA = document.getElementById("name-a");
const nameB = document.getElementById("name-b");
const identityA = document.getElementById("identity-a");
const identityB = document.getElementById("identity-b");
const metaA = document.getElementById("meta-a");
const metaB = document.getElementById("meta-b");

const resetBtn  = document.getElementById("reset-stats");
const rankBtnA  = document.getElementById("rank-btn-a");
const rankBtnB  = document.getElementById("rank-btn-b");
const chartAxisPicker = document.createElement("div");
chartAxisPicker.className = "chart-axis-picker";
chartAxisPicker.hidden = true;
chartAxisPicker.innerHTML = `
  <input class="chart-axis-search" type="search" autocomplete="off" placeholder="Search attributes..." aria-label="Search radar attributes" />
  <ul class="chart-axis-results" role="listbox"></ul>
`;
const chartAxisSearch = chartAxisPicker.querySelector(".chart-axis-search");
const chartAxisResults = chartAxisPicker.querySelector(".chart-axis-results");
document.body.appendChild(chartAxisPicker);

const MAX_PHOTO_REQUESTS = 4;
const IMAGE_API_TIMEOUT_MS = 4500;
const LOCAL_IMAGE_API_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];
const LOCAL_ASSET_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];
const FLAG_CDN_BASE = "https://cdn.jsdelivr.net/npm/flag-icons/flags/4x3";

let dataset = null;
let catalog = [];
let playerA = null;
let playerB = null;
let axisKeys = [...PRESETS.FW];
let radar = null;
let activeLeague = "all";
let activePosition = "all";
let activeRole = "all";

/**
 * POSITION SEARCH FILTERS (Feature 2)
 * Per-side Sets of selected position codes (e.g. {"FW","MF"}).
 * An empty Set means "all positions" — no filtering applied.
 * Kept separate per panel so Player A and Player B can be filtered
 * independently (e.g. A → FW only, B → GK only).
 */
const posFilterA = new Set();
const posFilterB = new Set();

const photoCache = new Map();
const photoSrcCache = new Map();
const photoQueue = [];
let activePhotoRequests = 0;
let imageRequestTokenA = 0;
let imageRequestTokenB = 0;

const POSITION_LABELS = {
  GK: "Goalkeeper",
  DF: "Defender",
  MF: "Midfielder",
  FW: "Forward",
};

const LEAGUE_LABELS = {
  "eng Premier League": "Premier League",
  "es La Liga": "La Liga",
  "it Serie A": "Serie A",
  "de Bundesliga": "Bundesliga",
  "fr Ligue 1": "Ligue 1",
};

const LOGO_FOLDERS = {
  "eng Premier League": "England - Premier League",
  "es La Liga": "Spain - LaLiga",
  "it Serie A": "Italy - Serie A",
  "de Bundesliga": "Germany - Bundesliga",
  "fr Ligue 1": "France - Ligue 1",
};

const TEAM_LOGO_FILES = {
  Alavés: "Deportivo Alavés.png",
  Angers: "Angers SCO.png",
  Arsenal: "Arsenal FC.png",
  Atalanta: "Atalanta BC.png",
  "Athletic Club": "Athletic Bilbao.png",
  "Atlético Madrid": "Atlético de Madrid.png",
  Augsburg: "FC Augsburg.png",
  Auxerre: "AJ Auxerre.png",
  Barcelona: "FC Barcelona.png",
  Betis: "Real Betis Balompié.png",
  Bochum: "VfL Bochum.png",
  Bologna: "Bologna FC 1909.png",
  Bournemouth: "AFC Bournemouth.png",
  Brentford: "Brentford FC.png",
  Brest: "Stade Brestois 29.png",
  Brighton: "Brighton & Hove Albion.png",
  Cagliari: "Cagliari Calcio.png",
  "Celta Vigo": "Celta de Vigo.png",
  Chelsea: "Chelsea FC.png",
  Como: "Como 1907.png",
  Dortmund: "Borussia Dortmund.png",
  "Eint Frankfurt": "Eintracht Frankfurt.png",
  Empoli: "FC Empoli.png",
  Espanyol: "RCD Espanyol Barcelona.png",
  Everton: "Everton FC.png",
  Fiorentina: "ACF Fiorentina.png",
  Freiburg: "SC Freiburg.png",
  Fulham: "Fulham FC.png",
  Genoa: "Genoa CFC.png",
  Getafe: "Getafe CF.png",
  Girona: "Girona FC.png",
  Gladbach: "Borussia Mönchengladbach.png",
  Heidenheim: "1.FC Heidenheim 1846.png",
  Hoffenheim: "TSG 1899 Hoffenheim.png",
  Inter: "Inter Milan.png",
  Juventus: "Juventus FC.png",
  "Las Palmas": "UD Las Palmas.png",
  Lazio: "SS Lazio.png",
  "Le Havre": "Le Havre AC.png",
  Lecce: "US Lecce.png",
  Leverkusen: "Bayer 04 Leverkusen.png",
  Leganés: "CD Leganés.png",
  Lens: "RC Lens.png",
  Lille: "LOSC Lille.png",
  Liverpool: "Liverpool FC.png",
  Lyon: "Olympique Lyon.png",
  "Mainz 05": "1.FSV Mainz 05.png",
  Mallorca: "RCD Mallorca.png",
  "Manchester Utd": "Manchester United.png",
  Marseille: "Olympique Marseille.png",
  Milan: "AC Milan.png",
  Monaco: "AS Monaco.png",
  Montpellier: "Montpellier HSC.png",
  Monza: "AC Monza.png",
  Nantes: "FC Nantes.png",
  Napoli: "SSC Napoli.png",
  "Newcastle Utd": "Newcastle United.png",
  Nice: "OGC Nice.png",
  "Nott'ham Forest": "Nottingham Forest.png",
  Osasuna: "CA Osasuna.png",
  "Paris S-G": "Paris Saint-Germain.png",
  Parma: "Parma Calcio 1913.png",
  "RB Leipzig": "RB Leipzig.png",
  Reims: "Stade Reims.png",
  Rennes: "Stade Rennais FC.png",
  Roma: "AS Roma.png",
  "Saint-Étienne": "AS Saint-Étienne.png",
  Sevilla: "Sevilla FC.png",
  Southampton: "Southampton FC.png",
  "St. Pauli": "FC St. Pauli.png",
  Strasbourg: "RC Strasbourg Alsace.png",
  Stuttgart: "VfB Stuttgart.png",
  Tottenham: "Tottenham Hotspur.png",
  Toulouse: "FC Toulouse.png",
  Torino: "Torino FC.png",
  Udinese: "Udinese Calcio.png",
  Valencia: "Valencia CF.png",
  "Union Berlin": "1.FC Union Berlin.png",
  Valladolid: "Real Valladolid CF.png",
  Venezia: "Venezia FC.png",
  Villarreal: "Villarreal CF.png",
  "Werder Bremen": "SV Werder Bremen.png",
  "West Ham": "West Ham United.png",
  Wolfsburg: "VfL Wolfsburg.png",
  Wolves: "Wolverhampton Wanderers.png",
};

const FLAG_CODE_OVERRIDES = {
  eng: "gb-eng",
  nir: "gb-nir",
  sct: "gb-sct",
  wls: "gb-wls",
};

const POSITION_LABELS_BY_FILTER = {
  all: "All-around",
  attacking: "Attacking",
  midfield: "Midfield",
  defending: "Defending",
  goalkeeping: "Goalkeeping",
};

const ROLE_LABELS = {
  all: "All roles",
  striker: "Striker",
  winger: "Winger",
  "attacking-mid": "Attacking Mid",
  "central-mid": "Central Mid",
  "defensive-mid": "Defensive Mid",
  fullback: "Fullback",
  "center-back": "Center Back",
  goalkeeper: "Goalkeeper",
};

const POSITION_PRESETS = {
  all: ["Gls", "Ast", "PrgP", "PrgC", "Tkl", "Int"],
  attacking: ["Gls", "xG", "Sh", "SoT", "PrgC", "Att Pen"],
  midfield: ["Ast", "xAG", "KP", "PrgP", "Carries", "Cmp%"],
  defending: ["Tkl", "Int", "Clr", "Blocks_stats_defense", "Won", "Cmp"],
  goalkeeping: ["Saves", "Save%", "CS", "GA", "PSxG", "Stp"],
};

const ROLE_PRESETS = {
  striker: ["Gls", "xG", "Sh", "SoT", "Att Pen", "npxG"],
  winger: ["PrgC", "PrgR", "Crs", "Succ", "Ast", "xAG"],
  "attacking-mid": ["Ast", "xAG", "KP", "SCA", "PassLive", "PPA"],
  "central-mid": ["Cmp", "Cmp%", "PrgP", "Carries", "Rec", "PrgDist"],
  "defensive-mid": ["Tkl", "Int", "Blocks_stats_defense", "Recov", "PrgP", "Cmp"],
  fullback: ["Tkl", "Int", "Crs", "PrgC", "PrgP", "Touches"],
  "center-back": ["Clr", "Blocks_stats_defense", "Won", "Tkl", "Int", "Cmp"],
  goalkeeper: ["Saves", "Save%", "CS", "GA", "PSxG", "Stp"],
};

/**
 * DEFAULT PLAYER SELECTION (Feature 1)
 * Priority-ordered pools of notable 2024/25 players per league.
 * selectLeagueDefaults() walks each pool and picks the first two
 * names that actually exist in the loaded CSV dataset.
 * Falls back to the first two rows in the league if none are found.
 */
const LEAGUE_PLAYER_POOLS = {
  "all": [
    "Vinicius Júnior", "Erling Haaland", "Kylian Mbappé", "Mohamed Salah",
  ],
  "eng Premier League": [
    "Mohamed Salah", "Erling Haaland", "Cole Palmer", "Bukayo Saka",
    "Alexander Isak", "Ollie Watkins", "Phil Foden", "Son Heung-min",
  ],
  "es La Liga": [
    "Vinicius Júnior", "Jude Bellingham", "Kylian Mbappé", "Robert Lewandowski",
    "Lamine Yamal", "Pedri", "Arda Güler", "Dani Carvajal",
  ],
  "it Serie A": [
    "Lautaro Martínez", "Ademola Lookman", "Romelu Lukaku", "Dušan Vlahović",
    "Moise Kean", "Paulo Dybala", "Khvicha Kvaratskhelia", "Marcus Thuram",
  ],
  "de Bundesliga": [
    "Harry Kane", "Florian Wirtz", "Jamal Musiala", "Serhou Guirassy",
    "Omar Marmoush", "Leroy Sané", "Michael Olise", "Viktor Gyökeres",
  ],
  "fr Ligue 1": [
    "Bradley Barcola", "Jonathan David", "Achraf Hakimi", "Gonçalo Ramos",
    "Mason Greenwood", "Amine Harit", "Désiré Doué", "Rayan Cherki",
  ],
};

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

function leagueLabel(comp) {
  return LEAGUE_LABELS[comp] || comp || "Unknown league";
}

function formatPosition(pos) {
  const parts = String(pos || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return "Unknown position";
  return parts.map((p) => `${p} (${POSITION_LABELS[p] || p})`).join(", ");
}

function positionText(row) {
  if (!row) return "";
  return formatPosition(row.Pos);
}

function applyAxisPreset(keys) {
  const valid = keys.filter((key) => catalog.some((item) => item.key === key));
  if (valid.length >= 6) axisKeys = valid.slice(0, 6);
  else axisKeys = [...keys.slice(0, 6)];
  updateChart();
}

function nationParts(nation) {
  const parts = String(nation || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length || parts[0] === "NULL") return { flagCode: "", label: "Unknown nationality" };
  const rawCode = parts[0].toLowerCase();
  return {
    flagCode: FLAG_CODE_OVERRIDES[rawCode] || rawCode,
    label: parts.slice(1).join(" ") || rawCode.toUpperCase(),
  };
}

function localAssetOrigins() {
  const current = window.location.origin;
  return [...new Set([current, ...LOCAL_ASSET_ORIGINS])].filter((origin) => /^https?:\/\//.test(origin));
}

function withRepoRootPath(path) {
  const clean = path.replace(/^\/+/, "");
  return clean;
}

function teamLogoUrls(row) {
  if (!row) return "";
  const folder = LOGO_FOLDERS[row.Comp];
  const file = TEAM_LOGO_FILES[row.Squad] || `${row.Squad}.png`;
  if (!folder || !file) return [];
  const encodedPath = `${encodeURIComponent(folder)}/${encodeURIComponent(file)}`;
  const repoPath = `team-logos/${folder}/${file}`;
  return [
    ...localAssetOrigins().map((origin) => `${origin}/team-logos/${encodedPath}`),
    withRepoRootPath(repoPath),
  ];
}

function flagUrls(row) {
  const nation = nationParts(row?.Nation);
  if (!nation.flagCode) return [];
  return [
    ...localAssetOrigins().map((origin) => `${origin}/flag-icons/flags/4x3/${nation.flagCode}.svg`),
    `${FLAG_CDN_BASE}/${nation.flagCode}.svg`,
  ];
}

function assetImgMarkup({ urls, className, alt, title = "", extraClass = "" }) {
  if (!urls?.length) return `<span class="${className} ${extraClass} identity-empty" aria-hidden="true"></span>`;
  const [first, ...rest] = urls;
  return `<img class="${className} ${extraClass}" src="${escapeHtml(first)}" data-fallbacks="${escapeHtml(
    JSON.stringify(rest)
  )}" alt="${escapeHtml(alt)}" title="${escapeHtml(title || alt)}" loading="lazy" />`;
}

function activateAssetFallbacks(root) {
  root.querySelectorAll("img[data-fallbacks]").forEach((img) => {
    img.addEventListener("error", () => {
      const fallbacks = JSON.parse(img.dataset.fallbacks || "[]");
      const next = fallbacks.shift();
      img.dataset.fallbacks = JSON.stringify(fallbacks);
      if (next) img.src = next;
      else img.classList.add("asset-missing");
    });
  });
}

function flagMarkup(row, className = "identity-flag") {
  const nation = nationParts(row?.Nation);
  return assetImgMarkup({
    urls: flagUrls(row),
    className,
    alt: `${nation.label} flag`,
    title: nation.label,
  });
}

function renderIdentity(target, row) {
  if (!target) return;
  if (!row) {
    target.innerHTML = "";
    return;
  }
  const nation = nationParts(row.Nation);
  const logoUrls = teamLogoUrls(row);
  target.innerHTML = `
    <span class="identity-pill" title="${escapeHtml(nation.label)}">
      ${flagMarkup(row)}
    </span>
    <span class="identity-pill" title="${escapeHtml(row.Squad)}">
      ${assetImgMarkup({
        urls: logoUrls,
        className: "club-logo",
        alt: `${row.Squad} logo`,
        title: row.Squad,
        extraClass: "club-logo--empty",
      })}
    </span>`;
  activateAssetFallbacks(target);
}

function visibleRows() {
  if (!dataset) return [];
  return dataset.rows.filter((row) => activeLeague === "all" || row.Comp === activeLeague);
}

function rowMatchesActiveLeague(row) {
  return activeLeague === "all" || row?.Comp === activeLeague;
}

/**
 * Filter the player pool by name query and an optional position filter Set.
 *
 * posFilter (Feature 2): a Set of position codes such as {"FW","MF"}.
 * A player matches if ANY of their listed positions (comma-separated in the
 * CSV) appears in the Set.  An empty / null Set means "all positions".
 * This filter is per-side (posFilterA / posFilterB) and is independent of
 * the league pool and radar-preset axis filters.
 */
function filterPlayers(q, posFilter = null) {
  if (!dataset) return [];
  const qq = asciiSearchText(q);
  const out = [];
  for (const row of visibleRows()) {
    // Position filter: match any position the player plays
    if (posFilter && posFilter.size > 0) {
      const positions = String(row.Pos || "").split(",").map((p) => p.trim());
      if (!positions.some((p) => posFilter.has(p))) continue;
    }
    if (!qq || asciiSearchText(row.Player).includes(qq)) {
      out.push(row);
      if (out.length >= 40) break;
    }
  }
  return out;
}

function renderList(ul, rows, pick) {
  ul.innerHTML = "";
  ul.hidden = rows.length === 0;
  rows.forEach((row) => {
    const li = document.createElement("li");
    li.innerHTML = `${flagMarkup(row, "ac-flag")}<span class="ac-copy"><span class="ac-name">${escapeHtml(
      row.Player
    )}</span><span class="ac-meta">${escapeHtml(row.Squad)} · ${escapeHtml(leagueLabel(row.Comp))} · ${escapeHtml(
      formatPosition(row.Pos)
    )}</span></span>`;
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
    activateAssetFallbacks(li);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function playerPhotoKey(player) {
  if (typeof player === "string") return asciiSearchText(player);
  return asciiSearchText(player?.Player || "");
}

function imageApiOrigins() {
  const current = window.location.origin;
  const origins = current.includes(":3000")
    ? [current, ...LOCAL_IMAGE_API_ORIGINS]
    : [...LOCAL_IMAGE_API_ORIGINS, current];
  return [...new Set(origins)].filter((origin) => /^https?:\/\//.test(origin));
}

function queuePhotoLookup(task, priority = false) {
  return new Promise((resolve) => {
    const item = { task, resolve };
    if (priority) photoQueue.unshift(item);
    else photoQueue.push(item);
    runPhotoQueue();
  });
}

function runPhotoQueue() {
  while (activePhotoRequests < MAX_PHOTO_REQUESTS && photoQueue.length) {
    const item = photoQueue.shift();
    activePhotoRequests += 1;
    item
      .task()
      .then(item.resolve)
      .catch(() => item.resolve(null))
      .finally(() => {
        activePhotoRequests -= 1;
        runPhotoQueue();
      });
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), IMAGE_API_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchPlayerImage(player) {
  const name = typeof player === "string" ? player : player?.Player;
  const squad = typeof player === "string" ? "" : player?.Squad || "";
  const comp = typeof player === "string" ? "" : player?.Comp || "";
  const variants = [...new Set([String(name).trim(), asciiSearchText(name)].filter(Boolean))];
  for (const origin of imageApiOrigins()) {
    try {
      const params = new URLSearchParams({ name: String(name).trim() });
      if (squad) params.set("squad", squad);
      if (comp) params.set("comp", comp);
      const res = await fetchWithTimeout(`${origin}/api/player?${params.toString()}`);
      const text = await res.text();
      let data = {};
      try {
        data = JSON.parse(text);
      } catch {
        /* Live Server / static hosts often return HTML for unknown routes */
      }
      if (res.ok && data.imageUrl) return data.imageUrl;
    } catch (_) {
      /* try the next origin */
    }
  }
  for (const variant of variants) {
    try {
      const url = await resolvePlayerPhoto(variant, { squad, comp });
      if (url) return url;
    } catch (_) {
      /* try next spelling */
    }
  }
  return null;
}

function noPhotoSvg(width = 160, height = 200, text = "No photo") {
  return (
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect fill="#e5e7eb" width="100%" height="100%"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#6b7280" font-family="sans-serif" font-size="14">${text}</text></svg>`
    )
  );
}

function getCachedPlayerImage(player, options = {}) {
  const key = playerPhotoKey(player);
  if (photoSrcCache.has(key)) return Promise.resolve(photoSrcCache.get(key));
  if (!photoCache.has(key)) {
    const promise = queuePhotoLookup(() => fetchPlayerImage(player), options.priority).then((src) => {
      if (src && !photoSrcCache.has(key)) photoSrcCache.set(key, src);
      return src;
    });
    photoCache.set(key, promise);
  }
  return photoCache.get(key);
}

function loadSelectedPlayerImage(side, row) {
  const img = side === "a" ? imgA : imgB;
  const token = side === "a" ? ++imageRequestTokenA : ++imageRequestTokenB;
  const key = playerPhotoKey(row);
  img.src = noPhotoSvg();

  const cachedSrc = photoSrcCache.get(key);
  const promise = cachedSrc ? Promise.resolve(cachedSrc) : fetchPlayerImage(row);
  photoCache.set(key, promise);

  promise.then((src) => {
    if (!src) return;
    photoSrcCache.set(key, src);
    photoCache.set(key, Promise.resolve(src));
    if (side === "a" && token !== imageRequestTokenA) return;
    if (side === "b" && token !== imageRequestTokenB) return;
    if (playerA && playerPhotoKey(playerA) === key) imgA.src = src;
    if (playerB && playerPhotoKey(playerB) === key) imgB.src = src;
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
}

/**
 * Build per-axis metadata for a player, optionally including differential
 * values compared to the other player (Feature 2 — Differential Tooltip).
 *
 * @param {object}      row      - The primary player's dataset row.
 * @param {string[]}    keys     - The active radar axis keys.
 * @param {object|null} otherRow - The comparison player's row, or null when
 *                                 only one player is selected (no diff shown).
 */
function buildMeta(row, keys, otherRow = null) {
  return keys.map((key) => {
    const raw   = dataset.rawForPlayer(row, key);
    const score = dataset.normalizedForPlayer(row, key);
    const range = dataset.rangeForStat(key);

    // --- Differential calculations ---
    // Compare this player's raw value and normalized score against the other
    // player on the same axis. Both rawDiff and scoreDiff are kept as raw
    // numbers so radarChart.js can colour-code them; the pre-formatted strings
    // avoid duplicating formatting logic inside the chart module.
    let rawDiff     = null;
    let scoreDiff   = null;
    let rawDiffStr  = null;
    let scoreDiffStr = null;

    if (otherRow) {
      const otherRaw   = dataset.rawForPlayer(otherRow, key);
      const otherScore = dataset.normalizedForPlayer(otherRow, key);

      if (raw != null && !Number.isNaN(Number(raw)) &&
          otherRaw != null && !Number.isNaN(Number(otherRaw))) {
        rawDiff = Number(raw) - Number(otherRaw);
        // Re-use formatRaw on the absolute value then prepend the sign,
        // so percentage-type stats still render with their "%" suffix.
        const sign = rawDiff >= 0 ? "+" : "-";
        rawDiffStr = sign + formatRaw(key, Math.abs(rawDiff));
      }

      if (score != null && !Number.isNaN(Number(score)) &&
          otherScore != null && !Number.isNaN(Number(otherScore))) {
        scoreDiff = Number(score) - Number(otherScore);
        // Scores are 0–100 normalized points; show as "±X.X pts"
        const sign = scoreDiff >= 0 ? "+" : "";
        scoreDiffStr = `${sign}${scoreDiff.toFixed(1)} pts`;
      }
    }

    return {
      key,
      label: statLabel(key),
      rawExact: formatRawExact(key, raw),
      scoreExact:
        score == null ? "N/A (missing in dataset)" : `${Number(score).toFixed(2)} / 100`,
      rangeExact:
        range?.min == null || range?.max == null
          ? "N/A"
          : `${formatRawExact(key, range.min)} to ${formatRawExact(key, range.max)}`,
      // Differential data (null when no comparison player is selected)
      rawDiff,
      scoreDiff,
      rawDiffStr,
      scoreDiffStr,
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
          scoreExact: "—",
          rangeExact: "—",
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
          scoreExact: "—",
          rangeExact: "—",
        })),
      },
      transitionMs: 400,
    });
    return;
  }

  setWarning("");

  const valsA = playerA
    ? axisKeys.map((k) => dataset.normalizedForPlayer(playerA, k) ?? 0)
    : axisKeys.map(() => 0);
  const valsB = playerB
    ? axisKeys.map((k) => dataset.normalizedForPlayer(playerB, k) ?? 0)
    : axisKeys.map(() => 0);

  radar.update({
    axisKeys,
    labels: axisKeys.map((k) => statLabel(k)),
    playerA: {
      name: playerA?.Player ?? "Player A",
      color: "var(--player-a)",
      values: valsA,
      // Pass playerB as the comparison reference so differential tooltips work (Feature 2)
      meta: playerA ? buildMeta(playerA, axisKeys, playerB) : axisKeys.map(() => ({})),
    },
    playerB: {
      name: playerB?.Player ?? "Player B",
      color: "var(--player-b)",
      values: valsB,
      // Pass playerA as the comparison reference so differential tooltips work (Feature 2)
      meta: playerB ? buildMeta(playerB, axisKeys, playerA) : axisKeys.map(() => ({})),
    },
    transitionMs: 450,
  });
}

function onPickPlayer(side, row) {
  if (side === "a") {
    playerA = row;
    searchA.value = row.Player;
    listA.hidden = true;
    nameA.textContent = row.Player;
    renderIdentity(identityA, row);
    metaA.textContent = `${row.Squad} · ${leagueLabel(row.Comp)} · ${positionText(row)}`;
    imgA.alt = row.Player;
    loadSelectedPlayerImage("a", row);
    legendA.textContent = row.Player;
    if (headlineA) headlineA.textContent = row.Player;
    // Show the manual rankings button now that a player is loaded (Feature 3)
    if (rankBtnA) rankBtnA.hidden = false;
  } else {
    playerB = row;
    searchB.value = row.Player;
    listB.hidden = true;
    nameB.textContent = row.Player;
    renderIdentity(identityB, row);
    metaB.textContent = `${row.Squad} · ${leagueLabel(row.Comp)} · ${positionText(row)}`;
    imgB.alt = row.Player;
    loadSelectedPlayerImage("b", row);
    legendB.textContent = row.Player;
    if (headlineB) headlineB.textContent = row.Player;
    if (rankBtnB) rankBtnB.hidden = false;
  }

  updateChart();
}

function selectDefaultPlayers() {
  const vinicius = dataset?.rows.find((row) => row.Player === "Vinicius Júnior");
  const haaland = dataset?.rows.find((row) => row.Player === "Erling Haaland");
  if (vinicius) onPickPlayer("a", vinicius);
  if (haaland) onPickPlayer("b", haaland);
}

/**
 * DEFAULT PLAYER SELECTION PER LEAGUE (Feature 1)
 *
 * Called whenever the active league filter changes.  Walks the priority pool
 * for the chosen league (LEAGUE_PLAYER_POOLS) and picks the first two player
 * names that exist in the loaded dataset.  Falls back to the first two rows
 * for that league if none of the named candidates are found.
 *
 * This function is ONLY called from the league-tab click handler, ensuring
 * defaults fire on league change but never override manual player selections.
 */
function selectLeagueDefaults(league) {
  if (!dataset) return;

  const pool = LEAGUE_PLAYER_POOLS[league] ?? [];
  const leagueRows = league === "all"
    ? dataset.rows
    : dataset.rows.filter((r) => r.Comp === league);

  // Walk the priority pool and collect the first two distinct matches
  const found = [];
  for (const name of pool) {
    const row = leagueRows.find((r) => r.Player === name);
    if (row && !found.includes(row)) {
      found.push(row);
      if (found.length === 2) break;
    }
  }

  // If the named pool didn't yield two players, fill from the league roster
  if (found.length < 2) {
    for (const row of leagueRows) {
      if (!found.includes(row)) {
        found.push(row);
        if (found.length === 2) break;
      }
    }
  }

  if (found[0]) onPickPlayer("a", found[0]);
  if (found[1]) onPickPlayer("b", found[1]);

  // After both players are set, apply position-appropriate axes and re-render
  if (found[0] && found[1]) {
    applyRecommendedAxes();
    updateChart();
  }
}

function hideChartAxisPicker() {
  chartAxisPicker.hidden = true;
  chartAxisPicker.dataset.axisIndex = "";
  chartAxisSearch.value = "";
  chartAxisResults.innerHTML = "";
}

function applyAxisChoice(index, key) {
  if (!Number.isInteger(index) || !axisKeys[index]) return;
  axisKeys[index] = key;
  hideChartAxisPicker();
  updateChart();
}

function filteredStats(query) {
  const q = asciiSearchText(query);
  if (!q) return catalog;
  return catalog.filter((item) => {
    const label = asciiSearchText(item.label);
    const actualName = asciiSearchText(item.actualName);
    const key = asciiSearchText(item.key);
    const category = asciiSearchText(item.category);
    const description = asciiSearchText(item.description);
    return label.includes(q) || actualName.includes(q) || key.includes(q) || category.includes(q) || description.includes(q);
  });
}

function renderChartAxisResults() {
  const index = Number(chartAxisPicker.dataset.axisIndex);
  const rows = filteredStats(chartAxisSearch.value).slice(0, 48);
  const activeKey = axisKeys[index];
  chartAxisResults.innerHTML = "";

  if (!rows.length) {
    const empty = document.createElement("li");
    empty.className = "chart-axis-empty";
    empty.textContent = "No matching attributes";
    chartAxisResults.appendChild(empty);
    return;
  }

  for (const item of rows) {
    const li = document.createElement("li");
    li.className = "chart-axis-option";
    li.setAttribute("role", "option");
    li.tabIndex = 0;
    li.dataset.key = item.key;
    li.setAttribute("aria-selected", String(item.key === activeKey));
    li.innerHTML = `
      <span class="chart-axis-option__label">${escapeHtml(item.label)}</span>
      <span class="chart-axis-option__meta">${escapeHtml(item.category)} · ${escapeHtml(item.key)} · ${escapeHtml(
        item.actualName
      )}</span>
      <span class="chart-axis-option__desc">${escapeHtml(item.description)}</span>
    `;
    li.addEventListener("click", () => applyAxisChoice(index, item.key));
    li.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      applyAxisChoice(index, item.key);
    });
    chartAxisResults.appendChild(li);
  }
}

function showChartAxisPicker({ index, target }) {
  chartAxisPicker.dataset.axisIndex = String(index);
  chartAxisSearch.value = "";
  renderChartAxisResults();

  const rect = target.getBoundingClientRect();
  const width = 380;
  const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left + rect.width / 2 - width / 2));
  const top = Math.min(window.innerHeight - 380, Math.max(12, rect.bottom + 8));

  chartAxisPicker.style.left = `${left}px`;
  chartAxisPicker.style.top = `${top}px`;
  chartAxisPicker.style.width = `${width}px`;
  chartAxisPicker.hidden = false;
  chartAxisSearch.focus();
}

chartAxisSearch.addEventListener("input", renderChartAxisResults);

chartAxisPicker.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    hideChartAxisPicker();
    return;
  }
  if (e.key !== "Enter" || document.activeElement !== chartAxisSearch) return;
  const first = chartAxisResults.querySelector(".chart-axis-option");
  if (!first) return;
  applyAxisChoice(Number(chartAxisPicker.dataset.axisIndex), first.dataset.key);
});

document.addEventListener("pointerdown", (e) => {
  if (chartAxisPicker.hidden || chartAxisPicker.contains(e.target) || e.target.closest?.(".axis-label-control")) {
    return;
  }
  hideChartAxisPicker();
});

function clearPlayer(side) {
  if (side === "a") {
    playerA = null;
    searchA.value = "";
    listA.hidden = true;
    nameA.textContent = "Player A";
    renderIdentity(identityA, null);
    metaA.textContent = "";
    imgA.src = noPhotoSvg(160, 200, "");
    imgA.alt = "";
    legendA.textContent = "Player A";
    if (headlineA) headlineA.textContent = "Player A";
    // Hide rankings button when no player is selected (Feature 3)
    if (rankBtnA) rankBtnA.hidden = true;
  } else {
    playerB = null;
    searchB.value = "";
    listB.hidden = true;
    nameB.textContent = "Player B";
    renderIdentity(identityB, null);
    metaB.textContent = "";
    imgB.src = noPhotoSvg(160, 200, "");
    imgB.alt = "";
    legendB.textContent = "Player B";
    if (headlineB) headlineB.textContent = "Player B";
    if (rankBtnB) rankBtnB.hidden = true;
  }
}

function setupSearch(side) {
  const input     = side === "a" ? searchA : searchB;
  const list      = side === "a" ? listA   : listB;
  const posFilter = side === "a" ? posFilterA : posFilterB;

  // Shared refresh — re-runs whenever query text or position filter changes
  function refresh() {
    const rows = filterPlayers(input.value.trim(), posFilter);
    renderList(list, rows, (row) => onPickPlayer(side, row));
    list.hidden = rows.length === 0;
    input.setAttribute("aria-expanded", String(rows.length > 0 && !list.hidden));
  }

  input.addEventListener("input", refresh);
  input.addEventListener("focus", refresh);

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
    }
  });

  // Wire the position filter button group for this panel (Feature 2)
  setupPositionSearchFilter(side, refresh);
}

/**
 * POSITION SEARCH FILTER SETUP (Feature 2)
 *
 * Wires the five position-filter buttons (All · FW · MF · DF · GK) for one
 * player panel.  FW/MF/DF/GK are multi-select — clicking several keeps all
 * active.  Clicking "All" clears the filter entirely.  Clicking an active
 * specific-position button deactivates it; if no specific positions remain
 * active the filter automatically reverts to "all".
 *
 * The active position set (posFilterA / posFilterB) is a module-level Set so
 * refreshPlayerSearches() can also access it when the league changes.
 */
function setupPositionSearchFilter(side, refreshFn) {
  const group     = document.getElementById(`pos-filter-${side}`);
  if (!group) return;
  const posFilter = side === "a" ? posFilterA : posFilterB;

  group.querySelectorAll(".pos-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pos = btn.dataset.pos;

      if (pos === "all") {
        // Clear all specific-position selections
        posFilter.clear();
      } else {
        // Toggle this position
        if (posFilter.has(pos)) posFilter.delete(pos);
        else posFilter.add(pos);
      }

      // Sync aria-pressed and is-active state on every button in this group
      group.querySelectorAll(".pos-filter-btn").forEach((b) => {
        const active =
          b.dataset.pos === "all"
            ? posFilter.size === 0
            : posFilter.has(b.dataset.pos);
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", String(active));
      });

      refreshFn();
    });
  });
}

function updateLeagueStatus() {
  if (!leagueStatusEl) return;
  const count = visibleRows().length;
  const label = activeLeague === "all" ? "All players" : leagueLabel(activeLeague);
  leagueStatusEl.textContent = `Pool: ${label} · ${count.toLocaleString()}`;
  if (positionStatusEl) {
    positionStatusEl.textContent = `Preset: ${activePosition === "all" ? "All-around" : POSITION_LABELS_BY_FILTER[activePosition]}`;
  }
  if (roleStatusEl) {
    roleStatusEl.textContent = `Role: ${activeRole === "all" ? "All roles" : ROLE_LABELS[activeRole]}`;
  }
  toggleRoleFilterBtn?.classList.toggle("is-active", activeRole !== "all" || !roleFilterBlock?.hidden);
}

function refreshPlayerSearches() {
  if (playerA && !rowMatchesActiveLeague(playerA)) clearPlayer("a");
  if (playerB && !rowMatchesActiveLeague(playerB)) clearPlayer("b");
  // Pass per-side position filters so the dropdown respects both league and
  // position selections simultaneously (Feature 2)
  renderList(listA, filterPlayers(searchA.value.trim(), posFilterA), (row) => onPickPlayer("a", row));
  renderList(listB, filterPlayers(searchB.value.trim(), posFilterB), (row) => onPickPlayer("b", row));
  listA.hidden = document.activeElement !== searchA || listA.children.length === 0;
  listB.hidden = document.activeElement !== searchB || listB.children.length === 0;
  searchA.setAttribute("aria-expanded", String(!listA.hidden));
  searchB.setAttribute("aria-expanded", String(!listB.hidden));
  updateLeagueStatus();
}

function refreshStatFocusStatus() {
  updateLeagueStatus();
}

function setupLeagueFilter() {
  leagueTabs.forEach((tab) => {
    const selected = (tab.dataset.league || "all") === activeLeague;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-pressed", String(selected));

    tab.addEventListener("click", () => {
      activeLeague = tab.dataset.league || "all";
      leagueTabs.forEach((btn) => {
        const selected = btn === tab;
        btn.classList.toggle("is-active", selected);
        btn.setAttribute("aria-pressed", String(selected));
      });

      refreshPlayerSearches();

      // Auto-select two notable defaults whenever the league filter changes (Feature 1).
      // refreshPlayerSearches() may have already cleared out-of-league players, so
      // selectLeagueDefaults() runs after to populate both slots fresh.
      selectLeagueDefaults(activeLeague);
    });
  });
  updateLeagueStatus();
}

function setupPositionFilter() {
  positionTabs.forEach((tab) => {
    const selected = (tab.dataset.position || "all") === activePosition;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-pressed", String(selected));

    tab.addEventListener("click", () => {
      activePosition = tab.dataset.position || "all";
      if (activePosition === "goalkeeping") activeRole = "goalkeeper";
      else activeRole = "all";

      positionTabs.forEach((btn) => {
        const selected = btn === tab;
        btn.classList.toggle("is-active", selected);
        btn.setAttribute("aria-pressed", String(selected));
      });
      roleTabs.forEach((btn) => {
        const selected = (btn.dataset.role || "all") === activeRole;
        btn.classList.toggle("is-active", selected);
        btn.setAttribute("aria-pressed", String(selected));
      });

      applyAxisPreset(POSITION_PRESETS[activePosition] || POSITION_PRESETS.all);
      refreshStatFocusStatus();
    });
  });
}

function setupRoleFilter() {
  toggleRoleFilterBtn?.addEventListener("click", () => {
    const nextOpen = roleFilterBlock?.hidden ?? true;
    if (roleFilterBlock) roleFilterBlock.hidden = !nextOpen;
    toggleRoleFilterBtn.setAttribute("aria-expanded", String(nextOpen));
    toggleRoleFilterBtn.classList.toggle("is-active", nextOpen || activeRole !== "all");
    toggleRoleFilterBtn.textContent = nextOpen ? "Advanced ▴" : "Advanced ▾";
  });

  roleTabs.forEach((tab) => {
    const selected = (tab.dataset.role || "all") === activeRole;
    tab.classList.toggle("is-active", selected);
    tab.setAttribute("aria-pressed", String(selected));

    tab.addEventListener("click", () => {
      activeRole = tab.dataset.role || "all";
      roleTabs.forEach((btn) => {
        const selected = btn === tab;
        btn.classList.toggle("is-active", selected);
        btn.setAttribute("aria-pressed", String(selected));
      });

      if (activeRole !== "all") {
        const broad =
          activeRole === "goalkeeper"
            ? "goalkeeping"
            : activeRole === "striker" || activeRole === "winger"
              ? "attacking"
              : activeRole === "fullback" || activeRole === "center-back"
                ? "defending"
                : "midfield";
        activePosition = broad;
        positionTabs.forEach((btn) => {
          const selected = (btn.dataset.position || "all") === activePosition;
          btn.classList.toggle("is-active", selected);
          btn.setAttribute("aria-pressed", String(selected));
        });
        applyAxisPreset(ROLE_PRESETS[activeRole] || POSITION_PRESETS[broad]);
      } else {
        applyAxisPreset(POSITION_PRESETS[activePosition] || POSITION_PRESETS.all);
      }
      refreshStatFocusStatus();
      toggleRoleFilterBtn?.classList.toggle("is-active", activeRole !== "all" || !roleFilterBlock?.hidden);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RANKING MODAL (Feature 3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Trap keyboard focus inside `container` while the modal is open.
 * Returns a cleanup function that removes the keydown listener.
 * Handles both forward (Tab) and reverse (Shift+Tab) cycling.
 */
function trapFocus(container) {
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function getFocusable() {
    return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
      (el) => !el.hasAttribute("disabled") && el.offsetParent !== null
    );
  }

  function onKeyDown(e) {
    if (e.key !== "Tab") return;
    const els = getFocusable();
    if (!els.length) { e.preventDefault(); return; }
    const first = els[0];
    const last  = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || !container.contains(document.activeElement)) {
        e.preventDefault(); last.focus();
      }
    } else {
      if (document.activeElement === last || !container.contains(document.activeElement)) {
        e.preventDefault(); first.focus();
      }
    }
  }

  container.addEventListener("keydown", onKeyDown);
  return () => container.removeEventListener("keydown", onKeyDown);
}

/** Module-level state for the ranking modal */
let _rankingModal      = null;  // the overlay element
let _removeFocusTrap   = null;  // cleanup fn from trapFocus
let _lastFocusEl       = null;  // element to restore focus to on close
let _onModalEscape     = null;  // bound keydown handler
// Persist "don't show automatically" across page reloads
let suppressAutoRanking = localStorage.getItem("suppressAutoRanking") === "true";

/**
 * Build the modal DOM once and cache it.  All subsequent opens just
 * repopulate the list — no additional DOM creation.
 */
function createRankingModal() {
  const overlay = document.createElement("div");
  overlay.id        = "ranking-modal";
  overlay.className = "modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "modal-title");
  overlay.hidden = true;

  overlay.innerHTML = `
    <div class="modal-card" role="document">
      <header class="modal-header">
        <h2 id="modal-title" class="modal-title">Attribute Rankings</h2>
        <button class="modal-close" aria-label="Close ranking modal" type="button">✕</button>
      </header>
      <ol id="modal-ranking-list" class="ranking-list" aria-label="Attributes ranked by score"></ol>
      <div class="modal-pref">
        <label class="modal-pref-label">
          <input type="checkbox" id="modal-no-auto" class="modal-pref-check" />
          Don't open automatically when clicking a radar
        </label>
      </div>
    </div>`;

  // Close on backdrop click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeRankingModal();
  });

  // Wire close button
  overlay.querySelector(".modal-close").addEventListener("click", closeRankingModal);

  // Wire "suppress auto" checkbox — persist to localStorage
  overlay.querySelector("#modal-no-auto").addEventListener("change", (e) => {
    suppressAutoRanking = e.target.checked;
    localStorage.setItem("suppressAutoRanking", String(suppressAutoRanking));
  });

  document.body.appendChild(overlay);
  return overlay;
}

/**
 * Open the ranking modal for `player` (a dataset row).
 * `tag` is "A" or "B" — used for accent colour.
 * `isAutoTriggered` is true when called from a polygon click; false when
 * the user explicitly clicks the Rankings button.
 */
function openRankingModal(player, tag, isAutoTriggered = false) {
  if (!player || !dataset) return;
  if (isAutoTriggered && suppressAutoRanking) return;

  if (!_rankingModal) _rankingModal = createRankingModal();

  // Sync checkbox with current preference
  _rankingModal.querySelector("#modal-no-auto").checked = suppressAutoRanking;

  // Accent colour mirrors player colour variable
  const accentColor = tag === "A" ? "var(--player-a)" : "var(--player-b)";
  const titleEl = _rankingModal.querySelector("#modal-title");
  titleEl.textContent = `${player.Player} · Attribute Rankings`;
  titleEl.style.borderBottomColor = accentColor;

  // Build ranked attribute list sorted descending by normalized score
  const items = axisKeys
    .map((key) => ({
      key,
      label : statLabel(key),
      score : dataset.normalizedForPlayer(player, key) ?? 0,
      raw   : dataset.rawForPlayer(player, key),
    }))
    .sort((a, b) => b.score - a.score);

  const list = _rankingModal.querySelector("#modal-ranking-list");
  list.innerHTML = items
    .map(
      (item, idx) => `
      <li class="ranking-item">
        <span class="rank-num" aria-hidden="true">${idx + 1}</span>
        <span class="rank-name">${escapeHtml(item.label)}</span>
        <span class="rank-score" style="color:${accentColor}">${Math.round(item.score)}</span>
        <span class="rank-raw">(${escapeHtml(formatRaw(item.key, item.raw))})</span>
      </li>`
    )
    .join("");

  // Open modal — save focus, reveal, trap, focus close button
  _lastFocusEl    = document.activeElement;
  _rankingModal.hidden = false;
  _removeFocusTrap = trapFocus(_rankingModal.querySelector(".modal-card"));

  _onModalEscape = (e) => { if (e.key === "Escape") closeRankingModal(); };
  document.addEventListener("keydown", _onModalEscape);

  _rankingModal.querySelector(".modal-close").focus();
}

/** Close the ranking modal and restore focus to the previously focused element. */
function closeRankingModal() {
  if (!_rankingModal || _rankingModal.hidden) return;
  _rankingModal.hidden = true;
  if (_removeFocusTrap) { _removeFocusTrap(); _removeFocusTrap = null; }
  if (_onModalEscape)   { document.removeEventListener("keydown", _onModalEscape); _onModalEscape = null; }
  _lastFocusEl?.focus();
}

// ─────────────────────────────────────────────────────────────────────────────

async function fetchDatasetCsv() {
  const filename = "players_data_cleaned_v2.csv";
  const attempts = [`./${filename}`, new URL(filename, import.meta.url).href];

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
    statusEl.textContent = `${rows.length} player-season rows · min-max normalized stats`;

    // Outer wrapper elements for the two legend items (contain swatch + text span)
    const legendItemA = legendA.closest(".legend-item");
    const legendItemB = legendB.closest(".legend-item");

    /**
     * RADAR LOCK — called by radarChart whenever the lock state changes.
     * Applies is-locked / is-dimmed CSS classes to the legend items so the
     * user gets clear visual feedback about which radar is focused.
     */
    function handleLockChange(lockedTag) {
      if (!legendItemA || !legendItemB) return;

      legendItemA.classList.toggle("is-locked", lockedTag === "A");
      legendItemA.classList.toggle("is-dimmed", lockedTag === "B");
      legendItemB.classList.toggle("is-locked", lockedTag === "B");
      legendItemB.classList.toggle("is-dimmed", lockedTag === "A");

      // Update the hint text below the legend
      const hint = document.getElementById("radar-lock-hint");
      if (hint) {
        hint.textContent = lockedTag
          ? "Click the focused radar, a dot, or the chart background to release"
          : "Click a radar polygon or legend label to focus it";
      }
    }

    radar = createRadarChart(chartMount, {
      width: 600,
      height: 600,
      onAxisLabelClick: showChartAxisPicker,
      onLockChange: handleLockChange,
      /**
       * RANKING MODAL auto-trigger (Feature 3)
       * Clicking the polygon area fires this callback.  It passes
       * isAutoTriggered=true so the "don't show automatically" preference
       * is respected; manual rank-button clicks pass false.
       */
      onPolygonClick: (tag) => {
        const player = tag === "A" ? playerA : playerB;
        if (player) openRankingModal(player, tag, true);
      },
    });

    // Manual ranking buttons — always open the modal regardless of the
    // "don't show automatically" preference (Feature 3)
    rankBtnA?.addEventListener("click", () => {
      if (playerA) openRankingModal(playerA, "A", false);
    });
    rankBtnB?.addEventListener("click", () => {
      if (playerB) openRankingModal(playerB, "B", false);
    });

    // Make legend items clickable to toggle the radar lock
    if (legendItemA) {
      legendItemA.setAttribute("role", "button");
      legendItemA.setAttribute("tabindex", "0");
      legendItemA.title = "Click to focus Player A radar";
      legendItemA.addEventListener("click", () => radar.setLock("A"));
      legendItemA.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); radar.setLock("A"); }
      });
    }
    if (legendItemB) {
      legendItemB.setAttribute("role", "button");
      legendItemB.setAttribute("tabindex", "0");
      legendItemB.title = "Click to focus Player B radar";
      legendItemB.addEventListener("click", () => radar.setLock("B"));
      legendItemB.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); radar.setLock("B"); }
      });
    }
    setupLeagueFilter();
    setupPositionFilter();
    setupRoleFilter();
    setupSearch("a");
    setupSearch("b");

    resetBtn?.addEventListener("click", () => {
      activePosition = "all";
      activeRole = "all";
      positionTabs.forEach((btn) => {
        const selected = (btn.dataset.position || "all") === activePosition;
        btn.classList.toggle("is-active", selected);
        btn.setAttribute("aria-pressed", String(selected));
      });
      roleTabs.forEach((btn) => {
        const selected = (btn.dataset.role || "all") === activeRole;
        btn.classList.toggle("is-active", selected);
        btn.setAttribute("aria-pressed", String(selected));
      });
      applyAxisPreset(POSITION_PRESETS.all);
      refreshStatFocusStatus();
    });

    selectDefaultPlayers();
  } catch (err) {
    console.error(err);
    statusEl.innerHTML =
      `Could not load <code>players_data_cleaned_v2.csv</code> (${String(err?.message || err)}). ` +
      "From the project folder run <code>npm start</code> or <code>node scraper.js</code>, then open " +
      "<code>http://localhost:3000</code> — not a local <code>file://</code> path. " +
      "Ensure <code>docs/players_data_cleaned_v2.csv</code> exists.";
  }
}

init();
