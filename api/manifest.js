module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600");

  res.status(200).json({
    id: "com.hasanrabby.javcatalogue",
    version: "1.0.0",
    name: "JAV Catalogue Free",
    description: "JAV catalogue and metadata search. No streams.",
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
  });
};
