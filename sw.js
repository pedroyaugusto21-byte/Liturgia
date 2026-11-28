/* Service worker do Calendarium: guarda os arquivos do app para abrir offline e permitir a instalação.
   VERSAO e ARQUIVOS são GERADOS por scripts/gerar-sw.js (npm run gerar-sw). Para publicar uma atualização,
   rode o script depois de editar o site: a versão muda sozinha quando qualquer arquivo do cache muda.
   Fluxo de atualização: ver atualizacao.js (aviso "Há uma atualização disponível. Recarregar"). */
/* @gerado-inicio — não edite à mão; rode: npm run gerar-sw */
const VERSAO = 'calendarium-73bf49c05f';
const ARQUIVOS = ['./', 'app.js', 'astral-calc.js', 'astral-vista.js', 'astral.css', 'astral.js', 'atualizacao.css', 'atualizacao.js', 'calendarium.css', 'cofre-ui.js', 'conta.js', 'cripto.js', 'favicon-16.png', 'favicon-32.png', 'favicon-48.png', 'favicon.ico', 'festas.js', 'firebase-config.js', 'hinos-orficos.js', 'icone-lira-180.png', 'icone-lira-192.png', 'icone-lira-512.png', 'icone-lira-maskable-512.png', 'importar.js', 'index.html', 'liturgy.js', 'lunar.js', 'manifest.webmanifest', 'mansoes-dados.js', 'mansoes-lunares.js', 'mansoes.css', 'nuvem.js', 'ouranos-calc.js', 'ouranos-data.js', 'ouranos.js', 'redimensionar.js', 'store.js', 'teurgica-dados.js', 'teurgica-relatorio-calc.js', 'teurgica.css', 'teurgica.js', 'versos-aureos.js'];
/* @gerado-fim */

/* Atualização com aviso: o install NÃO chama skipWaiting(). Uma versão nova fica "em espera" até a pessoa
   aceitar o aviso (atualizacao.js envia SKIP_WAITING) ou até todas as janelas do app serem fechadas.
   Na primeira instalação (sem versão anterior) não há espera: o worker ativa sozinho. */
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => Promise.all(ARQUIVOS.map((u) => c.add(u).catch(() => {})))));
});
/* mensagens vindas da página:
   · {type:'SKIP_WAITING'} → ativa já esta versão (a página recarrega quando o controllerchange chegar)
   · {type:'VERSAO'}       → responde com a VERSAO pela porta enviada (usado só nos testes e para diagnóstico) */
self.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  if (d.type === 'SKIP_WAITING') self.skipWaiting();
  else if (d.type === 'VERSAO' && e.ports && e.ports[0]) e.ports[0].postMessage(VERSAO);
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
