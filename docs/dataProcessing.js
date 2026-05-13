// CSV parsing, min-max normalization, stat taxonomy, and axis recommendation

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

// Default six-axis sets for each broad position group
export const PRESETS = {
  FW: ["Gls", "xG", "Sh", "SoT", "PrgC", "Att Pen"],
  MF: ["Ast", "xA", "Cmp", "PrgP", "Carries", "Cmp%"],
  DF: ["Tkl", "Int", "Clr", "Blocks_stats_defense", "Won", "Cmp"],
  GK: ["Saves", "Save%", "CS", "GA", "PSxG", "Stp"],
};

// Human-readable display names for CSV column keys (falls back to the key itself)
export const LABEL_OVERRIDES = {
  MP: "Matches Played",
  Starts: "Starts",
  Min: "Minutes",
  "90s": "Full-90s Played",
  Gls: "Goals",
  Ast: "Assists",
  "G+A": "Goals + Assists",
  "G-PK": "Non-Penalty Goals",
  PK: "Penalty Goals",
  PKatt: "Penalties Attempted",
  Sh: "Shots",
  SoT: "Shots on Target",
  "SoT%": "Shot Accuracy",
  "Sh/90": "Shots per 90",
  "SoT/90": "Shots on Target per 90",
  "G/Sh": "Goals per Shot",
  "G/SoT": "Goals per Shot on Target",
  Dist: "Average Shot Distance",
  FK: "Free-Kick Shots",
  Cmp: "Passes Completed",
  Att: "Passes Attempted",
  "Cmp%": "Pass Completion %",
  PrgC: "Progressive Carries",
  PrgP: "Progressive Passes",
  PrgR: "Progressive Passes Received",
  "Cmp%_stats_keeper_adv": "Pass Completion % (GK)",
  "Att (GK)": "Passes Attempted (GK)",
  xG: "Expected Goals",
  xAG: "Expected Assisted Goals",
  xA: "Expected Assists",
  npxG: "Non-Penalty Expected Goals",
  "npxG+xAG": "Non-Penalty Expected Goals + Expected Assisted Goals",
  "G+A-PK": "Goals + Assists (no PK)",
  "xG+xAG": "Expected Goals + Expected Assisted Goals",
  "npxG/Sh": "Non-Penalty Expected Goals per Shot",
  "G-xG": "Goals minus Expected Goals",
  "np:G-xG": "Non-Penalty Goals minus Expected Goals",
  "A-xAG": "Assists minus Expected Assisted Goals",
  Tkl: "Tackles",
  TklW: "Tackles Won",
  "Tkl%": "Dribbler Tackle %",
  Int: "Interceptions",
  Clr: "Clearances",
  Blocks_stats_defense: "Blocks",
  Sh_stats_defense: "Shots Blocked",
  Pass: "Passes Blocked",
  "Tkl+Int": "Tackles + Interceptions",
  Err: "Errors",
  Won: "Aerial Duels Won",
  "Won%": "Aerial Duel Win %",
  Lost_stats_misc: "Aerial Duels Lost",
  "Att Pen": "Touches (Att Pen)",
  "Def Pen": "Touches (Def Pen)",
  PrgDist: "Progressive Passing Distance",
  TotDist: "Total Passing Distance",
  PrgDist_stats_possession: "Progressive Carrying Distance",
  TotDist_stats_possession: "Total Carrying Distance",
  "Def 3rd": "Defensive 3rd Touches",
  "Mid 3rd": "Middle 3rd Touches",
  "Att 3rd": "Attacking 3rd Touches",
  "1/3": "Passes into Final Third",
  KP: "Key Passes",
  SCA: "Shot-Creating Actions",
  SCA90: "Shot-Creating Actions per 90",
  GCA: "Goal-Creating Actions",
  GCA90: "Goal-Creating Actions per 90",
  Recov: "Ball Recoveries",
  Touches: "Touches",
  Succ: "Successful Take-Ons",
  "Succ%": "Take-On Success %",
  Tkld: "Tackled While Dribbling",
  "Tkld%": "Tackled While Dribbling %",
  CrdY: "Yellow Cards",
  CrdR: "Red Cards",
  GA: "Goals Conceded",
  PKA: "Penalty Kicks Against (GK)",
  CPA: "Carries into Penalty Area",
  Carries: "Carries",
  Rec: "Passes Received",
  Mis: "Miscontrols",
  Dis: "Dispossessed",
  Live: "Live-Ball Passes",
  Dead: "Dead-Ball Passes",
  TB: "Through Balls",
  Sw: "Switches",
  Crs: "Crosses",
  TI: "Throw-Ins",
  CK: "Corner Kicks",
  In: "Inswinging Corners",
  Out: "Outswinging Corners",
  Str: "Straight Corners",
  Off: "Offsides",
  PassLive: "Live-Pass Shot Creations",
  PassDead: "Dead-Ball Shot Creations",
  TO: "Take-On Shot Creations",
  Fld: "Fouls Drawn",
  Def: "Defensive Shot Creations",
  Fls: "Fouls Committed",
  PKwon: "Penalties Won",
  PKcon: "Penalties Conceded",
  OG: "Own Goals",
  PPM: "Points per Match",
  onG: "Team Goals While On Pitch",
  onGA: "Team Goals Against While On Pitch",
  "+/-": "Team Goal Difference While On Pitch",
  "+/-90": "Team Goal Difference per 90 While On Pitch",
  "On-Off": "On-Off Goal Difference",
  onxG: "Team Expected Goals While On Pitch",
  onxGA: "Team Expected Goals Against While On Pitch",
  "xG+/-": "Team Expected Goal Difference While On Pitch",
  "xG+/-90": "Team Expected Goal Difference per 90 While On Pitch",
  PSxG: "Post-Shot Expected Goals",
  "PSxG/SoT": "Post-Shot Expected Goals per Shot on Target",
  "PSxG+/-": "Post-Shot Expected Goals minus Goals Allowed",
  SoTA: "Shots on Target Faced",
  "#OPA": "Outside Penalty Area Actions",
  "#OPA/90": "Outside Penalty Area Actions per 90",
  AvgDist: "Average Keeper Action Distance",
  Stp: "Crosses Stopped",
  "Stp%": "Cross Stop %",
  CS: "Clean Sheets",
  "CS%": "Clean Sheet %",
  "Save%": "Save %",
  GA90: "Goals Against /90",
  // GK-specific columns (not duplicates of the bare column names)
  "90s_stats_keeper":     "Goalkeeping Stats Per 90",
  "90s_stats_keeper_adv": "Adv. GK Stats Per 90",
  "MP_stats_keeper":    "Matches Played (Goalkeeping)",
  "Min_stats_keeper":   "Minutes Played (Goalkeeping)",
  "Starts_stats_keeper": "Starts (Goalkeeping)",

  // Possession-table columns (different from the base columns of the same name)
  "1/3_stats_possession":     "Carries into Final Third",
  "Att 3rd_stats_possession": "Attacking 3rd Touches (Possession)",
  "Def 3rd_stats_possession": "Defensive 3rd Touches (Possession)",
  "Mid 3rd_stats_possession": "Mid 3rd Touches (Possession)",
  "Att_stats_possession":     "Take-Ons Attempted",
  "Live_stats_possession":    "Live-Ball Touches (Possession)",

  "FK_stats_passing_types": "Free-Kick Passes",
  "Att_stats_defense": "Dribble Attempts Faced",
  "Sh_stats_gca": "Shot-Based GCAs",
  "Fld_stats_misc": "Fouls Drawn",
  "Off_stats_misc": "Offsides",

  "Att_stats_keeper_adv": "Launched Passes Attempted (GK)",
  "CK_stats_keeper_adv":  "Corner Kicks Faced (GK)",
  "Cmp_stats_keeper_adv": "Long Balls Completed (GK)",
  "FK_stats_keeper_adv":  "Free-Kick Shots Faced (GK)",
  "OG_stats_keeper_adv":  "Own Goals (GK)",
  "PKatt_stats_keeper": "Penalties Faced (GK)",
};

