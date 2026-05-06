export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    try {
      // Try to serve the static asset first
      let response = await env.ASSETS.fetch(request);
      if (response.status !== 404) return response;
    } catch {}
    
    // Fallback: serve index.html for all routes (SPA routing)
    return env.ASSETS.fetch(new URL('/index.html', url.origin));
  }
}