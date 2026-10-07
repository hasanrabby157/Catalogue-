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
    version: "1.1.0",
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

async function searchJavInfo(query, apiKey) {
  const response = await fetch(
    "https://api.javinfo.dev/query?q=" +
      encodeURIComponent(query) +
      "&num=20",
    {
      headers: {
        "x-javinfo-key": apiKey,
        "Accept": "application/json"
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      "JAVINFO returned HTTP " + response.status
    );
  }

  return await response.json();
}

function convertResults(data) {
  const items =
    data.results ||
    data.movies ||
    data.data ||
    [];

  return items.map((item, index) => {
    const id =
      item.id ||
      item.code ||
      item.movie_id ||
      item.title ||
      ("result-" + index);

    const name =
      item.code ||
      item.title ||
      item.name ||
      id;

    const poster =
      item.poster ||
      item.image ||
      item.cover ||
      item.thumbnail ||
      "";

    return {
      id: "jav:" + id,
      type: "movie",
      name: name,
      poster: poster,
      description:
        item.description ||
        item.desc ||
        "JAV catalogue entry"
    };
  });
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

    // Catalogue / Search
    if (
      path === "/catalog/movie/jav.json" ||
      path.startsWith("/catalog/movie/jav/")
    ) {
      const apiKey = env.JAVINFO_API_KEY;

      if (!apiKey) {
        return json({
          error: "JAVINFO_API_KEY secret not found"
        }, 500);
      }

      const match = path.match(
        /\/search=([^/.]+)/
      );

      const search = match
        ? decodeURIComponent(match[1])
        : "SSIS";

      try {
        const data = await searchJavInfo(
          search,
          apiKey
        );

        const metas = convertResults(data);

        return json({
          metas
        });

      } catch (error) {
        return json({
          metas: [],
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
