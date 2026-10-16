/* Teste da ETAPA 2 (aba Teúrgica: navegação, Hinário, Diário).
   Uso:  node teste-etapa2.js <dir> [modo]
         modos: nav | hinario | diario | xss | teclado | fail | timers | todos (padrão)
   (a regressão de #clockdiv/#info/#mystList usa:  node teste-etapa1.js <dir> snap <saida.json>
    e  node teste-etapa1.js comparar a.json b.json)  */
const fs = require('fs');
const path = require('path');
const { chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright');
const sharp = require('/home/claude/.npm-global/lib/node_modules/sharp');
const [, , dir, modoArg = 'todos'] = process.argv;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const R = [];
const ok = (n, c, d) => { R.push((c ? 'OK      ' : 'FALHOU  ') + n + (!c && d !== undefined ? '  [' + JSON.stringify(d) + ']' : '')); };
const quer = (m) => modoArg === 'todos' || modoArg === m;
const hojeLocal = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

function variante(nome, editar) {
  const d = '/tmp/var2-' + nome; fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d);
  fs.readdirSync(dir).forEach((f) => { if (fs.statSync(path.join(dir, f)).isFile()) fs.copyFileSync(path.join(dir, f), path.join(d, f)); });
  editar(d, (arq, fn) => { const p = path.join(d, arq); fs.writeFileSync(p, fn(fs.readFileSync(p, 'utf8'))); });
  return d;
}

