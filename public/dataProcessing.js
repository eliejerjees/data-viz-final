/**
 * CSV parsing, min-max normalization, stat taxonomy, and recommendation logic.
 */

export const CATEGORIES = ["Attacking", "Midfield", "Defending", "Goalkeeping"];

/** Stats where a lower raw value is better (normalized score is inverted). */
export const LOWER_IS_BETTER = new Set([
  "GA",
  "GA90",
  "GA_stats_keeper_adv",
  "OG",
  "Err",
  "Lost",
  "Lost_stats_misc",
  "CrdY",
  "CrdR",
  "CrdY_stats_misc",
  "CrdR_stats_misc",
  "G-xG",
  "np:G-xG",
  "A-xAG",
  "Fls",
  "Mis",
  "Dis",
  "Tkld",
]);

/** Columns never used as comparable performance stats */
const METADATA_KEYS = new Set([
  "Player",
  "Nation",
  "Pos",
  "Squad",
  "Comp",
  "Born",
  "Rk",
]);

/**
 * Preset axes per primary role (exact CSV column keys).
 * FW: goals, xG, shots, shots on target, progressive carries, touches in attacking penalty area
 */
export const PRESETS = {
  FW: ["Gls", "xG", "Sh", "SoT", "PrgC", "Att Pen"],
  MF: ["Ast", "xA", "Cmp", "PrgP", "Carries", "Cmp%"],
  DF: ["Tkl", "Int", "Clr", "Blocks_stats_defense", "Won", "Cmp"],
  GK: ["Saves", "Save%", "CS", "GA", "PSxG", "Stp"],
};

/** Human-readable labels for columns (fallback = column key) */
export const LABEL_OVERRIDES = {
  Gls: "Goals",
  Ast: "Assists",
  Sh: "Shots",
  SoT: "Shots on Target",
  Cmp: "Passes Completed",
  "Cmp%": "Pass Completion %",
  PrgC: "Progressive Carries",
  PrgP: "Progressive Passes",
  "Cmp%_stats_keeper_adv": "Pass Completion % (GK)",
  "Att (GK)": "Passes Attempted (GK)",
  xAG: "Expected Assisted Goals",
  npxG: "Non-Penalty xG",
  "npxG+xAG": "npxG + xAG",
  "G+A-PK": "Goals + Assists (no PK)",
  "xG+xAG": "xG + xAG",
  Tkl: "Tackles",
  Int: "Interceptions",
  Clr: "Clearances",
  Blocks_stats_defense: "Blocks",
  Won: "Aerial Duels Won",
  "Att Pen": "Touches (Att Pen)",
  "Def Pen": "Touches (Def Pen)",
  PrgDist: "Progressive Passing Distance",
  TotDist: "Total Passing Distance",
  "Def 3rd": "Defensive 3rd Touches",
  "Mid 3rd": "Middle 3rd Touches",
  "Att 3rd": "Attacking 3rd Touches",
  "1/3": "Passes into Final Third",
  KP: "Key Passes",
  SCA: "Shot-Creating Actions",
  GCA: "Goal-Creating Actions",
  Recov: "Ball Recoveries",
  PSxG: "Post-Shot xG",
  "PSxG/SoT": "PSxG per Shot on Target",
  "PSxG+/-": "PSxG minus Goals",
  SoTA: "Shots on Target Faced",
  "#OPA": "Outside Penalty Area Actions",
  Stp: "Crosses Stopped",
  CS: "Clean Sheets",
  "CS%": "Clean Sheet %",
  "Save%": "Save %",
  GA90: "Goals Against /90",
  PrgC_stats_possession: "Progressive Carries",
  PrgP_stats_passing: "Progressive Passes",
};

