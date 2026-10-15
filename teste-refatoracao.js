// Uso: node run.js <dir> <modo> [saida.json]   modos: perf | snap | xss
process.env.TZ = 'America/Bahia';
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const dir = path.resolve(process.argv[2]), mode = process.argv[3] || 'perf', out = process.argv[4];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const XSS_NAME = 'Zé "Q" <img src=x onerror=window.__pwn=1> &amp; \'a\'';
const XSS_DATE = '2026-10-15T12:00:00.000Z';

function patchJS(name, src, opts) {
  // contadores só para medição (não vão para os arquivos entregues)
  src = src.replace(/function computeAstral(Raw)?\(([^)]*)\)\{/g, (m, raw) => m + `window.__c=window.__c||{ca:0,raw:0};window.__c.${raw ? 'raw' : 'ca'}++;`);
  return src;
}
function xssPatch(name, src, opts) {
  if (opts && opts.xss && /ouranos-data\.js$/.test(name)) src += `\n;(function(){var s=NAMED_STARS[0];s.n=${JSON.stringify(XSS_NAME)};s.d='α "Z" <b>';s.c='#fff" onmouseover="window.__pwn=2';s.ra=${opts.ra};s.dec=${opts.dec};})();`;
  return src;
}
function fakeCtx() {
  const mk = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : mk()), apply: () => mk(), set: () => true });
  return mk();
}
async function load(opts = {}) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.detail && e.detail.message || e.message)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));
  let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  html = html.replace(/<script src="([^"]+\.js)"><\/script>/g, (m, f) => '<script>' + xssPatch(f, fs.readFileSync(path.join(dir, f), 'utf8'), opts).replace(/<\/script>/g, '<\\/script>') + '</script>');
  html = html.replace(/<link [^>]*>/g, '');
  if (opts.html) html = opts.html(html);
  html = html.replace(/<script>([\s\S]*?)<\/script>/g, (m, c) => '<script>' + patchJS('inline', c, opts) + '</script>');
  const dom = new JSDOM(html, {
    url: 'file://' + dir + '/index.html', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      w.HTMLCanvasElement.prototype.getContext = () => fakeCtx();
      Object.defineProperty(w.navigator, 'geolocation', { value: { getCurrentPosition: (ok) => setTimeout(() => ok({ coords: { latitude: -12.9714, longitude: -38.5014, accuracy: 50 } }), 30) } });
      w.addEventListener('error', e => errors.push('uncaught: ' + e.message));
      w.scrollTo = () => {};
    }
  });
  const w = dom.window;
  await sleep(600);
  w.document.getElementById('chooseUranus').click();
  await sleep(300);
  w.document.querySelector('#ou-mode-group .ou-pill[data-mode="astral"]').click();
  await sleep(800);
  return { dom, w, errors };
}
function setDate(w, iso) {
  const dt = w.document.getElementById('ou-astral-dt');
  dt.value = iso; dt.dispatchEvent(new w.Event('change'));
}
async function measure(w, label, ms) {
  const c0 = JSON.parse(JSON.stringify(w.__c || { ca: 0, raw: 0 }));
  let svg = 0, list = 0, grid = 0;
  const obs = (id, f) => { const n = w.document.getElementById(id); const o = new w.MutationObserver(r => r.forEach(x => { if (x.addedNodes.length) f(); })); o.observe(n, { childList: true }); return o; };
  const os = [obs('ou-astral-svg', () => svg++), obs('ou-astro-list', () => list++), obs('ou-astral-grid', () => grid++)];
  const t0 = Date.now();
  await sleep(ms);
  const secs = (Date.now() - t0) / 1000;
  os.forEach(o => o.disconnect());
  const c1 = w.__c || { ca: 0, raw: 0 };
  const r = x => +(x / secs).toFixed(2);
  return { cenario: label, ca_por_s: r(c1.ca - c0.ca), raw_por_s: r((c1.raw || 0) - (c0.raw || 0)), svg_rebuilds_por_s: r(svg), cartoes_leitura_por_s: r(list), grade_por_s: r(grid) };
}
(async () => {
  if (mode === 'fail') {
    const R = [];
    const ok = (nome, cond, extra) => R.push({ teste: nome, resultado: cond ? 'OK' : 'FALHOU', ...(extra ? { detalhe: extra } : {}) });
    // 1) sem #ou-astral-panel
    { const { w, errors } = await load({ html: h => h.replace('id="ou-astral-panel"', 'id="x-sem-painel"') });
      await sleep(1500);
      ok('sem #ou-astral-panel: sem erros e o mapa continua desenhando', errors.length === 0 && w.document.getElementById('ou-astral-svg').innerHTML.length > 1000 && !w.document.getElementById('ou-time-box'), errors.slice(0, 2)); w.close(); }
    // 2) ganchos lançando exceção
    { const { w, errors } = await load();
      w.AstralStars.svg = () => { throw new Error('estrelas'); }; w.AstralPoints.svg = () => { throw new Error('pontos'); };
      setDate(w, '2026-10-13T12:00'); await sleep(1200);
      ok('AstralStars/AstralPoints lançando: mapa sai sem elas e sem erro', errors.length === 0 && w.document.getElementById('ou-astral-svg').innerHTML.includes('Áries'), errors.slice(0, 2));
      const orig = w.AstralPanel; w.AstralPanel = { frame() { throw new Error('painel'); } };
      setDate(w, '2026-10-14T12:00'); await sleep(1200);
      ok('AstralPanel.frame lançando: renderAstral engole e o mapa segue', errors.length === 0 && w.document.getElementById('ou-astral-grid').innerHTML.includes('14 de outubro'), errors.slice(0, 2));
      w.AstralPanel = orig;
      const r = orig.frame(null, true);
      ok('AstralPanel.frame(entrada inválida) não lança; erro fica em AstralCalc.error()', r === undefined && !!w.AstralCalc.error(), String(w.AstralCalc.error()));
      w.close(); }
    // 3) astral.js sem Ouranos / com Ouranos incompleto
    for (const [nome, pre] of [['sem Ouranos', ''], ['Ouranos sem astralRefresh', 'const Ouranos={astral(){}};']]) {
      const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(e.message));
      const dom = new JSDOM('<body><div id="ouranosView"><div id="ou-astral-panel"></div></div></body>', { runScripts: 'outside-only', virtualConsole: vc });
      try { dom.window.eval(pre + fs.readFileSync(path.join(dir, 'astral.js'), 'utf8')); } catch (e) { errs.push(String(e)); }
      ok('astral.js ' + nome + ': não faz nada e não lança', errs.length === 0 && !dom.window.AstralClock && !dom.window.document.getElementById('ou-time-box'), errs.slice(0, 2)); dom.window.close(); }
    console.log(JSON.stringify(R, null, 1)); process.exit(0);
  }
  if (mode === 'roteiro') {
    const R = []; const ok = (n, c, d) => R.push({ passo: n, resultado: c ? 'OK' : 'FALHOU', ...(d !== undefined && !c ? { detalhe: d } : {}) });
    const { w, errors } = await load(); const doc = w.document;
    const vis = id => doc.getElementById(id).style.display;
    // abas e menu
    for (const [v, id] of [['sun', 'liturgyView'], ['moon', 'lunarView'], ['lyra', 'mysteriesView'], ['uranus', 'ouranosView']]) {
      w.Calendarium.show(v); await sleep(250);
      ok('aba ' + v + ' visível e as outras ocultas', vis(id) === 'block' && ['liturgyView', 'lunarView', 'mysteriesView', 'ouranosView'].filter(x => x !== id).every(x => vis(x) === 'none') && w.Calendarium.view === v, vis(id));
    }
    doc.getElementById('menuBtn').click(); await sleep(250);
    ok('botão de menu volta à escolha', w.Calendarium.view === null && doc.getElementById('choice').style.display === 'flex');
    doc.getElementById('chooseUranus').click(); await sleep(300);
    // todos os modos da aba Urano
    const modos = [...doc.querySelectorAll('#ou-mode-group .ou-pill')].map(b => b.dataset.mode);
    for (const m of modos) { doc.querySelector('#ou-mode-group .ou-pill[data-mode="' + m + '"]').click(); await sleep(350);
      ok('modo Urano "' + m + '" ativo, info não vazia', doc.getElementById('ouranosView').classList.contains('astral-on') === (m === 'astral') && doc.getElementById('ou-info-bar').textContent.length > 3); }
    doc.querySelector('#ou-mode-group .ou-pill[data-mode="astral"]').click(); await sleep(700);
    const clk = w.AstralClock;
    ok('Mapa Astral: caixa de tempo, cartões e mapa montados', !!doc.getElementById('ou-time-box') && doc.getElementById('ou-astro-list').children.length > 5 && doc.getElementById('ou-astral-svg').innerHTML.length > 5000);
    ok('começa ao vivo', clk.isLive() === true);
    // tempo acelerado: 1 h/s para o futuro, depois passado, depois pausa
    doc.querySelector('#ou-ast-speed-group button[data-as="3600"]').click(); await sleep(150);
    ok('velocidade escolhida sai do "ao vivo"', clk.isLive() === false);
    let t0 = clk.date().getTime(); await sleep(1000); let t1 = clk.date().getTime();
    ok('futuro 1 h/s: ~3600 s por s real', Math.abs((t1 - t0) / 1000 - 3600) < 700, ((t1 - t0) / 1000).toFixed(0));
    doc.getElementById('ou-ast-past').click(); await sleep(100); t0 = clk.date().getTime(); await sleep(1000); t1 = clk.date().getTime();
    ok('passado 1 h/s: recua ~3600 s por s real', Math.abs((t0 - t1) / 1000 - 3600) < 700, ((t0 - t1) / 1000).toFixed(0));
    doc.querySelector('#ou-ast-speed-group button[data-as="86400"]') && doc.querySelector('#ou-ast-speed-group button[data-as="86400"]').click(); await sleep(100);
    t0 = clk.date().getTime(); await sleep(1000); t1 = clk.date().getTime();
    ok('1 dia/s (sentido passado): ~86400 s por s real', Math.abs((t0 - t1) / 1000 - 86400) < 15000, ((t0 - t1) / 1000).toFixed(0));
    doc.getElementById('ou-ast-play').click(); await sleep(100); t0 = clk.date().getTime(); await sleep(700); t1 = clk.date().getTime();
    ok('pausar: o tempo para', t0 === t1);
    const svgPausado = doc.getElementById('ou-astral-svg').innerHTML; await sleep(1300);
    ok('pausado: o SVG não é reconstruído', doc.getElementById('ou-astral-svg').innerHTML === svgPausado);
    // seletor de data (inclui fora de 1800–2050) e voltar ao Agora
    setDate(w, '2026-10-13T12:00'); await sleep(300);
    ok('seletor de data: mapa e relógio vão para 13/10/2026 12:00', doc.getElementById('ou-astral-clock').textContent.includes('13/10/2026 12:00') && doc.getElementById('ou-astral-grid').innerHTML.includes('13 de outubro'));
    ok('dentro de 1800–2050 sem aviso', !doc.getElementById('ou-ephem-warn').classList.contains('on'));
    setDate(w, '2100-01-01T00:00'); await sleep(300);
    ok('data fora de 1800–2050 mostra o aviso', doc.getElementById('ou-ephem-warn').classList.contains('on'));
    doc.getElementById('ou-ast-now').click(); await sleep(300);
    ok('"Agora" volta ao tempo real', clk.isLive() === true && Math.abs(clk.date().getTime() - Date.now()) < 2000 && !doc.getElementById('ou-ephem-warn').classList.contains('on'));
    ok('localização por GPS (simulada) liberou Ascendente/casas', doc.getElementById('ou-astro-list').textContent.includes('Ascendente'));
    w.Calendarium.show('sun'); await sleep(300); w.Calendarium.show('uranus'); await sleep(500);
    ok('voltar à aba Urano mantém o mapa astral', doc.getElementById('ou-astral-svg').innerHTML.length > 5000);
    ok('sem erros no console durante todo o roteiro', errors.length === 0, errors.slice(0, 3));
    console.log(JSON.stringify(R.map(r => r.resultado + '  ' + r.passo + (r.detalhe !== undefined ? '  [' + r.detalhe + ']' : '')), null, 1));
    console.log('RESUMO:', R.filter(r => r.resultado === 'OK').length + '/' + R.length + ' passos OK');
    process.exit(0);
  }
  if (mode === 'perf') {
    const { w, errors } = await load();
    const res = [];
    res.push(await measure(w, 'ao vivo', 5000));
    setDate(w, '2026-10-13T12:00'); await sleep(300);
    res.push(await measure(w, 'simulado parado', 5000));
    w.document.getElementById('ou-ast-play').click(); await sleep(200);
    res.push(await measure(w, 'reproduzindo 1 h/s', 3000));
    w.document.getElementById('ou-ast-play').click();
    w.Calendarium.show('sun'); await sleep(300);
    res.push(await measure(w, 'em outra aba (Sol)', 3000));
    console.log(JSON.stringify({ resultados: res, erros: errors }, null, 1));
    process.exit(0);
  }
  if (mode === 'snap') {
    const { w, errors } = await load();
    const snaps = {};
    for (const iso of ['2026-10-13T12:00', '1879-03-14T11:30', '2040-06-01T00:00']) {
      setDate(w, iso); await sleep(1600);
      const g = id => w.document.getElementById(id).innerHTML;
      snaps[iso] = { svg: g('ou-astral-svg'), grid: g('ou-astral-grid'), list: g('ou-astro-list'), clock: g('ou-astral-clock'), info: w.document.getElementById('ou-info-bar').textContent };
    }
    fs.writeFileSync(out, JSON.stringify({ snaps, errors }));
    console.log('snapshots gravados;', 'erros:', errors.length, errors.slice(0, 3));
    process.exit(0);
  }
  if (mode === 'xss') {
    // 1ª carga: descobre λ do Sol; 2ª carga: planta uma estrela "maliciosa" sobre o Sol
    const p = await load();
    const sunLon = p.w.eval('Ouranos').astral(new Date(XSS_DATE), { lat: -12.97, lon: -38.5 }).sunLon;
    const T = (new Date(XSS_DATE).getTime() / 86400000 + 2440587.5 - 2451545) / 36525;
    const lam = (sunLon - 1.3969713 * T) * Math.PI / 180, eps = 23.4392911 * Math.PI / 180;
    const ra = Math.atan2(Math.sin(lam) * Math.cos(eps), Math.cos(lam)) * 180 / Math.PI / 15, dec = Math.asin(Math.sin(lam) * Math.sin(eps)) * 180 / Math.PI;
    p.w.close();
    const { w, errors } = await load({ xss: true, ra: ((ra % 24) + 24) % 24, dec });
    setDate(w, XSS_DATE.slice(0, 16)); await sleep(600);
    const doc = w.document, host = doc.getElementById('ou-astral-svg'), list = doc.getElementById('ou-astro-list');
    const dis = [...host.querySelectorAll('[data-info]')].map(g => g.getAttribute('data-info'));
    const starG = dis.filter(s => s.includes('Q'));
    const res = {
      pwn: w.__pwn || null,
      imgs_injetadas: host.querySelectorAll('img').length + list.querySelectorAll('img').length + doc.getElementById('ou-astral-grid').querySelectorAll('img').length,
      atributos_onmouseover: host.querySelectorAll('[onmouseover]').length,
      estrela_no_mapa: starG.length, info_do_mapa_intacto: starG.some(s => s.includes(XSS_NAME)),
      estrela_no_cartao: list.textContent.includes(XSS_NAME), erros: errors
    };
    console.log(JSON.stringify(res, null, 1));
    process.exit(0);
  }
})().catch(e => { console.error('FALHA DO TESTE', e); process.exit(2); });
