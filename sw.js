// Garde l'appli en cache pour qu'elle s'ouvre même sans réseau.
// Changer le numéro de version à chaque mise à jour de l'appli.
const CACHE = "avatar-v5";
const FICHIERS = ["./", "./index.html", "./app.js", "./config.js", "./app.css", "./manifest.json", "./icone-192.png", "./icone-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FICHIERS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((cles) => Promise.all(cles.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

// Réseau d'abord (pour avoir la dernière version), cache si hors ligne.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    // « no-cache » : toujours demander au serveur si le fichier a changé.
    fetch(e.request, { cache: "no-cache" })
      .then((r) => { const copie = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copie)); return r; })
      .catch(() => caches.match(e.request))
  );
});