/** Short glossary blurbs (FBref-style) */
export const STAT_DESCRIPTIONS = {
  Gls: "Goals scored in all competitions in the sample.",
  xG: "Expected goals from shot quality and location (non-penalty components vary by source).",
  Sh: "Total shots attempted.",
  SoT: "Shots that hit the target.",
  PrgC: "Carries that move the ball significantly toward the opponent goal.",
  "Att Pen": "Touches in the attacking penalty area.",
  Ast: "Assists credited to the player.",
  xA: "Expected assists based on passes that lead to shots.",
  Cmp: "Passes completed successfully.",
  PrgP: "Progressive passes that advance the ball toward goal.",
  Carries: "Times the player controlled the ball while dribbling or carrying forward.",
  "Cmp%": "Share of pass attempts completed.",
  Tkl: "Defensive tackles attempted.",
  Int: "Passes intercepted.",
  Clr: "Clearances (typically defensive).",
  Blocks_stats_defense: "Blocks of passes or shots.",
  Won: "Aerial duels won (subset of duels in FBref misc).",
  Saves: "Shots saved by the goalkeeper.",
  "Save%": "Saves divided by shots on target faced.",
  CS: "Matches with no goals conceded while on pitch (GK).",
  GA: "Goals conceded while goalkeeper was on pitch.",
  PSxG: "Expected goals after the shot based on placement (post-shot model).",
  Stp: "Crosses into the penalty area stopped by the keeper.",
  default:
    "This attribute measures a player action or outcome from the selected statistical category. Higher normalized values mean the player is closer to the best raw value in this dataset for that attribute.",
};

function parseValue(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === "" || s.toUpperCase() === "NULL") return null;
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function isNumericColumnKey(key, rows) {
  if (METADATA_KEYS.has(key)) return false;
  let ok = 0;
  let total = 0;
  for (const row of rows) {
    const v = row[key];
    if (v === undefined || v === null || String(v).trim() === "" || String(v).toUpperCase() === "NULL")
      continue;
    total++;
    if (parseValue(v) !== null) ok++;
  }
  return total > 0 && ok / total > 0.85;
}

