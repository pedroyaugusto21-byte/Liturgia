/* Teste de TELA da ETAPA D (Importar backup), em Chromium real via Playwright.
   Uso:  node tests/teste-importar-e2e.js        (precisa de "npm install" e dos navegadores do Playwright)
   O login não é usado: nuvem.js é trocado por um stub que diz "conectado" e deixa o teste ligar/desligar
   "sincronizando"; o restante do app (conta.js, store.js, importar.js, teurgica.js) é o código real.
   Cobre: fluxo completo (prévia → mesclar/substituir), cancelar/Esc, foco, rótulos acessíveis, textContent
   (HTML no arquivo/nome do arquivo não executa), arquivo inválido, botão bloqueado durante sincronização,
   reset ao sair da conta, celular 360 px sem rolagem horizontal, fila de sincronização recebendo as gravações. */
const http = require('http');
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const RAIZ = path.join(__dirname, '..');
const R = [];
const ok = (n, c, d) => R.push((c ? 'OK      ' : 'FALHOU  ') + n + (!c && d !== undefined ? '  [' + JSON.stringify(d) + ']' : ''));
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

const STUB_NUVEM = `
(function () {
  var E = { fase: 'logado', usuario: { uid: 'u1', email: 'pedro@exemplo.com' }, sincronizando: false, pendencias: 0, ultimoSync: null, erro: null, offline: false, decisao: null };
  var ouv = [];
  window.__nuvem = { E: E, notificar: function () { var c = JSON.parse(JSON.stringify(E)); ouv.forEach(function (f) { f(c); }); } };
  window.__fila = [];
  window.CalendariumNuvem = { disponivel: true, estado: function () { return JSON.parse(JSON.stringify(E)); }, onEstado: function (f) { ouv.push(f); }, sincronizar: function () { return Promise.resolve({ ok: true, enviados: 0, recebidos: 0 }); }, sair: function () { return Promise.resolve({ ok: true }); }, decidir: function () { return Promise.resolve({ ok: true }); } };
  window.addEventListener('load', function () { window.CalendariumStore.onChange(function (ev) { window.__fila.push(ev.nome + ':' + ev.op + ':' + ev.chave); }); });
  window.__eventos = [];
  window.addEventListener('calendarium:nuvem-dados', function (ev) { window.__eventos.push(ev.detail); });
})();`;

const T1 = '2026-11-01T10:00:00.000Z', T2 = '2026-11-02T10:00:00.000Z', T3 = '2026-11-03T10:00:00.000Z';
const dia = (data, texto, salvoEm) => ({ data, id: 'd' + data, texto, clima: { amanhecer: [], entardecer: [], noite: [] }, photagogia: false, criadoEm: T1, salvoEm });
const festa = (id, data, nome) => ({ id, data, nome, descricao: '', criadoEm: 1700000000000 });
const arq = (stores) => JSON.stringify({ app: 'calendarium', versao: 1, exportadoEm: '2026-11-20T12:00:00.000Z', stores: Object.assign({ festas: [], diario: [], diario_log: [] }, stores) });
const buf = (texto, nome) => ({ name: nome || 'calendarium-copia-2026-11-20.json', mimeType: 'application/json', buffer: Buffer.from(texto, 'utf8') });

