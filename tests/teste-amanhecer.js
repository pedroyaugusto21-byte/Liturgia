/* Teste da ETAPA A (amanhecer real). Node puro, sem navegador e sem dependências:  node tests/teste-amanhecer.js
   Cobre: (1) padrão sem localização idêntico ao anterior (golden), (2) cálculo do nascer do Sol,
   (3) troca do dia litúrgico no nascer real, (4) latitudes extremas, (5) painel e mensagens,
   (6) negação/erro de localização, (7) ponte com a geolocalização do ouranos.js. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { carregar } = require('./_ambiente');
const RAIZ = path.join(__dirname, '..');
const R = [];
const ok = (n, c, d) => R.push((c ? 'OK      ' : 'FALHOU  ') + n + (!c && d !== undefined ? '  [' + JSON.stringify(d) + ']' : ''));
const sha = (t) => crypto.createHash('sha1').update(t).digest('hex');
const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const ORDEM_SCRIPTS = ['ouranos-data.js', 'ouranos-calc.js', 'liturgy.js'];
const novo = (extra) => carregar(ORDEM_SCRIPTS.concat(extra || []), extra && extra.opts);
const hhmm = (h) => { const t = Math.round(h * 60); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
const SALVADOR = { lat: -12.97, lon: -38.5 };

/* ---------- 0. ordem dos scripts no HTML ---------- */
{
  const ordem = [...HTML.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  ok('index.html carrega ouranos-calc.js ANTES de liturgy.js', ordem.indexOf('ouranos-calc.js') >= 0 && ordem.indexOf('ouranos-calc.js') < ordem.indexOf('liturgy.js'), ordem);
  ok('index.html tem o botão e a região de mensagem do amanhecer', /id="btnDawnLoc"/.test(HTML) && /id="dawnMsg"[^>]*aria-live="polite"/.test(HTML));
}

/* ---------- 1. sem localização: idêntico ao comportamento anterior (golden) ---------- */
{
  const g = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden', 'amanhecer-padrao.json'), 'utf8'));
  const falhas = [];
  const fusos = [...new Set(Object.keys(g).map((k) => k.split('|')[0]))];
  const instantes = [...new Set(Object.keys(g).map((k) => k.split('|')[1]))];
  for (const fuso of fusos) {
    process.env.TZ = fuso;
    const amb = novo();
    for (const i of instantes) {
      amb.irPara(i);
      if (sha(amb.el('clockdiv').innerHTML) !== g[fuso + '|' + i + '|relogio']) falhas.push(fuso + ' ' + i + ' relógio');
      amb.run('window.mystRender()');
      if (sha(amb.el('mystClockdiv').innerHTML) !== g[fuso + '|' + i + '|misterios']) falhas.push(fuso + ' ' + i + ' mistérios');
      if (String(amb.ctx.LiturgyKit.litDay(new Date(i).getTime())) !== g[fuso + '|' + i + '|litDay']) falhas.push(fuso + ' ' + i + ' litDay');
    }
  }
  ok('sem localização: relógio, Mistérios e litDay idênticos ao anterior (' + Object.keys(g).length + ' capturas, 3 fusos)', falhas.length === 0, falhas.slice(0, 5));
  process.env.TZ = 'America/Bahia';
  const a = novo().ctx.LiturgyKit.amanhecer(new Date('2026-11-26T12:00:00-03:00'));
  ok('sem localização: amanhecer = 06:00, padrão', a.horas === 6 && a.padrao === true && a.estado === 'padrao', a);
}

/* ---------- 2. cálculo do nascer do Sol ---------- */
{
  process.env.TZ = 'America/Bahia';
  const amb = novo(); const C = amb.ctx.OuranosCalc;
  const ref = new Date('2026-11-26T06:00:00-03:00').getTime();
  const s = C.sunriseNear(ref, SALVADOR.lat, SALVADOR.lon);
  const A = C.computeAstral(new Date(s.ms), SALVADOR);
  ok('sunriseNear concorda com computeAstral (hora solar do nascer, ±2 s)', Math.abs(A.solarH - A.rise) * 3600 < 2, { solarH: A.solarH, rise: A.rise });
  const loc = new Date(s.ms - 3 * 3600000);
  ok('Salvador, 26/11/2026: nascer entre 04:50 e 05:05', loc.getUTCHours() + loc.getUTCMinutes() / 60 > 4 + 50 / 60 && loc.getUTCHours() + loc.getUTCMinutes() / 60 < 5 + 5 / 60, loc.toISOString());
  const eq = C.sunriseNear(new Date('2026-03-20T06:00:00Z').getTime(), 0, 0);
  const dh = new Date(eq.ms); const h = dh.getUTCHours() + dh.getUTCMinutes() / 60;
  ok('equador, longitude 0, equinócio: nascer ≈ 06:05–06:10 UTC', h > 6.05 && h < 6.2, h);
  process.env.TZ = 'Europe/London';
  const amb2 = novo(); amb2.ctx.LiturgyKit.setLocal(51.5, -0.12);
  const l = amb2.ctx.LiturgyKit.amanhecer(new Date('2026-06-21T12:00:00+01:00'));
  ok('Londres, solstício de junho: nascer ≈ 04:43 (±4 min)', Math.abs(l.horas - (4 + 43 / 60)) < 4 / 60 && !l.padrao, hhmm(l.horas));
  const l2 = amb2.ctx.LiturgyKit.amanhecer(new Date('2026-12-21T12:00:00Z'));
  ok('Londres, solstício de dezembro: nascer ≈ 08:04 (±4 min)', Math.abs(l2.horas - (8 + 4 / 60)) < 4 / 60, hhmm(l2.horas));
  ok('o amanhecer varia ao longo do ano (jun ≠ dez)', Math.abs(l.horas - l2.horas) > 3);
}

/* ---------- 3. o dia litúrgico troca no nascer real ---------- */
{
  process.env.TZ = 'America/Bahia';
  const amb = novo(); const K = amb.ctx.LiturgyKit;
  const t = (hm) => new Date('2026-11-26T' + hm + ':00-03:00').getTime();
  const civil = (ms) => K.civilOfLitDay(K.litDay(ms));
  ok('padrão: 05:30 ainda é o dia litúrgico anterior', civil(t('05:30')) === '2026-11-25', civil(t('05:30')));
  K.setLocal(SALVADOR.lat, SALVADOR.lon);
  const d = K.amanhecer(t('12:00')).horas;
  ok('com localização: nascer de hoje antes das 05:30', d < 5.5 && d > 4.5, hhmm(d));
  ok('com localização: 05:30 já é o dia litúrgico de hoje', civil(t('05:30')) === '2026-11-26', civil(t('05:30')));
  ok('com localização: 04:30 ainda é o dia anterior', civil(t('04:30')) === '2026-11-25', civil(t('04:30')));
  const antes = t('00:00') + Math.floor(d * 3600) * 1000 - 1000, depois = antes + 2000;
  ok('a virada ocorre exatamente no nascer (±1 s)', K.litDay(antes) + 1 === K.litDay(depois), [K.litDay(antes), K.litDay(depois)]);
  amb.irPara('2026-11-26T05:30');
  ok('relógio: dia da semana litúrgico = quinta-feira às 05:30 (já amanheceu)', /Quinta-feira/.test(amb.el('info').innerHTML));
  K.clearLocal();
  amb.irPara('2026-11-26T05:30');
  ok('sem localização de novo: 05:30 ainda é quarta-feira', /Quarta-feira/.test(amb.el('info').innerHTML));
}

/* ---------- 4. latitudes extremas e continuidade ---------- */
{
  process.env.TZ = 'UTC';
  const amb = novo(); const K = amb.ctx.LiturgyKit;
  const casos = [
    ['Svalbard (78 N) em 21/jun: Sol não se põe', 78.2, 15.6, '2026-06-21T12:00:00Z', 'sol-da-meia-noite'],
    ['Svalbard (78 N) em 21/dez: Sol não nasce', 78.2, 15.6, '2026-12-21T12:00:00Z', 'noite-polar'],
    ['Polo Sul em 21/dez: Sol não se põe', -90, 0, '2026-12-21T12:00:00Z', 'sol-da-meia-noite'],
    ['Polo Norte em 21/dez: Sol não nasce', 90, 0, '2026-12-21T12:00:00Z', 'noite-polar'],
    ['Antártida (-80) em 21/jun: Sol não nasce', -80, 0, '2026-06-21T12:00:00Z', 'noite-polar'],
  ];
  for (const [nome, lat, lon, quando, motivo] of casos) {
    K.setLocal(lat, lon);
    const a = K.amanhecer(new Date(quando));
    ok(nome + ' → usa 06:00 (' + motivo + ')', a.padrao === true && a.horas === 6 && a.motivo === motivo, a);
    amb.irPara(quando.slice(0, 16));
    ok('  painel avisa e não quebra', /Padrão ·/.test(amb.el('info').innerHTML) && !/NaN|undefined/.test(amb.el('info').innerHTML + amb.el('clockdiv').innerHTML));
  }
  /* continuidade: dias litúrgicos sempre positivos e quase de 24 h, em várias latitudes, o ano todo */
  for (const lat of [-12.97, 0, 40, 60, 66.5, 69.6, -66.5, -69.6]) {
    K.setLocal(lat, 10);
    let ruim = 0, minLen = 99, maxLen = 0, anterior = null;
    for (let dia = 0; dia < 365; dia++) {
      const ms = Date.UTC(2026, 0, 1 + dia, 12);
      const a = K.amanhecer(ms), ini = Date.UTC(2026, 0, 1 + dia) + a.horas * 3600000;
      if (anterior !== null) { const len = (ini - anterior) / 3600000; minLen = Math.min(minLen, len); maxLen = Math.max(maxLen, len); if (len <= 0) ruim++; }
      anterior = ini;
    }
    ok('latitude ' + lat + ': 365 dias litúrgicos, todos de duração positiva (' + minLen.toFixed(1) + '–' + maxLen.toFixed(1) + ' h)', ruim === 0 && minLen > 11, { ruim, minLen, maxLen });
  }
  K.setLocal(51.5, -0.12); /* latitudes de uso comum: duração do dia litúrgico perto de 24 h */
  let desvio = 0;
  for (let dia = 0; dia < 364; dia++) { const a = K.amanhecer(Date.UTC(2026, 0, 1 + dia, 12)), b = K.amanhecer(Date.UTC(2026, 0, 2 + dia, 12)); desvio = Math.max(desvio, Math.abs(24 + b.horas - a.horas - 24)); }
  ok('Londres: amanhecer muda no máximo ~3 min por dia', desvio < 0.06, desvio);
  const ref = Date.UTC(2026, 5, 21, 12), antesInval = K.amanhecer(ref).horas;
  const rets = [K.setLocal(NaN, 10), K.setLocal(91, 10), K.setLocal(10, 181), K.setLocal('x', 'y'), K.setLocal(undefined, undefined)];
  ok('coordenadas inválidas são rejeitadas e a última válida permanece', rets.every((r) => r === false) && K.amanhecer(ref).horas === antesInval && K.amanhecer(ref).padrao === false, rets);
}

/* ---------- 5. painel, mostrador e mensagens ---------- */
{
  process.env.TZ = 'America/Bahia';
  const amb = novo(); const K = amb.ctx.LiturgyKit;
  amb.irPara('2026-11-26T12:00');
  let info = amb.el('info').innerHTML;
  ok('painel mostra "Amanhecer 06:00 · Padrão · sem localização"', /Amanhecer<\/span>[\s\S]*?<p class="v">06:00<\/p><p class="d">Padrão · sem localização/.test(info), info.slice(0, 300));
  const relogioPadrao = amb.el('clockdiv').innerHTML;
  amb.disparaDocumento('calendarium:localizacao', { lat: SALVADOR.lat, lon: SALVADOR.lon, acc: 30 });
  amb.irPara('2026-11-26T12:00');
  info = amb.el('info').innerHTML;
  const m = /Amanhecer<\/span>[\s\S]*?<p class="v">(\d\d:\d\d)<\/p><p class="d">([^<]*)/.exec(info);
  ok('com localização: painel mostra o horário real (04:5x/05:0x) e "Nascer do Sol no seu local"', m && /^0[45]:/.test(m[1]) && m[1] !== '06:00' && m[2] === 'Nascer do Sol no seu local', m);
  ok('o mostrador do relógio muda de lugar o marcador do amanhecer', amb.el('clockdiv').innerHTML !== relogioPadrao);
  ok('mensagem de estado (textContent, sem HTML) após obter a localização', amb.el('dawnMsg').textContent === 'Amanhecer calculado pelo nascer do Sol no seu local.' && amb.el('dawnMsg').innerHTML === '');
  ok('botão passa a "Atualizar localização"', amb.el('btnDawnLoc').textContent === 'Atualizar localização' && amb.el('btnDawnLoc').getAttribute('aria-busy') === 'false');
  amb.run('window.mystRender()');
  ok('diagrama dos Mistérios também usa o amanhecer real', amb.el('mystClockdiv').innerHTML.length > 100 && amb.el('mystClockdiv').innerHTML !== '');
  const dial = K.dialSVG(5, { id: 'x' }), dialA = K.dialSVG(5, { id: 'x', dawn: 4.5 });
  ok('dialSVG aceita amanhecer opcional (padrão continua 06:00)', dial !== dialA && K.dialSVG(5, { id: 'x' }) === dial);
}

/* ---------- 6. negação e falhas ---------- */
{
  process.env.TZ = 'America/Bahia';
  const amb = novo(); const K = amb.ctx.LiturgyKit;
  K.setLocal(SALVADOR.lat, SALVADOR.lon);
  amb.disparaDocumento('calendarium:localizacao-erro', { code: 3, negado: false, indisponivel: true });
  ok('falha passageira (tempo esgotado) mantém a localização que já havia', K.amanhecer(Date.UTC(2026, 10, 26, 15)).padrao === false && K.amanhecer(Date.UTC(2026, 10, 26, 15)).estado === 'ok');
  amb.disparaDocumento('calendarium:localizacao-erro', { code: 1, negado: true, indisponivel: false });
  const a = K.amanhecer(Date.UTC(2026, 10, 26, 15));
  ok('negou a permissão: esquece a localização e volta às 06:00', a.padrao === true && a.horas === 6 && a.estado === 'negado', a);
  ok('mensagem de negação em pt-BR', /^Localização não autorizada: o dia litúrgico segue começando às 06:00/.test(amb.el('dawnMsg').textContent));
  amb.irPara('2026-11-26T12:00');
  ok('painel: "Padrão · localização não autorizada"', /Padrão · localização não autorizada/.test(amb.el('info').innerHTML));
  const amb2 = novo();
  amb2.disparaDocumento('calendarium:localizacao-erro', { code: 2, negado: false, indisponivel: true });
  ok('sem localização e sem GPS: 06:00 com aviso "indisponível"', amb2.ctx.LiturgyKit.amanhecer(Date.UTC(2026, 10, 26, 15)).estado === 'indisponivel' && /não foi possível/i.test(amb2.el('dawnMsg').textContent));
}

/* ---------- 7. ponte com a geolocalização do ouranos.js ---------- */
{
  process.env.TZ = 'America/Bahia';
  let pedidos = 0, modo = 'ok', resposta = null;
  const geolocation = { getCurrentPosition(sucesso, erro) { pedidos++; resposta = () => (modo === 'ok' ? sucesso({ coords: { latitude: SALVADOR.lat, longitude: SALVADOR.lon, accuracy: 25 } }) : erro({ code: modo === 'negado' ? 1 : 2 })); resposta(); } };
  const amb = carregar(['ouranos-data.js', 'ouranos-calc.js', 'liturgy.js', 'ouranos.js'], { geolocation });
  const K = amb.ctx.LiturgyKit;
  const eventos = []; amb.document.addEventListener('calendarium:localizacao', (e) => eventos.push(['loc', e.detail])); amb.document.addEventListener('calendarium:localizacao-erro', (e) => eventos.push(['erro', e.detail]));
  amb.el('btnDawnLoc').onclick ? amb.el('btnDawnLoc').onclick() : amb.el('btnDawnLoc').dispatch('click');
  ok('botão pede a localização UMA vez, via Ouranos (sem segunda geolocalização)', pedidos === 1, pedidos);
  ok('Ouranos anuncia calendarium:localizacao com lat/lon', eventos.length === 1 && eventos[0][0] === 'loc' && eventos[0][1].lat === SALVADOR.lat && eventos[0][1].lon === SALVADOR.lon, eventos);
  ok('a Liturgia passou a usar o nascer real', K.amanhecer(Date.UTC(2026, 10, 26, 15)).padrao === false);
  ok('Ouranos.location() expõe a localização em uso', amb.run('Ouranos.location().src') === 'gps' && amb.run('Ouranos.location().lat') === SALVADOR.lat);
  modo = 'negado'; amb.el('btnDawnLoc').dispatch('click');
  ok('negação via Ouranos → evento de erro com negado:true → volta ao padrão', eventos.some((e) => e[0] === 'erro' && e[1].negado === true && e[1].code === 1) && K.amanhecer(Date.UTC(2026, 10, 26, 15)).estado === 'negado' && K.amanhecer(Date.UTC(2026, 10, 26, 15)).horas === 6);
  /* quem já tem a permissão: usa sem clicar; quem nunca decidiu: não dispara pedido por conta própria */
  const casos = [['granted', 1], ['prompt', 0], ['denied', 0]];
  let pendentes = casos.length;
  for (const [estado, esperaPedido] of casos) {
    let n = 0;                                         /* contador próprio de cada caso */
    const geo = { getCurrentPosition(sucesso) { n++; sucesso({ coords: { latitude: SALVADOR.lat, longitude: SALVADOR.lon, accuracy: 25 } }); } };
    const perm = { query: () => Promise.resolve({ state: estado }) };
    const a2 = carregar(['ouranos-data.js', 'ouranos-calc.js', 'liturgy.js', 'ouranos.js'], { geolocation: geo, permissions: perm });
    a2.disparaJanela('load');
    Promise.resolve().then(() => Promise.resolve()).then(() => {
      ok('permissão "' + estado + '" ao abrir: ' + (esperaPedido ? 'usa a localização sem perguntar' : 'não dispara nenhum pedido'), n === esperaPedido, n);
      if (estado === 'denied') ok('permissão "denied" ao abrir: mensagem de negação visível', /não autorizada/.test(a2.el('dawnMsg').textContent));
      if (estado === 'granted') ok('permissão "granted": amanhecer real já aplicado', a2.ctx.LiturgyKit.amanhecer(Date.UTC(2026, 10, 26, 15)).padrao === false);
      if (estado === 'prompt') ok('permissão "prompt": segue em 06:00 até a pessoa clicar', a2.ctx.LiturgyKit.amanhecer(Date.UTC(2026, 10, 26, 15)).horas === 6);
      if (--pendentes === 0) imprimir();
    });
  }
}

function imprimir() {
  R.forEach((l) => console.log(l));
  const f = R.filter((l) => l.startsWith('FALHOU')).length;
  console.log('\n' + (f ? f + ' FALHA(S) de ' + R.length : 'TUDO OK — ' + R.length + ' verificações'));
  process.exit(f ? 1 : 0);
}
