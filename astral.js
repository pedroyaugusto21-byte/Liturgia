/* global Ouranos, NAMED_STARS, SYMBOL_CATALOG */
/* Este arquivo é a INTERFACE (relógio, painel, eventos, boot). O cálculo está em astral-calc.js (window.AstralCore)
   e a montagem de HTML/SVG em astral-vista.js (window.AstralVista); ambos carregam antes deste. */
/* Ouranos e as constantes NAMED_STARS e SYMBOL_CATALOG vêm do documento
   que carrega este script (roteiro principal e ouranos-data.js). */
/* ======================================================================
   CALENDARIUM · MÓDULO ASTRAL — aba Urano, modo "Mapa Astral"
   ----------------------------------------------------------------------
   Acrescenta ao Mapa Astral:
     · controle de tempo (acelerar, reverter, pausar, ir a uma data);
     · leitura por astro com as cinco dignidades essenciais (pontuação de
       Lilly), conjunções, aspectos por moiety, debilidades (inclusive
       estacionário) e estrelas fixas ao alcance da longitude;
     · Urano, Netuno e Plutão (sem dignidade tradicional), nodos médios da
       Lua, Ascendente, Meio do Céu e casas por signo inteiro (só com
       localização), Parte da Fortuna e hora planetária;
     · tábua das dignidades e glossário dos critérios usados.
   Consome a API Ouranos.astral(data) do roteiro principal e as constantes
   de ouranos-data.js. Nada aqui altera o restante do Calendarium.

   PRECISÃO ESPERADA DAS EFEMÉRIDES  (ver também o aviso na interface)
     · Faixa de validade: 1800–2050 (elementos de Standish/JPL). Fora dela o
       mapa continua sendo calculado, mas aparece o aviso
       "Efemérides aproximadas fora de 1800–2050".
     · Sol: série de baixa precisão de Meeus (cap. 25), longitude geométrica.
     · Lua: série truncada de Meeus (cap. 47), longitude média do equinócio da data.
     · Planetas: elementos keplerianos de Standish & Williams (JPL), tabela
       8.10.2 (1800–2050). Erro nominal em longitude heliocêntrica: Mercúrio 15″,
       Vênus 20″, Marte 40″, Júpiter 400″, Saturno 600″, Urano 50″, Netuno 10″,
       Plutão 5″ (a longitude geocêntrica herda o erro do planeta e o da Terra, 20″).
     · NÃO se aplicam nutação (até ±17″ em longitude), aberração (≈ 20,5″) nem
       tempo-luz; UT é tratado como TT (ΔT ≈ 69 s em 2026: ≈ 0,01° na Lua).
     · Ascendente e Meio do Céu usam tempo sideral médio (sem nutação).
     · Desvios medidos (verificação de 14/10/2026): Sol, Mercúrio, Vênus, Marte, Urano, Netuno e
       Plutão ≤ 1,0′; Júpiter ≤ 2,8′; Saturno ≤ 5,0′ (dentro do erro nominal de Standish);
       Lua truncada: 5,3′ contra o exemplo 47.a de Meeus (+ΔT: até ≈ 0,6′ por minuto de erro de hora);
       Ascendente 0,5′, Meio do Céu 0,2′ e Parte da Fortuna 1,3′ no mapa de Einstein (1879).
   ====================================================================== */
