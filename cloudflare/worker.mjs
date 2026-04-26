function toUpstreamUrl(requestUrl, originBaseUrl, originPathPrefix) {
  const incomingUrl = new URL(requestUrl);
  const upstreamUrl = new URL(originBaseUrl);
  const prefix = originPathPrefix.endsWith("/") ? originPathPrefix.slice(0, -1) : originPathPrefix;
  const incomingPath = incomingUrl.pathname || "/";
  const normalizedPath =
    incomingPath === prefix || incomingPath.startsWith(`${prefix}/`)
      ? incomingPath
      : `${prefix}${incomingPath.startsWith("/") ? incomingPath : `/${incomingPath}`}`;

  upstreamUrl.pathname = normalizedPath;
  upstreamUrl.search = incomingUrl.search;
  return upstreamUrl;
}

export default {
  async fetch(request, env) {
    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          Allow: "GET, HEAD",
        },
      });
    }

    const upstreamUrl = toUpstreamUrl(
      request.url,
      env.ORIGIN_BASE_URL,
      env.ORIGIN_PATH_PREFIX || "/jianping-fund"
    );

    const upstreamHeaders = new Headers(request.headers);
    upstreamHeaders.set("host", upstreamUrl.host);

    const upstreamResponse = await fetch(upstreamUrl, {
      method: request.method,
      headers: upstreamHeaders,
      cf: {
        cacheEverything: true,
        cacheTtlByStatus: {
          "200-299": 3600,
          "404": 60,
          "500-599": 0,
        },
      },
    });

    const responseHeaders = new Headers(upstreamResponse.headers);
    responseHeaders.set("x-edge-proxy", "cloudflare-workers");

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};
