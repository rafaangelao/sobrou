import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const raiz = normalize(join(import.meta.dirname, ".."));
const porta = Number(process.env.PORT) || 4173;
const tipos = { ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json", ".css":"text/css" };

http.createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const arq = normalize(join(raiz, p));
  if (!arq.startsWith(raiz)) { res.writeHead(403).end(); return; }
  try {
    const dados = await readFile(arq);
    res.writeHead(200, { "content-type": tipos[extname(arq)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(dados);
  } catch { res.writeHead(404).end("não achei"); }
}).listen(porta, () => console.log("http://localhost:" + porta));
