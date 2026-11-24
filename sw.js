/* Service worker do Calendarium: guarda os arquivos do app para abrir offline e permitir a instalação.
   Para publicar uma atualização, aumente VERSAO. */
const VERSAO = 'calendarium-v1';
const ARQUIVOS = ['./', 'app.js', 'astral.css', 'astral.js', 'calendarium.css', 'favicon-16.png', 'favicon-32.png', 'favicon-48.png', 'favicon.ico', 'festas.js', 'hinos-orficos.js', 'icone-lira-180.png', 'icone-lira-192.png', 'icone-lira-512.png', 'icone-lira-maskable-512.png', 'index.html', 'liturgy.js', 'lunar.js', 'manifest.webmanifest', 'mansoes-lunares.js', 'mansoes.css', 'ouranos-data.js', 'ouranos.js', 'store.js', 'teurgica.css', 'teurgica.js', 'versos-aureos.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => Promise.all(ARQUIVOS.map((u) => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSAO).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mesmaOrigem = url.origin === self.location.origin;
  const fonte = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!mesmaOrigem && !fonte) return;
  if (req.mode === 'navigate') {            /* páginas: rede primeiro (pega atualizações), cache se estiver offline */
    e.respondWith(fetch(req).then((r) => { const cp = r.clone(); caches.open(VERSAO).then((c) => c.put('index.html', cp)); return r; })
      .catch(() => caches.match('index.html').then((r) => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => {   /* resto: cache primeiro e atualiza em segundo plano */
    const rede = fetch(req).then((r) => { if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(VERSAO).then((c) => c.put(req, cp)); } return r; }).catch(() => hit);
    return hit || rede;
  }));
});
