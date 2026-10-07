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
    version: "1.3.0",
    name: "JAV Catalogue Free",
    description: "JAV catalogue and metadata addon.",
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

function first(item, keys) {
  for (const key of keys) {
    const value = item?.[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return "";
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
    first(item, [
      "code",
      "id",
      "movie_id",
      "movieId"
    ]);

  const title =
    first(item, [
      "title",
      "name",
      "movie_title",
      "movieTitle"
    ]) || code;

  const poster =
    first(item, [
      "poster",
      "poster_url",
      "posterUrl",
      "image",
      "image_url",
      "imageUrl",
      "cover",
      "cover_url",
      "thumbnail"
    ]);

  const description =
    first(item, [
      "description",
      "desc",
      "synopsis",
      "plot",
      "summary"
    ]) ||
    "JAV catalogue entry";

  const meta = {
    id: "jav:" + code,
    type: "movie",
    name: title,
    poster: poster,
    description: description
  };

  const release = first(item, [
    "release_date",
    "releaseDate",
    "date",
    "released"
  ]);

  const runtime = first(item, [
    "runtime",
    "duration",
    "length"
  ]);

  const studio = first(item, [
    "studio",
    "maker",
    "maker_name",
    "label",
    "company"
  ]);

  const director = first(item, [
    "director",
    "director_name"
  ]);

  const actors = cleanArray(
    first(item, [
      "actors",
      "actresses",
      "actress",
      "actor",
      "performers",
      "cast"
    ])
  );

  const genres = cleanArray(
    first(item, [
      "genres",
      "genre",
      "tags",
      "categories"
    ])
  );

  if (release) {
    meta.releaseInfo = String(release);
  }

  if (runtime) {
    meta.runtime = String(runtime);
  }

  if (studio) {
    meta.studio = String(studio);
  }

  if (director) {
    meta.director = String(director);
  }

  if (actors.length) {
    meta.cast = actors;
  }

  if (genres.length) {
    meta.genre = genres;
  }

  return meta;
}

function unwrapMovie(data) {
  if (!data) return null;

  if (Array.isArray(data)) {
    return data[0] || null;
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
    const path = url.pathname;

    // Manifest
    if (
      path === "/" ||
      path === "/manifest.json"
    ) {
      return json(manifest());
    }

    const apiKey = env.JAVINFO_API_KEY;

    if (!apiKey) {
      return json({
        error: "JAVINFO_API_KEY secret not found"
      }, 500);
    }

    // SEARCH
    if (
      path === "/catalog/movie/jav.json" ||
      path.startsWith("/catalog/movie/jav/")
    ) {
      const match = path.match(
        /\/search=([^/.]+)/
      );

      const search = match
        ? decodeURIComponent(match[1])
        : "SSIS";

      // Cache search results for 1 hour
      const cacheKey = new Request(
        url.toString(),
        request
      );

      const cached =
        await caches.default.match(cacheKey);

      if (cached) {
        return cached;
      }

      try {
        const data = await javinfo(
          "/query?q=" +
          encodeURIComponent(search) +
          "&num=20",
          apiKey
        );

        const results = getResults(data);

        const response = json({
          metas: results.map(item =>
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
        return json({
          metas: [],
          error: error.message
        }, 500);
      }
    }

    // FULL MOVIE METADATA
    if (
      path.startsWith("/meta/movie/jav:")
    ) {
      const rawId = path
        .split("/")
        .pop()
        .replace(".json", "");

      const code = rawId.replace(
        /^jav:/,
        ""
      );

      // Cache individual movie metadata
      const cacheKey = new Request(
        url.toString(),
        request
      );

      const cached =
        await caches.default.match(cacheKey);

      if (cached) {
        return cached;
      }

      try {
        const data = await javinfo(
          "/movie?q=" +
          encodeURIComponent(code),
          apiKey
        );

        const item = unwrapMovie(data);

        if (!item) {
          return json({
            error: "Movie not found"
          }, 404);
        }

        const meta = makeMeta(
          item,
          code
        );

        const response = json({
          meta
        });

        // Cache metadata
        ctx.waitUntil(
          caches.default.put(
            cacheKey,
            response.clone()
          )
        );

        return response;

      } catch (error) {
        return json({
          error: error.message
        }, 500);
      }
    }

    return json(
      { error: "Not found" },
      404
    );
  }
};
