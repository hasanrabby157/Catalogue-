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
      }
 
      return json({
        meta: movie
      });
    }
            // JAVINFO API test
    if (path === "/test-javinfo") {
      const apiKey = env.JAVINFO_API_KEY;

      if (!apiKey) {
        return json({
          error: "JAVINFO_API_KEY secret not found"
        }, 500);
      }

      try {
        const response = await fetch(
          "https://api.javinfo.dev/movie?q=SSIS-001",
          {
            headers: {
              "x-javinfo-key": apiKey,
              "Accept": "application/json"
            }
          }
        );

        const text = await response.text();

        return json({
          status: response.status,
          ok: response.ok,
          response: text.substring(0, 5000)
        });

      } catch (error) {
        return json({
          error: error.message
        }, 500);
      }
    }
    return json(
      {
        error: "Not found"
      },
      404
    );
  }
};
