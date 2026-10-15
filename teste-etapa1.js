/* Teste da ETAPA 1 (fundação + festas pessoais).
   Uso:  node teste-etapa1.js <dir> [modo]
         modos: tz | festas | xss | fail | teclado | dial | todos (padrão)
         node teste-etapa1.js <dir> snap <saida.json>      (captura para regressão)
         node teste-etapa1.js comparar a.json b.json       (igualdade byte a byte)  */
const fs = require('fs');
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const [, , dirArg, modoArg = 'todos', extra] = process.argv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = [];
const ok = (n, c, d) => { R.push((c ? 'OK      ' : 'FALHOU  ') + n + (!c && d !== undefined ? '  [' + JSON.stringify(d) + ']' : '')); };
const DATAS = ['2026-03-20T10:00', '2026-10-15T03:00', '2027-01-01T18:30'];

if (dirArg === 'comparar') {
  const a = fs.readFileSync(modoArg, 'utf8'), b = fs.readFileSync(extra, 'utf8');
  const ja = JSON.parse(a), jb = JSON.parse(b); let dif = 0;
  Object.keys(ja).forEach((k) => { if (ja[k] !== jb[k]) { dif++; console.log('DIFERE: ' + k); } });
  console.log(dif === 0 && a === b ? 'OK      snapshots idênticos byte a byte (' + Object.keys(ja).length + ' capturas)' : 'FALHOU  ' + dif + ' diferença(s)');
  process.exit(dif === 0 && a === b ? 0 : 1);
}
const dir = dirArg;

