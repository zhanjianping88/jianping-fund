const HTML_CONTENT_TYPE = "text/html";

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

function rewriteHtml(html, originPathPrefix, requestOrigin) {
  const prefix = originPathPrefix.endsWith("/") ? originPathPrefix.slice(0, -1) : originPathPrefix;
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const originUrl = new URL(prefix, requestOrigin).toString().replace(/\/$/, "");

  return html
    .replace(new RegExp(escapedPrefix, "g"), "")
    .replaceAll("https://zhanjianping88.github.io/jianping-fund", originUrl);
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

    const contentType = responseHeaders.get("content-type") || "";
    if (contentType.includes(HTML_CONTENT_TYPE)) {
      const requestUrl = new URL(request.url);
      const html = await upstreamResponse.text();
      const rewrittenHtml = rewriteHtml(
        html,
        env.ORIGIN_PATH_PREFIX || "/jianping-fund",
        requestUrl.origin
      );
      responseHeaders.delete("content-length");
      return new Response(rewrittenHtml, {
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        headers: responseHeaders,
      });
    }

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  },
};