// Full names shown in the axis picker search results (abbreviations stay in the metadata row)
export const PICKER_LABEL_OVERRIDES = {
  xG: "Expected Goals",
  npxG: "Non-Penalty Expected Goals",
  xAG: "Expected Assisted Goals",
  xA: "Expected Assists",
  "xG+xAG": "Expected Goals + Expected Assisted Goals",
  "npxG+xAG": "Non-Penalty Expected Goals + Expected Assisted Goals",
  "G-xG": "Goals minus Expected Goals",
  "np:G-xG": "Non-Penalty Goals minus Expected Goals",
  onxG: "Team Expected Goals While On Pitch",
  onxGA: "Team Expected Goals Against While On Pitch",
  "xG+/-": "Team Expected Goal Difference While On Pitch",
  "xG+/-90": "Team Expected Goal Difference per 90 While On Pitch",
  PSxG: "Post-Shot Expected Goals",
  "PSxG/SoT": "Post-Shot Expected Goals per Shot on Target",
  "PSxG+/-": "Post-Shot Expected Goals minus Goals Allowed",
  "#OPA": "Outside Penalty Area Actions",
};

// Short glossary blurbs shown in the axis picker
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
  Stp: "Crosses into the penalty area stopped by the keeper.",
  "G+A": "Goals and assists combined; a quick measure of direct goal involvement.",
  "G-PK": "Goals scored excluding penalties, useful for open-play scoring comparison.",
  PK: "Penalty goals scored.",
  PKatt: "Penalty kicks attempted.",
  "SoT%": "Percentage of shots that were on target.",
  "Sh/90": "Shots attempted per 90 minutes.",
  "SoT/90": "Shots on target per 90 minutes.",
  "G/Sh": "Goals scored per shot attempt.",
  "G/SoT": "Goals scored per shot on target.",
  Dist: "Average distance from goal on shot attempts.",
  npxG: "Expected goals excluding penalty kicks, so it focuses more on open-play chance quality.",
  "xG+xAG": "Expected goals plus expected assisted goals, combining shooting threat and chance creation.",
  "npxG+xAG": "Non-penalty expected goals plus expected assisted goals, combining open-play scoring and creation.",
  "npxG/Sh": "Average non-penalty expected-goal value per shot.",
  "G-xG": "Goals minus expected goals; positive numbers suggest finishing above expected chances.",
  "np:G-xG": "Non-penalty goals minus non-penalty expected goals.",
  "A-xAG": "Assists minus expected assisted goals; compares actual assists to chance quality created.",
  onxG: "Expected goals by the player's team while he was on the pitch.",
  onxGA: "Expected goals allowed by the player's team while he was on the pitch.",
  "xG+/-": "Team expected goals for minus expected goals against while the player was on the pitch.",
  "xG+/-90": "Team expected goal difference per 90 minutes while the player was on the pitch.",
  PSxG: "Post-shot expected goals estimates how likely shots on target were to score after placement.",
  "PSxG/SoT": "Post-shot expected goals divided by shots on target faced.",
  "PSxG+/-": "Post-shot expected goals minus goals allowed; often read as goals prevented.",
  PrgR: "Progressive passes received, showing how often a player receives the ball in advanced movement.",
  KP: "Passes that directly lead to a teammate's shot.",
  "1/3": "Completed passes into the attacking final third.",
  PPA: "Completed passes into the opponent penalty area.",
  CrsPA: "Completed crosses into the opponent penalty area.",
  SCA90: "Shot-creating actions per 90 minutes.",
  GCA: "Actions directly leading to a goal, such as passes, take-ons, or fouls drawn.",
  GCA90: "Goal-creating actions per 90 minutes.",
  TklW: "Tackles where the player's team wins possession.",
  "Tkl%": "Percentage of dribblers tackled when the player challenges them.",
  "Tkl+Int": "Tackles plus interceptions; a broad defensive activity measure.",
  Err: "Mistakes that directly lead to an opponent shot.",
  Touches: "Total times the player touched the ball.",
  Succ: "Dribble/take-on attempts where the player beat the defender.",
  "Succ%": "Successful take-ons divided by attempted take-ons.",
  Tkld: "Times the player was tackled while attempting to dribble.",
  CPA: "Carries that move the ball into the opponent penalty area.",
  Rec: "Completed passes received by the player.",
  Recov: "Loose balls recovered by the player.",
  Mis: "Times the player miscontrolled the ball.",
  Dis: "Times the player was dispossessed by an opponent.",
  Won: "Aerial duels won.",
  "Won%": "Percentage of aerial duels won.",
  Lost_stats_misc: "Aerial duels lost.",
  GA90: "Goals conceded per 90 minutes by a goalkeeper.",
  SoTA: "Shots on target faced by the goalkeeper.",
  "Stp%": "Percentage of opponent crosses into the box stopped by the goalkeeper.",
  "#OPA": "Defensive actions made by the goalkeeper outside the penalty area.",
  "#OPA/90": "Goalkeeper defensive actions outside the penalty area per 90 minutes.",
  AvgDist: "Average distance from goal of the goalkeeper's defensive actions.",
};

export const CATEGORY_DESCRIPTIONS = {
  Attacking: "Shows how a player shoots, scores, creates chances, or gets into dangerous attacking areas.",
  Midfield: "Shows passing, carrying, ball progression, and involvement in possession.",
  Defending: "Shows how a player wins the ball, blocks danger, clears attacks, or competes physically.",
  Goalkeeping: "Shows shot stopping, goals prevented, clean sheets, passing, and box control for goalkeepers.",
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

// Classify a stat column into one of four groups using FBref-style heuristics.
// The long if-chains are intentional — each condition maps a known column name.
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

export function statPickerLabel(key) {
  return PICKER_LABEL_OVERRIDES[key] || statLabel(key);
}

export function statDescription(key) {
  return STAT_DESCRIPTIONS[key] || CATEGORY_DESCRIPTIONS[categorizeStat(key)];
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

// Pick six radar axis keys based on the positions of the two players.
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

// Compute min/max extents and percentile data for every numeric column.
// Returns helper functions used by main.js to look up values per player.
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

  function availableStatsCatalog() {
    return keys
      .map((key) => ({
        key,
        label: statPickerLabel(key),
        actualName: statLabel(key),
        category: categorizeStat(key),
        description: statDescription(key),
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