/** Classify any stat column into one of four UI groups (FBref-aligned heuristics). */
export function categorizeStat(key) {
  const k = key.toLowerCase();

  if (
    k.includes("keeper") ||
    k.includes("stats_keeper") ||
    ["psxg", "save%", "saves", "soata", "ga90", "gk"].some((x) => k.includes(x)) ||
    /^ga$/i.test(key) ||
    key === "CS" ||
    key === "CS%" ||
    key === "PKsv" ||
    key === "PKA" ||
    key === "PKm" ||
    key === "Stp" ||
    key === "Stp%" ||
    key === "Opp" ||
    key === "Thr" ||
    key === "Launch%" ||
    key === "AvgLen" ||
    key === "#OPA" ||
    key === "#OPA/90" ||
    key === "AvgDist" ||
    key === "Att (GK)" ||
    key === "Cmp_stats_keeper_adv" ||
    key === "Att_stats_keeper_adv" ||
    key === "Cmp%_stats_keeper_adv" ||
    key === "GA_stats_keeper_adv" ||
    key === "FK_stats_keeper_adv" ||
    key === "CK_stats_keeper_adv" ||
    key === "OG_stats_keeper_adv"
  ) {
    return "Goalkeeping";
  }

  if (
    k.includes("xg") ||
    k.includes("npxg") ||
    /(^|_)gls(_|$)/.test(k) ||
    k.includes("shooting") ||
    key === "Sh" ||
    key === "SoT" ||
    key === "SoT%" ||
    k.includes("sh/90") ||
    k.includes("sot/90") ||
    key === "G/Sh" ||
    key === "G/SoT" ||
    key === "Dist" ||
    key === "Att Pen" ||
    key === "CPA" ||
    key === "G+A" ||
    key === "G-PK" ||
    key === "PKatt" ||
    key === "PK" ||
    key === "xAG" ||
    key === "npxG+xAG" ||
    key === "G+A-PK" ||
    key === "xG+xAG" ||
    key === "SCA" ||
    key === "SCA90" ||
    key === "GCA" ||
    key === "GCA90" ||
    key === "PPA" ||
    key === "CrsPA" ||
    key === "onG" ||
    key === "onxG" ||
    k.includes("stats_gca")
  ) {
    return "Attacking";
  }

  if (
    key === "Tkl" ||
    key === "TklW" ||
    key === "Tkl%" ||
    key === "Int" ||
    key === "Clr" ||
    key === "Blocks_stats_defense" ||
    key === "Sh_stats_defense" ||
    key === "Pass" ||
    key === "Tkl+Int" ||
    key === "Err" ||
    key === "Def Pen" ||
    key.includes("Def 3rd") ||
    key.includes("stats_defense")
  ) {
    return "Defending";
  }

  if (
    key === "Ast" ||
    key === "Cmp" ||
    key === "Att" ||
    key === "Cmp%" ||
    key === "TotDist" ||
    key === "PrgDist" ||
    key === "PrgP" ||
    key === "PrgP_stats_passing" ||
    key === "xA" ||
    key === "KP" ||
    key === "1/3" ||
    key === "Crs" ||
    key === "TB" ||
    key === "Sw" ||
    key === "Carries" ||
    key === "Touches" ||
    key === "Mid 3rd" ||
    key === "Att 3rd" ||
    key === "PrgC" ||
    key === "PrgC_stats_possession" ||
    key === "Rec" ||
    key === "PrgR" ||
    key === "Live" ||
    key === "Dead" ||
    key === "Succ" ||
    key === "Succ%" ||
    key === "TotDist_stats_possession" ||
    key === "PrgDist_stats_possession" ||
    key === "1/3_stats_possession" ||
    key === "Mis" ||
    key === "Dis" ||
    key === "Tkld" ||
    key === "Fld" ||
    key === "Fld_stats_misc" ||
    key === "Fls" ||
    key === "Recov" ||
    key === "PassLive" ||
    key === "PassDead" ||
    key === "TO" ||
    key === "Def" ||
    key.includes("stats_passing") ||
    key.includes("stats_possession") ||
    key.includes("stats_passing_types") ||
    key === "MP" ||
    key === "Min" ||
    key === "Starts" ||
    key === "90s" ||
    key === "Subs" ||
    key === "Mn/MP" ||
    key === "Min%" ||
    key === "Compl" ||
    key === "PPM" ||
    key === "+/-" ||
    key === "+/-90" ||
    key === "On-Off" ||
    key === "xG+/-" ||
    key === "xG+/-90" ||
    key === "Age" ||
    key === "MP_stats_playing_time" ||
    key === "Min_stats_playing_time"
  ) {
    return "Midfield";
  }

  if (
    key === "Won" ||
    key === "Lost_stats_misc" ||
    key === "Won%" ||
    key.includes("misc") ||
    key === "CrdY" ||
    key === "CrdR" ||
    key === "2CrdY" ||
    key === "Off" ||
    key === "Off_stats_misc" ||
    key === "PKwon" ||
    key === "PKcon" ||
    key === "OG"
  ) {
    return "Defending";
  }

  return "Midfield";
}

export function statLabel(key) {
  return LABEL_OVERRIDES[key] || key.replace(/_stats_[a-z_]+$/i, "").replace(/_/g, " ");
}

export function statDescription(key) {
  return STAT_DESCRIPTIONS[key] || STAT_DESCRIPTIONS.default;
}

export function isGoalkeeper(pos) {
  return String(pos).trim() === "GK";
}

export function getPrimaryRole(pos) {
  const p = String(pos).trim();
  if (p === "GK") return "GK";
  const first = p.split(",")[0].trim();
  if (first === "FW" || first === "MF" || first === "DF") return first;
  return "MF";
}

export function canComparePositions(posA, posB) {
  return isGoalkeeper(posA) === isGoalkeeper(posB);
}

export function samePrimaryRole(posA, posB) {
  return getPrimaryRole(posA) === getPrimaryRole(posB);
}

