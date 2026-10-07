export default {
  async fetch(request) {
    return new Response("JAV Catalogue Worker is working!", {
      headers: {
        "content-type": "text/plain"
      }
    });
  }
};
