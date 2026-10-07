const BASE = "https://javdb.com";

export default {
  async fetch(request) {
    try {
      const response = await fetch(BASE + "/tags", {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "text/html,application/xhtml+xml"
        }
      });

      const html = await response.text();

      return new Response(
        JSON.stringify({
          status: response.status,
          ok: response.ok,
          length: html.length,
          start: html.substring(0, 2000)
        }, null, 2),
        {
          headers: {
            "content-type": "application/json; charset=UTF-8"
          }
        }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error.message
        }, null, 2),
        {
          status: 500,
          headers: {
            "content-type": "application/json; charset=UTF-8"
          }
        }
      );
    }
  }
};
