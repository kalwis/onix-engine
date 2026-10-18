import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve("demo");
const files: Record<string, [string, string]> = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/demo.css": ["demo.css", "text/css; charset=utf-8"],
  "/demo.js": ["dist/main.js", "text/javascript; charset=utf-8"],
};
const serve = async (request: import("node:http").IncomingMessage, response: import("node:http").ServerResponse) => {
  const path = new URL(request.url ?? "/", "http://localhost").pathname;
  const file = files[path];
  if (!file) { response.writeHead(404).end("Not found"); return; }
  try {
    const content = await readFile(resolve(root, file[0]));
    response.writeHead(200, { "content-type": file[1] }).end(content);
  } catch {
    response.writeHead(404).end("Demo bundle missing; run pnpm demo first.");
  }
};
const firstPort = Number(process.env.PORT ?? 4173);
const lastPort = firstPort + 20;
const listen = (port: number) => {
  const server = createServer(serve);
  server.once("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE" && port < lastPort) {
      console.log(`Port ${port} is in use; trying ${port + 1}.`);
      listen(port + 1);
      return;
    }
    console.error(`Could not start the ONIX demo server on port ${port}: ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => console.log(`ONIX demo: http://localhost:${port}`));
};
listen(firstPort);
