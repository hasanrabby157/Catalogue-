const { URL } = require("url");

const BASE = "https://javdb.com";

function send(res, data, status = 200) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.status(status).json(data);
}

function clean(text) {
  return (text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function absolute(url) {
  if (!url) return "";
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return BASE + url;
  return url;
}

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error("Source returned HTTP " + response.status);
  }

  return await response.text();
}

function parseMovies(html) {
  const results = [];

  const regex =
    /<a[^>]+href=["'](\/v\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    const content = match[2];

    const idMatch = href.match(/\/v\/([^/?#]+)/i);

    if (!idMatch) continue;

    const id = idMatch[1];

    const imageMatch = content.match(
      /(?:data-src|src)=["']([^"']+)["']/i
    );

    const titleMatch =
      content.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i) ||
      content.match(/<span[^>]*>([\s\S]*?)<\/span>/i);

    const title = clean(titleMatch ? titleMatch[1] : id);

    results.push({
      id: "jav:" + id,
      type: "movie",
      name: title,
      poster: absolute(imageMatch ? imageMatch[1] : "")
    });

    if (results.length >= 50) break;
  }

  return results;
}

module.exports = async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      return send(res, {}, 204);
    }

    const url = new URL(req.url, "https://example.com");
    const pathname = url.pathname;

    /*
     * CATALOG
     *
     * /catalog/movie/jav.json
     * /catalog/movie/jav/search=ABC.json
     */

    if (
      pathname.startsWith("/catalog/movie/jav")
    ) {
      const search = url.searchParams.get("search") || "";
      const skip = parseInt(
        url.searchParams.get("skip") || "0",
        10
      );

      let sourceUrl;

      if (search) {
        sourceUrl =
          BASE +
          "/search?q=" +
          encodeURIComponent(search);
      } else {
        sourceUrl = BASE + "/tags";
      }

      const html = await fetchPage(sourceUrl);

      let metas = parseMovies(html);

      metas = metas.slice(skip, skip + 20);

      return send(res, {
        metas
      });
    }

    /*
     * META
     *
     * /meta/movie/jav:xxxxx.json
     */

    if (
      pathname.startsWith("/meta/movie/jav:")
    ) {
      const rawId = pathname
        .split("/")
        .pop()
        .replace(".json", "");

      const id = rawId.replace(/^jav:/, "");

      const html = await fetchPage(
        BASE + "/v/" + encodeURIComponent(id)
      );

      const titleMatch = html.match(
        /<h2[^>]*>([\s\S]*?)<\/h2>/i
      );

      const imageMatch = html.match(
        /(?:data-src|src)=["']([^"']+)["']/i
      );

      const descriptionMatch = html.match(
        /<div[^>]+class=["'][^"']*(?:description|plot)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
      );

      const title = clean(
        titleMatch ? titleMatch[1] : id
      );

      const poster = absolute(
        imageMatch ? imageMatch[1] : ""
      );

      const description = clean(
        descriptionMatch
          ? descriptionMatch[1]
          : ""
      );

      return send(res, {
        meta: {
          id: "jav:" + id,
          type: "movie",
          name: title,
          poster,
          posterShape: "poster",
          description
        }
      });
    }

    return send(
      res,
      {
        error: "Not found"
      },
      404
    );
  } catch (error) {
    return send(
      res,
      {
        error: "JAV source unavailable",
        details: error.message
      },
      502
    );
  }
};
