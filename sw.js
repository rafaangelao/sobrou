/* Deixa o painel abrir sem internet.
   Arquivos do próprio site: tenta a rede primeiro (assim cada versão nova chega
   na hora) e só usa a cópia guardada quando está offline.
   Fontes e a biblioteca do Supabase: têm versão fixa, então a cópia guardada vale.
   O que vai para o Supabase (dados e login) nunca passa por aqui. */
const CACHE = "painel-v4";
const BASE = [
  "/", "/manifest.webmanifest",
  "/js/painel.js", "/js/base.js", "/js/config.js", "/js/fixas.js", "/js/juntar.js",
  "/js/nuvem.js", "/js/pareamento.js", "/js/rapido.js", "/js/sincronia.js",
  "/js/formato.js", "/js/raiox.js", "/js/icones.js", "/js/navegacao.js", "/js/movimento.js",
  "/js/telas/inicio.js", "/js/telas/extrato.js", "/js/telas/mais.js", "/js/telas/periodo.js",
  "/icones/apple-touch-icon.png", "/icones/icone-192.png", "/icones/favicon.png",
];
const FIXOS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com", "https://esm.sh"];

self.addEventListener("install", ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith("painel-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === location.origin){
    ev.respondWith(redePrimeiro(req, req.mode === "navigate"));
  } else if (FIXOS.includes(url.origin)){
    ev.respondWith(guardadoPrimeiro(req));
  }
});

async function redePrimeiro(req, navegacao){
  const cache = await caches.open(CACHE);
  try {
    const resp = await fetch(req);
    if (resp.ok) cache.put(navegacao ? "/" : req, resp.clone());
    return resp;
  } catch {
    const guardado = await cache.match(navegacao ? "/" : req, { ignoreSearch: navegacao });
    return guardado || Response.error();
  }
}

async function guardadoPrimeiro(req){
  const cache = await caches.open(CACHE);
  const guardado = await cache.match(req);
  if (guardado) return guardado;
  const resp = await fetch(req);
  if (resp.ok || resp.type === "opaque") cache.put(req, resp.clone());
  return resp;
}
