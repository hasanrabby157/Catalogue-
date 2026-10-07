function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600"
    }
  });
}

function manifest() {
  return {
    id: "com.hasanrabby.javcatalogue",
    version: "1.5.0",
    name: "JAV Catalogue Free",
    description: "JAV catalogue and metadata addon.",
    types: ["movie"],

    resources: [
      "catalog",
      {
        name: "meta",
        types: ["movie"],
        idPrefixes: ["jav:"]
      }
    ],

    idPrefixes: ["jav:"],

    catalogs: [
      {
        type: "movie",
        id: "jav2026",
        name: "🆕 2026 Releases"
      },
      {
        type: "movie",
        id: "jav2025",
        name: "📅 2025 Releases"
      },
      {
        type: "movie",
        id: "jav",
        name: "JAV Catalogue",
        extra: [
          {
            name: "search",
            isRequired: false
          }
        ]
      }
    ]
  };
}

async function javinfo(path, apiKey) {
  const response = await fetch(
    "https://api.javinfo.dev" + path,
    {
      headers: {
        "x-javinfo-key": apiKey,
        "Accept": "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      "JAVINFO HTTP " + response.status
    );
  }

  return await response.json();
}

function getResults(data) {
  if (Array.isArray(data)) {
    return data;
  }

  return (
    data.results ||
    data.movies ||
    data.data ||
    []
  );
}

function cleanArray(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map(x => {
        if (typeof x === "string") return x;

        if (typeof x === "object") {
          return (
            x.name ||
            x.title ||
            x.text ||
            x.value ||
            ""
          );
        }

        return String(x);
      })
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map(x => x.trim())
      .filter(Boolean);
  }

  return [];
}

function makeMeta(item, forcedCode = "") {
  const code =
    forcedCode ||
    item.dvdId ||
    item.code ||
    item.id ||
    "";

  const title =
    item.titleEn ||
    item.titleJa ||
    item.title ||
    item.name ||
    code;

  const poster =
    item.jacketFullUrl ||
    item.cover ||
    item.poster ||
    item.image ||
    "";

  const description =
    item.description ||
    item.desc ||
    item.synopsis ||
    item.plot ||
    "";

  return {
    id: "jav:" + code,
    type: "movie",
    name: title,
    poster: poster,
    description: description,

    releaseInfo: item.releaseDate
      ? String(item.releaseDate)
      : undefined,

    runtime: item.runtimeMins
      ? String(item.runtimeMins)
      : undefined,

    director: item.director || undefined,

    cast: cleanArray(item.actresses),

    genre: cleanArray(item.categories),

    studio: Array.isArray(item.makers)
      ? item.makers.join(", ")
      : (item.label || "")
  };
}

function unwrapMovie(data) {
  if (!data) return null;

  if (data.result) {
    return data.result;
  }

  if (data.movie) {
    return Array.isArray(data.movie)
      ? data.movie[0]
      : data.movie;
  }

  if (data.data) {
    return Array.isArray(data.data)
      ? data.data[0]
      : data.data;
  }

  if (data.results) {
    return Array.isArray(data.results)
      ? data.results[0]
      : data.results;
  }

  return data;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    const path =
      url.pathname.replace(/%3A/gi, ":");

    console.log(
      "DEBUG PATH:",
      path
    );

    // MANIFEST
    if (
      path === "/" ||
      path === "/manifest.json"
    ) {
      return json(manifest());
    }

    const apiKey =
      env.JAVINFO_API_KEY;

    if (!apiKey) {
      return json(
        {
          error:
            "JAVINFO_API_KEY secret not found"
        },
        500
      );
    }

    // HOME CATALOGS
    if (
      path ===
        "/catalog/movie/jav2026.json" ||
      path ===
        "/catalog/movie/jav2025.json"
    ) {
      const is2026 =
        path ===
        "/catalog/movie/jav2026.json";

      const cacheKey =
        new Request(
          url.toString()
        );

      const cached =
        await caches.default.match(
          cacheKey
        );

      if (cached) {
        return cached;
      }

      try {
        const query =
          is2026
            ? "filter[releaseAfter]=2026-01-01"
            : "filter[releaseAfter]=2025-01-01&filter[releaseBefore]=2025-12-31";

        const data =
          await javinfo(
            "/query?" +
              query +
              "&num=20",
            apiKey
          );

        const results =
          getResults(data);

        const response =
          json({
            metas:
              results.map(
                item =>
                  makeMeta(item)
              )
          });

        ctx.waitUntil(
          caches.default.put(
            cacheKey,
            response.clone()
          )
        );

        return response;

      } catch (error) {
        console.error(
          "HOME CATALOG ERROR:",
          error
        );

        return json(
          {
            metas: [],
            error: error.message
          },
          500
        );
      }
    }

    // SEARCH
    if (
      path ===
        "/catalog/movie/jav.json" ||
      path.startsWith(
        "/catalog/movie/jav/"
      )
    ) {
      const match =
        path.match(
          /\/search=([^/.]+)/
        );

      const search =
        match
          ? decodeURIComponent(
              match[1]
            )
          : "SSIS";

      const cacheKey =
        new Request(
          url.toString()
        );

      const cached =
        await caches.default.match(
          cacheKey
        );

      if (cached) {
        return cached;
      }

      try {
        const data =
          await javinfo(
            "/query?q=" +
              encodeURIComponent(
                search
              ) +
              "&num=20",
            apiKey
          );

        const results =
          getResults(data);

        const response =
          json({
            metas:
              results.map(
                item =>
                  makeMeta(item)
              )
          });

        ctx.waitUntil(
          caches.default.put(
            cacheKey,
            response.clone()
          )
        );

        return response;

      } catch (error) {
        return json(
          {
            metas: [],
            error: error.message
          },
          500
        );
      }
    }

    // FULL MOVIE METADATA
    if (
      path.startsWith(
        "/meta/movie/jav:"
      )
    ) {
      const rawId =
        path
          .split("/")
          .pop()
          .replace(
            ".json",
            ""
          );

      const code =
        rawId.replace(
          /^jav:/,
          ""
        );

      const cacheKey =
        new Request(
          url.toString()
        );

      const cached =
        await caches.default.match(
          cacheKey
        );

      if (cached) {
        return cached;
      }

      try {
        console.log(
          "META CODE:",
          code
        );

        const data =
          await javinfo(
            "/movie?q=" +
              encodeURIComponent(
                code
              ),
            apiKey
          );

        const item =
          unwrapMovie(data);

        if (!item) {
          return json(
            {
              error:
                "Movie not found"
            },
            404
          );
        }

        const meta =
          makeMeta(
            item,
            code
          );

        const response =
          json({
            meta
          });

        ctx.waitUntil(
          caches.default.put(
            cacheKey,
            response.clone()
          )
        );

        return response;

      } catch (error) {
        console.error(
          "META ERROR:",
          error
        );

        return json(
          {
            error:
              error.message,
            stack:
              error.stack ||
              ""
          },
          500
        );
      }
    }

    return json(
      {
        error:
          "Not found"
      },
      404
    );
  }
};
