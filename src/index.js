const BASE = "https://javdb.com";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300"
    }
  });
}

function clean(text) {
  return (text || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
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
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  if (!response.ok) {
    throw new Error("Source returned " + response.status);
  }

  return await response.text();
}

function parseMovies(html) {
  const results = [];
  const seen = new Set();

  // Find every /v/XXXXX link
  const regex =
    /<a[^>]+href=["'](\/v\/[^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    const content = match[2];

    const idMatch = href.match(/^\/v\/([^/?#]+)/i);
    if (!idMatch) continue;

    const id = idMatch[1];

    if (seen.has(id)) continue;
    seen.add(id);

    // Poster
    const imageMatch =
      content.match(/data-src=["']([^"']+)["']/i) ||
      content.match(/src=["']([^"']+)["']/i);

    // Title
    const titleMatch =
      content.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i) ||
      content.match(/<span[^>]*>([\s\S]*?)<\/span>/i) ||
      content.match(/<div[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

    let title = clean(titleMatch ? titleMatch[1] : "");

    if (!title) {
      title = id;
    }

    results.push({
      id: "jav:" + id,
      type: "movie",
      name: title,
      poster: absolute(imageMatch ? imageMatch[1] : "")
    });

    if (results.length >= 100) break;
  }

  return results;
}

function parseCatalogPath(pathname) {
  const match = pathname.match(
    /^\/catalog\/movie\/jav(?:\/([^/]+))?\.json$/i
  );

  if (!match) return null;

  const extra = match[1] || "";

  let search = "";
  let skip = 0;

  if (extra) {
    const parts = extra.split("&");

    for (const part of parts) {
      const [key, ...valueParts] = part.split("=");
      const value = valueParts.join("=");

      if (key === "search") {
        search = decodeURIComponent(value || "");
      }

      if (key === "skip") {
        skip = parseInt(value || "0", 10) || 0;
      }
    }
  }

  return {
    search,
    skip
  };
}

function manifest() {
  return {
    id: "com.hasanrabby.javcatalogue",
    version: "1.0.1",
    name: "JAV Catalogue Free",
    description:
      "JAV catalogue and metadata search. No streams.",
    resources: ["catalog", "meta"],
    types: ["movie"],
    idPrefixes: ["jav:"],

    catalogs: [
      {
        type: "movie",
        id: "jav",
        name: "JAV Catalogue",
        extra: [
          {
            name: "search",
            isRequired: false
          },
          {
            name: "skip",
            isRequired: false
          }
        ]
      }
    ]
  };
}

export default {
  async fetch(request) {
    try {
      const url = new URL(request.url);
      const path = url.pathname;

      // Manifest
      if (
        path === "/" ||
        path === "/manifest.json"
      ) {
        return json(manifest());
      }

      // Catalogue / Search
      const catalog = parseCatalogPath(path);

      if (catalog) {
        let source;

        if (catalog.search) {
          source =
            BASE +
            "/search?q=" +
            encodeURIComponent(catalog.search);
        } else {
          source = BASE + "/tags";
        }

        const html = await fetchPage(source);

        let metas = parseMovies(html);

        metas = metas.slice(
          catalog.skip,
          catalog.skip + 20
        );

        return json({
          metas
        });
      }

      // Metadata
      const metaMatch = path.match(
        /^\/meta\/movie\/jav:([^/]+)\.json$/i
      );

      if (metaMatch) {
        const id = metaMatch[1];

        const html = await fetchPage(
          BASE + "/v/" + encodeURIComponent(id)
        );

        const titleMatch =
          html.match(
            /<h2[^>]*>([\s\S]*?)<\/h2>/i
          ) ||
          html.match(
            /<title[^>]*>([\s\S]*?)<\/title>/i
          );

        const imageMatch =
          html.match(
            /data-src=["']([^"']+)["']/i
          ) ||
          html.match(
            /<img[^>]+src=["']([^"']+)["']/i
          );

        const descriptionMatch =
          html.match(
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

        return json({
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

      return json(
        {
          error: "Not found"
        },
        404
      );
    } catch (error) {
      return json(
        {
          error: "JAV source unavailable",
          details: error.message
        },
        502
      );
    }
  }
};
