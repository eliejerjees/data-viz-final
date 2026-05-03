const express = require("express");
const path = require("path");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = "https://www.playmakerstats.com";

const http = axios.create({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  },
  timeout: 15000,
});

app.use("/data", express.static(path.join(__dirname, "data")));
app.use("/flag-icons", express.static(path.join(__dirname, "node_modules", "flag-icons")));
app.use("/team-logos", express.static(path.join(__dirname, "Team Logos")));
app.use("/api", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  next();
});
app.use(express.static("public"));

const WIKI_UA =
  "DataVizFinal/1.0 (https://github.com/; node; educational data-viz)";

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

function normalizeSearchText(s) {
  return String(s)
    .replace(/[ÆæÐðÞþŁłØøŒœß]/g, (ch) => EXTRA_ASCII[ch] || ch)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[’‘`´]/g, "'")
    .replace(/[‐‑‒–—]/g, "-")
    .toLowerCase();
}

const _WS = /\s+/;

function asciiSearchText(s) {
  return normalizeSearchText(s)
    .replace(/[^a-z0-9\s'-]/g, " ")
    .replace(/[-']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function significantTokens(playerName) {
  return asciiSearchText(playerName).split(_WS).filter((t) => t.length >= 3);
}

function titleMatchesPlayer(title, playerName) {
  const nt = asciiSearchText(title);
  const tokens = significantTokens(playerName);
  if (!tokens.length) {
    return nt.includes(asciiSearchText(playerName));
  }
  return tokens.every((t) => nt.includes(t));
}

/**
 * PlaymakerStats is behind Cloudflare; Wikipedia uses list=search + name filtering
 * so we return player bios, not random season or league pages from gsrlimit=1.
 */
async function fetchWikipediaImage(playerName) {
  const cleaned = String(playerName).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  const asciiName = asciiSearchText(cleaned);
  const nameVariants = [...new Set([cleaned, asciiName].filter(Boolean))];

  const langs = ["en"];
  const queries = nameVariants.flatMap((variant) => [
    `${variant} footballer`,
    `${variant} association football`,
    `${variant} football`,
    variant,
  ]);

  for (const lang of langs) {
    const base = `https://${lang}.wikipedia.org/w/api.php`;
    for (const srsearch of queries) {
      const { data } = await http.get(base, {
        params: {
          action: "query",
          list: "search",
          srsearch,
          srlimit: 15,
          format: "json",
        },
        headers: { "User-Agent": WIKI_UA },
        timeout: 12000,
      });

      const hits = data.query?.search || [];
      const titles = hits.map((h) => h.title).filter((t) => titleMatchesPlayer(t, cleaned));
      if (!titles.length) continue;

      for (let i = 0; i < titles.length; i += 10) {
        const slice = titles.slice(i, i + 10);
        const { data: d2 } = await http.get(base, {
          params: {
            action: "query",
            titles: slice.join("|"),
            prop: "pageimages",
            piprop: "thumbnail",
            pithumbsize: 400,
            format: "json",
          },
          headers: { "User-Agent": WIKI_UA },
          timeout: 12000,
        });

        const pages = d2.query?.pages;
        if (!pages) continue;

        for (const title of slice) {
          const page = Object.values(pages).find((p) => p.title === title);
          const imageUrl = page?.thumbnail?.source;
          if (!imageUrl) continue;

          const profileUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
          const displayName = title.replace(/\s*\([^)]*\)\s*$/, "").trim();
          return { imageUrl, profileUrl, displayName };
        }
      }
    }
  }

  return null;
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
  if (occupationIds.has("Q937857")) return true;

  const sportIds = new Set(
    (entity?.claims?.P641 || [])
      .map((claim) => claim?.mainsnak?.datavalue?.value?.id)
      .filter(Boolean)
  );
  return sportIds.has("Q2736");
}

async function fetchWikidataImage(playerName) {
  const cleaned = String(playerName).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const variants = [...new Set([cleaned, asciiSearchText(cleaned)].filter(Boolean))];
  for (const variant of variants) {
    const { data } = await http.get("https://www.wikidata.org/w/api.php", {
      params: {
        action: "wbsearchentities",
        search: variant,
        language: "en",
        uselang: "en",
        type: "item",
        limit: 12,
        format: "json",
      },
      headers: { "User-Agent": WIKI_UA },
      timeout: 12000,
    });

    const ids = (data.search || [])
      .filter((hit) => titleMatchesPlayer(hit.label || "", cleaned))
      .map((hit) => hit.id)
      .filter(Boolean);
    if (!ids.length) continue;

    const { data: entityData } = await http.get("https://www.wikidata.org/w/api.php", {
      params: {
        action: "wbgetentities",
        ids: ids.join("|"),
        props: "labels|descriptions|claims",
        languages: "en",
        format: "json",
      },
      headers: { "User-Agent": WIKI_UA },
      timeout: 12000,
    });

    const entities = entityData.entities || {};
    for (const id of ids) {
      const entity = entities[id];
      const label = entity?.labels?.en?.value || "";
      const imageFile = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (!imageFile || !titleMatchesPlayer(label, cleaned) || !footballishEntity(entity)) continue;
      return {
        imageUrl: commonsFilePath(imageFile),
        profileUrl: `https://www.wikidata.org/wiki/${id}`,
        displayName: label || cleaned,
      };
    }
  }

  return null;
}