(async () => {
  const servidor = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]); const f = path.join(RAIZ, u === '/' ? 'index.html' : u);
    if (!f.startsWith(RAIZ) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  const URL_BASE = 'http://127.0.0.1:' + servidor.address().port + '/';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1000, height: 900 }, locale: 'pt-BR' });
  await ctx.route('**/nuvem.js', (r) => r.fulfill({ contentType: 'text/javascript', body: STUB_NUVEM }));
  await ctx.route(/gstatic|googleapis/, (r) => r.abort());
  const page = await ctx.newPage();
  const errosPagina = [];
  page.on('pageerror', (e) => errosPagina.push(String(e)));
  page.on('dialog', (d) => d.dismiss());

  const abrirCartao = async () => {
    await page.goto(URL_BASE);
    await page.click('#chooseTeurgica');
    await page.waitForSelector('#teuContaBtn');
    await page.click('#teuContaBtn');
    await page.waitForSelector('#teuContaImportar', { state: 'visible' });
  };
  const semear = () => page.evaluate(async () => {
    const S = window.CalendariumStore; await S.ready();
    for (const d of await S.getAll('diario')) await S.delete('diario', d.data, { silencioso: true });
    for (const f of await S.getAll('festas')) await S.delete('festas', f.id, { silencioso: true });
    for (const l of await S.getAll('diario_log')) await S.delete('diario_log', l.seq, { silencioso: true });
    const dia = (data, texto, salvoEm) => ({ data, id: 'd' + data, texto, clima: { amanhecer: [], entardecer: [], noite: [] }, photagogia: false, criadoEm: '2026-11-01T10:00:00.000Z', salvoEm });
    await S.put('diario', dia('2026-11-01', 'local novo', '2026-11-02T10:00:00.000Z'), { silencioso: true });
    await S.put('diario', dia('2026-11-02', 'local velho', '2026-11-01T10:00:00.000Z'), { silencioso: true });
    await S.put('diario', dia('2026-11-04', 'só aqui', '2026-11-01T10:00:00.000Z'), { silencioso: true });
    window.__fila.length = 0; window.__eventos.length = 0;
  });
  const lerDias = () => page.evaluate(async () => (await window.CalendariumStore.getAll('diario')).map((d) => d.data + '=' + d.texto));
  const escolher = async (b) => { const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#teuContaImportar')]); await fc.setFiles(b); };
  const texto = (sel) => page.locator(sel).innerText();

  const base = arq({ diario: [dia('2026-11-01', 'arquivo velho', T1), dia('2026-11-02', 'arquivo novo', T3), dia('2026-11-03', 'inédito', T1)], festas: [festa('fb', '2026-12-31', 'Réveillon')] });

  /* ---------- 1. prévia ---------- */
  await abrirCartao(); await semear();
  ok('botão "Importar backup" aparece ao lado de "Baixar backup" (conectado)', (await page.locator('#teuContaAcoes button').allInnerTexts()).join('|') === 'Sincronizar agora|Baixar backup|Importar backup|Sair');
  ok('o input de arquivo é escondido e só aceita .json', await page.locator('#teuContaArquivo').evaluate((e) => e.hidden && e.accept === 'application/json,.json'));
  await escolher(buf(base));
  await page.waitForSelector('#teuContaImpBloco', { state: 'visible' });
  const lista = await page.locator('#teuContaImpLista li').allInnerTexts();
  ok('prévia lista dias e festas com novos / mais recentes / já aqui', /^3 dias de diário no backup: 1 novo\(s\), 1 mais recente\(s\) que o daqui, 1 já aqui/.test(lista[0]) && /^1 festa pessoal no backup: 1 nova\(s\), 0 já aqui/.test(lista[1]), lista);
  ok('foco vai para o título do bloco (leitor de tela anuncia o grupo)', await page.evaluate(() => document.activeElement && document.activeElement.id === 'teuContaImpH'));
  ok('o grupo tem nome acessível e mostra o nome do arquivo e a data do backup', (await page.getByRole('group', { name: 'Importar backup' }).count()) === 1 && /calendarium-copia-2026-11-20\.json.*20\/11\/2026/.test(await texto('#teuContaImpArq')));
  ok('os botões de ação normais ficam escondidos durante a escolha', await page.locator('#teuContaAcoes').evaluate((e) => e.hidden));
  ok('Mesclar vem marcado, aviso diz que nada será apagado', (await page.getByRole('radio', { name: /Mesclar/ }).isChecked()) && /Nada do que já está aqui será apagado/.test(await texto('#teuContaImpAviso')));
  ok('o grupo de rádios tem nome ("Como importar") e dois rádios nomeados', (await page.getByRole('group', { name: 'Como importar' }).count()) === 1 && (await page.getByRole('radio').count()) === 2);
  ok('NADA foi gravado só por mostrar a prévia', (await lerDias()).join('|') === '2026-11-01=local novo|2026-11-02=local velho|2026-11-04=só aqui');
  await page.screenshot({ path: path.join(require('os').tmpdir(), 'calendarium-previa-mesclar.png'), fullPage: false });

  /* ---------- 2. modo substituir: aviso e botão mudam ---------- */
  await page.getByRole('radio', { name: /Substituir/ }).check();
  const aviso = await texto('#teuContaImpAviso');
  ok('substituir: aviso diz o que sai (1 dia), que sai também da conta, e que não dá para desfazer', /1 dia de diário/.test(aviso) && /sairá da sua conta/.test(aviso) && /não pode ser desfeito/.test(aviso), aviso);
  ok('substituir: botão principal vira "Substituir tudo"', (await page.locator('#teuContaImpAcoes button').first().innerText()) === 'Substituir tudo');
  /* teclado: seta troca o rádio; foco visível no rádio */
  await page.getByRole('radio', { name: /Mesclar/ }).focus();
  await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  const foco = await page.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); return { tag: a.tagName, tipo: a.type, fv: a.matches(':focus-visible'), outline: cs.outlineStyle, w: cs.outlineWidth }; });
  ok('foco por teclado no rádio é visível (outline sólido)', foco.tag === 'INPUT' && foco.fv && foco.outline !== 'none' && parseFloat(foco.w) >= 2, foco);
  await page.keyboard.press('ArrowUp');
  ok('seta ↑ volta para Mesclar e o botão volta a "Mesclar"', (await page.getByRole('radio', { name: /Mesclar/ }).isChecked()) && (await page.locator('#teuContaImpAcoes button').first().innerText()) === 'Mesclar');

  /* ---------- 3. Esc cancela e devolve o foco ---------- */
  await page.keyboard.press('Escape');
  ok('Esc cancela: bloco some, botões voltam, foco volta em "Importar backup", nada gravado', await page.locator('#teuContaImpBloco').isHidden() && await page.locator('#teuContaAcoes').isVisible() && await page.evaluate(() => document.activeElement.id === 'teuContaImportar') && /cancelada/.test(await texto('#teuContaMsg')) && (await lerDias()).length === 3);
  ok('o cartão da conta continua aberto depois do Esc (Esc só fecha a importação)', await page.locator('#teuContaPainel').isVisible());

  /* ---------- 4. mesclar ---------- */
  await escolher(buf(base)); await page.waitForSelector('#teuContaImpBloco', { state: 'visible' });
  await page.getByRole('button', { name: 'Mesclar', exact: true }).click();
  await page.waitForFunction(() => /Backup importado/.test(document.getElementById('teuContaMsg').textContent));
  ok('mesclar: mensagem de resultado em região aria-live', /Backup importado \(mesclar\): 2 dias gravados, 1 festa gravada, 0 registros de horário gravados\. 1 dia ficou como estava/.test(await texto('#teuContaMsg')) && (await page.locator('#teuContaMsg').getAttribute('aria-live')) === 'polite', await texto('#teuContaMsg'));
  ok('regra do salvoEm na tela: 01 fica local, 02 vira arquivo, 03 entra, 04 intacto', (await lerDias()).join('|') === '2026-11-01=local novo|2026-11-02=arquivo novo|2026-11-03=inédito|2026-11-04=só aqui', await lerDias());
  ok('foco volta para "Importar backup" e o bloco fecha', await page.locator('#teuContaImpBloco').isHidden() && await page.evaluate(() => document.activeElement.id === 'teuContaImportar'));
  const fila = await page.evaluate(() => window.__fila.slice());
  ok('a fila de sincronização recebeu as gravações (2 dias + 1 festa)', fila.filter((x) => x.startsWith('diario:put')).length === 2 && fila.filter((x) => x.startsWith('festas:put')).length === 1, fila);
  const ev = await page.evaluate(() => window.__eventos.slice());
  ok('as telas receberam o aviso de dados novos (origem importacao)', ev.length === 1 && ev[0].origem === 'importacao' && ev[0].festas === true, ev);

  /* ---------- 5. substituir ---------- */
  await semear();
  await escolher(buf(base)); await page.waitForSelector('#teuContaImpBloco', { state: 'visible' });
  await page.getByRole('radio', { name: /Substituir/ }).check();
  await page.getByRole('button', { name: 'Substituir tudo' }).click();
  await page.waitForFunction(() => /Backup importado/.test(document.getElementById('teuContaMsg').textContent));
  ok('substituir: aparelho fica igual ao arquivo (01 vira "arquivo velho"; 04 apagado)', (await lerDias()).join('|') === '2026-11-01=arquivo velho|2026-11-02=arquivo novo|2026-11-03=inédito', await lerDias());
  ok('substituir: mensagem informa o que foi apagado', /substituir.*1 item apagado deste aparelho/.test(await texto('#teuContaMsg')), await texto('#teuContaMsg'));
  ok('substituir: a exclusão do dia 04 entrou na fila da nuvem', (await page.evaluate(() => window.__fila.slice())).indexOf('diario:delete:2026-11-04') >= 0);

  /* ---------- 6. arquivos ruins ---------- */
  await semear();
  const casos = [['não é JSON', buf('oi, sou um texto'), /JSON válido/], ['de outro app', buf('{"app":"x","stores":{}}'), /não parece ser um backup/], ['vazio', buf(''), /vazio/], ['versão futura', buf(JSON.stringify({ app: 'calendarium', versao: 9, stores: {} })), /versão mais nova/], ['só lixo', buf(arq({ diario: [{ data: 'x' }] })), /Nenhum registro válido/]];
  for (const [nome, b, re] of casos) {
    await escolher(b); await page.waitForFunction(() => document.getElementById('teuContaErro').textContent.length > 0);
    const t = await texto('#teuContaErro');
    ok('arquivo ruim (' + nome + '): erro claro em role=alert, sem prévia, nada gravado', re.test(t) && (await page.locator('#teuContaErro').getAttribute('role')) === 'alert' && await page.locator('#teuContaImpBloco').isHidden() && (await lerDias()).length === 3, t);
  }

  /* ---------- 7. HTML no arquivo e no NOME do arquivo é só texto ---------- */
  const xss = arq({ diario: [dia('2026-11-10', '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>', T1)], festas: [festa('fx', '2026-12-01', '<img src=x onerror="window.__xss=3">')] });
  await escolher(buf(xss, '<img src=x onerror=window.__xss=4>.json')); await page.waitForSelector('#teuContaImpBloco', { state: 'visible' });
  ok('nome de arquivo com HTML aparece como texto na prévia', (await texto('#teuContaImpArq')).indexOf('<img src=x onerror=window.__xss=4>.json') >= 0 && (await page.locator('#teuContaImpBloco img').count()) === 0);
  await page.getByRole('button', { name: 'Mesclar', exact: true }).click(); await page.waitForFunction(() => /Backup importado/.test(document.getElementById('teuContaMsg').textContent));
  await page.waitForTimeout(300);
  ok('nada do arquivo executou (window.__xss indefinido) e o texto ficou intacto no banco', (await page.evaluate(() => window.__xss)) === undefined && (await lerDias()).some((d) => d.startsWith('2026-11-10=<img src=x onerror="window.__xss=1">')));

  /* ---------- 8. sincronizando: botão bloqueado; sair da conta com a prévia aberta ---------- */
  await page.evaluate(() => { window.__nuvem.E.sincronizando = true; window.__nuvem.notificar(); });
  ok('durante a sincronização o botão "Importar backup" fica desabilitado', await page.locator('#teuContaImportar').isDisabled());
  await page.evaluate(() => { window.__nuvem.E.sincronizando = false; window.__nuvem.notificar(); });
  ok('...e volta ao terminar', await page.locator('#teuContaImportar').isEnabled());
  await escolher(buf(base)); await page.waitForSelector('#teuContaImpBloco', { state: 'visible' });
  await page.evaluate(() => { window.__nuvem.E.sincronizando = true; window.__nuvem.notificar(); });
  await page.getByRole('button', { name: 'Mesclar', exact: true }).click();
  await page.waitForFunction(() => /sincronização está em andamento/.test(document.getElementById('teuContaErro').textContent));
  ok('confirmar durante uma sincronização é recusado com aviso (e a prévia continua aberta)', await page.locator('#teuContaImpBloco').isVisible());
  await page.evaluate(() => { window.__nuvem.E.sincronizando = false; window.__nuvem.E.fase = 'deslogado'; window.__nuvem.notificar(); });
  ok('se a conta sai com a prévia aberta, a prévia some (plano velho não fica pendurado)', await page.locator('#teuContaImpBloco').isHidden());

  /* ---------- 9. celular 360 px ---------- */
  await page.evaluate(() => { window.__nuvem.E.fase = 'logado'; window.__nuvem.notificar(); });
  await page.setViewportSize({ width: 360, height: 740 });
  await escolher(buf(base)); await page.waitForSelector('#teuContaImpBloco', { state: 'visible' });
  const larg = await page.evaluate(() => ({ rolagem: document.documentElement.scrollWidth, janela: document.documentElement.clientWidth, bloco: document.getElementById('teuContaImpBloco').getBoundingClientRect().right }));
  ok('360 px: sem rolagem horizontal e o bloco cabe na tela', larg.rolagem <= larg.janela && larg.bloco <= larg.janela, larg);
  const alvos = await page.evaluate(() => [...document.querySelectorAll('#teuContaImpAcoes button, .teu-conta-radio')].map((e) => Math.round(e.getBoundingClientRect().height)));
  ok('alvos de toque com pelo menos 44 px de altura', alvos.every((h) => h >= 44), alvos);
  await page.screenshot({ path: path.join(require('os').tmpdir(), 'calendarium-previa-360.png') });

  /* ---------- 10. movimento: o bloco novo não cria animação; com "reduzir movimento" vale a regra global do app ---------- */
  const duracoes = () => page.evaluate(() => [...document.querySelectorAll('#teuContaImpBloco, #teuContaImpBloco *')].map((e) => { const c = getComputedStyle(e); return { t: e.tagName + '.' + e.className, trans: Math.max(...c.transitionDuration.split(',').map(parseFloat)), anim: c.animationName === 'none' ? 0 : Math.max(...c.animationDuration.split(',').map(parseFloat)) }; }).filter((x) => x.trans > 0.001 || x.anim > 0.001));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const normal = await duracoes();
  ok('sem preferência de movimento: nada no bloco de importação tem transição ou animação (não criei nenhuma)', normal.length === 0, normal);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduzido = await duracoes();
  ok('com "reduzir movimento": continua sem transição/animação perceptível (regra global do app + nada novo)', reduzido.length === 0, reduzido);

  /* BASE CONHECIDA: o zip da etapa C (sem a etapa D) já lança este erro ao abrir a aba Teúrgica; não vem do importar. Fica
     como AVISO visível, e qualquer OUTRO erro de página reprova o teste. */
  const conhecido = (e) => /Failed to execute 'arc' on 'CanvasRenderingContext2D': The radius provided \(-?\d+\) is negative/.test(e);
  const novos = errosPagina.filter((e) => !conhecido(e));
  ok('nenhum erro de JavaScript NOVO na página durante todo o teste', novos.length === 0, novos);
  if (errosPagina.some(conhecido)) R.push('AVISO   erro pré-existente (já na etapa C): canvas arc() com raio negativo ao abrir a Teúrgica — ' + errosPagina.filter(conhecido).length + ' ocorrência(s)');
  await browser.close(); servidor.close();
  console.log(R.join('\n'));
  const f = R.filter((l) => l.startsWith('FALHOU')).length;
  console.log('\n' + (f ? f + ' FALHA(S) de ' + R.length : 'TUDO OK — ' + R.length + ' verificações'));
  process.exit(f ? 1 : 0);
})().catch((e) => { console.log(R.join('\n')); console.error('ERRO NO TESTE:', e); process.exit(2); });
