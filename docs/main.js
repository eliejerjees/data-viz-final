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

const resetBtn = document.getElementById("reset-stats");
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

function filterPlayers(q) {
  if (!dataset) return [];
  const qq = asciiSearchText(q);
  const out = [];
  for (const row of visibleRows()) {
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

function buildMeta(row, keys) {
  return keys.map((key) => {
    const raw = dataset.rawForPlayer(row, key);
    const score = dataset.normalizedForPlayer(row, key);
    const range = dataset.rangeForStat(key);
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
  }

  updateChart();
}

function selectDefaultPlayers() {
  const vinicius = dataset?.rows.find((row) => row.Player === "Vinicius Júnior");
  const haaland = dataset?.rows.find((row) => row.Player === "Erling Haaland");
  if (vinicius) onPickPlayer("a", vinicius);
  if (haaland) onPickPlayer("b", haaland);
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
  }
}

function setupSearch(side) {
  const input = side === "a" ? searchA : searchB;
  const list = side === "a" ? listA : listB;

  input.addEventListener("input", () => {
    const rows = filterPlayers(input.value.trim());
    renderList(list, rows, (row) => onPickPlayer(side, row));
    input.setAttribute("aria-expanded", String(rows.length > 0));
  });

  input.addEventListener("focus", () => {
    const rows = filterPlayers(input.value.trim());
    renderList(list, rows, (row) => onPickPlayer(side, row));
    input.setAttribute("aria-expanded", String(rows.length > 0));
  });

  document.addEventListener("click", (e) => {
    if (!input.contains(e.target) && !list.contains(e.target)) {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
    }
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
  renderList(listA, filterPlayers(searchA.value.trim()), (row) => onPickPlayer("a", row));
  renderList(listB, filterPlayers(searchB.value.trim()), (row) => onPickPlayer("b", row));
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

    radar = createRadarChart(chartMount, {
      width: 600,
      height: 600,
      onAxisLabelClick: showChartAxisPicker,
    });
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
