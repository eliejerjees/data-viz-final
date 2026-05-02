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
app.use(express.static("public"));

const WIKI_UA =
  "DataVizFinal/1.0 (https://github.com/; node; educational data-viz)";

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

function titleMatchesPlayer(title, playerName) {
  const nt = normalizeDiacritics(title);
  const tokens = significantTokens(playerName);
  if (!tokens.length) {
    return nt.includes(normalizeDiacritics(playerName).replace(/\s+/g, " ").trim());
  }
  return tokens.every((t) => nt.includes(t));
}

/**
 * PlaymakerStats is behind Cloudflare; Wikipedia uses list=search + name filtering
 * so we return player bios—not random season or league pages from gsrlimit=1.
 */
async function fetchWikipediaImage(playerName) {
  const cleaned = String(playerName).replace(/\s+/g, " ").trim();
  if (!cleaned) return null;

  const langs = ["en", "es", "de", "it", "fr"];
  const queries = [
    `${cleaned} footballer`,
    `${cleaned} association football`,
    `${cleaned} football`,
    cleaned,
  ];

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

    try {
      const pm = await fetchPlaymakerImage(name);
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
