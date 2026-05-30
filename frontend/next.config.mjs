/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server bundle for a slim Docker runtime image (PH12).
  output: "standalone",

  // Dev convenience: proxy "/api/*" to the backend so the browser only ever
  // talks to the same origin as the page (no CORS, first-party cookies). In
  // production nginx does this instead, so this rewrite is never reached there.
  async rewrites() {
    const target = process.env.BACKEND_PROXY_TARGET || "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${target}/:path*` }];
  },
};

export default nextConfig;