(async () => {
  const browser = await chromium.launch();
  const mk = async (opts = {}, init) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Bahia', ...opts });
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
    await page.route(/^https?:/, (r) => r.abort());
    await page.goto('file://' + dir + '/index.html');
    await page.evaluate(() => { sessionStorage.setItem('calendarium.intro.visto', '1'); });
    await page.reload(); await sleep(250);
    return { ctx, page, errs };
  };
  const setDt = async (page, v) => { await page.evaluate((x) => { const d = document.getElementById('dt'); d.value = x; d.dispatchEvent(new Event('change')); }, v); await sleep(60); };
  const abrirLiturgia = async (page) => { await page.evaluate(() => Calendarium.show('sun')); await sleep(100); };

  /* ---------- snap: regressão sem festas ---------- */
  if (modoArg === 'snap') {
    const { ctx, page } = await mk(); const out = {};
    await abrirLiturgia(page);
    for (const d of DATAS) {
      await setDt(page, d);
      out['clockdiv@' + d] = await page.evaluate(() => document.getElementById('clockdiv').innerHTML);
      out['info@' + d] = await page.evaluate(() => document.getElementById('info').innerHTML);
      out['anelLunar@' + d] = await page.evaluate(() => [...document.querySelectorAll('#clockdiv svg > path')].filter((p) => /A170 170/.test(p.getAttribute('d'))).map((p) => p.outerHTML).join(''));
      await page.evaluate(() => Calendarium.show('lyra')); await sleep(60);
      out['mystList@' + d] = await page.evaluate(() => document.getElementById('mystList').innerHTML);
      out['mystClock@' + d] = await page.evaluate(() => document.getElementById('mystClockdiv').innerHTML);
      await abrirLiturgia(page);
    }
    fs.writeFileSync(extra, JSON.stringify(out, null, 1));
    console.log('snap gravado: ' + Object.keys(out).length + ' capturas'); await ctx.close(); await browser.close(); return;
  }
  const quer = (m) => modoArg === 'todos' || modoArg === m;

  /* ---------- tz: civilOfLitDay em vários fusos ---------- */
  if (quer('tz')) {
    for (const tz of ['America/Bahia', 'UTC', 'Asia/Tokyo', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago']) {
      const { ctx, page, errs } = await mk({ timezoneId: tz });
      const bad = await page.evaluate(() => {
        const K = LiturgyKit, falhas = [];
        const pad = (n) => String(n).padStart(2, '0');
        for (const [y, m, d] of [[2026, 2, 20], [2026, 9, 15], [2027, 0, 1], [2024, 1, 29], [2026, 11, 31]]) {
          for (const [h, mi, off] of [[0, 0, -1], [5, 59, -1], [6, 0, 0], [6, 1, 0], [12, 0, 0], [23, 59, 0]]) {
            const ms = new Date(y, m, d, h, mi).getTime();
            const ref = new Date(y, m, d + off);                 /* data civil do dia litúrgico esperada */
            const esp = ref.getFullYear() + '-' + pad(ref.getMonth() + 1) + '-' + pad(ref.getDate());
            const got = K.civilOfLitDay(K.litDay(ms));
            if (got !== esp) falhas.push([y, m + 1, d, h, mi, got, esp]);
          }
        }
        return falhas;
      });
      ok('tz ' + tz + ': civilOfLitDay(litDay) correto na virada das 06:00', bad.length === 0, bad.slice(0, 3));
      ok('tz ' + tz + ': sem erros', errs.length === 0, errs); await ctx.close();
    }
  }

  /* ---------- festas: adicionar / marca / linha / remover / virada 06:00 ---------- */
  if (quer('festas')) {
    const { ctx, page, errs } = await mk();
    page.on('dialog', (d) => d.accept());
    await abrirLiturgia(page);
    const sel = 'path[fill="rgba(120,160,230,.28)"]';
    await setDt(page, '2026-10-15T12:00');
    ok('festas: sem festas → sem marca azul e sem linha Festa', await page.evaluate((s) => document.querySelectorAll(s).length === 0 && !/Festa/.test(document.getElementById('info').textContent), sel));
    await page.evaluate(() => Festas.add({ data: '2026-10-15', nome: 'Noumênia de Teste', descricao: 'Descrição A' }));
    await page.evaluate(() => Festas.add({ data: '2026-09-01', nome: 'Antiga', descricao: '' }));
    await page.evaluate(() => Festas.add({ data: '2027-02-01', nome: 'Futura', descricao: 'x' }));
    await sleep(100);
    const m1 = await page.evaluate((s) => { const p = [...document.querySelectorAll(s)]; return { n: p.length, t: p.map((x) => x.querySelector('title').textContent) }; }, sel);
    ok('festas: marca azul com <title> = nome, só no dia', m1.n === 1 && m1.t[0] === 'Noumênia de Teste', m1);
    ok('festas: linha "Festa" no #info', await page.evaluate(() => { const r = [...document.querySelectorAll('#info .row')].find((x) => /Festa/.test(x.textContent)); return !!r && /Noumênia de Teste/.test(r.textContent) && /15\/10\/2026/.test(r.textContent); }));
    /* a marca coincide com a célula do dia ativo (mesmo setor) e fica POR CIMA do realce dourado */
    const geo = await page.evaluate((s) => {
      const todos = [...document.querySelectorAll('#clockdiv svg > path')];
      const marca = todos.find((p) => p.matches(s));
      const ativo = todos.find((p) => p.getAttribute('fill') === 'rgba(227,194,122,0.18)' && /A170 170/.test(p.getAttribute('d')));
      return { mesmaCelula: !!marca && !!ativo && marca.getAttribute('d') === ativo.getAttribute('d'), acima: todos.indexOf(marca) > todos.indexOf(ativo), dourado: !!ativo };
    }, sel);
    ok('festas: marca sobre a célula do dia lunar ativo, acima do realce dourado (que permanece)', geo.mesmaCelula && geo.acima && geo.dourado, geo);
    /* virada das 06:00 */
    const marca = async (dt) => { await setDt(page, dt); return page.evaluate((s) => document.querySelectorAll(s).length + '|' + /Festa/.test(document.getElementById('info').textContent), sel); };
    ok('06:00 virada: 14/10 23:59 sem marca', await marca('2026-10-14T23:59') === '0|false');
    ok('06:00 virada: 15/10 05:59 sem marca (ainda é o dia litúrgico de 14/10)', await marca('2026-10-15T05:59') === '0|false');
    ok('06:00 virada: 15/10 06:00 com marca', await marca('2026-10-15T06:00') === '1|true');
    ok('06:00 virada: 16/10 05:59 ainda com marca', await marca('2026-10-16T05:59') === '1|true');
    ok('06:00 virada: 16/10 06:00 sem marca', await marca('2026-10-16T06:00') === '0|false');
    await setDt(page, '2026-10-15T12:00');
    /* aba 4 */
    await page.evaluate(() => Calendarium.show('lyra')); await sleep(80);
    const lista = await page.evaluate(() => [...document.querySelectorAll('#mystLocal .festa-item')].map((i) => ({ n: i.querySelector('h3').childNodes[0].textContent.trim(), d: i.querySelector('.myst-date').textContent, past: i.classList.contains('festa-past') })));
    ok('aba 4: três festas em ordem de data, formato dd/mm/aaaa', lista.map((x) => x.n).join('|') === 'Antiga|Noumênia de Teste|Futura' && /01\/09\/2026/.test(lista[0].d) && /15\/10\/2026/.test(lista[1].d), lista);
    ok('aba 4: só a passada é esmaecida (e rotulada "passada")', lista[0].past && !lista[1].past && !lista[2].past && /passada/.test(lista[0].d), lista);
    ok('aba 4: anel dos Mistérios NÃO recebe a marca azul', await page.evaluate((s) => document.querySelectorAll('#mystClockdiv ' + s).length === 0, sel));
    ok('aba 4: botão × com aria-label "Remover festa X"', await page.evaluate(() => [...document.querySelectorAll('#mystLocal .festa-del')].map((b) => b.getAttribute('aria-label')).join('|')) === 'Remover festa Antiga|Remover festa Noumênia de Teste|Remover festa Futura');
    ok('aba 4: #mystLocal fica entre .myst-list e .myst-ritual', await page.evaluate(() => { const l = document.getElementById('mystList'); return l.nextElementSibling.id === 'mystLocal' && document.getElementById('mystLocal').nextElementSibling.classList.contains('myst-ritual'); }));
    /* remover (com confirmação: recusar e aceitar) */
    page.removeAllListeners('dialog'); page.once('dialog', (d) => d.dismiss());
    await page.click('#mystLocal .festa-del[aria-label="Remover festa Antiga"]'); await sleep(80);
    ok('remover: confirmação recusada mantém a festa', await page.evaluate(() => Festas.list().length) === 3);
    page.once('dialog', (d) => d.accept());
    await page.click('#mystLocal .festa-del[aria-label="Remover festa Antiga"]'); await sleep(80);
    ok('remover: confirmação aceita remove e foco vai ao título da seção', await page.evaluate(() => Festas.list().length === 2 && document.activeElement.tagName === 'H2' && document.activeElement.closest('#mystLocal') !== null));
    await page.evaluate(() => Festas.list().forEach((f) => Festas.remove(f.id))); await sleep(80);
    await abrirLiturgia(page);
    ok('remover tudo: some a marca e a linha', await page.evaluate((s) => document.querySelectorAll(s).length === 0 && !/Festa/.test(document.getElementById('info').textContent), sel));
    await page.evaluate(() => Calendarium.show('lyra')); await sleep(60);
    ok('vazio: mensagem orientando o uso de "Personalizar"', await page.evaluate(() => document.getElementById('mystLocal').textContent.includes('Nenhuma festa pessoal registrada. Use "Personalizar" na aba Liturgia.')));
    /* persistência: IndexedDB */
    await page.evaluate(() => Festas.add({ data: '2026-10-20', nome: 'Persistente', descricao: 'sobrevive ao reload' })); await sleep(300);
    const be = await page.evaluate(() => CalendariumStore.ready());
    await page.reload(); await sleep(500);
    ok('persistência (' + be + '): festa volta após recarregar, aba 4 re-renderizada', await page.evaluate(() => Festas.list().some((f) => f.nome === 'Persistente')) && await page.evaluate(() => /Persistente/.test(document.getElementById('mystLocal').textContent)));
    /* store: exportar / importar */
    const exp = await page.evaluate(async () => { const e = await CalendariumStore.exportAll(); return { chaves: Object.keys(e.stores).join(','), nf: e.stores.festas.length, app: e.app }; });
    ok('store: exportAll devolve os 3 stores (festas, diario, diario_log)', exp.chaves === 'festas,diario,diario_log' && exp.nf === 1 && exp.app === 'calendarium', exp);
    const imp = await page.evaluate(async () => {
      const a = await CalendariumStore.importAll({ app: 'calendarium', versao: 1, stores: { festas: [{ id: 'imp1', data: '2026-01-01', nome: 'Importada' }, { id: '', nome: 'inválida' }], diario: [{ data: '2026-10-15', texto: 'oi' }, { data: 'x' }], diario_log: [{ acao: 'a' }, { acao: 'b' }] } });
      const b = await CalendariumStore.importAll('lixo');
      const log = await CalendariumStore.getAll('diario_log'); const d = await CalendariumStore.get('diario', '2026-10-15');
      return { a, b: b.ok, seqs: log.map((x) => x.seq).join(','), d: d && d.texto };
    });
    ok('store: importAll valida e importa; diario_log com autoincremento; JSON inválido → {ok:false}', imp.a.ok && imp.a.importados.festas === 1 && imp.a.ignorados.festas === 1 && imp.a.importados.diario === 1 && imp.seqs === '1,2' && imp.d === 'oi' && imp.b === false, imp);
    ok('festas: sem erros no console', errs.length === 0, errs); await ctx.close();
  }

  /* ---------- xss ---------- */
  if (quer('xss')) {
    const { ctx, page, errs } = await mk(); page.on('dialog', (d) => d.accept());
    const NOME = '<img src=x onerror=window.__pwn=1> "aspas" \'simples\' &amp; <b>x</b>';
    const DESC = '</p><script>window.__pwn=2<\/script><img src=x onerror=window.__pwn=3> &lt;i&gt; "q"';
    await abrirLiturgia(page);
    await setDt(page, '2026-10-15T12:00');
    await page.click('#btnPersonalizar'); await sleep(100);
    await page.fill('#festaNome', NOME.slice(0, 60)); await page.fill('#festaDesc', DESC);
    await page.click('#festaDialog .festa-btn-ok'); await sleep(200);
    const esperado = NOME.slice(0, 60);
    const r = await page.evaluate(() => ({
      info: document.getElementById('info').innerHTML, svg: document.getElementById('clockdiv').innerHTML,
      pwn: window.__pwn, imgs: document.querySelectorAll('#info img, #clockdiv img, #mystLocal img').length,
      bs: document.querySelectorAll('#info b, #mystLocal b, #mystLocal script').length,
    }));
    await page.evaluate(() => Calendarium.show('lyra')); await sleep(100);
    const r2 = await page.evaluate(() => ({
      pwn: window.__pwn, imgs: document.querySelectorAll('#mystLocal img').length, scripts: document.querySelectorAll('#mystLocal script').length, bs: document.querySelectorAll('#mystLocal b').length,
      h3: document.querySelector('#mystLocal .festa-item h3').childNodes[0].textContent.trim(), p: document.querySelector('#mystLocal .festa-item p').textContent,
      label: document.querySelector('#mystLocal .festa-del').getAttribute('aria-label'), attrs: [...document.querySelectorAll('#mystLocal .festa-item, #mystLocal .festa-item *')].some((el) => [...el.attributes].some((a) => /^on/i.test(a.name))),
    }));
    ok('xss: nada executa (window.__pwn indefinido) nas abas 1 e 4', r.pwn === undefined && r2.pwn === undefined, [r.pwn, r2.pwn]);
    ok('xss: nenhum <img>/<b>/<script> criado em #info, anel e #mystLocal', r.imgs === 0 && r.bs === 0 && r2.imgs === 0 && r2.scripts === 0 && r2.bs === 0, [r, r2]);
    ok('xss: nome aparece literalmente (inclusive "&amp;" e aspas)', r2.h3.replace(/\s+/g, ' ') === esperado.replace(/\s+/g, ' ').trim(), [r2.h3, esperado]);
    ok('xss: descrição literal; aria-label e atributos intactos', r2.p === DESC.trim() && r2.label === 'Remover festa ' + esperado.trim() && r2.attrs === false, r2);
    ok('xss: <title> do anel contém o texto escapado', r.svg.includes('&lt;img src=x onerror=window.__pwn=1&gt;'));
    await page.reload(); await sleep(500);
    ok('xss: após recarregar (hidratação) continua inerte', await page.evaluate(() => window.__pwn === undefined && document.querySelectorAll('#mystLocal img').length === 0));
    /* importação com id malicioso é descartada */
    await page.evaluate(() => CalendariumStore.importAll({ app: 'calendarium', versao: 1, stores: { festas: [{ id: '"><img src=x onerror=window.__pwn=9>', data: '2026-10-15', nome: 'mau' }] } }));
    await page.reload(); await sleep(500);
    ok('xss: id malicioso vindo do store é rejeitado na hidratação', await page.evaluate(() => !Festas.list().some((f) => f.nome === 'mau') && window.__pwn === undefined));
    ok('xss: sem erros', errs.length === 0, errs); await ctx.close();
  }

  /* ---------- fail: sem IndexedDB e sem showModal ---------- */
  if (quer('fail')) {
    const semIDB = () => { try { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); } catch (e) {} try { HTMLDialogElement.prototype.showModal = undefined; } catch (e) {} };
    const semTudo = () => { try { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); } catch (e) {} try { HTMLDialogElement.prototype.showModal = undefined; } catch (e) {} try { Object.defineProperty(window, 'localStorage', { get() { throw new Error('bloqueado'); }, configurable: true }); } catch (e) {} };
    for (const [nome, init, esperaBe] of [['sem IndexedDB e sem showModal', semIDB, 'localStorage'], ['sem IndexedDB, sem localStorage e sem showModal', semTudo, 'memoria']]) {
      const { ctx, page, errs } = await mk({}, init);
      await abrirLiturgia(page); await setDt(page, '2026-10-15T12:00');
      const be = await page.evaluate(() => CalendariumStore.ready());
      ok('fail (' + nome + '): backend = ' + esperaBe, be === esperaBe, be);
      await page.focus('#btnPersonalizar'); await page.keyboard.press('Enter'); await sleep(100);
      const est = await page.evaluate(() => { const d = document.getElementById('festaDialog'); return { tag: d.tagName, vis: getComputedStyle(d).display !== 'none' && !d.hidden, foco: document.activeElement.id, modal: d.getAttribute('aria-modal'), inert: document.getElementById('liturgyView').hasAttribute('inert') }; });
      ok('fail (' + nome + '): diálogo abre pelo fallback (div overlay, aria-modal, fundo inerte, foco no Nome)', est.tag === 'DIV' && est.vis && est.foco === 'festaNome' && est.modal === 'true' && est.inert, est);
      await page.keyboard.press('Escape'); await sleep(80);
      ok('fail (' + nome + '): Esc fecha, foco volta ao Personalizar, fundo sem inert', await page.evaluate(() => document.getElementById('festaDialog').hidden && document.activeElement.id === 'btnPersonalizar' && !document.getElementById('liturgyView').hasAttribute('inert')));
      await page.click('#btnPersonalizar'); await page.fill('#festaNome', 'Falha segura'); await page.keyboard.press('Enter'); await sleep(150);
      ok('fail (' + nome + '): festa é adicionada e a marca aparece', await page.evaluate(() => Festas.list().length === 1 && document.querySelectorAll('path[fill="rgba(120,160,230,.28)"]').length === 1));
      await page.click('#btnPersonalizar'); await page.mouse.click(4, 4); await sleep(80);
      ok('fail (' + nome + '): clique no fundo fecha', await page.evaluate(() => document.getElementById('festaDialog').hidden));
      if (esperaBe === 'localStorage') { await page.reload(); await sleep(300); ok('fail (localStorage): persiste após recarregar', await page.evaluate(() => Festas.list().some((f) => f.nome === 'Falha segura'))); }
      ok('fail (' + nome + '): ZERO erros/avisos no console', errs.length === 0, errs); await ctx.close();
    }
  }

  /* ---------- teclado + diálogo nativo ---------- */
  if (quer('teclado')) {
    const { ctx, page, errs } = await mk();
    await abrirLiturgia(page); await setDt(page, '2026-10-15T12:00');
    await page.focus('#btnPersonalizar'); await page.keyboard.press('Enter'); await sleep(150);
    const a = await page.evaluate(() => { const d = document.getElementById('festaDialog'); return { tag: d.tagName, open: d.open, foco: document.activeElement.id, lab: d.getAttribute('aria-labelledby'), pressed: document.querySelectorAll('.festa-dia[aria-pressed="true"]').length, rotulo: document.querySelector('.festa-dia[aria-pressed="true"]').getAttribute('aria-label') }; });
    ok('teclado: Enter no Personalizar abre <dialog> nativo (showModal) com foco no Nome', a.tag === 'DIALOG' && a.open && a.foco === 'festaNome' && a.lab === 'festaDialogTitle', a);
    ok('calendário: dia da tela pré-selecionado (aria-pressed) com rótulo por extenso', a.pressed === 1 && a.rotulo === 'quinta-feira, 15 de outubro de 2026', a);
    await page.keyboard.press('Shift+Tab'); await sleep(30);
    ok('Shift+Tab leva ao dia escolhido (único tabulável da grade)', await page.evaluate(() => document.activeElement.classList.contains('festa-dia') && document.activeElement.getAttribute('aria-pressed') === 'true'));
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowDown');
    const b = await page.evaluate(() => document.activeElement.getAttribute('aria-label') + '|' + document.activeElement.getAttribute('aria-pressed') + '|' + document.querySelectorAll('.festa-dia[aria-pressed="true"]').length);
    ok('setas movem o dia (→ +1, ↓ +7): 23 de outubro, sexta-feira', b === 'sexta-feira, 23 de outubro de 2026|true|1', b);
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
    ok('seta ao passar do fim do mês troca de mês (6 de novembro, mês exibido muda)', await page.evaluate(() => document.activeElement.getAttribute('aria-label') === 'sexta-feira, 6 de novembro de 2026' && document.getElementById('festaMes').textContent === 'Novembro de 2026'));
    await page.keyboard.press('PageUp'); await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
    ok('PageUp volta o mês; ← anda para trás (4 de outubro)', await page.evaluate(() => document.activeElement.getAttribute('aria-label') === 'domingo, 4 de outubro de 2026'));
    await page.keyboard.press('Tab');
    ok('Tab sai do calendário para o campo Nome', await page.evaluate(() => document.activeElement.id) === 'festaNome');
    /* envio vazio → erro acessível */
    await page.keyboard.press('Enter'); await sleep(60);
    const e = await page.evaluate(() => ({ t: document.getElementById('festaErro').textContent, inv: document.getElementById('festaNome').getAttribute('aria-invalid'), foco: document.activeElement.id, n: Festas.list().length, aberto: document.getElementById('festaDialog').open }));
    ok('nome vazio: mensagem em texto (role=alert), aria-invalid, foco no Nome, nada gravado', e.t.length > 0 && e.inv === 'true' && e.foco === 'festaNome' && e.n === 0 && e.aberto, e);
    await page.keyboard.type('Festa do Teclado'); await page.keyboard.press('Tab'); await page.keyboard.type('Linha 1'); await page.keyboard.press('Enter'); await page.keyboard.type('Linha 2');
    await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
    ok('Tab: descrição → Cancelar → Adicionar festa (ordem lógica)', await page.evaluate(() => document.activeElement.textContent) === 'Adicionar festa');
    await page.keyboard.press('Enter'); await sleep(200);
    const f = await page.evaluate(() => ({ l: Festas.list(), fechado: !document.getElementById('festaDialog').open, foco: document.activeElement.id }));
    ok('salvo só com teclado: data 04/10/2026, nome e descrição (com quebra de linha)', f.l.length === 1 && f.l[0].data === '2026-10-04' && f.l[0].nome === 'Festa do Teclado' && f.l[0].descricao === 'Linha 1\nLinha 2', f.l);
    ok('diálogo fechou e o foco voltou ao botão Personalizar', f.fechado && f.foco === 'btnPersonalizar', f);
    /* Esc, Cancelar, clique no fundo */
    for (const [nome, acao] of [['Esc', () => page.keyboard.press('Escape')], ['Cancelar', () => page.click('#festaDialog [data-act="cancelar"]')], ['clique no fundo', () => page.mouse.click(4, 4)]]) {
      await page.focus('#btnPersonalizar'); await page.keyboard.press('Enter'); await sleep(100);
      await page.fill('#festaNome', 'não salvar'); await acao(); await sleep(150);
      ok('fecha com ' + nome + ' sem gravar; foco volta ao Personalizar', await page.evaluate(() => !document.getElementById('festaDialog').open && document.activeElement.id === 'btnPersonalizar' && Festas.list().length === 1));
    }
    /* clique dentro e arrastar para fora NÃO fecha */
    await page.click('#btnPersonalizar'); await sleep(80);
    const bx = await page.evaluate(() => { const r = document.getElementById('festaNome').getBoundingClientRect(); return [r.x + 20, r.y + 10]; });
    await page.mouse.move(bx[0], bx[1]); await page.mouse.down(); await page.mouse.move(4, 4); await page.mouse.up(); await sleep(80);
    ok('arrastar texto de dentro para fora do diálogo não fecha', await page.evaluate(() => document.getElementById('festaDialog').open));
    await page.keyboard.press('Escape'); await sleep(80);
    ok('estilos do diálogo: botões com borda/cor próprias (não herdam o reset)', await page.evaluate(() => { document.getElementById('btnPersonalizar').click(); const b = document.querySelector('#festaDialog .festa-btn-ok'); const c = getComputedStyle(b); const ok = c.backgroundColor !== 'rgba(0, 0, 0, 0)' && parseFloat(c.minHeight) >= 36; document.getElementById('festaDialog').close(); return ok; }));
    ok('alvos de toque do diálogo ≥ 36 px', await page.evaluate(() => { document.getElementById('btnPersonalizar').click(); const m = [...document.querySelectorAll('#festaDialog button')].map((b) => b.getBoundingClientRect()).every((r) => r.width >= 36 && r.height >= 36); document.getElementById('festaDialog').close(); return m; }));
    await page.setViewportSize({ width: 320, height: 640 }); await sleep(100);
    ok('mobile 320 px: diálogo cabe na tela, botões ≥ 36 px', await page.evaluate(() => { document.getElementById('btnPersonalizar').click(); const d = document.getElementById('festaDialog').getBoundingClientRect(); const bs = [...document.querySelectorAll('#festaDialog button')].every((b) => { const r = b.getBoundingClientRect(); return r.width >= 36 && r.height >= 36; }); const r = d.right <= innerWidth + 0.5 && d.left >= -0.5; document.getElementById('festaDialog').close(); return r && bs && document.documentElement.scrollWidth <= innerWidth; }));
    ok('teclado: sem erros', errs.length === 0, errs); await ctx.close();
  }

  /* ---------- dial / moonInfo / armadilha dos gradientes ---------- */
  if (quer('dial')) {
    const { ctx, page, errs } = await mk(); await abrirLiturgia(page);
    const r = await page.evaluate(() => {
      const K = LiturgyKit; const out = {};
      const s1 = K.dialSVG(14.5, { id: 'a' }), s2 = K.dialSVG(6, { id: 'b' }), s3 = K.dialSVG(0);
      out.label = /aria-label="Mostrador de 24 horas, 14:30"/.test(s1) && /role="img"/.test(s1) && /viewBox="375 375 250 250"/.test(s1) && /focusable="false"/.test(s1);
      out.ids = /id="dawn-a"/.test(s1) && /url\(#dawn-a\)/.test(s1) && /id="dawn-b"/.test(s2) && !/id="dawn"/.test(s1);
      out.auto = /id="dawn-dial\d+"/.test(s3) && /24 horas, 00:00/.test(s3);
      out.ponta = /circle cx="500" cy="404"/.test(K.dialSVG(0)) || true;
      /* gradiente renderiza num SVG dentro de contêiner display:none ao lado do relógio principal? (ids distintos) */
      const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px'; box.innerHTML = s1; document.body.appendChild(box);
      const oculto = document.createElement('div'); oculto.style.display = 'none'; oculto.innerHTML = K.dialSVG(3, { id: 'a' }); document.body.appendChild(oculto);
      out.ptsDawn = box.querySelectorAll('[fill="url(#dawn-a)"]').length === 1;
      const mi = K.moonInfo(new Date(Date.UTC(2026, 9, 10, 12))), mn = K.moonInfo(Date.UTC(2000, 0, 6, 18, 30)), bad = K.moonInfo('x');
      out.moon = mi && mi.frac >= 0 && mi.frac < 1 && Math.abs(mi.elong - mi.frac * 360) < 1e-9 && typeof mi.phaseName === 'string' && mi.phaseIndex === K.PHASES.indexOf(mi.phaseName);
      out.novaRef = mn.phaseName === 'Lua Nova' && mn.age < 1;
      out.bad = bad === null;
      out.kit = ['dialSVG', 'moonInfo', 'civilOfLitDay', 'WEEK', 'PHASES', 'litDay'].every((k) => k in K);
      box.remove(); oculto.remove();
      /* dayCore padrão idêntico: relógio principal ainda usa id="dawn" */
      out.principal = document.querySelector('#clockdiv linearGradient#dawn') !== null;
      return out;
    });
    ok('dial: aria-label HH:MM, role=img, viewBox, focusable=false', r.label, r);
    ok('dial: IDs dos gradientes com sufixo (sem colisão com os do relógio)', r.ids && r.auto && r.ptsDawn, r);
    ok('moonInfo: {age,frac,elong,phaseName,phaseIndex} coerentes; Lua Nova de ref.; entrada inválida → null', r.moon && r.novaRef && r.bad, r);
    ok('LiturgyKit exporta as 6 peças; relógio principal mantém id="dawn"', r.kit && r.principal, r);
    ok('dial: sem erros', errs.length === 0, errs); await ctx.close();
  }

  console.log(R.join('\n'));
  const f = R.filter((x) => x.startsWith('FALHOU')).length;
  console.log('\n' + (R.length - f) + '/' + R.length + ' OK' + (f ? '  —  ' + f + ' FALHA(S)' : ''));
  await browser.close();
  process.exit(f ? 1 : 0);
})().catch((e) => { console.log(R.join('\n')); console.error('ERRO NO TESTE:', e); process.exit(2); });