/* ======================================================================
   DEPENDÊNCIAS E FALHA SEGURA
   O que este módulo espera encontrar (fornecido pelo index.html, ouranos.js e ouranos-data.js):
     · Globais de scripts clássicos, carregados ANTES deste:
         Ouranos       — usa Ouranos.astral(data, local) e Ouranos.astralRefresh();
         NAMED_STARS, SYMBOL_CATALOG — opcionais: sem eles o catálogo de estrelas fica vazio e a
                         leitura avisa que ele está indisponível.
     · DOM do index.html:
         #ouranosView  — ganha a classe astral-on no modo Mapa Astral (só então o painel aparece);
         #ou-astral-panel — onde o módulo monta a caixa de tempo, o título, #ou-astro-list e a tábua;
         #ou-astral-svg e #ou-astral-grid — desenhados pelo index.html (não por este módulo).
     · Classes de estilo herdadas do index.html: .ou-btn, .ou-pill, .ou-pills, .ou-row,
         .ou-zoom-row, .ou-speed-label (o restante está em astral.css).
     · Variáveis CSS definidas em #ouranosView: --ou-border, --ou-card, --ou-text, --ou-muted,
         --ou-gold, --ou-primary.
   O que este módulo OFERECE: window.AstralClock (relógio), window.AstralStars.svg e
   window.AstralPoints.svg (desenhos chamados pelo index.html), window.AstralPanel.frame(A, force)
   (chamado a cada redesenho do mapa) e window.AstralCalc (somente leitura).
   Falha segura (nada disso lança exceção no console):
     1) na carga, sem Ouranos.astral ou Ouranos.astralRefresh o módulo simplesmente não faz nada;
     2) sem #ou-astral-panel a interface não é criada e AstralPanel.frame não faz nada;
     3) frame, boot, botões e seletor de data passam por safe(): a exceção é engolida e fica em
        AstralCalc.error();
     4) o index.html chama AstralStars.svg e AstralPoints.svg dentro de try/catch: se falharem, o
        mapa sai sem as estrelas ou sem os ângulos.
   ====================================================================== */