(async () => {
  const browser = await chromium.launch();
  const mk = async (opts = {}, init, base) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Bahia', acceptDownloads: true, ...opts });
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/Failed to load resource|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
    await page.route(/^https?:/, (r) => r.abort());
    await page.goto('file://' + (base || dir) + '/index.html');
    await page.evaluate(() => { try { sessionStorage.setItem('calendarium.intro.visto', '1'); } catch (e) {} });
    await page.reload(); await sleep(250);
    return { ctx, page, errs };
  };
  const irTeu = async (page, sub) => { await page.evaluate(() => Calendarium.show('teurgica')); await sleep(80); if (sub) { await page.click('#teuTab-' + sub); await sleep(120); } };

  /* ---------------- NAV: escolha, navegação, sub-abas ---------------- */
  if (quer('nav')) {
    const { ctx, page, errs } = await mk();
    const esc = await page.evaluate(() => { const b = [...document.querySelectorAll('#choice .choice-btns .choice-btn')]; const t = document.getElementById('chooseTeurgica'); const c = getComputedStyle(t), l = getComputedStyle(document.getElementById('chooseLyra')); const sv = t.querySelector('.sym svg'); const r = sv.getBoundingClientRect(); return { n: b.length, ult: b[4] && b[4].id, label: t.getAttribute('aria-label'), nome: t.querySelector('.name').textContent, symHidden: t.querySelector('.sym').getAttribute('aria-hidden'), w: c.width, wl: l.width, cor: getComputedStyle(t.querySelector('.sym')).color, sv: [Math.round(r.width), Math.round(r.height)] }; });
    ok('menu: quinto botão "Teúrgica" no padrão dos demais (aria-label, .sym aria-hidden, mesmo tamanho)', esc.n === 5 && esc.ult === 'chooseTeurgica' && esc.label === 'Teúrgica' && esc.nome === 'Teúrgica' && esc.symHidden === 'true' && esc.w === esc.wl, esc);
    ok('menu: ícone dourado de 52 px', esc.cor === 'rgb(201, 164, 92)' && esc.sv[0] === 52 && esc.sv[1] === 52, esc);
    await page.click('#chooseTeurgica'); await sleep(1000);
    const a = await page.evaluate(() => ({
      vis: ['liturgyView', 'lunarView', 'ouranosView', 'mysteriesView', 'teurgicaView'].map((i) => getComputedStyle(document.getElementById(i)).display).join(','),
      foco: document.activeElement.tagName + ':' + (document.activeElement.closest('#teurgicaView') ? 'teu' : '?'), h1: document.querySelector('#teurgicaView h1').textContent,
      cur: Calendarium.view, menu: getComputedStyle(document.getElementById('choice')).display,
    }));
    ok('Teúrgica visível, as outras 4 ocultas, menu escondido, Calendarium.view="teurgica"', a.vis === 'none,none,none,none,block' && a.cur === 'teurgica' && a.menu === 'none', a);
    ok('h1 "Teúrgica" focado ao trocar de aba', a.foco === 'H1:teu' && a.h1 === 'Teúrgica', a);
    const nv = await page.evaluate(() => { const bs = [...document.querySelectorAll('#navCluster .nav-btn')]; return { labels: bs.map((b) => b.getAttribute('aria-label')).join('|'), teu: !!document.querySelector('.nav-btn.teurgica-target') }; });
    ok('nav da Teúrgica: 4 botões (sem ela mesma), com os rótulos corretos', nv.labels === 'Calendário Litúrgico|Calendário Lunar|Calendário de Urano|Mistérios e Festas' && !nv.teu, nv);
    await page.evaluate(() => Calendarium.show('sun')); await sleep(100);
    const nv2 = await page.evaluate(() => { const bs = [...document.querySelectorAll('#navCluster .nav-btn')]; const t = document.querySelector('.nav-btn.teurgica-target'); const ly = document.querySelector('.nav-btn.lyra-target'); const r = t.getBoundingClientRect(); return { n: bs.length, label: t.getAttribute('aria-label'), title: t.title, svgHidden: t.querySelector('svg').getAttribute('aria-hidden'), foc: t.querySelector('svg').getAttribute('focusable'), cor: getComputedStyle(t).color, tam: [Math.round(r.width), Math.round(r.height)], altar: t.innerHTML.includes('M5 12.5h14'), lyraIgual: ly.innerHTML.includes('M7 5.2h10') && !ly.innerHTML.includes('M5 12.5h14') }; });
    ok('botão de nav da Teúrgica: 50×50, dourado, aria-label/title, svg decorativo; lira continua a mesma', nv2.n === 4 && nv2.label === 'Teúrgica' && nv2.title === 'Teúrgica' && nv2.svgHidden === 'true' && nv2.foc === 'false' && nv2.cor === 'rgb(201, 164, 92)' && nv2.tam[0] === 50 && nv2.altar && nv2.lyraIgual, nv2);
    await page.click('.nav-btn.teurgica-target'); await sleep(150);
    ok('clicar no botão de nav abre a Teúrgica', await page.evaluate(() => Calendarium.view === 'teurgica' && getComputedStyle(document.getElementById('teurgicaView')).display === 'block'));
    /* sub-abas */
    const s = await page.evaluate(() => { const tl = document.querySelector('#teurgicaView [role=tablist]'); const ts = [...tl.querySelectorAll('[role=tab]')]; return { lab: tl.getAttribute('aria-label'), tabs: ts.map((t) => [t.getAttribute('aria-label'), t.title, t.getAttribute('aria-selected'), t.tabIndex, t.getAttribute('aria-controls'), t.querySelector('svg').getAttribute('aria-hidden'), t.querySelector('svg').getAttribute('focusable')].join('/')), ctl: ts.every((t) => { const p = document.getElementById(t.getAttribute('aria-controls')); return p && p.getAttribute('role') === 'tabpanel' && p.getAttribute('aria-labelledby') === t.id; }), painel: [...document.querySelectorAll('#teurgicaView [role=tabpanel]')].map((p) => p.hidden).join(',') }; });
    ok('sub-abas: tablist rotulado; Hinário/Diário/Relatório com aria-label, title, aria-selected, roving tabindex, ícone aria-hidden+focusable=false', s.lab && s.tabs.join('|') === 'Hinário/Hinário/true/0/teuPanel-hinario/true/false|Diário/Diário/false/-1/teuPanel-diario/true/false|Relatório/Relatório/false/-1/teuPanel-relatorio/true/false' && s.ctl, s);
    ok('sub-aba inicial = Hinário (só o painel dele visível)', s.painel === 'false,true,true', s);
    await page.click('#teuTab-diario'); await sleep(100);
    ok('clicar em Diário troca o painel', await page.evaluate(() => document.getElementById('teuPanel-diario').hidden === false && document.getElementById('teuPanel-hinario').hidden === true && document.getElementById('teuTab-diario').getAttribute('aria-selected') === 'true'));
    await page.click('#teuTab-relatorio'); await sleep(80);
    ok('painel Relatório: "Em breve"', await page.evaluate(() => document.getElementById('teuPanel-relatorio').textContent.trim() === 'Em breve' && !document.getElementById('teuPanel-relatorio').hidden));
    /* lembrar na sessão */
    await page.click('#teuTab-diario'); await sleep(60);
    await page.evaluate(() => Calendarium.menu()); await sleep(100);
    ok('menu: volta à escolha, Teúrgica oculta, nav escondido', await page.evaluate(() => getComputedStyle(document.getElementById('choice')).display === 'flex' && getComputedStyle(document.getElementById('teurgicaView')).display === 'none' && getComputedStyle(document.getElementById('navCluster')).display === 'none' && Calendarium.view === null));
    await page.click('#chooseTeurgica'); await sleep(900);
    ok('lembra a última sub-aba na sessão (Diário) ao voltar', await page.evaluate(() => document.getElementById('teuTab-diario').getAttribute('aria-selected') === 'true'));
    /* padding inferior + mobile */
    const pb = await page.evaluate(() => getComputedStyle(document.querySelector('#teurgicaView .teu-wrap')).paddingBottom);
    ok('padding inferior ≥ 96 px (botões fixos ficam por cima)', parseFloat(pb) >= 96, pb);
    await page.setViewportSize({ width: 320, height: 640 }); await sleep(150);
    const mb = await page.evaluate(() => ({ sx: document.documentElement.scrollWidth <= innerWidth, tabs: [...document.querySelectorAll('.teu-tab')].every((t) => { const r = t.getBoundingClientRect(); return r.height >= 36 && r.width >= 36; }) }));
    ok('mobile 320 px: sem rolagem horizontal e sub-abas ≥ 36 px', mb.sx && mb.tabs, mb);
    ok('nav: sem erros', errs.length === 0, errs); await ctx.close();
  }

  /* ---------------- HINÁRIO ---------------- */
  if (quer('hinario')) {
    const { ctx, page, errs } = await mk(); await irTeu(page);
    const h = await page.evaluate(() => { const ds = [...document.querySelectorAll('#teuPanel-hinario details.teu-hino')]; return { n: ds.length, sum: ds.map((d) => d.querySelector('summary').textContent.replace(/\s+/g, ' ').trim()), texto0: ds.map((d) => d.querySelectorAll('.teu-hino-texto').length).join(','), minH: ds.map((d) => Math.round(d.querySelector('summary').getBoundingClientRect().height)), chev: ds[0].querySelector('.teu-chev').getAttribute('aria-hidden') }; });
    ok('hinário: 3 <details>, summary "Hino n — Deus" + "Incenso: …" (omitido quando vazio)', h.n === 3 && h.sum[0] === 'Hino 1 — [exemplo] Deus A Incenso: [exemplo] resina fictícia' && h.sum[2] === 'Hino 3 — [exemplo] Daimon C' && h.chev === 'true', h);
    ok('hinário: texto NÃO está no DOM enquanto fechado; summary ≥ 36 px', h.texto0 === '0,0,0' && h.minH.every((x) => x >= 36), h);
    await page.click('#teuPanel-hinario details:nth-child(2) summary'); await sleep(120);
    const o = await page.evaluate(() => { const d = document.querySelectorAll('#teuPanel-hinario details')[1]; const t = d.querySelector('.teu-hino-texto'); return { open: d.open, ws: t && getComputedStyle(t).whiteSpace, fam: t && getComputedStyle(t).fontFamily, txt: t && t.textContent, tags: t ? t.querySelectorAll('*').length : -1, outros: [...document.querySelectorAll('#teuPanel-hinario details')].filter((x) => x.open).length, chev: getComputedStyle(d.querySelector('.teu-chev'), '::before').content }; });
    ok('abrir: texto entra no DOM (pre-line, Cormorant), literal (<tags>/&/aspas sem criar elementos), itens independentes', o.open && o.ws === 'pre-line' && /Cormorant/.test(o.fam) && o.txt.includes('<tags> & "aspas"') && o.tags === 0 && o.outros === 1, o);
    ok('chevron muda ▸ → ▾ ao abrir', /▾/.test(o.chev), o.chev);
    await page.click('#teuPanel-hinario details:nth-child(1) summary'); await sleep(100);
    ok('itens independentes: abrir outro não fecha o primeiro', await page.evaluate(() => [...document.querySelectorAll('#teuPanel-hinario details')].filter((x) => x.open).length) === 2);
    await page.click('#teuPanel-hinario details:nth-child(2) summary'); await sleep(100);
    ok('fechar: details fecha (texto permanece no DOM, só oculto)', await page.evaluate(() => !document.querySelectorAll('#teuPanel-hinario details')[1].open));
    ok('hinário: sem erros', errs.length === 0, errs); await ctx.close();
  }

  /* ---------------- DIÁRIO ---------------- */
  if (quer('diario')) {
    const { ctx, page, errs } = await mk(); page.on('dialog', (d) => d.accept());
    await page.clock.setFixedTime(new Date('2026-10-15T14:30:00-03:00'));
    await page.reload(); await sleep(250);
    await irTeu(page, 'diario');
    const d0 = await page.evaluate(() => ({
      timer: document.getElementById('teuHora').getAttribute('role') + '/' + document.getElementById('teuHora').getAttribute('aria-live'),
      hora: document.getElementById('teuHora').textContent, estado: document.getElementById('teuEstado').getAttribute('aria-live'),
      ancLive: !!document.getElementById('teuHora').parentElement.closest('[aria-live],[role=alert],[role=status],[role=log]'),
      label: document.getElementById('teuDial').querySelector('svg').getAttribute('aria-label'), role: document.getElementById('teuDial').querySelector('svg').getAttribute('role'),
      data: document.getElementById('teuData').value, max: document.getElementById('teuData').max,
      dataExt: document.getElementById('teuDataExt').textContent,
    }));
    ok('carimbo com role="timer" aria-live="off"; estado separado com aria-live="polite"; sem ancestral live', d0.timer === 'timer/off' && d0.estado === 'polite' && !d0.ancLive, d0);
    ok('hora fixa 14:30:00 no carimbo e no mostrador (aria-label "…, 14:30"); dia por extenso', d0.hora === '14:30:00' && d0.label === 'Mostrador de 24 horas, 14:30' && d0.role === 'img' && /quinta-feira, 15 de outubro de 2026/.test(d0.dataExt), d0);
    ok('seletor de data: padrão hoje, máximo hoje', d0.data === '2026-10-15' && d0.max === '2026-10-15', d0);
    /* ponteiro na hora atual = mesmo SVG de LiturgyKit.dialSVG(14.5) */
    const pt = await page.evaluate(() => {
      const norm = (s) => { const t = document.createElement('div'); t.innerHTML = s; return t.firstElementChild.lastElementChild.outerHTML; };
      const ponta = document.getElementById('teuDial').querySelector('svg').lastElementChild.outerHTML;
      return { igual: ponta === norm(LiturgyKit.dialSVG(14.5, { id: 'x' })), difere: ponta !== norm(LiturgyKit.dialSVG(2, { id: 'x' })), ids: [...document.getElementById('teuDial').querySelectorAll('linearGradient')].map((g) => g.id).join(',') };
    });
    ok('ponteiro-sol no perímetro na posição de 14,5 h (e não de outra hora)', pt.igual && pt.difere, pt);
    ok('gradientes do mostrador com sufixo de ID (dawn-teu-dia / dusk-teu-dia)', pt.ids === 'dawn-teu-dia,dusk-teu-dia', pt);
    /* cor do mostrador com a Liturgia oculta: remover os gradientes muda os pixels */
    const clip = await page.evaluate(() => { const r = document.getElementById('teuDial').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    const A = await sharp(await page.screenshot({ clip })).raw().toBuffer({ resolveWithObject: true });
    await page.evaluate(() => document.getElementById('teuDial').querySelectorAll('linearGradient').forEach((g) => g.remove()));
    const B = await sharp(await page.screenshot({ clip })).raw().toBuffer({ resolveWithObject: true });
    let dif = 0; for (let i = 0; i < A.data.length; i += A.info.channels) if (Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]) > 40) dif++;
    ok('mostrador renderiza o gradiente das fases do dia mesmo com a Liturgia oculta (display:none)', dif > 500 && await page.evaluate(() => getComputedStyle(document.getElementById('liturgyView')).display === 'none'), dif);
    await page.reload(); await sleep(250); await irTeu(page, 'diario');
    /* grupos de clima */
    const g = await page.evaluate(() => { const gs = [...document.querySelectorAll('#teuPanel-diario .teu-clima-grupo')]; return { janela: document.querySelector('.teu-clima').getAttribute('role') + '/' + (document.getElementById(document.querySelector('.teu-clima').getAttribute('aria-labelledby')) || {}).textContent, grupos: gs.map((x) => x.getAttribute('role') + '/' + x.getAttribute('aria-label')).join('|'), sims: gs.map((x) => x.querySelector('.teu-per-sym').textContent + ':' + x.querySelector('.teu-per-sym').getAttribute('aria-hidden')).join(','), chips: gs.map((x) => [...x.querySelectorAll('.teu-chip')].map((c) => c.textContent).join(',')).join('|'), semTexto: gs.every((x) => x.textContent.replace(x.querySelector('.teu-chips').textContent, '').trim() === x.querySelector('.teu-per-sym').textContent.trim()), alvos: [...document.querySelectorAll('.teu-chip')].every((c) => c.getBoundingClientRect().height >= 36) }; });
    ok('clima: janela "Clima" + 3 grupos (role=group, aria-label por extenso) identificados só pelos símbolos 🜢 🜬 ✧ (aria-hidden)', g.janela === 'group/Clima' && g.grupos === 'group/Clima ao amanhecer|group/Clima ao entardecer|group/Clima à noite' && g.sims === '🜢:true,🜬:true,✧:true' && g.semTexto, g);
    ok('clima: 9 chips por grupo, alvos ≥ 36 px', g.chips.split('|').every((c) => c === 'quente,úmido,frio,seco,ameno,ensolarado,nublado,chuvoso,ventoso') && g.alvos, g);
    /* exclusões mútuas (por grupo) */
    const chip = (p, t) => `.teu-chip[data-per="${p}"][data-tag="${t}"]`;
    const on = (p, t) => page.evaluate((s) => document.querySelector(s).getAttribute('aria-pressed'), chip(p, t));
    await page.click(chip('amanhecer', 'quente')); await page.click(chip('amanhecer', 'ameno')); await page.click(chip('entardecer', 'frio'));
    ok('chips: multisseleção (quente + ameno) e grupos independentes', await on('amanhecer', 'quente') === 'true' && await on('amanhecer', 'ameno') === 'true' && await on('entardecer', 'frio') === 'true');
    await page.click(chip('amanhecer', 'frio'));
    ok('exclusão quente×frio só no mesmo grupo', await on('amanhecer', 'frio') === 'true' && await on('amanhecer', 'quente') === 'false' && await on('entardecer', 'frio') === 'true');
    await page.click(chip('noite', 'úmido')); await page.click(chip('noite', 'seco'));
    ok('exclusão úmido×seco', await on('noite', 'seco') === 'true' && await on('noite', 'úmido') === 'false');
    await page.click(chip('noite', 'ensolarado')); await page.click(chip('noite', 'nublado'));
    ok('exclusão ensolarado×nublado', await on('noite', 'nublado') === 'true' && await on('noite', 'ensolarado') === 'false');
    await page.click(chip('noite', 'nublado'));
    ok('clicar de novo desmarca', await on('noite', 'nublado') === 'false');
    await page.click(chip('noite', 'seco')); /* limpar para o teste seguinte */
    await page.click(chip('amanhecer', 'frio')); await page.click(chip('amanhecer', 'ameno')); await page.click(chip('entardecer', 'frio'));
    /* validação */
    await page.click('#teuSalvar'); await sleep(100);
    const v = await page.evaluate(async () => ({ msg: document.getElementById('teuEstado').textContent, n: (await CalendariumStore.getAll('diario')).length, foco: document.activeElement.id }));
    ok('exigir texto ou clima: mensagem em texto (aria-live), nada gravado, foco no texto', /Escreva algo ou marque o clima/.test(v.msg) && v.n === 0 && v.foco === 'teuTexto', v);
    /* salvar */
    await page.fill('#teuTexto', 'Dia de teste.\nSegunda linha.');
    await page.click(chip('amanhecer', 'quente')); await page.click(chip('amanhecer', 'ensolarado')); await page.click(chip('noite', 'ventoso'));
    await page.click('#teuSalvar'); await sleep(200);
    const s1 = await page.evaluate(async () => ({ msg: document.getElementById('teuEstado').textContent, reg: await CalendariumStore.get('diario', '2026-10-15'), log: await CalendariumStore.getAll('diario_log'), li: [...document.querySelectorAll('#teuSalvos li')].map((l) => l.textContent.trim()) }));
    ok('salvar: "Salvo às 14:30:00" (região polite)', s1.msg === 'Salvo às 14:30:00', s1.msg);
    ok('registro: {id, texto, clima{3 períodos}, criadoEm, salvoEm} com chave = data civil local', s1.reg && s1.reg.data === '2026-10-15' && /^d/.test(s1.reg.id) && s1.reg.texto === 'Dia de teste.\nSegunda linha.' && JSON.stringify(s1.reg.clima) === JSON.stringify({ amanhecer: ['quente', 'ensolarado'], entardecer: [], noite: ['ventoso'] }) && s1.reg.criadoEm === s1.reg.salvoEm && /^\d{4}-\d\d-\d\dT/.test(s1.reg.salvoEm), s1.reg);
    ok('log (diario_log): {data, salvoEm, hora:"HH:MM:SS", horas decimal local, acao:"criou"}', s1.log.length === 1 && s1.log[0].data === '2026-10-15' && s1.log[0].hora === '14:30:00' && s1.log[0].horas === 14.5 && s1.log[0].acao === 'criou' && s1.log[0].seq === 1, s1.log);
    ok('lista os horários de salvamento do dia', s1.li.length === 1 && /14:30:00/.test(s1.li[0]) && /criou/.test(s1.li[0]), s1.li);
    await page.fill('#teuTexto', 'Dia de teste (editado).');
    await page.click('#teuSalvar'); await sleep(200);
    const s2 = await page.evaluate(async () => ({ reg: await CalendariumStore.get('diario', '2026-10-15'), log: await CalendariumStore.getAll('diario_log'), li: document.querySelectorAll('#teuSalvos li').length }));
    ok('salvar de novo: atualiza o registro (criadoEm e id preservados) e ACRESCENTA ao log ("atualizou")', s2.reg.texto === 'Dia de teste (editado).' && s2.reg.criadoEm === s1.reg.criadoEm && s2.reg.id === s1.reg.id && s2.log.length === 2 && s2.log[1].acao === 'atualizou' && s2.li === 2, s2);
    /* reabrir recarrega */
    await page.reload(); await sleep(300); await irTeu(page, 'diario'); await sleep(250);
    const rl = await page.evaluate(() => ({ txt: document.getElementById('teuTexto').value, on: [...document.querySelectorAll('.teu-chip[aria-pressed="true"]')].map((c) => c.dataset.per + ':' + c.dataset.tag).join(','), li: document.querySelectorAll('#teuSalvos li').length }));
    ok('reabrir a data recarrega texto, clima e salvamentos (persistência após recarregar)', rl.txt === 'Dia de teste (editado).' && rl.on === 'amanhecer:quente,amanhecer:ensolarado,noite:ventoso' && rl.li === 2, rl);
    /* data anterior */
    await page.fill('#teuData', '2026-10-14'); await sleep(250);
    const ant = await page.evaluate(() => ({ txt: document.getElementById('teuTexto').value, on: document.querySelectorAll('.teu-chip[aria-pressed="true"]').length, msg: document.getElementById('teuEstado').textContent, li: document.querySelectorAll('#teuSalvos li.teu-salvo-vazio').length }));
    ok('trocar para dia anterior sem registro: form limpo, aviso "Novo registro", lista vazia', ant.txt === '' && ant.on === 0 && /Novo registro para 14\/10\/2026/.test(ant.msg) && ant.li === 1, ant);
    await page.fill('#teuTexto', 'Ontem.'); await page.click(chip('entardecer', 'chuvoso')); await page.click('#teuSalvar'); await sleep(200);
    const ant2 = await page.evaluate(async () => ({ a: await CalendariumStore.get('diario', '2026-10-14'), b: await CalendariumStore.get('diario', '2026-10-15'), log: (await CalendariumStore.getAll('diario_log')).filter((l) => l.data === '2026-10-14').length }));
    ok('registrar dia anterior grava na chave daquele dia; log carrega a data do DIA registrado', ant2.a && ant2.a.texto === 'Ontem.' && ant2.b.texto === 'Dia de teste (editado).' && ant2.log === 1, ant2);
    await page.fill('#teuData', '2026-10-15'); await sleep(250);
    ok('voltar ao dia: carrega o registro existente', await page.evaluate(() => document.getElementById('teuTexto').value) === 'Dia de teste (editado).');
    await page.evaluate(() => { const i = document.getElementById('teuData'); i.value = '2030-01-01'; i.dispatchEvent(new Event('change')); }); await sleep(200);
    ok('data futura é limitada a hoje', await page.evaluate(() => document.getElementById('teuData').value) === '2026-10-15');
    /* alterações não salvas */
    await page.fill('#teuTexto', 'não salvo');
    page.removeAllListeners('dialog'); page.once('dialog', (d) => d.dismiss());
    await page.fill('#teuData', '2026-10-14'); await sleep(200);
    ok('mudar a data com texto não salvo: confirmação; recusar mantém data e texto', await page.evaluate(() => document.getElementById('teuData').value === '2026-10-15' && document.getElementById('teuTexto').value === 'não salvo'));
    page.once('dialog', (d) => d.accept());
    await page.fill('#teuData', '2026-10-14'); await sleep(250);
    ok('aceitar descarta e carrega o outro dia', await page.evaluate(() => document.getElementById('teuTexto').value) === 'Ontem.');
    page.on('dialog', (d) => d.accept());
    await page.fill('#teuData', '2026-10-15'); await sleep(250);
    /* limite de 10.000 */
    await page.evaluate(() => { const t = document.getElementById('teuTexto'); t.value = 'x'.repeat(10050); t.dispatchEvent(new Event('input')); });
    ok('textarea com maxlength=10000', await page.evaluate(() => document.getElementById('teuTexto').maxLength) === 10000);
    await page.click('#teuSalvar'); await sleep(200);
    ok('texto limitado a 10.000 caracteres ao gravar', await page.evaluate(async () => (await CalendariumStore.get('diario', '2026-10-15')).texto.length) === 10000);
    /* TeurgicaData */
    const td = await page.evaluate(async () => {
      const T = TeurgicaData; const reg = await T.carregarDia('2026-10-15'); const lst = await T.listarPeriodo('2026-10-01', '2026-10-31'); const lst2 = await T.listarPeriodo('2026-10-15', '2026-10-15');
      return { tags: T.TAGS.join(','), reg: !!reg && reg.data === '2026-10-15', inval: await T.carregarDia('lixo'), nul: await T.carregarDia('2026-01-01'), n: lst.map((r) => r.data).join(','), n2: lst2.length, res: T.resumirDia(lst[0]), vazio: await T.listarPeriodo('x', 'y') };
    });
    ok('TeurgicaData: TAGS, carregarDia (existente/inexistente/inválida), listarPeriodo (ordenado, inclusivo), resumirDia', td.tags === 'quente,úmido,frio,seco,ameno,ensolarado,nublado,chuvoso,ventoso' && td.reg && td.inval === null && td.nul === null && td.n === '2026-10-14,2026-10-15' && td.n2 === 1 && td.res && td.res.data === '2026-10-14' && td.res.total === 1 && td.res.tags.chuvoso === 1 && td.res.temTexto && td.vazio.length === 0, td);
    /* exportar / importar */
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#teuExportar')]);
    const exp = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
    ok('exportar cópia: arquivo calendarium-copia-AAAA-MM-DD.json com as 3 stores', /^calendarium-copia-\d{4}-\d\d-\d\d\.json$/.test(dl.suggestedFilename()) && Object.keys(exp.stores).join(',') === 'festas,diario,diario_log' && exp.stores.diario.length === 2 && exp.stores.diario_log.length >= 3, [dl.suggestedFilename(), Object.keys(exp.stores)]);
    const arq = '/tmp/copia-teste.json';
    fs.writeFileSync(arq, JSON.stringify({ app: 'calendarium', versao: 1, stores: { diario: [{ data: '2026-09-01', id: 'dimp', texto: 'importado', clima: { amanhecer: ['frio', 'inexistente'], entardecer: [], noite: [] } }, { data: 'x' }], diario_log: [{ data: '2026-09-01', salvoEm: '2026-09-01T10:00:00.000Z', hora: '07:00:00', horas: 7, acao: 'criou' }], festas: [{ id: 'fimp', data: '2026-09-01', nome: 'Festa importada' }] } }));
    await page.setInputFiles('#teuArquivo', arq); await sleep(400);
    const im = await page.evaluate(async () => ({ msg: document.getElementById('teuCopiaEstado').textContent, r: await TeurgicaData.carregarDia('2026-09-01') }));
    ok('importar cópia: mensagem com contagens, aviso para recarregar (festas), clima validado contra TAGS', /1 dia\(s\), 1 salvamento\(s\), 1 festa\(s\)/.test(im.msg) && /Recarregue/.test(im.msg) && im.r && im.r.texto === 'importado' && JSON.stringify(im.r.clima.amanhecer) === '["frio"]', im);
    fs.writeFileSync(arq, 'isto não é json');
    await page.setInputFiles('#teuArquivo', arq); await sleep(300);
    ok('importar arquivo inválido: erro em texto, nada quebra', await page.evaluate(() => /^⚠ /.test(document.getElementById('teuCopiaEstado').textContent)));
    ok('diário: sem erros', errs.length === 0, errs); await ctx.close();
  }

  /* ---------------- XSS ---------------- */
  if (quer('xss')) {
    const { ctx, page, errs } = await mk(); page.on('dialog', (d) => d.accept());
    const TXT = '<img src=x onerror=window.__pwn=1> "aspas" \'s\' &amp; <b>x</b></textarea><script>window.__pwn=2<\/script>';
    await irTeu(page, 'diario');
    await page.fill('#teuTexto', TXT); await page.click('#teuSalvar'); await sleep(250);
    await page.reload(); await sleep(300); await irTeu(page, 'diario'); await sleep(250);
    const r = await page.evaluate(() => ({ v: document.getElementById('teuTexto').value, pwn: window.__pwn, imgs: document.querySelectorAll('#teurgicaView img, #teurgicaView script, #teurgicaView b:not(.teu-hora)').length }));
    ok('xss diário: texto volta literal no textarea; nada executa; nenhum <img>/<script>/<b> criado', r.v === TXT && r.pwn === undefined && r.imgs === 0, r);
    /* importação maliciosa: log com hora/acao e registro com texto malicioso */
    const arq = '/tmp/copia-xss.json'; const M = '<img src=x onerror=window.__pwn=3>';
    const hoje = hojeLocal();
    fs.writeFileSync(arq, JSON.stringify({ app: 'calendarium', versao: 1, stores: { diario: [{ data: hoje, id: M, texto: M, clima: { amanhecer: [M], entardecer: [], noite: [] } }], diario_log: [{ data: hoje, salvoEm: '2030-01-01T00:00:00Z', hora: M, acao: M }] } }));
    await page.setInputFiles('#teuArquivo', arq); await sleep(500);
    await page.reload(); await sleep(300); await irTeu(page, 'diario'); await sleep(300);
    const r2 = await page.evaluate(() => ({ pwn: window.__pwn, imgs: document.querySelectorAll('#teurgicaView img').length, li: [...document.querySelectorAll('#teuSalvos li')].map((l) => l.textContent).join('|'), v: document.getElementById('teuTexto').value, chips: document.querySelectorAll('.teu-chip[aria-pressed="true"]').length }));
    ok('xss importação: hora/ação maliciosas no log aparecem como texto (ação desconhecida vira "—"); id/clima inválidos descartados', r2.pwn === undefined && r2.imgs === 0 && /<img/.test(r2.li) && /—/.test(r2.li) && r2.v === M && r2.chips === 0, r2);
    await irTeu(page, 'hinario'); await page.click('#teuTab-hinario');
    ok('xss hinário: nenhum elemento criado pelos textos', await page.evaluate(() => { document.querySelectorAll('#teuPanel-hinario summary').forEach((s) => s.click()); return document.querySelectorAll('#teuPanel-hinario img, #teuPanel-hinario script, #teuPanel-hinario b').length === 0 && window.__pwn === undefined; }));
    ok('xss: sem erros', errs.length === 0, errs); await ctx.close();
  }

  /* ---------------- TECLADO / leitor de tela ---------------- */
  if (quer('teclado')) {
    const { ctx, page, errs } = await mk();
    await irTeu(page);
    await page.focus('#teuTab-hinario');
    const foco = () => page.evaluate(() => document.activeElement.id + '|' + document.getElementById('teuTab-hinario').getAttribute('aria-selected') + document.getElementById('teuTab-diario').getAttribute('aria-selected') + document.getElementById('teuTab-relatorio').getAttribute('aria-selected'));
    await page.keyboard.press('ArrowRight'); ok('→ vai a Diário (foco + seleção)', await foco() === 'teuTab-diario|falsetruefalse');
    await page.keyboard.press('ArrowRight'); ok('→ vai a Relatório', await foco() === 'teuTab-relatorio|falsefalsetrue');
    await page.keyboard.press('ArrowRight'); ok('→ no fim volta ao Hinário (circular)', await foco() === 'teuTab-hinario|truefalsefalse');
    await page.keyboard.press('ArrowLeft'); ok('← no início vai ao último (Relatório)', await foco() === 'teuTab-relatorio|falsefalsetrue');
    await page.keyboard.press('Home'); ok('Home → Hinário', await foco() === 'teuTab-hinario|truefalsefalse');
    await page.keyboard.press('End'); ok('End → Relatório', await foco() === 'teuTab-relatorio|falsefalsetrue');
    await page.keyboard.press('Home'); await page.keyboard.press('Tab');
    ok('Tab sai da lista de abas direto para o conteúdo (só a aba selecionada é tabulável)', await page.evaluate(() => !document.activeElement.classList.contains('teu-tab') && !!document.activeElement.closest('#teuPanel-hinario')));
    /* hinário por teclado */
    await page.keyboard.press('Enter'); await sleep(120);
    ok('Enter no summary abre o hino (details)', await page.evaluate(() => document.querySelector('#teuPanel-hinario details').open && !!document.querySelector('.teu-hino-texto')));
    await page.keyboard.press('Space'); await sleep(120);
    ok('Espaço fecha', await page.evaluate(() => !document.querySelector('#teuPanel-hinario details').open));
    /* chips com Enter/Espaço */
    await page.focus('#teuTab-hinario'); await page.keyboard.press('ArrowRight'); await sleep(100);
    await page.focus('.teu-chip[data-per="amanhecer"][data-tag="quente"]');
    await page.keyboard.press('Enter');
    const a = await page.evaluate(() => document.querySelector('.teu-chip[data-per="amanhecer"][data-tag="quente"]').getAttribute('aria-pressed'));
    await page.keyboard.press('Tab'); await page.keyboard.press('Space');
    const b = await page.evaluate(() => document.activeElement.dataset.tag + ':' + document.activeElement.getAttribute('aria-pressed'));
    ok('chips alternam com Enter e Espaço (aria-pressed)', a === 'true' && b === 'úmido:true', [a, b]);
    /* carimbo do relógio não é anunciado: nenhuma região live muda a cada segundo */
    const mut = await page.evaluate(() => new Promise((res) => {
      const lives = [...document.querySelectorAll('#teurgicaView [aria-live="polite"],#teurgicaView [aria-live="assertive"],#teurgicaView [role=alert],#teurgicaView [role=status]')];
      let n = 0; const mo = new MutationObserver((m) => { n += m.length; });
      lives.forEach((l) => mo.observe(l, { childList: true, characterData: true, subtree: true, attributes: true }));
      const hora = document.getElementById('teuHora'); let nh = 0; const mh = new MutationObserver((m) => { nh += m.length; }); mh.observe(hora, { childList: true, characterData: true, subtree: true });
      setTimeout(() => { mo.disconnect(); mh.disconnect(); res({ regioes: lives.length, mutLive: n, mutHora: nh }); }, 3300);
    }));
    ok('o carimbo muda a cada segundo, mas NENHUMA região live muda (não é anunciado)', mut.regioes >= 2 && mut.mutLive === 0 && mut.mutHora >= 2, mut);
    ok('teclado: sem erros', errs.length === 0, errs); await ctx.close();
  }

  /* ---------------- TIMERS ---------------- */
  if (quer('timers')) {
    const contar = () => { const ids = new Set(); const si = window.setInterval.bind(window), ci = window.clearInterval.bind(window); window.__ativos = () => ids.size; window.setInterval = function (f, t, ...a) { const id = si(f, t, ...a); ids.add(id); return id; }; window.clearInterval = function (id) { ids.delete(id); return ci(id); }; };
    const { ctx, page, errs } = await mk({}, contar);
    await page.evaluate(() => Calendarium.show('sun')); await sleep(100);
    const base = await page.evaluate(() => __ativos());
    await page.evaluate(() => Calendarium.show('teurgica')); await sleep(100);
    const hin = await page.evaluate(() => ({ n: __ativos(), r: Teurgica.info().relogio }));
    ok('Teúrgica/Hinário: nenhum timer novo', hin.n === base && !hin.r, [base, hin]);
    await page.click('#teuTab-diario'); await sleep(100);
    const di = await page.evaluate(() => ({ n: __ativos(), r: Teurgica.info().relogio }));
    ok('Diário visível: exatamente 1 timer novo (o relógio)', di.n === base + 1 && di.r, [base, di]);
    await page.click('#teuTab-relatorio'); await sleep(100);
    ok('sub-aba Relatório: timer parado', await page.evaluate(() => __ativos()) === base && !(await page.evaluate(() => Teurgica.info().relogio)));
    await page.click('#teuTab-diario'); await sleep(100);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    ok('documento oculto: timer parado', await page.evaluate(() => __ativos()) === base);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    ok('documento visível de novo: timer volta (1)', await page.evaluate(() => __ativos()) === base + 1);
    await page.evaluate(() => Calendarium.show('sun')); await sleep(100);
    ok('trocar para outra aba: timer parado', await page.evaluate(() => __ativos()) === base && !(await page.evaluate(() => Teurgica.info().relogio)));
    await page.evaluate(() => Calendarium.show('teurgica')); await sleep(100);
    ok('voltar à Teúrgica (Diário lembrado): timer volta', await page.evaluate(() => __ativos()) === base + 1);
    await page.evaluate(() => Calendarium.menu()); await sleep(100);
    ok('menu inicial: timer parado', await page.evaluate(() => __ativos()) === base);
    ok('timers: sem erros', errs.length === 0, errs); await ctx.close();
  }

  /* ---------------- FALHA SEGURA ---------------- */
  if (quer('fail')) {
    const abrirDiario = async (page) => { await irTeu(page, 'hinario'); await sleep(50); };
    /* a) hinos-orficos.js vazio / sem a tag / arquivo ausente */
    for (const [nome, ed, estrito] of [
      ['hinos-orficos.js vazio', (d) => fs.writeFileSync(path.join(d, 'hinos-orficos.js'), ''), true],
      ['sem a tag <script> do hinário', (d, ch) => ch('index.html', (s) => s.replace('<script src="hinos-orficos.js"></script>\n', '')), true],
      ['hinos-orficos.js ausente (404)', (d) => fs.rmSync(path.join(d, 'hinos-orficos.js')), false],
      ['HINOS_ORFICOS = []', (d) => fs.writeFileSync(path.join(d, 'hinos-orficos.js'), 'const HINOS_ORFICOS = [];'), true],
      ['HINOS_ORFICOS inválido', (d) => fs.writeFileSync(path.join(d, 'hinos-orficos.js'), 'const HINOS_ORFICOS = [null, 5, {n:1}, {texto:7}];'), true],
    ]) {
      const v = variante('h', ed); const { ctx, page, errs } = await mk({}, null, v); await irTeu(page);
      ok('fail (' + nome + '): "Hinário indisponível" e zero erros', await page.evaluate(() => document.getElementById('teuPanel-hinario').textContent.trim() === 'Hinário indisponível') && errs.length === 0, errs); await ctx.close();
    }
    /* b) sem LiturgyKit */
    {
      const v = variante('lk', (d, ch) => ch('index.html', (s) => s.replace('<script src="teurgica.js"></script>', '<script>delete window.LiturgyKit;</script>\n<script src="teurgica.js"></script>')));
      const { ctx, page, errs } = await mk({}, null, v); await irTeu(page, 'diario');
      await page.fill('#teuTexto', 'sem kit'); await page.click('#teuSalvar'); await sleep(200);
      ok('fail (sem LiturgyKit): "Mostrador indisponível", relógio e salvar continuam, zero erros', await page.evaluate(() => /Mostrador indisponível/.test(document.getElementById('teuDial').textContent) && /^\d\d:\d\d:\d\d$/.test(document.getElementById('teuHora').textContent) && /^Salvo às/.test(document.getElementById('teuEstado').textContent)) && errs.length === 0, errs); await ctx.close();
    }
    /* c) sem CalendariumStore */
    {
      const v = variante('st', (d, ch) => ch('index.html', (s) => s.replace('<script src="store.js"></script>\n', '')));
      const { ctx, page, errs } = await mk({}, null, v); await irTeu(page, 'diario');
      await page.fill('#teuTexto', 'sem store'); await page.click('#teuSalvar'); await page.click('#teuExportar'); await sleep(200);
      ok('fail (sem CalendariumStore): avisos em texto, nada lança, zero erros', await page.evaluate(() => /Armazenamento indisponível/.test(document.getElementById('teuEstado').textContent) && /Armazenamento indisponível/.test(document.getElementById('teuCopiaEstado').textContent)) && errs.length === 0, errs); await ctx.close();
    }
    /* d) sem IndexedDB, localStorage e sessionStorage */
    {
      const sem = () => { const q = (k) => { try { Object.defineProperty(window, k, { get() { throw new Error('bloqueado'); }, configurable: true }); } catch (e) {} }; try { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); } catch (e) {} q('localStorage'); q('sessionStorage'); };
      const { ctx, page, errs } = await mk({}, sem); await irTeu(page, 'diario');
      await page.fill('#teuTexto', 'em memória'); await page.click('#teuSalvar'); await sleep(250);
      const r = await page.evaluate(async () => ({ be: await CalendariumStore.ready(), msg: document.getElementById('teuEstado').textContent, reg: (await TeurgicaData.carregarDia(new Date().toLocaleDateString('sv-SE'))) }));
      await page.click('#teuTab-hinario'); await page.click('#teuTab-relatorio');
      ok('fail (sem IndexedDB/localStorage/sessionStorage): salva em memória, sub-abas funcionam, zero erros', r.be === 'memoria' && /^Salvo às/.test(r.msg) && r.reg && r.reg.texto === 'em memória' && errs.length === 0, [r, errs]); await ctx.close();
    }
    /* e) sem prefers-reduced/matchMedia e sem <dialog>: a aba não depende deles */
    {
      const sem = () => { try { window.matchMedia = undefined; } catch (e) {} try { HTMLDialogElement.prototype.showModal = undefined; } catch (e) {} };
      const { ctx, page, errs } = await mk({}, sem); await irTeu(page, 'diario');
      ok('fail (sem matchMedia/showModal): aba Teúrgica funciona, zero erros', await page.evaluate(() => !!document.getElementById('teuDial').querySelector('svg')) && errs.length === 0, errs); await ctx.close();
    }
  }

  console.log(R.join('\n'));
  const f = R.filter((x) => x.startsWith('FALHOU')).length;
  console.log('\n' + (R.length - f) + '/' + R.length + ' OK' + (f ? '  —  ' + f + ' FALHA(S)' : ''));
  await browser.close();
  process.exit(f ? 1 : 0);
})().catch((e) => { console.log(R.join('\n')); console.error('ERRO NO TESTE:', e); process.exit(2); });
