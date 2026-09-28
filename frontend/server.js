import http from "node:http";

// Runtime shell only. The reviewed browser UI remains FE-01 work.
const server = http.createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }
  response.writeHead(404, { "content-type": "text/plain" });
  response.end("Frontend journeys are not implemented yet. See FE-01.");
});

server.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
function stop() {
  server.close();
  server.closeIdleConnections();
}
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
