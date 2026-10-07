function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

function manifest() {
  return {
    id: "com.hasanrabby.javcatalogue",
    version: "1.2.0",
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
  return (
    data.results ||
    data.movies ||
    data.data ||
    []
  );
}

function makeMeta(item) {
  const code =
    item.id ||
    item.code ||
    item.movie_id ||
    item.title ||
    item.name;

  const name =
    item.code ||
    item.title ||
    item.name ||
    code;

  const poster =
    item.poster ||
    item.image ||
    item.cover ||
    item.thumbnail ||
    "";

  return {
    id: "jav:" + code,
    type: "movie",
    name: name,
    poster: poster,
    description:
      item.description ||
      item.desc ||
      "JAV catalogue entry"
  };
}

export default {
  async fetch(request, env) {
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

    // One-time movie test
    if (path === "/test-movie") {
      try {
        const data = await javinfo(
          "/movie?q=SSIS-001",
          apiKey
        );

        return json(data);

      } catch (error) {
        return json({
          error: error.message
        }, 500);
      }
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

      try {
        const data = await javinfo(
          "/query?q=" +
          encodeURIComponent(search) +
          "&num=20",
          apiKey
        );

        const results = getResults(data);

        return json({
          metas: results.map(makeMeta)
        });

      } catch (error) {
        return json({
          metas: [],
          error: error.message
        }, 500);
      }
    }

    // MOVIE METADATA
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

      try {
        const data = await javinfo(
          "/movie?q=" +
          encodeURIComponent(code),
          apiKey
        );

        let item = data;

        if (data.movie) {
          item = data.movie;
        } else if (data.data) {
          item = Array.isArray(data.data)
            ? data.data[0]
            : data.data;
        } else if (data.results) {
          item = Array.isArray(data.results)
            ? data.results[0]
            : data.results;
        }

        if (!item) {
          return json({
            error: "Movie not found"
          }, 404);
        }

        const meta = makeMeta(item);

        return json({
          meta: {
            ...meta,
            id: "jav:" + code
          }
        });

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