(function () {
  'use strict';

  /* falha segura: sem o index.html esperado (Ouranos.astral e Ouranos.astralRefresh) o módulo não faz nada */
  if (typeof Ouranos === 'undefined' || typeof Ouranos.astral !== 'function' || typeof Ouranos.astralRefresh !== 'function') return;

  var lastError = null; /* último erro engolido por safe(); ver AstralCalc.error() */
  function safe(fn) { return function () { try { return fn.apply(this, arguments); } catch (e) { lastError = e; } }; }

  /* cálculo e vista (astral-calc.js, astral-vista.js): lidos depois do guard para manter a falha segura */
  var C = window.AstralCore, V = window.AstralVista;
  var pad = C.pad,
      termRuler = C.termRuler,
      faceRuler = C.faceRuler,
      dignityOf = C.dignityOf,
      MOIETY = C.MOIETY,
      CONJ = C.CONJ,
      ASPECTS = C.ASPECTS,
      orbOf = C.orbOf,
      geoLonOuter = C.geoLonOuter,
      meanNode = C.meanNode,
      anglesOf = C.anglesOf,
      planetaryHour = C.planetaryHour,
      modelFor = C.modelFor,
      inRange = C.inRange,
      userOpen = V.userOpen,
      renderReadings = V.renderReadings,
      buildTable = V.buildTable;
  /* os desenhos que o ouranos.js chama por gancho continuam publicados com os mesmos nomes */
  window.AstralStars = V.AstralStars;
  window.AstralPoints = V.AstralPoints;

  /* ================= tempo do mapa astral ================= */
  var SPEEDS = [
    { l: '1×', v: 1 }, { l: '1 min/s', v: 60 }, { l: '1 h/s', v: 3600 },
    { l: '1 dia/s', v: 86400 }, { l: '1 mês/s', v: 2592000 }
  ];
  var st = { live: true, playing: false, dir: 1, speed: 3600, ms: Date.now() };
  var lastTs = performance.now(); /* instante real (ms) da última atualização do relógio */
  /* Avança o relógio simulado pelo tempo REAL decorrido: só corre em "reproduzir" (passado ou futuro).
     Em "agora" (live) o mapa fica parado no céu real; pausado, fica parado na data.
     Todo botão que muda o estado chama advance() ANTES de mudá-lo: o intervalo já decorrido é
     contado com o estado antigo e lastTs é renovado, então pausar, retomar, inverter o sentido ou
     voltar ao "Agora" nunca produzem salto. */
  function advance() {
    var t = performance.now(), dt = Math.min(t - lastTs, 1000); /* limita o salto com a aba em segundo plano */
    lastTs = t;
    if (!st.live && st.playing) st.ms += st.dir * st.speed * dt; /* speed = s simulados por s real */
  }
  function now() { advance(); return st.live ? new Date() : new Date(st.ms); }
  /* Reproduzindo: redesenha a ~25 quadros/s para o movimento dos astros ficar fluido. */
  function interval() { return (!st.live && st.playing) ? 40 : 1000; }

  window.AstralClock = {
    date: now,
    interval: interval,
    isLive: function () { return st.live; },
    speed: function (v) { if (typeof v === 'number') { advance(); st.speed = v; } return st.speed; },
    setTime: function (ms) { advance(); st.live = false; st.playing = false; st.ms = ms; sync(); renderNow(); },
    goLive: function () { advance(); st.live = true; st.playing = false; st.dir = 1; st.ms = Date.now(); sync(); renderNow(); }
  };

  /* API de cálculo (somente leitura): usada pelos testes e por quem quiser ler o modelo do momento. */
  window.AstralCalc = {
    model: function (A) { return modelFor(A); },
    dignity: dignityOf,
    orb: function (aspect, i, j) { return orbOf(aspect, MOIETY[i], MOIETY[j]); },
    aspects: ASPECTS, conj: CONJ,
    angles: anglesOf, meanNode: meanNode, outer: geoLonOuter, hour: planetaryHour,
    termRuler: termRuler, faceRuler: faceRuler, inRange: inRange,
    error: function () { return lastError; }
  };

  /* ================= interface ================= */
  var el = {};
  function buildUI() {
    var panel = document.getElementById('ou-astral-panel');
    if (!panel || document.getElementById('ou-time-box')) return;

    var box = document.createElement('div');
    box.className = 'ou-time-box';
    box.id = 'ou-time-box';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Controle do tempo do mapa astral');
    box.innerHTML =
      '<div class="ou-row">' +
        '<button type="button" class="ou-btn" id="ou-ast-play"><span aria-hidden="true">▶</span> Reproduzir</button>' +
        '<button type="button" class="ou-btn" id="ou-ast-past" aria-pressed="false"><span aria-hidden="true">⏪</span> Passado</button>' +
        '<button type="button" class="ou-btn" id="ou-ast-fut" aria-pressed="false">Futuro <span aria-hidden="true">⏩</span></button>' +
        '<button type="button" class="ou-btn" id="ou-ast-now" aria-pressed="true"><span aria-hidden="true">🕐</span> Agora</button>' +
        '<label class="ou-sr" for="ou-astral-dt">Ir para uma data e hora</label>' +
        '<input type="datetime-local" id="ou-astral-dt">' +
      '</div>' +
      '<div class="ou-zoom-row"><span class="ou-speed-label" id="ou-ast-speed-label">Acelerar o céu:</span>' +
        '<div class="ou-pills" id="ou-ast-speed-group" role="group" aria-labelledby="ou-ast-speed-label"></div></div>' +
      /* carimbo (muda a cada instante, SEM aria-live) separado do estado (só muda quando a pessoa age, COM aria-live) */
      '<div class="ou-time-clock" id="ou-astral-clock">' +
        '<b id="ou-astral-stamp" role="timer" aria-live="off"></b> <span aria-hidden="true">·</span> ' +
        '<em id="ou-astral-state" aria-live="polite" aria-atomic="true">' + stateText() + '</em></div>' +
      '<div class="ou-ephem-warn" id="ou-ephem-warn" role="status">⚠ Efemérides aproximadas fora de 1800–2050</div>';
    panel.insertBefore(box, panel.firstChild);

    var head = document.createElement('div');
    head.className = 'ou-detail-h';
    head.innerHTML = '<h2>Dignidades, conjunções, aspectos e debilidades</h2>' +
      '<p>Leitura astrológica na hora do mapa: os sete astros clássicos com as cinco dignidades essenciais e a pontuação de Lilly, conjunções e aspectos com orbe por moiety, debilidades acidentais (retrogradação, estacionário, combustão, queda) e estrelas fixas; os planetas exteriores, os nodos da Lua, o Ascendente, o Meio do Céu e as casas (com a localização), a Parte da Fortuna e a hora planetária.</p>';
    panel.appendChild(head);

    var list = document.createElement('div');
    list.className = 'ou-astro-list';
    list.id = 'ou-astro-list';
    list.addEventListener('click', function (e) {
      var sm = e.target && e.target.closest ? e.target.closest('summary') : null;
      var d = sm && sm.parentNode;
      var k = d && d.getAttribute && d.getAttribute('data-k');
      if (k) userOpen[k] = !d.open; /* o clique ainda vai alternar: guarda o estado de DESTINO */
    });
    panel.appendChild(list);

    var tab = document.createElement('details');
    tab.className = 'ou-dign';
    tab.id = 'ou-dign';
    tab.innerHTML = '<summary>Tábua das dignidades essenciais e glossário</summary>' + buildTable();
    panel.appendChild(tab);

    el.play = document.getElementById('ou-ast-play');
    el.past = document.getElementById('ou-ast-past');
    el.fut = document.getElementById('ou-ast-fut');
    el.now = document.getElementById('ou-ast-now');
    el.dt = document.getElementById('ou-astral-dt');
    el.clock = document.getElementById('ou-astral-clock');
    el.stamp = document.getElementById('ou-astral-stamp');
    el.state = document.getElementById('ou-astral-state');
    el.warn = document.getElementById('ou-ephem-warn');
    el.speeds = document.getElementById('ou-ast-speed-group');
    el.list = document.getElementById('ou-astro-list');
    el.box = box;

    el.speeds.innerHTML = SPEEDS.map(function (s) {
      return '<button type="button" class="ou-pill' + (s.v === st.speed ? ' active' : '') + '" data-as="' + s.v + '" aria-pressed="' + (s.v === st.speed) + '">' + s.l + '</button>';
    }).join('');
    Array.prototype.forEach.call(el.speeds.querySelectorAll('button'), function (b) {
      b.onclick = function () {
        advance();
        st.speed = Number(b.dataset.as);
        if (st.live) { st.ms = Date.now(); st.live = false; st.dir = 1; st.playing = true; }
        sync(); renderNow();
      };
    });
    el.play.onclick = function () {
      advance();
      if (st.live) { st.ms = Date.now(); st.live = false; st.dir = 1; st.playing = true; }
      else st.playing = !st.playing;
      sync(); renderNow();
    };
    el.past.onclick = function () { advance(); if (st.live) st.ms = Date.now(); st.live = false; st.dir = -1; st.playing = true; sync(); renderNow(); };
    el.fut.onclick = function () { advance(); if (st.live) st.ms = Date.now(); st.live = false; st.dir = 1; st.playing = true; sync(); renderNow(); };
    el.now.onclick = function () { advance(); st.live = true; st.playing = false; st.dir = 1; st.ms = Date.now(); sync(); renderNow(); };
    el.dt.onchange = function (e) {
      if (!e.target.value) return;
      var t = new Date(e.target.value).getTime();
      if (isNaN(t)) return;
      advance();
      st.live = false; st.playing = false; st.ms = t; sync(); renderNow();
    };
    ['play', 'past', 'fut', 'now'].forEach(function (k) { el[k].onclick = safe(el[k].onclick); });
    el.dt.onchange = safe(el.dt.onchange);
    Array.prototype.forEach.call(el.speeds.querySelectorAll('button'), function (b) { b.onclick = safe(b.onclick); });
  }

  function stampText(d) {
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  /* texto de ESTADO (lido pelo leitor de tela): não contém a hora, então só muda quando o estado muda */
  function stateText() {
    if (st.live) return 'Tempo real: o mapa acompanha o céu de agora.';
    var sp = SPEEDS.filter(function (s2) { return s2.v === st.speed; })[0], vel = sp ? sp.l : '1×';
    if (!st.playing) return 'Céu simulado: parado, velocidade ' + vel + '.';
    return 'Céu simulado: ' + (st.dir > 0 ? 'avançando rumo ao futuro' : 'recuando rumo ao passado') + ' a ' + vel + '.';
  }
  function setText(node, txt) { if (node && node.textContent !== txt) node.textContent = txt; }
  function setBtn(btn, icon, label) {
    var h = '<span aria-hidden="true">' + icon + '</span> ' + label;
    if (btn.innerHTML !== h) btn.innerHTML = h;
  }
  function sync() {
    if (!el.play) return;
    setBtn(el.play, st.playing ? '⏸' : '▶', st.playing ? 'Pausar' : 'Reproduzir');
    el.past.classList.toggle('active', !st.live && st.dir < 0);
    el.fut.classList.toggle('active', !st.live && st.dir > 0);
    el.now.classList.toggle('active', st.live);
    el.past.setAttribute('aria-pressed', String(!st.live && st.dir < 0));
    el.fut.setAttribute('aria-pressed', String(!st.live && st.dir > 0));
    el.now.setAttribute('aria-pressed', String(st.live));
    el.box.classList.toggle('sim', !st.live);
    Array.prototype.forEach.call(el.speeds.querySelectorAll('button'), function (b) {
      var on = Number(b.dataset.as) === st.speed;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    setText(el.state, stateText());
  }
  function updateClock(d) {
    setText(el.stamp, stampText(d));
    setText(el.state, stateText());
    if (el.warn) el.warn.classList.toggle('on', !inRange(d));
    if (el.dt && document.activeElement !== el.dt) {
      var v = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      if (el.dt.value !== v) el.dt.value = v;
    }
  }

  /* ================= atualização do painel (C1 e C3) =================
     Não há laço próprio. A cada redesenho do mapa o index.html chama AstralPanel.frame(A, force)
     com o MESMO A que acabou de calcular (nada é recalculado aqui) e só enquanto a aba Urano está
     ativa no modo Mapa Astral. Botões e seletor de data pedem o redesenho por Ouranos.astralRefresh().
     · O relógio é atualizado a cada quadro (só troca o texto se ele mudou).
     · A leitura (cartões) é refeita no máximo a cada READ_MIN_MS, salvo `force`, e só mexe no DOM
       quando o HTML gerado é diferente do anterior. A assinatura é o próprio HTML: tudo o que os
       cartões exibem (longitudes em minutos de arco, orbes, velocidades, aplicativo/separativo, hora
       sideral, hora planetária…) entra automaticamente e nada fica defasado; valores que não aparecem
       na tela (como a altura do Sol em ponto flutuante) não forçam redesenho. */
  var signature = '';
  var lastRead = 0, READ_MIN_MS = 250;
  function renderReadings_(A) {
    if (!el.list) return;
    var html = renderReadings(modelFor(A));
    if (html === signature) return;
    signature = html;
    /* o foco no <summary> sobrevive à reconstrução (senão o teclado "cai" no início da página) */
    var ae = document.activeElement, fk = null;
    if (ae && ae.tagName === 'SUMMARY' && el.list.contains(ae)) fk = ae.parentNode.getAttribute('data-k');
    el.list.innerHTML = html;
    if (fk) {
      var ns = el.list.querySelector('details[data-k="' + fk + '"] > summary');
      if (ns) ns.focus({ preventScroll: true });
    }
  }
  function frame(A, force) {
    if (!el.play) buildUI();
    if (!el.play) return;
    updateClock(A.date);
    var t = performance.now();
    if (!force && t - lastRead < READ_MIN_MS) return;
    lastRead = t;
    renderReadings_(A);
  }
  window.AstralPanel = { frame: safe(frame) };
  /* pede ao index.html um redesenho imediato (o retorno chega por AstralPanel.frame com force) */
  function renderNow() { if (typeof Ouranos.astralRefresh === 'function') Ouranos.astralRefresh(); }

  function boot() { buildUI(); sync(); }
  var bootSafe = safe(boot);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootSafe);
  else bootSafe();
})();
