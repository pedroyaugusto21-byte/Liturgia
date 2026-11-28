/* Teste da ETAPA C (resize e orientação). Node puro:  node tests/teste-redimensionar.js
   Cobre: debounce único, lunar.js (tamanho, DPR, estado), ouranos.js (resolução do canvas, estado visual),
   Liturgia/Mistérios (SVG sem tamanho fixo) e acessibilidade/movimento reduzido. */
const fs = require('fs');
const path = require('path');
const { carregar } = require('./_ambiente');
const RAIZ = path.join(__dirname, '..');
process.env.TZ = 'America/Bahia';
const R = [];
const ok = (n, c, d) => R.push((c ? 'OK      ' : 'FALHOU  ') + n + (!c && d !== undefined ? '  [' + JSON.stringify(d) + ']' : ''));
const HTML = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(RAIZ, 'calendarium.css'), 'utf8');
const ordem = [...HTML.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
const cont = (log, nome) => log.filter((c) => c[0] === nome).length;

/* ---------- 0. HTML ---------- */
ok('redimensionar.js é carregado antes de lunar.js e ouranos.js', ordem.indexOf('redimensionar.js') >= 0 && ordem.indexOf('redimensionar.js') < ordem.indexOf('lunar.js') && ordem.indexOf('redimensionar.js') < ordem.indexOf('ouranos.js'), ordem);

/* ---------- 1. debounce e eventos ---------- */
{
  const amb = carregar(['redimensionar.js']); const RS = amb.ctx.CalendariumResize; let n = 0;
  RS.aoRedimensionar(() => n++);
  for (let i = 0; i < 20; i++) { amb.disparaJanela('resize'); amb.avancar(50); }
  ok('rajada de 20 resize em 1 s não dispara nada antes de a rajada terminar', n === 0, n);
  amb.avancar(RS.ESPERA_MS + 1);
  ok('...e dispara UMA vez ' + RS.ESPERA_MS + ' ms após o último evento', n === 1, n);
  amb.disparaJanela('orientationchange'); amb.avancar(RS.ESPERA_MS + 1);
  ok('orientationchange também dispara (uma vez)', n === 2, n);
  amb.disparaTela('change'); amb.avancar(RS.ESPERA_MS + 1);
  ok('screen.orientation "change" também dispara', n === 3, n);
  amb.disparaJanela('resize'); amb.disparaJanela('orientationchange'); amb.disparaTela('change'); amb.avancar(RS.ESPERA_MS + 1);
  ok('resize + orientationchange + screen.orientation juntos (giro real) → uma só chamada', n === 4, n);
  let b = 0; const cancela = RS.aoRedimensionar(() => b++); amb.disparaJanela('resize'); amb.avancar(300); cancela(); amb.disparaJanela('resize'); amb.avancar(300);
  ok('a função devolvida cancela a assinatura', b === 1);
  const ruim = carregar(['redimensionar.js']); let bom = 0; const silencio = ruim.ctx.console; ruim.ctx.console = { error() {} };
  ruim.ctx.CalendariumResize.aoRedimensionar(() => { throw new Error('x'); }); ruim.ctx.CalendariumResize.aoRedimensionar(() => bom++);
  ruim.disparaJanela('resize'); ruim.avancar(300);
  ok('assinatura que lança erro não impede as outras', bom === 1);
  ok('sem timers pendentes depois de tudo', amb.pendentes() === 0);
}

/* ---------- 2. lunar.js ---------- */
{
  const amb = carregar(['redimensionar.js', 'lunar.js'], { janela: { innerWidth: 1024, devicePixelRatio: 1 } });
  const cv = amb.el('moonCanvas'), g = cv.getContext('2d');
  ok('carga em janela larga: canvas 360 CSS px, DPR 1', cv.width === 360 && cv.style.width === '360px');
  /* estado: avança 2 meses e aponta o cursor no dia 1 (topo do anel) */
  const mesInicial = amb.el('monthYear').textContent;
  amb.ctx.changeMonth(1); amb.ctx.changeMonth(1);
  const mes = amb.el('monthYear').textContent;
  cv.rect = { left: 0, top: 0, width: 360, height: 360 };
  const aponta = (size) => cv.dispatch('mousemove', { clientX: size / 2, clientY: size / 2 - size * 0.345 });
  aponta(360);
  const hover = amb.el('hoverInfo').textContent;
  ok('antes do resize: mês navegado e dia sob o cursor', mes !== mesInicial && /^Dia 1 ·/.test(hover), [mes, hover]);
  g.log.length = 0;
  amb.redimensionar(420, 1);   /* celular em pé: 420 − 80 = 340 */
  ok('o canvas NÃO muda antes do debounce', cv.width === 360 && g.log.length === 0);
  amb.avancar(300);
  ok('retrato 420 px: canvas passa a 340 px', cv.width === 340 && cv.style.width === '340px' && cv.style.height === '340px', [cv.width, cv.style.width]);
  ok('redesenhou imediatamente (clearRect + arcos) com o novo tamanho', cont(g.log, 'clearRect') === 1 && g.log.some((c) => c[0] === 'clearRect' && c[3] === 340) && g.log.some((c) => c[0] === 'arc' && c[1] === 170), g.log.slice(0, 3));
  ok('matriz definida por setTransform(DPR) — nunca acumulada com scale', g.log.length > 0 && cont(g.log, 'scale') === 0, cont(g.log, 'scale'));
  ok('mês em exibição preservado', amb.el('monthYear').textContent === mes);
  ok('texto do cursor preservado', amb.el('hoverInfo').textContent === hover);
  cv.rect = { left: 0, top: 0, width: 340, height: 340 };
  aponta(340);
  ok('o hit-test acompanha o novo tamanho (dia 1 de novo no topo do anel)', /^Dia 1 ·/.test(amb.el('hoverInfo').textContent), amb.el('hoverInfo').textContent);
  amb.run('0'); g.log.length = 0;
  amb.redimensionar(420, 1); amb.avancar(300);
  ok('resize sem mudar a largura (ex.: só a barra de endereço) não redesenha', g.log.length === 0);
  amb.redimensionar(420, 3); amb.avancar(300);
  ok('DPR 3 (mover para outra tela / zoom): backing store 1020 px, CSS continua 340', cv.width === 1020 && cv.style.width === '340px', [cv.width, cv.style.width]);
  amb.redimensionar(300, 2); amb.avancar(300);
  ok('janela estreita 300 px: 220 CSS × DPR 2 = 440', cv.width === 440 && cv.style.width === '220px');
  amb.redimensionar(100, 1); amb.avancar(300);
  ok('janela minúscula: piso de 160 px (antes ficaria negativo)', cv.width === 160 && cv.style.width === '160px', cv.width);
  amb.disparaJanela('orientationchange'); amb.redimensionar(900, 1); amb.avancar(300);
  ok('paisagem: volta ao máximo de 360', cv.width === 360 && amb.el('monthYear').textContent === mes);
  amb.ctx.changeMonth(-1);
  ok('navegar de mês depois do resize continua funcionando', amb.el('monthYear').textContent !== mes);
}

/* ---------- 3. ouranos.js ---------- */
{
  const geolocation = { getCurrentPosition() {} };
  const amb = carregar(['redimensionar.js', 'ouranos-data.js', 'ouranos-calc.js', 'ouranos.js'], { janela: { innerWidth: 1024, devicePixelRatio: 2 }, geolocation });
  const cv = amb.el('ou-canvas'), g = cv.getContext('2d');
  cv.rect = { left: 0, top: 0, width: 700, height: 560 };
  amb.run('Ouranos.activate()');
  ok('desktop 700 px exibidos, DPR 2: backing store 1400×1120 (nitidez), lógica 700×560', cv.width === 1400 && cv.height === 1120 && g.log.some((c) => c[0] === 'setTransform' && c[1] === 2 && c[4] === 2), [cv.width, cv.height]);
  amb.el('ou-zoom').oninput = amb.el('ou-zoom').oninput || (() => {});
  const z = amb.el('ou-zoom'); z.value = '230'; z.oninput();
  amb.el('ou-pause-btn').onclick();   /* pausa: a esfera não gira sozinha */
  const antes = amb.run('Ouranos.estadoVisual()');
  ok('zoom 230 aplicado e esfera pausada', antes.zoom === 230, antes);
  g.log.length = 0;
  cv.rect = { left: 0, top: 0, width: 360, height: 288 };
  amb.redimensionar(390, 3);   /* celular, DPR 3 */
  ok('antes do debounce nada muda', cv.width === 1400 && g.log.length === 0);
  amb.avancar(300);
  const depois = amb.run('Ouranos.estadoVisual()');
  ok('celular 360 px × DPR 3 → escala 1,54 (1078×862)', depois.escala === 1.54 && cv.width === 1078 && cv.height === 862, depois);
  ok('redesenhou na hora, mesmo pausado (o canvas é zerado ao mudar de tamanho)', cont(g.log, 'clearRect') >= 1 && g.log.some((c) => c[0] === 'clearRect' && c[3] === 700 && c[4] === 560), g.log.slice(0, 2));
  ok('estado preservado: zoom, ângulos, modo e data de efemérides', depois.zoom === antes.zoom && depois.aX === antes.aX && depois.aY === antes.aY && depois.mode === antes.mode && depois.ephDate === antes.ephDate, [antes, depois]);
  ok('pausa preservada (botão segue "Retomar")', /Retomar/.test(amb.el('ou-pause-btn').textContent));
  cv.rect = { left: 0, top: 0, width: 360, height: 288 };
  const ev = { clientX: 180, clientY: 144 }; let semErro = true; try { cv.dispatch('mousemove', ev); } catch (e) { semErro = false; }
  ok('hover continua convertendo pelo tamanho exibido (sem exceção)', semErro);
  g.log.length = 0; amb.redimensionar(390, 3); amb.avancar(300);
  ok('mesma escala → não refaz o canvas à toa', g.log.length === 0);
  /* Mapa Astral: canvas escondido */
  amb.run("document.getElementById('ou-mode-group')");
  cv.rect = { left: 0, top: 0, width: 0, height: 0 };
  g.log.length = 0; amb.redimensionar(700, 1); amb.avancar(300);
  ok('canvas escondido (largura 0): não mexe nele', cv.width === 1078 && g.log.length === 0);
  cv.rect = { left: 0, top: 0, width: 700, height: 560 }; amb.ctx.document.getElementById('ou-mode-group');
  /* NITIDEZ_MAX */
  ok('teto de nitidez 2× (DPR 3 em 700 px não passa de 1400)', (() => { amb.redimensionar(1200, 3); amb.avancar(300); return cv.width === 1400; })(), cv.width);
  /* carga com DPR 1 em tela pequena: piso = resolução original */
  const amb2 = carregar(['redimensionar.js', 'ouranos-data.js', 'ouranos-calc.js', 'ouranos.js'], { janela: { innerWidth: 360, devicePixelRatio: 1 }, geolocation });
  amb2.el('ou-canvas').rect = { left: 0, top: 0, width: 330, height: 264 }; amb2.run('Ouranos.activate()');
  ok('DPR 1 em tela pequena: nunca abaixo de 700×560 (piso = comportamento anterior)', amb2.el('ou-canvas').width === 700 && amb2.el('ou-canvas').height === 560);
}

/* ---------- 4. Liturgia e Mistérios: SVG que escala sozinho ---------- */
{
  const amb = carregar(['ouranos-data.js', 'ouranos-calc.js', 'liturgy.js']);
  amb.irPara('2026-11-26T12:00'); amb.run('window.mystRender()');
  for (const [nome, id] of [['relógio da Liturgia', 'clockdiv'], ['relógio dos Mistérios', 'mystClockdiv']]) {
    const raiz = /^<svg[^>]*>/.exec(amb.el(id).innerHTML);
    ok(nome + ': SVG raiz tem viewBox e NÃO tem width/height fixos', raiz && /viewBox="/.test(raiz[0]) && !/\swidth=/.test(raiz[0]) && !/\sheight=/.test(raiz[0]), raiz && raiz[0]);
  }
  ok('CSS: .clock ocupa 100% da largura com altura automática (Liturgia e Mistérios)', /#liturgyView \.clock \{ width: 100%; height: auto;/.test(CSS) && /#mysteriesView \.myst-clock-wrap \.clock \{ width: 100%; height: auto;/.test(CSS));
  ok('liturgy.js não calcula tamanho em JS (nenhum innerWidth/clientWidth/devicePixelRatio)', !/innerWidth|clientWidth|devicePixelRatio|getBoundingClientRect/.test(fs.readFileSync(path.join(RAIZ, 'liturgy.js'), 'utf8')));
  const antes = amb.el('clockdiv').innerHTML; amb.redimensionar(500, 2); amb.avancar(300);
  ok('resize não altera a data nem o modo da Liturgia', amb.el('clockdiv').innerHTML === antes && amb.el('dt').value !== undefined);
}

/* ---------- 5. acessibilidade / movimento reduzido ---------- */
{
  const fonte = ['redimensionar.js', 'lunar.js', 'ouranos.js'].map((f) => fs.readFileSync(path.join(RAIZ, f), 'utf8')).join('\n');
  ok('o tratamento de resize não anima nada (sem requestAnimationFrame/transition novos em redimensionar.js)', !/requestAnimationFrame|transition|animate/.test(fs.readFileSync(path.join(RAIZ, 'redimensionar.js'), 'utf8')));
  ok('a opção de movimento reduzido do Ouranos segue intacta', /prefers-reduced-motion: reduce/.test(fonte));
  ok('nenhum innerHTML com dados do usuário foi introduzido', !/innerHTML\s*=[^;]*(innerWidth|devicePixelRatio)/.test(fonte));
}

console.log(R.join('\n'));
const f = R.filter((l) => l.startsWith('FALHOU')).length;
console.log('\n' + (f ? f + ' FALHA(S) de ' + R.length : 'TUDO OK — ' + R.length + ' verificações'));
process.exit(f ? 1 : 0);
