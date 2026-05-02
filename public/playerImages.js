/**
 * Resolve player headshots without the Express /api/player route (Live Server, static hosts).
 * Uses Wikipedia search + pageimages with MediaWiki CORS (origin=*).
 */

function normalizeDiacritics(s) {
  return String(s)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

const _WS = /\s+/;

function significantTokens(playerName) {
  return normalizeDiacritics(playerName).split(_WS).filter((t) => t.length >= 3);
}

/** Prefer articles whose title contains each distinct part of the player name (reduces season/league hits). */
export function titleMatchesPlayer(title, playerName) {
  const nt = normalizeDiacritics(title);
  const tokens = significantTokens(playerName);
  if (!tokens.length) {
    return nt.includes(normalizeDiacritics(playerName).replace(/\s+/g, " ").trim());
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

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

/**
 * @param {string} playerName
 * @returns {Promise<string|null>} image URL or null
 */
export async function resolvePlayerPhoto(playerName) {
  const name = String(playerName).replace(/\s+/g, " ").trim();
  if (!name) return null;

  const langs = ["en", "es", "de", "it", "fr"];
  const queries = [
    `${name} footballer`,
    `${name} association football`,
    `${name} football`,
    name,
  ];

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

  return null;
}