/**
 * Returns six column keys for the radar axes.
 * @param {{ Pos?: string, pos?: string }} playerA
 * @param {{ Pos?: string, pos?: string }} playerB
 */
export function recommendedAxisKeys(playerA, playerB) {
  const a = getPrimaryRole(playerA.Pos ?? playerA.pos);
  const b = getPrimaryRole(playerB.Pos ?? playerB.pos);
  if (a === "GK" || b === "GK") {
    return [...PRESETS.GK];
  }
  if (a === b) {
    return [...PRESETS[a]];
  }
  const pa = PRESETS[a];
  const pb = PRESETS[b];
  return [pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]];
}

function percentileRank(sortedAsc, value, lowerIsBetter) {
  const n = sortedAsc.length;
  if (!n) return 50;
  let below = 0;
  let eq = 0;
  for (const v of sortedAsc) {
    if (v < value) below++;
    else if (v === value) eq++;
  }
  const mid = below + eq / 2;
  const p = (mid / n) * 100;
  return lowerIsBetter ? 100 - p : p;
}

/**
 * Build stat scaling lookup and metadata for the whole dataset.
 */
export function buildDataset(rows) {
  const statKeys = Object.keys(rows[0] || {}).filter((k) => isNumericColumnKey(k, rows));
  const excludedRank = new Set(["Rk", "Born"]);
  const keys = statKeys.filter((k) => !excludedRank.has(k));

  const rawByKey = {};
  const sortedByKey = {};
  const extentByKey = {};
  const lowerFlag = {};

  for (const key of keys) {
    const lower = LOWER_IS_BETTER.has(key);
    lowerFlag[key] = lower;
    const vals = [];
    for (const row of rows) {
      const raw = parseValue(row[key]);
      if (raw === null) continue;
      vals.push(raw);
    }
    rawByKey[key] = vals;
    sortedByKey[key] = [...vals].sort((a, b) => a - b);
    extentByKey[key] = vals.length
      ? {
          min: Math.min(...vals),
          max: Math.max(...vals),
        }
      : {
          min: null,
          max: null,
        };
  }

  function percentileForPlayer(row, key) {
    const sorted = sortedByKey[key];
    if (!sorted?.length) return null;
    const raw = parseValue(row[key]);
    if (raw === null) return null;
    return percentileRank(sorted, raw, lowerFlag[key]);
  }

  function normalizedForPlayer(row, key) {
    const extent = extentByKey[key];
    if (!extent || extent.min === null || extent.max === null) return null;
    const raw = parseValue(row[key]);
    if (raw === null) return null;
    if (extent.max === extent.min) return 50;

    const score = lowerFlag[key]
      ? ((extent.max - raw) / (extent.max - extent.min)) * 100
      : ((raw - extent.min) / (extent.max - extent.min)) * 100;
    return Math.min(100, Math.max(0, score));
  }

  function rangeForStat(key) {
    return extentByKey[key] || { min: null, max: null };
  }

  function rawForPlayer(row, key) {
    return parseValue(row[key]);
  }

  /** @returns {{ key: string, label: string, category: string }[]} */
  function availableStatsCatalog() {
    return keys
      .map((key) => ({
        key,
        label: statLabel(key),
        category: categorizeStat(key),
      }))
      .sort((a, b) => {
        const c = a.category.localeCompare(b.category);
        if (c !== 0) return c;
        return a.label.localeCompare(b.label);
      });
  }

  return {
    rows,
    statKeys: keys,
    percentileForPlayer,
    normalizedForPlayer,
    rangeForStat,
    rawForPlayer,
    availableStatsCatalog,
    parseValue,
  };
}

export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return [];

  const parseLine = (line) => {
    const out = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        q = !q;
        continue;
      }
      if (ch === "," && !q) {
        out.push(cur);
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur);
    return out;
  };

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseLine(lines[i]);
    if (cells.length !== headers.length) continue;
    const row = {};
    headers.forEach((h, j) => {
      row[h] = cells[j];
    });
    rows.push(row);
  }
  return rows;
}
