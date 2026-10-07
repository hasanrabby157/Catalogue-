const MOVIES = [
  {
    id: "jav:SSIS-001",
    type: "movie",
    name: "SSIS-001",
    poster: "https://placehold.co/600x900?text=SSIS-001",
    description: "JAV catalogue entry"
  },
  {
    id: "jav:SSIS-002",
    type: "movie",
    name: "SSIS-002",
    poster: "https://placehold.co/600x900?text=SSIS-002",
    description: "JAV catalogue entry"
  },
  {
    id: "jav:IPX-001",
    type: "movie",
    name: "IPX-001",
    poster: "https://placehold.co/600x900?text=IPX-001",
    description: "JAV catalogue entry"
  },
  {
    id: "jav:IPX-002",
    type: "movie",
    name: "IPX-002",
    poster: "https://placehold.co/600x900?text=IPX-002",
    description: "JAV catalogue entry"
  },
  {
    id: "jav:ABF-001",
    type: "movie",
    name: "ABF-001",
    poster: "https://placehold.co/600x900?text=ABF-001",
    description: "JAV catalogue entry"
  }
];

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
    version: "1.0.2",
    name: "JAV Catalogue Free",
    description: "Simple JAV catalogue and metadata addon.",
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

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Manifest
    if (
      path === "/" ||
      path === "/manifest.json"
    ) {
      return json(manifest());
    }

    // Catalogue
    if (
      path === "/catalog/movie/jav.json" ||
      path.startsWith("/catalog/movie/jav/")
    ) {
      let search = "";

      const match = path.match(
        /\/search=([^/.]+)/
      );

      if (match) {
        search = decodeURIComponent(match[1])
          .toLowerCase();
      }

      let results = MOVIES;

      if (search) {
        results = results.filter(movie =>
          movie.name
            .toLowerCase()
            .includes(search)
        );
      }

      return json({
        metas: results
      });
    }

    // Metadata
    if (
      path.startsWith("/meta/movie/jav:")
    ) {
      const id = path
        .split("/")
        .pop()
        .replace(".json", "");

      const movie = MOVIES.find(
        item => item.id === id
      );

      if (!movie) {
        return json(
          { error: "Movie not found" },
          404
        );
        // API test
    if (path === "/test-api") {
      try {
        const response = await fetch(
          "https://javdb.com/api/v2/search?q=ipzz&page=1&type=movie",
          {
            headers: {
              "User-Agent": "Mozilla/5.0",
              "Accept": "application/json"
            }
          }
        );

        const data = await response.text();

        return json({
          status: response.status,
          ok: response.ok,
          length: data.length,
          response: data.substring(0, 3000)
        });

      } catch (error) {
        return json({
          error: error.message
        }, 500);
      }
    }
      }

      return json({
        meta: movie
      });
    }

    return json(
      {
        error: "Not found"
      },
      404
    );
  }
};
