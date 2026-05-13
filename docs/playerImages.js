// Resolve player headshots using Wikipedia, Wikidata, and Wikimedia Commons.
// Works without a local server — all APIs support CORS with origin=*.


const EXTRA_ASCII = {
  Æ: "AE",
  æ: "ae",
  Ð: "D",
  ð: "d",
  Þ: "Th",
  þ: "th",
  Ł: "L",
  ł: "l",
  Ø: "O",
  ø: "o",
  Œ: "OE",
  œ: "oe",
  ß: "ss",
};

export function normalizeSearchText(s) {
  return String(s)
    .replace(/[ÆæÐðÞþŁłØøŒœß]/g, (ch) => EXTRA_ASCII[ch] || ch)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[‐‑‒–—]/g, "-")
    .toLowerCase();
}

const _WS = /\s+/;

export function asciiSearchText(s) {
  return normalizeSearchText(s)
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/[-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(playerName) {
  return asciiSearchText(playerName).split(_WS).filter((t) => t.length >= 3);
}

// Check that every significant word of the player name appears in the title.
// This filters out season pages, league articles, etc.
export function titleMatchesPlayer(title, playerName) {
  const nt = asciiSearchText(title);
  const tokens = significantTokens(playerName);
  if (!tokens.length) {
    return nt.includes(asciiSearchText(playerName));
  }
  return tokens.every((t) => nt.includes(t));
}

function wikiApiUrl(lang, params) {
  const u = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  Object.entries(params).forEach(([k, v]) => {
    u.searchParams.set(k, v);
  });
  u.searchParams.set("format", "json");
  u.searchParams.set("origin", "*");
  return u.toString();
}

function apiUrl(base, params) {
  const u = new URL(base);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") u.searchParams.set(k, v);
  });
  u.searchParams.set("format", "json");
  u.searchParams.set("origin", "*");
  return u.toString();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

function commonsFilePath(fileName, width = 400) {
  const clean = String(fileName || "").replace(/^File:/i, "").trim();
  if (!clean) return null;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(clean)}?width=${width}`;
}

function footballishEntity(entity) {
  const desc = asciiSearchText(entity?.descriptions?.en?.value || "");
  if (/(football|soccer|goalkeeper|winger|midfielder|defender|striker)/.test(desc)) return true;

  const occupationIds = new Set(
    (entity?.claims?.P106 || [])
      .map((claim) => claim?.mainsnak?.datavalue?.value?.id)
      .filter(Boolean)
  );
  if (occupationIds.has("Q937857")) return true; // association football player

  const sportIds = new Set(
    (entity?.claims?.P641 || [])
      .map((claim) => claim?.mainsnak?.datavalue?.value?.id)
      .filter(Boolean)
  );
  return sportIds.has("Q2736"); // association football
}

async function fetchWikidataImage(playerName) {
  const name = String(playerName).replace(/\s+/g, " ").trim();
  const variants = [...new Set([name, asciiSearchText(name)].filter(Boolean))];

  for (const variant of variants) {
    const searchData = await fetchJson(
      apiUrl("https://www.wikidata.org/w/api.php", {
        action: "wbsearchentities",
        search: variant,
        language: "en",
        uselang: "en",
        type: "item",
        limit: "12",
      })
    );

    const ids = (searchData?.search || [])
      .filter((hit) => titleMatchesPlayer(hit.label || "", name))
      .map((hit) => hit.id)
      .filter(Boolean);
    if (!ids.length) continue;

    const entityData = await fetchJson(
      apiUrl("https://www.wikidata.org/w/api.php", {
        action: "wbgetentities",
        ids: ids.join("|"),
        props: "labels|descriptions|claims",
        languages: "en",
      })
    );

    const entities = entityData?.entities || {};
    for (const id of ids) {
      const entity = entities[id];
      const label = entity?.labels?.en?.value || "";
      const imageFile = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (!imageFile || !titleMatchesPlayer(label, name) || !footballishEntity(entity)) continue;
      return commonsFilePath(imageFile);
    }
  }

  return null;
}

function badCommonsTitle(title) {
  return /(logo|kit|jersey|shirt|stadium|map|flag|signature|line-?up|squad|team photo|training ground)/i.test(title);
}

async function fetchCommonsImage(playerName, context = {}) {
  const name = String(playerName).replace(/\s+/g, " ").trim();
  const squad = String(context.squad || "").trim();
  const variants = [
    `${name} footballer`,
    `${name} soccer player`,
    squad ? `${name} ${squad}` : "",
    name,
    asciiSearchText(name),
  ].filter(Boolean);

  for (const srsearch of [...new Set(variants)]) {
    const data = await fetchJson(
      apiUrl("https://commons.wikimedia.org/w/api.php", {
        action: "query",
        generator: "search",
        gsrnamespace: "6",
        gsrlimit: "20",
        gsrsearch: srsearch,
        prop: "imageinfo",
        iiprop: "url|mime",
        iiurlwidth: "400",
      })
    );

    const pages = Object.values(data?.query?.pages || {});
    const matches = pages
      .filter((page) => titleMatchesPlayer(page.title || "", name))
      .filter((page) => !badCommonsTitle(page.title || ""))
      .filter((page) => (page.imageinfo?.[0]?.mime || "").startsWith("image/"));

    for (const page of matches) {
      const info = page.imageinfo?.[0];
      const src = info?.thumburl || info?.url;
      if (src) return src;
    }
  }

  return null;
}

/**
 * @param {string} playerName
 * @returns {Promise<string|null>} image URL or null
 */
export async function resolvePlayerPhoto(playerName, context = {}) {
  const name = String(playerName).replace(/\s+/g, " ").trim();
  if (!name) return null;
  const asciiName = asciiSearchText(name);
  const nameVariants = [...new Set([name, asciiName].filter(Boolean))];

  const langs = ["en"];
  const queries = nameVariants.flatMap((variant) => [
    `${variant} footballer`,
    `${variant} association football`,
    `${variant} football`,
    variant,
  ]);

  for (const lang of langs) {
    for (const srsearch of queries) {
      const searchData = await fetchJson(
        wikiApiUrl(lang, {
          action: "query",
          list: "search",
          srsearch,
          srlimit: "15",
        })
      );
      const hits = searchData?.query?.search || [];
      const titles = hits.map((h) => h.title).filter((t) => titleMatchesPlayer(t, name));
      if (!titles.length) continue;

      for (let i = 0; i < titles.length; i += 10) {
        const slice = titles.slice(i, i + 10);
        const imgData = await fetchJson(
          wikiApiUrl(lang, {
            action: "query",
            titles: slice.join("|"),
            prop: "pageimages",
            piprop: "thumbnail",
            pithumbsize: "400",
          })
        );
        const pages = imgData?.query?.pages;
        if (!pages) continue;
        for (const title of slice) {
          const page = Object.values(pages).find((p) => p.title === title);
          const src = page?.thumbnail?.source;
          if (src) return src;
        }
      }
    }
  }

  return (await fetchWikidataImage(name)) || (await fetchCommonsImage(name, context));
}
