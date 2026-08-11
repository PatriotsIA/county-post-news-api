import { createServer } from "node:http";
import type { IncomingHttpHeaders } from "node:http";
import { config } from "./config.js";
import { handleRequest } from "./http.js";

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const body = await readBody(request);
  const apiResponse = await handleRequest({
    method: request.method || "GET",
    path: url.pathname,
    query: url.searchParams,
    headers: normalizeHeaders(request.headers),
    body,
    remoteAddress: request.socket.remoteAddress,
  });

  response.writeHead(apiResponse.statusCode, apiResponse.headers);
  response.end(apiResponse.body);
});

server.listen(config.port, () => {
  console.log(`county-post-news-api listening on http://localhost:${config.port}`);
});

function normalizeHeaders(headers: IncomingHttpHeaders) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : value]),
  );
}

function readBody(request: import("node:http").IncomingMessage) {
  return new Promise<string | undefined>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;

    request.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 64 * 1024) {
        reject(new Error("Request body is too large."));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(chunks.length ? Buffer.concat(chunks).toString("utf8") : undefined));
    request.on("error", reject);
  });
}
