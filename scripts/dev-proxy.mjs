import http from "node:http";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const defaultBaseUrl = process.env.PROVIDER_BASE_URL || "https://api.moonshot.cn/v1";
const allowedProviderOrigins = (
  process.env.ALLOWED_PROVIDER_ORIGINS ||
  "https://api.moonshot.cn,https://api.moonshot.ai,https://api.kimi.com,https://api.kimi.ai"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    writeCors(req, res);
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    const baseUrl =
      typeof req.headers["x-provider-base-url"] === "string"
        ? req.headers["x-provider-base-url"]
        : defaultBaseUrl;
    const providerUrl = new URL(baseUrl);
    if (!allowedProviderOrigins.includes(providerUrl.origin)) {
      writeCors(req, res);
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: `Provider origin ${providerUrl.origin} is not allowed by the local proxy.`,
        }),
      );
      return;
    }
    const target = `${baseUrl.replace(/\/$/, "")}${req.url || ""}`;
    const headers = new Headers();

    for (const [key, value] of Object.entries(req.headers)) {
      if (!value || key.toLowerCase() === "host" || key.toLowerCase() === "origin") {
        continue;
      }
      if (key.toLowerCase() === "x-provider-base-url") {
        continue;
      }
      headers.set(key, Array.isArray(value) ? value.join(",") : value);
    }
    headers.set("accept-encoding", "identity");

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : req,
      duplex: "half",
    });

    writeCors(req, res);
    res.writeHead(upstream.status, proxyResponseHeaders(upstream.headers));
    if (upstream.body) {
      for await (const chunk of upstream.body) {
        res.write(chunk);
      }
    }
    res.end();
  } catch (error) {
    writeCors(req, res);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Proxy error" }));
  }
});

server.listen(port, host, () => {
  console.log(`Document AI dev proxy listening on http://${host}:${port}`);
});

function writeCors(req, res) {
  const origin = req.headers.origin;
  if (
    typeof origin === "string" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  ) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Provider-Base-Url");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
}

function proxyResponseHeaders(headers) {
  const next = {};
  const blocked = new Set([
    "connection",
    "content-encoding",
    "content-length",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]);

  for (const [key, value] of headers.entries()) {
    if (!blocked.has(key.toLowerCase())) {
      next[key] = value;
    }
  }

  return next;
}