function badCommonsTitle(title) {
  return /(logo|kit|jersey|shirt|stadium|map|flag|signature|line-?up|squad|team photo|training ground)/i.test(title);
}

async function fetchCommonsImage(playerName, context = {}) {
  const cleaned = String(playerName).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const squad = String(context.squad || "").trim();
  const variants = [
    `${cleaned} footballer`,
    `${cleaned} soccer player`,
    squad ? `${cleaned} ${squad}` : "",
    cleaned,
    asciiSearchText(cleaned),
  ].filter(Boolean);

  for (const srsearch of [...new Set(variants)]) {
    const { data } = await http.get("https://commons.wikimedia.org/w/api.php", {
      params: {
        action: "query",
        generator: "search",
        gsrnamespace: 6,
        gsrlimit: 20,
        gsrsearch: srsearch,
        prop: "imageinfo",
        iiprop: "url|mime",
        iiurlwidth: 400,
        format: "json",
      },
      headers: { "User-Agent": WIKI_UA },
      timeout: 12000,
    });

    const pages = Object.values(data.query?.pages || {});
    const matches = pages
      .filter((page) => titleMatchesPlayer(page.title || "", cleaned))
      .filter((page) => !badCommonsTitle(page.title || ""))
      .filter((page) => (page.imageinfo?.[0]?.mime || "").startsWith("image/"));

    for (const page of matches) {
      const info = page.imageinfo?.[0];
      const imageUrl = info?.thumburl || info?.url;
      if (!imageUrl) continue;
      return {
        imageUrl,
        profileUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent((page.title || "").replace(/ /g, "_"))}`,
        displayName: cleaned,
      };
    }
  }

  return null;
}

async function fetchPlaymakerImage(name) {
  const searchUrl = `${BASE_URL}/search?search_txt=${encodeURIComponent(name)}`;
  const searchRes = await http.get(searchUrl);
  const $ = cheerio.load(searchRes.data);

  const playerLink = $('a[href*="/player/"]').first();
  if (!playerLink.length) return null;

  const playerHref = playerLink.attr("href");
  const profileUrl = playerHref.startsWith("http")
    ? playerHref
    : `${BASE_URL}${playerHref}`;

  const playerRes = await http.get(profileUrl);
  const p$ = cheerio.load(playerRes.data);

  let imageUrl =
    p$('meta[property="og:image"]').attr("content") ||
    p$('meta[property="twitter:image"]').attr("content") ||
    null;

  if (imageUrl && imageUrl.includes("nophoto")) imageUrl = null;
  if (!imageUrl) return null;

  if (imageUrl.startsWith("//")) imageUrl = "https:" + imageUrl;
  else if (imageUrl.startsWith("/")) imageUrl = BASE_URL + imageUrl;

  const rawName =
    p$("h1").first().text().trim() ||
    playerLink.text().trim() ||
    name;
  const playerName = rawName.replace(/^\d+\./, "").trim();

  return { imageUrl, profileUrl, displayName: playerName };
}

app.get("/api/player", async (req, res) => {
  const name = req.query.name;
  const squad = req.query.squad;
  if (!name) {
    return res.status(400).json({ error: "Missing 'name' query parameter" });
  }

  try {
    const wiki = await fetchWikipediaImage(name);
    if (wiki) {
      return res.json({
        name: wiki.displayName || name,
        profileUrl: wiki.profileUrl,
        imageUrl: wiki.imageUrl,
        source: "wikipedia",
      });
    }

    const wikidata = await fetchWikidataImage(name);
    if (wikidata) {
      return res.json({
        name: wikidata.displayName || name,
        profileUrl: wikidata.profileUrl,
        imageUrl: wikidata.imageUrl,
        source: "wikidata",
      });
    }

    const commons = await fetchCommonsImage(name, { squad });
    if (commons) {
      return res.json({
        name: commons.displayName || name,
        profileUrl: commons.profileUrl,
        imageUrl: commons.imageUrl,
        source: "commons",
      });
    }

    try {
      let pm = await fetchPlaymakerImage(name);
      if (!pm) {
        const asciiName = asciiSearchText(name);
        if (asciiName && asciiName !== String(name).trim()) {
          pm = await fetchPlaymakerImage(asciiName);
        }
      }
      if (pm) {
        return res.json({
          name: pm.displayName,
          profileUrl: pm.profileUrl,
          imageUrl: pm.imageUrl,
          source: "playmaker",
        });
      }
    } catch (pmErr) {
      console.warn("Playmaker fallback:", pmErr.message);
    }

    res.status(404).json({
      error: "No profile image found (tried Wikipedia and PlaymakerStats).",
    });
  } catch (err) {
    console.error("Player image error:", err.message);
    res.status(500).json({ error: "Image lookup failed: " + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
