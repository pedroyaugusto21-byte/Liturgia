/* global Ouranos, NAMED_STARS, SYMBOL_CATALOG */
/* Ouranos e as constantes NAMED_STARS e SYMBOL_CATALOG vêm do documento
   que carrega este script (roteiro principal e ouranos-data.js). */
/* ======================================================================
   CALENDARIUM · MÓDULO ASTRAL — aba Urano, modo "Mapa Astral"
   ----------------------------------------------------------------------
   Acrescenta ao Mapa Astral:
     · controle de tempo (acelerar, reverter, pausar, ir a uma data);
     · leitura por astro com dignidade essencial, conjunções, aspectos,
       debilidades e estrelas fixas ao alcance da longitude;
     · tábua das dignidades e glossário dos critérios usados.
   Consome a API Ouranos.astral(data) do roteiro principal e as constantes
   de ouranos-data.js. Nada aqui altera o restante do Calendarium.
   ====================================================================== */
(function () {
  'use strict';

  if (typeof Ouranos === 'undefined' || typeof Ouranos.astral !== 'function') return;

  var SYMF = '\uFE0E';
  var D2R = Math.PI / 180;
  var OBL = 23.4392911 * D2R;
  var norm = function (a) { return ((a % 360) + 360) % 360; };
  var sep180 = function (a, b) { var d = (((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; };
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var dd = function (v, n) { return v.toFixed(n === undefined ? 1 : n).replace('.', ','); };
  var sgn = function (v, n) { return (v < 0 ? '\u2212' : '+') + dd(Math.abs(v), n); };
  var PHASES = ['Lua Nova','Crescente Côncava','Quarto Crescente','Crescente Convexa','Lua Cheia','Minguante Convexa','Quarto Minguante','Minguante Côncava'];
  function phaseOf(elong) { return PHASES[Math.floor((norm(elong) + 22.5) / 45) % 8]; }

  /* ================= signos, elementos e regentes ================= */
  var SIGNS = [['♈','Áries'],['♉','Touro'],['♊','Gêmeos'],['♋','Câncer'],['♌','Leão'],['♍','Virgem'],['♎','Libra'],['♏','Escorpião'],['♐','Sagitário'],['♑','Capricórnio'],['♒','Aquário'],['♓','Peixes']];
  var ELEM = ['Fogo','Terra','Ar','Água'];
  var RULER = ['♂ Marte','♀ Vênus','☿ Mercúrio','☽ Lua','☉ Sol','☿ Mercúrio','♀ Vênus','♂ Marte','♃ Júpiter','♄ Saturno','♄ Saturno','♃ Júpiter'];
  function signTxt(s) { return SIGNS[s][0] + SYMF + ' ' + SIGNS[s][1]; }
  function lonTxt(lon) {
    var l = norm(lon), s = Math.floor(l / 30), ddg = l - s * 30, dg = Math.floor(ddg);
    var mn = Math.round((ddg - dg) * 60), d2 = dg, sg = s;
    if (mn === 60) { mn = 0; d2 += 1; }
    if (d2 === 30) { d2 = 0; sg = (s + 1) % 12; }
    return pad(d2) + '°' + pad(mn) + '′ ' + SIGNS[sg][0] + SYMF + ' ' + SIGNS[sg][1];
  }

  /* ================= os sete astros e suas dignidades =================
     dom = domicílio · exa = exaltação · det = detrimento · fal = queda    */
  var ASTROS = [
    { n: 'Lua',      s: '☽' }, { n: 'Mercúrio', s: '☿' }, { n: 'Vênus',  s: '♀' },
    { n: 'Sol',      s: '☉' }, { n: 'Marte',    s: '♂' }, { n: 'Júpiter', s: '♃' },
    { n: 'Saturno',  s: '♄' },
  ];
  var DIGN = [
    { dom: [3],    exa: [1],  det: [9],    fal: [7]  },
    { dom: [2, 5], exa: [5],  det: [8, 11], fal: [11] },
    { dom: [1, 6], exa: [11], det: [7, 0], fal: [5]  },
    { dom: [4],    exa: [0],  det: [10],   fal: [6]  },
    { dom: [0, 7], exa: [9],  det: [6, 1], fal: [3]  },
    { dom: [8, 11], exa: [3], det: [2, 5], fal: [9]  },
    { dom: [9, 10], exa: [6], det: [3, 4], fal: [0]  },
  ];
  function hits(i, sign) {
    var d = DIGN[i], out = [];
    if (d.dom.indexOf(sign) >= 0) out.push({ t: 'Domicílio', good: true });
    if (d.exa.indexOf(sign) >= 0) out.push({ t: 'Exaltação', good: true });
    if (d.det.indexOf(sign) >= 0) out.push({ t: 'Detrimento', good: false });
    if (d.fal.indexOf(sign) >= 0) out.push({ t: 'Queda', good: false });
    return out;
  }

  /* ================= aspectos e orbes ================= */
  var CONJ_ORB = 8;
  var ASPECTS = [
    { n: 'Oposição',         g: '☍', a: 180, o: 8, maj: true },
    { n: 'Trígono',          g: '△', a: 120, o: 7, maj: true },
    { n: 'Quadratura',       g: '□', a: 90,  o: 6, maj: true },
    { n: 'Sextil',           g: '⚹', a: 60,  o: 5, maj: true },
    { n: 'Semissextil',      g: '⚺', a: 30,  o: 2, maj: false },
    { n: 'Semiquadratura',   g: '∠', a: 45,  o: 2, maj: false },
    { n: 'Sesquiquadratura', g: '⚼', a: 135, o: 2, maj: false },
    { n: 'Quincunce',        g: '⚻', a: 150, o: 3, maj: false }
  ];

  /* ================= estrelas fixas: RA/Dec → λ/β eclípticas ================= */
  var STARS = (typeof NAMED_STARS !== 'undefined' ? NAMED_STARS : []).map(function (s) {
    var ra = (s.ra / 24) * 360 * D2R, dec = s.dec * D2R;
    var lam = norm(Math.atan2(Math.sin(ra) * Math.cos(OBL) + Math.tan(dec) * Math.sin(OBL), Math.cos(ra)) / D2R);
    var raw = Math.sin(dec) * Math.cos(OBL) - Math.cos(dec) * Math.sin(OBL) * Math.sin(ra);
    var bet = Math.asin(Math.max(-1, Math.min(1, raw))) / D2R;
    var ab = String(s.d || '').split(' ').pop();
    var cat = (typeof SYMBOL_CATALOG !== 'undefined' ? SYMBOL_CATALOG : []).filter(function (c) { return c.a === ab; })[0];
    return { n: s.n, d: s.d, m: s.m, c: s.c || '#e8d9b4', lam: lam, bet: bet, con: cat ? cat.p : ab };
  });

  /* ================= linhas da leitura ================= */
  function lineDignity(i, sign) {
    var h = hits(i, sign), tail = ' em ' + signTxt(sign) + ' · regente ' + RULER[sign] + ' · elemento ' + ELEM[sign % 4];
    if (!h.length) return '<span class="ou-empty">Peregrino — sem dignidade essencial</span>' + tail;
    var txt = h.map(function (x) { return '<b class="' + (x.good ? 'g' : 'w') + '">' + x.t + '</b>'; }).join(' e ');
    return txt + ' de ' + ASTROS[i].s + SYMF + ' ' + ASTROS[i].n + tail;
  }
  function lineConjunction(i, A) {
    var B = A.bodies, out = [];
    for (var j = 0; j < B.length; j++) {
      if (j === i) continue;
      var d = sep180(B[i].lon, B[j].lon);
      var who = '<b>' + B[j].sym + SYMF + ' ' + B[j].name + '</b>';
      if (d <= CONJ_ORB) out.push(who + ' a ' + dd(d) + '°' + (d <= 2 ? ' <b class="g">— conjunção estreita</b>' : ''));
      else if (B[j].z.sign === B[i].z.sign) out.push(who + ' no mesmo signo (' + signTxt(B[i].z.sign) + '), a ' + dd(d) + '°');
    }
    if (!out.length) return '<span class="ou-empty">Nenhuma conjunção por orbe (≤ ' + CONJ_ORB + '°) e nenhum astro no mesmo signo</span>';
    return out.join(' · ');
  }
  function lineAspects(i, A) {
    var B = A.bodies, L2 = A.laterLons, found = [], near = null;
    for (var j = 0; j < B.length; j++) {
      if (j === i) continue;
      var d = sep180(B[i].lon, B[j].lon), dl = sep180(L2[i], L2[j]);
      for (var k = 0; k < ASPECTS.length; k++) {
        var a = ASPECTS[k], orb = Math.abs(d - a.a);
        if (orb > a.o) continue;
        var item = { j: j, a: a, d: d, orb: orb, appl: Math.abs(dl - a.a) < orb };
        found.push(item);
        if (!near || orb < near.orb) near = item;
      }
    }
    if (!found.length) {
      var best = null;
      for (var m = 0; m < B.length; m++) {
        if (m === i) continue;
        var s2 = sep180(B[i].lon, B[m].lon);
        for (var q = 0; q < ASPECTS.length; q++) {
          var orb2 = Math.abs(s2 - ASPECTS[q].a);
          if (!best || orb2 < best.orb2) best = { j: m, a: ASPECTS[q], orb2: orb2, d: s2 };
        }
      }
      var hint = best ? ' — mais próximo: ' + best.a.g + ' ' + best.a.n + ' com ' + B[best.j].sym + SYMF + ' ' + B[best.j].name + ' a ' + dd(best.orb2) + '° fora do orbe' : '';
      return '<span class="ou-empty">Nenhum aspecto dentro do orbe</span>' + hint;
    }
    found.sort(function (x, y) { return (y.a.maj - x.a.maj) || (x.orb - y.orb); });
    return found.map(function (f) {
      return (f.a.maj ? '' : '<span class="ou-empty">menor · </span>') +
        '<b>' + f.a.g + ' ' + f.a.n + '</b> com <b>' + B[f.j].sym + SYMF + ' ' + B[f.j].name + '</b> — ' +
        dd(f.d) + '° · orbe ' + dd(f.orb) + '° · ' + (f.appl ? 'aplicativo' : 'separativo');
    }).join('<br>');
  }
  function lineDebility(i, A) {
    var b = A.bodies[i], out = [];
    var speed = (((A.laterLons[i] - b.lon + 540) % 360) - 180) * 24;
    out.push('Movimento ' + (b.retro ? '<b class="w">retrógrado</b>' : 'direto') + ' · ' + dd(Math.abs(speed)) + '°/dia');
    if (i === 3) {
      out.push('<span class="ou-empty">O Sol é a fonte da luz: não retrograda nem se queima.</span>');
    } else if (i === 0) {
      var dm = sep180(b.lon, A.sunLon);
      if (dm <= 0.283) out.push('<b class="g">Cazimi</b> — no coração do Sol');
      else if (dm <= 8.5) out.push('<b>Lua Nova</b> — colada ao Sol (' + dd(dm) + '°), submersa na sua luz');
      else if (dm >= 171.5) out.push('<b>Lua Cheia</b> — em oposição ao Sol (' + dd(dm) + '°), plena de luz');
      else if (dm <= 17) out.push('<b>Sob os raios do Sol</b> — ' + dd(dm) + '°');
    } else {
      var d3 = sep180(b.lon, A.sunLon);
      if (d3 <= 0.283) out.push('<b class="g">Cazimi</b> — no coração do Sol');
      else if (d3 <= 8.5) out.push('<b class="w">Combusto</b> — ' + dd(d3) + '° do Sol, submerso nas suas chamas');
      else if (d3 <= 17) out.push('<b>Sob os raios do Sol</b> — ' + dd(d3) + '°');
    }
    var h = hits(i, b.z.sign);
    h.forEach(function (x) {
      if (!x.good) out.push('<b class="w">' + x.t + '</b> — ' + (x.t === 'Detrimento' ? 'o astro está em seu signo de exílio' : 'o astro está no signo da sua queda') + ' (' + signTxt(b.z.sign) + ')');
    });
    if (!h.length) out.push('<b class="w">Peregrino</b> — sem dignidade essencial');
    return out.join(' · ');
  }
  function lineStars(i, A) {
    var lon = A.bodies[i].lon;
    var all = STARS.map(function (s) { return { s: s, d: sep180(s.lam, lon) }; }).sort(function (a, b) { return a.d - b.d; });
    function render(o, extra) {
      return '<b class="star">★ ' + o.s.n + '</b> (' + o.s.d + ' · ' + o.s.con + ') — ' + dd(o.d) + '° de longitude' +
        (extra ? ' <span class="ou-empty">(mais próxima)</span>' : (o.d <= 1 ? ' <b class="g">conjunção estreita</b>' : '')) +
        '<br>λ ' + lonTxt(o.s.lam) + ' · β ' + sgn(o.s.bet) + '° · magnitude ' + dd(o.s.m, 2);
    }
    var near = all.filter(function (o) { return o.d <= 5; }).slice(0, 4);
    if (near.length) return near.map(function (o) { return render(o, false); }).join('<br>');
    if (!all.length) return '<span class="ou-empty">Catálogo de estrelas indisponível.</span>';
    return '<span class="ou-empty">Nenhuma estrela nomeada a menos de 5° de longitude.</span><br>' + render(all[0], true);
  }

  /* ================= cartões ================= */
  function renderReadings(A) {
    return A.bodies.map(function (b, i) {
      var h = hits(i, b.z.sign);
      var tags = [];
      if (b.retro) tags.push('<span class="ou-astro-tag warn">℞ Retrógrado</span>');
      if (h.some(function (x) { return !x.good; })) tags.push('<span class="ou-astro-tag warn">Debilitado</span>');
      else if (h.length) tags.push('<span class="ou-astro-tag">Digno</span>');
      if (i === 0) {
        var lit = Math.round((1 - Math.cos(A.elong * D2R)) / 2 * 100);
        tags.push('<span class="ou-astro-tag">' + phaseOf(A.elong) + ' · ' + lit + '%</span>');
      }
      return '<article class="ou-astro" style="border-left-color:' + b.col + '">' +
        '<div class="ou-astro-h"><span class="ou-astro-sym" style="color:' + b.col + '">' + b.sym + SYMF + '</span>' +
        '<span class="ou-astro-name">' + b.name + '</span>' + tags.join('') +
        '<span class="ou-astro-pos">' + lonTxt(b.lon) + '</span></div>' +
        '<dl class="ou-rows">' +
        '<div><dt>Dignidade</dt><dd>' + lineDignity(i, b.z.sign) + '</dd></div>' +
        '<div><dt>Conjunções</dt><dd>' + lineConjunction(i, A) + '</dd></div>' +
        '<div><dt>Aspectos</dt><dd>' + lineAspects(i, A) + '</dd></div>' +
        '<div><dt>Debilidades</dt><dd>' + lineDebility(i, A) + '</dd></div>' +
        '<div><dt>Estrelas fixas</dt><dd>' + lineStars(i, A) + '</dd></div>' +
        '</dl></article>';
    }).join('');
  }

  /* ================= estrelas fixas no mapa =================
     Chamado por buildAstralSVG (index.html) através do gancho AstralStars.
     Marca no anel das estrelas cada estrela em conjunção estreita com um
     astro, ligada a ele pelo traço da sua longitude. */
  var MAP_ORB = 1;
  window.AstralStars = {
    svg: function (A, G) {
      var f = G.f, ha = G.ha, out = '';
      var UI = "font-family:'Inter',system-ui,sans-serif";
      var SYM = "font-family:'Noto Sans Symbols','Noto Sans Symbols 2','Segoe UI Symbol',serif";
      var rSt = G.rS0 - 22, marks = [];
      A.bodies.forEach(function (b) {
        STARS.forEach(function (s) {
          var d = sep180(s.lam, b.lon);
          if (d <= MAP_ORB) marks.push({ s: s, b: b, d: d });
        });
      });
      if (!marks.length) return '';
      marks.forEach(function (m) {
        var a = G.ang(m.s.lam);
        var ring = G.P(rSt, a), glyph = G.P(rSt - 13, a), foot = G.P(G.rOrb(m.b), a), lab = G.P(rSt + 17, a);
        var info = '★ ' + m.s.n + ' (' + m.s.d + ' · ' + m.s.con + ') — em conjunção com ' + m.b.sym + SYMF + ' ' + m.b.name +
          ' a ' + dd(m.d) + '° de longitude · λ ' + lonTxt(m.s.lam) + ' · β ' + sgn(m.s.bet) + '° · magnitude ' + dd(m.s.m, 2);
        out += '<g data-info="' + info + '">' +
          '<line x1="' + f(foot[0]) + '" y1="' + f(foot[1]) + '" x2="' + f(ring[0]) + '" y2="' + f(ring[1]) + '" stroke="' + ha(m.s.c, .5) + '" stroke-width="1.4"/>' +
          '<circle cx="' + f(ring[0]) + '" cy="' + f(ring[1]) + '" r="12" fill="rgba(10,14,20,.82)" stroke="' + ha(m.s.c, .9) + '" stroke-width="1.2"/>' +
          '<text x="' + f(glyph[0]) + '" y="' + f(glyph[1]) + '" text-anchor="middle" dominant-baseline="central" font-size="13" fill="' + m.s.c + '" style="' + SYM + '">★</text>' +
          '<text x="' + f(lab[0]) + '" y="' + f(lab[1]) + '" text-anchor="middle" dominant-baseline="central" font-size="9.5" fill="' + ha(m.s.c, .95) +
          '" stroke="#0a0e14" stroke-width="3" paint-order="stroke" style="' + UI + '">' + m.s.n + ' ' + dd(m.d) + '°</text>' +
          '</g>';
      });
      return out;
    }
  };

  /* ================= tábua e glossário ================= */
  function signsCell(list, mark) {
    if (!list.length) return '—';
    return list.map(function (s) { return SIGNS[s][0] + SYMF + ' <em>' + SIGNS[s][1] + '</em>' + (mark ? ' ' + mark : ''); }).join('<br>');
  }
  function buildTable() {
    var rows = DIGN.map(function (d, i) {
      return '<tr><td class="sym">' + ASTROS[i].s + SYMF + '</td><td>' + ASTROS[i].n + '</td>' +
        '<td>' + signsCell(d.dom) + '</td><td>' + signsCell(d.exa) + '</td>' +
        '<td>' + signsCell(d.det) + '</td><td>' + signsCell(d.fal) + '</td></tr>';
    }).join('');
    return '<div class="ou-tab-wrap"><table class="ou-tab"><thead><tr>' +
      '<th>Astro</th><th></th><th>Domicílio</th><th>Exaltação</th><th>Detrimento</th><th>Queda</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="ou-gloss">' +
      '<b>Dignidade essencial</b> — o astro <b>rege</b> o seu domicílio, é <b>honrado</b> na exaltação, e cai no <b>detrimento</b> (signo oposto ao domicílio) e na <b>queda</b> (signo oposto à exaltação). Sem nenhuma dessas condições, o astro é <b>peregrino</b>. ' +
      'Esta é a tábua ptolomaica dos sete astros errantes; aqui ela é lida na longitude real do mapa.' +
      '<br><b>Aspectos e orbes</b> — Conjunção ☌ 0° (8°) · Oposição ☍ 180° (8°) · Trígono △ 120° (7°) · Quadratura □ 90° (6°) · Sextil ⚹ 60° (5°); menores, com orbes estreitos: Semissextil ⚺ 30° (2°) · Semiquadratura ∠ 45° (2°) · Sesquiquadratura ⚼ 135° (2°) · Quincunce ⚻ 150° (3°). ' +
      'Um aspecto <b>aplicativo</b> ainda se fecha na hora seguinte; <b>separativo</b>, já se desfez.' +
      '<br><b>Debilidades</b> — <b>retrógrado</b>: percurso aparente inverso; <b>combusto</b>: a menos de 8°30′ do Sol; <b>sob os raios</b>: a menos de 17°; <b>cazimi</b>: a 17′ ou menos, no coração do Sol; além do detrimento, da queda e da condição peregrina. A velocidade é dada em graus por dia.' +
      '<br><b>Estrelas fixas</b> — a conjunção é medida pela <b>longitude eclíptica</b> (λ), como manda a tradição; <b>β</b> é a latitude celeste da estrela (quanto maior, mais longe do caminho dos astros) e <b>m</b> a magnitude visual. No mapa, a estrela em conjunção estreita (≤ 1°) fica marcada no anel das estrelas, ligada ao astro pelo traço da sua longitude.' +
      '</p>';
  }

  /* ================= tempo do mapa astral ================= */
  var SPEEDS = [
    { l: '1×', v: 1 }, { l: '1 min/s', v: 60 }, { l: '1 h/s', v: 3600 },
    { l: '1 dia/s', v: 86400 }, { l: '1 mês/s', v: 2592000 }
  ];
  var st = { live: true, playing: false, dir: 1, speed: 3600, ms: Date.now(), last: performance.now() };
  /* Avança o relógio simulado: só corre em "reproduzir" (passado ou futuro).
     Em "agora" (live) o mapa fica parado no céu real; pausado, fica parado na data. */
  function advance() {
    var t = performance.now(), dt = Math.min(t - st.last, 500);
    st.last = t;
    if (!st.live && st.playing) st.ms += st.dir * st.speed * dt; /* speed = s simulados por s real */
  }
  function now() { advance(); return st.live ? new Date() : new Date(st.ms); }
  /* Reproduzindo: redesenha a ~25 quadros/s para o movimento dos astros ficar fluido. */
  function interval() { return (!st.live && st.playing) ? 40 : 1000; }

  window.AstralClock = {
    date: now,
    interval: interval,
    isLive: function () { return st.live; },
    speed: function (v) { if (typeof v === 'number') st.speed = v; return st.speed; },
    setTime: function (ms) { st.live = false; st.playing = false; st.ms = ms; sync(); renderNow(); },
    goLive: function () { st.live = true; st.playing = false; st.dir = 1; st.ms = Date.now(); sync(); renderNow(); }
  };

  /* ================= interface ================= */
  var el = {};
  function buildUI() {
    var panel = document.getElementById('ou-astral-panel');
    if (!panel || document.getElementById('ou-time-box')) return;

    var box = document.createElement('div');
    box.className = 'ou-time-box';
    box.id = 'ou-time-box';
    box.innerHTML =
      '<div class="ou-row">' +
        '<button class="ou-btn" id="ou-ast-play">▶ Reproduzir</button>' +
        '<button class="ou-btn" id="ou-ast-past">⏪ Passado</button>' +
        '<button class="ou-btn" id="ou-ast-fut">Futuro ⏩</button>' +
        '<button class="ou-btn" id="ou-ast-now">🕐 Agora</button>' +
        '<input type="datetime-local" id="ou-astral-dt" aria-label="Ir para um momento">' +
      '</div>' +
      '<div class="ou-zoom-row"><span class="ou-speed-label">Acelerar o céu:</span>' +
        '<div class="ou-pills" id="ou-ast-speed-group"></div></div>' +
      '<div class="ou-time-clock" id="ou-astral-clock"></div>';
    panel.insertBefore(box, panel.firstChild);

    var head = document.createElement('div');
    head.className = 'ou-detail-h';
    head.innerHTML = '<h2>Dignidades, conjunções, aspectos e debilidades</h2>' +
      '<p>Leitura astrológica dos sete astros na hora do mapa: dignidade essencial no signo ocupado, conjunções entre si e com as estrelas fixas, aspectos maiores e menores com o seu orbe, debilidades acidentais (retrogradação, combustão, queda) e as estrelas fixas ao alcance de cada longitude.</p>';
    panel.appendChild(head);

    var list = document.createElement('div');
    list.className = 'ou-astro-list';
    list.id = 'ou-astro-list';
    panel.appendChild(list);

    var tab = document.createElement('details');
    tab.className = 'ou-dign';
    tab.id = 'ou-dign';
    tab.innerHTML = '<summary>Tábua das dignidades essenciais</summary>' + buildTable();
    panel.appendChild(tab);

    el.play = document.getElementById('ou-ast-play');
    el.past = document.getElementById('ou-ast-past');
    el.fut = document.getElementById('ou-ast-fut');
    el.now = document.getElementById('ou-ast-now');
    el.dt = document.getElementById('ou-astral-dt');
    el.clock = document.getElementById('ou-astral-clock');
    el.speeds = document.getElementById('ou-ast-speed-group');
    el.list = document.getElementById('ou-astro-list');
    el.box = box;

    el.speeds.innerHTML = SPEEDS.map(function (s) {
      return '<button class="ou-pill' + (s.v === st.speed ? ' active' : '') + '" data-as="' + s.v + '">' + s.l + '</button>';
    }).join('');
    Array.prototype.forEach.call(el.speeds.querySelectorAll('button'), function (b) {
      b.onclick = function () {
        st.speed = Number(b.dataset.as);
        if (st.live) { st.ms = Date.now(); st.live = false; st.dir = 1; st.playing = true; }
        sync(); renderNow();
      };
    });
    el.play.onclick = function () {
      if (st.live) { st.ms = Date.now(); st.live = false; st.dir = 1; st.playing = true; }
      else st.playing = !st.playing;
      sync(); renderNow();
    };
    el.past.onclick = function () { if (st.live) st.ms = Date.now(); st.live = false; st.dir = -1; st.playing = true; sync(); renderNow(); };
    el.fut.onclick = function () { if (st.live) st.ms = Date.now(); st.live = false; st.dir = 1; st.playing = true; sync(); renderNow(); };
    el.now.onclick = function () { st.live = true; st.playing = false; st.dir = 1; st.ms = Date.now(); sync(); renderNow(); };
    el.dt.onchange = function (e) {
      if (!e.target.value) return;
      var t = new Date(e.target.value).getTime();
      if (isNaN(t)) return;
      st.live = false; st.playing = false; st.ms = t; sync(); renderNow();
    };
  }

  function clockHTML() {
    var d = now();
    var stamp = pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    if (st.live) return '<b>' + stamp + '</b> <em>· tempo real · o mapa acompanha o céu de agora</em>';
    var sp = SPEEDS.filter(function (s) { return s.v === st.speed; })[0];
    var estado = st.playing ? (st.dir > 0 ? 'avançando' : 'recuando') : 'parado';
    return '<b>' + stamp + '</b> <em>· céu simulado — ' + estado + ' a ' + (sp ? sp.l : '1×') + ' · ' +
      (st.dir > 0 ? 'futuro' : 'passado') + '</em>';
  }
  function sync() {
    if (!el.play) return;
    el.play.textContent = st.playing ? '⏸ Pausar' : '▶ Reproduzir';
    el.past.classList.toggle('active', !st.live && st.dir < 0);
    el.fut.classList.toggle('active', !st.live && st.dir > 0);
    el.now.classList.toggle('active', st.live);
    el.box.classList.toggle('sim', !st.live);
    Array.prototype.forEach.call(el.speeds.querySelectorAll('button'), function (b) {
      b.classList.toggle('active', Number(b.dataset.as) === st.speed);
    });
  }
  function updateClock(d) {
    var txt = clockHTML();
    if (el.clock && el.clock.innerHTML !== txt) el.clock.innerHTML = txt;
    if (el.dt && document.activeElement !== el.dt) {
      var v = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      if (el.dt.value !== v) el.dt.value = v;
    }
  }

  /* ================= laço de atualização ================= */
  var signature = '';
  function renderReadings_(A) {
    if (!el.list) return;
    var sig = A.bodies.map(function (b) { return b.name + b.lon.toFixed(1) + (b.retro ? 'R' : ''); }).join('|');
    if (sig === signature) return;
    signature = sig;
    el.list.innerHTML = renderReadings(A);
  }
  function renderNow() {
    var view = document.getElementById('ouranosView');
    if (!view || !view.classList.contains('astral-on')) return;
    var A = Ouranos.astral(now());
    updateClock(A.date);
    renderReadings_(A);
  }
  function tick() {
    var view = document.getElementById('ouranosView');
    if (!view || !view.classList.contains('astral-on')) return;
    if (!el.play) buildUI();
    if (!el.play) return;
    var A = Ouranos.astral(now());
    updateClock(A.date);
    renderReadings_(A);
  }

  function boot() {
    buildUI();
    sync();
    setInterval(tick, 250);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();