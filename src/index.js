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
    throw new Error("Source returned " + response.status);
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

    const title = clean(
      titleMatch ? titleMatch[1] : id
    );

    results.push({
      id: "jav:" + id,
      type: "movie",
      name: title,
      poster: absolute(
        imageMatch ? imageMatch[1] : ""
      )
    });

    if (results.length >= 50) break;
  }

  return results;
}

function manifest() {
  return {
    id: "com.hasanrabby.javcatalogue",
    version: "1.0.0",
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
      if (path === "/" || path === "/manifest.json") {
        return json(manifest());
      }

      // Catalogue / search
      if (
        path.startsWith("/catalog/movie/jav")
      ) {
        const search =
          url.searchParams.get("search") || "";

        const skip = parseInt(
          url.searchParams.get("skip") || "0",
          10
        );

        let source;

        if (search) {
          source =
            BASE +
            "/search?q=" +
            encodeURIComponent(search);
        } else {
          source = BASE + "/tags";
        }

        const html = await fetchPage(source);

        let metas = parseMovies(html);

        metas = metas.slice(skip, skip + 20);

        return json({
          metas
        });
      }

      // Metadata
      if (
        path.startsWith("/meta/movie/jav:")
      ) {
        const value = path
          .split("/")
          .pop()
          .replace(".json", "");

        const id = value.replace(/^jav:/, "");

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
