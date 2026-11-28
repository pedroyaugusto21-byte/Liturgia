/* Teste da ETAPA B (hemisfério Sul/Norte). Node puro:  node tests/teste-hemisferio.js */
const fs = require('fs');
const path = require('path');
const { carregar } = require('./_ambiente');
const RAIZ = path.join(__dirname, '..');
process.env.TZ = 'America/Bahia';
const R = [];
const ok = (n, c, d) => R.push((c ? 'OK      ' : 'FALHOU  ') + n + (!c && d !== undefined ? '  [' + JSON.stringify(d) + ']' : ''));
const SCRIPTS = ['ouranos-data.js', 'ouranos-calc.js', 'liturgy.js'];
const memoria = (inicial) => { const m = Object.assign({}, inicial); return { m, getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
const ST = 'calendarium.hemisferio';
const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');

/* ---------- HTML / acessibilidade ---------- */
ok('HTML: grupo "Hemisfério" rotulado, dois botões com aria-pressed (Sul ligado por padrão)',
  /role="group" aria-labelledby="hemiRot"/.test(HTML) && /id="hemiRot"[^>]*>Hemisfério</.test(HTML) &&
  /id="btnHemiSul" aria-pressed="true"/.test(HTML) && /id="btnHemiNorte" aria-pressed="false"/.test(HTML));

/* ---------- padrão: Sul, comportamento original ---------- */
{
  const amb = carregar(SCRIPTS, { localStorage: memoria() }); const K = amb.ctx.LiturgyKit;
  ok('padrão é Sul, com a ordem original das estações', K.hemisferio() === 'sul' && K.estacoes().join() === 'Outono,Inverno,Primavera,Verão', K.estacoes());
  amb.irPara('2026-11-26T12:00');
  ok('Sul: mês e festas com os textos originais', /Equinócio de Março\n/.test(amb.el('clockdiv').innerHTML) && !/Equinócio de Março ·/.test(amb.el('clockdiv').innerHTML) && !/Solstício de Junho ·/.test(amb.el('clockdiv').innerHTML));
  ok('nada é gravado só por abrir o app', Object.keys(amb.ctx.localStorage.m).length === 0);
}

/* ---------- troca para o Norte ---------- */
{
  const st = memoria(); const amb = carregar(SCRIPTS, { localStorage: st }); const K = amb.ctx.LiturgyKit;
  const eventos = []; amb.document.addEventListener('calendarium:hemisferio-mudou', (e) => eventos.push(e.detail.hemisferio));
  amb.irPara('2026-11-26T12:00');
  const sul = K.lunarMonth('2026-11-26').name, relogioSul = amb.el('clockdiv').innerHTML;
  amb.el('btnHemiNorte').dispatch('click');
  ok('clicar em Norte muda o hemisfério, grava a escolha e avisa por evento', K.hemisferio() === 'norte' && st.m[ST] === 'norte' && eventos.join() === 'norte');
  ok('Norte: ordem Primavera, Verão, Outono, Inverno', K.estacoes().join() === 'Primavera,Verão,Outono,Inverno');
  ok('botões refletem o estado (aria-pressed e destaque)', amb.el('btnHemiNorte').getAttribute('aria-pressed') === 'true' && amb.el('btnHemiSul').getAttribute('aria-pressed') === 'false' && /btn-on/.test(amb.el('btnHemiNorte').className) && !/btn-on/.test(amb.el('btnHemiSul').className));
  const norte = K.lunarMonth('2026-11-26').name;
  ok('o mesmo mês lunar troca só a estação (' + sul + ' → ' + norte + ')', sul !== norte && sul.split(' da ')[0] === norte.split(' da ')[0]);
  ok('o painel de informações já mostra o nome novo, sem esperar o próximo segundo', amb.el('info').innerHTML.indexOf(norte) >= 0 && amb.el('info').innerHTML.indexOf(sul) < 0);
  ok('o relógio foi redesenhado', amb.el('clockdiv').innerHTML !== relogioSul);
  const MAP = { Outono: 'Primavera', Inverno: 'Verão', Primavera: 'Outono', Verão: 'Inverno' };
  let bom = true; const vistos = new Set();
  for (let k = 0; k < 14; k++) {
    K.setHemisferio('sul'); const a = K.lunarMonthK(1000 + k).name; K.setHemisferio('norte'); const b = K.lunarMonthK(1000 + k).name;
    const [ord, est] = a.split(' da '); vistos.add(est); if (b !== ord + ' da ' + MAP[est]) bom = false;
  }
  ok('os 12 meses: ordinal igual e estação correspondente (Outono↔Primavera, Inverno↔Verão)', bom && vistos.size === 4);
  amb.run('window.mystRender()');
  const myst = amb.el('mystList').innerHTML;
  ok('Norte: festas de equinócio e solstício ganham a estação no rótulo', /Equinócio de Março · primavera/.test(myst) && /Solstício de Junho · verão/.test(myst) && /Equinócio de Setembro · outono/.test(myst) && /Solstício de Dezembro · inverno/.test(myst), myst.match(/(Equinócio|Solstício)[^<]*/g));
  ok('Norte: festas de 1º do mês (não astronômicas) ficam iguais', /1º de Maio</.test(myst) && /1º de Agosto</.test(myst) && /1º de Novembro</.test(myst) && /1º de Fevereiro</.test(myst));
  ok('Norte: a dica (title) dos ícones do relógio também usa o rótulo ajustado', /Mistérios Menores — Equinócio de Março · primavera/.test(amb.el('clockdiv').innerHTML));
  ok('Norte: nomes e temas das festas não mudam', /Mistérios Menores/.test(myst) && /Banquete dos Mortos/.test(myst) && /Adônis/.test(myst));
  amb.el('btnHemiSul').dispatch('click');
  ok('voltar ao Sul restaura exatamente o relógio original', amb.el('clockdiv').innerHTML === relogioSul && st.m[ST] === 'sul');
  ok('valor inválido é rejeitado', K.setHemisferio('leste') === false && K.setHemisferio(null) === false && K.hemisferio() === 'sul');
}

/* ---------- persistência ---------- */
{
  const st = memoria({ [ST]: 'norte' }); const amb = carregar(SCRIPTS, { localStorage: st });
  ok('reabrir o app lembra o Norte (26/11 é Verão no Sul, Inverno no Norte)', amb.ctx.LiturgyKit.hemisferio() === 'norte' && /Inverno/.test(amb.ctx.LiturgyKit.lunarMonth('2026-11-26').name), amb.ctx.LiturgyKit.lunarMonth('2026-11-26').name);
  ok('reabrir: o botão Norte já nasce marcado', amb.el('btnHemiNorte').getAttribute('aria-pressed') === 'true');
  for (const lixo of ['xyz', '', 'NORTE', '{"a":1}', 'undefined']) {
    const a = carregar(SCRIPTS, { localStorage: memoria({ [ST]: lixo }) });
    ok('valor guardado inválido (' + JSON.stringify(lixo) + ') → Sul', a.ctx.LiturgyKit.hemisferio() === 'sul');
  }
  const quebrado = { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('cheio'); } };
  let erro = null, a2 = null;
  try { a2 = carregar(SCRIPTS, { localStorage: quebrado }); a2.el('btnHemiNorte').dispatch('click'); } catch (e) { erro = e.message; }
  ok('localStorage bloqueado/cheio: sem exceção, e a troca vale na sessão', erro === null && a2 && a2.ctx.LiturgyKit.hemisferio() === 'norte', erro);
  const a3 = carregar(SCRIPTS, {});
  ok('sem localStorage (indefinido): sem exceção, padrão Sul', a3.ctx.LiturgyKit.hemisferio() === 'sul');
}

/* ---------- a escolha não vai para a nuvem ---------- */
{
  const nuvem = fs.readFileSync(path.join(RAIZ, 'nuvem.js'), 'utf8'), store = fs.readFileSync(path.join(RAIZ, 'store.js'), 'utf8');
  ok('a preferência não entra na sincronização nem no store (só local)', !/hemisf/i.test(nuvem) && !/hemisf/i.test(store));
}

console.log(R.join('\n'));
const f = R.filter((l) => l.startsWith('FALHOU')).length;
console.log('\n' + (f ? f + ' FALHA(S) de ' + R.length : 'TUDO OK — ' + R.length + ' verificações'));
process.exit(f ? 1 : 0);
