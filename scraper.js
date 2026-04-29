const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();
const PORT = 3000;
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

app.use(express.static("public"));

app.get("/api/player", async (req, res) => {
  const name = req.query.name;
  if (!name) {
    return res.status(400).json({ error: "Missing 'name' query parameter" });
  }

  try {
    const searchUrl = `${BASE_URL}/search?search_txt=${encodeURIComponent(name)}`;
    const searchRes = await http.get(searchUrl);
    const $ = cheerio.load(searchRes.data);

    const playerLink = $('a[href*="/player/"]').first();
    if (!playerLink.length) {
      return res.status(404).json({ error: "No player found" });
    }

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

    if (imageUrl && imageUrl.includes("nophoto")) {
      imageUrl = null;
    }

    if (!imageUrl) {
      return res.status(404).json({
        error: "Player found but no profile image detected",
        profileUrl,
      });
    }

    if (imageUrl.startsWith("//")) {
      imageUrl = "https:" + imageUrl;
    } else if (imageUrl.startsWith("/")) {
      imageUrl = BASE_URL + imageUrl;
    }

    const rawName =
      p$("h1").first().text().trim() ||
      playerLink.text().trim() ||
      name;
    const playerName = rawName.replace(/^\d+\./, "").trim();

    res.json({ name: playerName, profileUrl, imageUrl });
  } catch (err) {
    console.error("Scrape error:", err.message);
    res.status(500).json({ error: "Scraping failed: " + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
