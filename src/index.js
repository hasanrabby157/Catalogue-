const BASE = "https://javdb.com";

export default {
  async fetch(request) {
    try {
      const api =
        BASE +
        "/api/v2/search?q=ABC&page=1&type=movie";

      const response = await fetch(api, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "application/json",
          "Referer": "https://javdb.com/"
        }
      });

      const text = await response.text();

      return new Response(
        JSON.stringify(
          {
            status: response.status,
            ok: response.ok,
            contentType:
              response.headers.get("content-type"),
            length: text.length,
            response: text.substring(0, 5000)
          },
          null,
          2
        ),
        {
          headers: {
            "content-type":
              "application/json; charset=UTF-8"
          }
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify(
          {
            error: error.message
          },
          null,
          2
        ),
        {
          status: 500,
          headers: {
            "content-type":
              "application/json; charset=UTF-8"
          }
        }
      );
    }
  }
};
