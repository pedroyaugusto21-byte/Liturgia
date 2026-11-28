/* ======================================================================
   MAPA ASTRAL — VISTA (window.AstralVista)
   Funções que montam TEXTO HTML/SVG a partir do cálculo (cartões da leitura, mostrador de horas,
   estrelas e pontos no mapa, tábua e glossário). Não tocam no DOM; só devolvem strings.
   Guarda userOpen/relKey (o que a pessoa abriu nos cartões). Carregar DEPOIS de astral-calc.js.
   Código MOVIDO de astral.js sem reescrever. Escopo: um IIFE; único global novo = o namespace acima.
   ====================================================================== */
window.AstralVista = (function () {
  'use strict';
  var C = window.AstralCore;
  var SYMF = C.SYMF,
      D2R = C.D2R,
      norm = C.norm,
      sep180 = C.sep180,
      pad = C.pad,
      esc = C.esc,
      dd = C.dd,
      sgn = C.sgn,
      sg0 = C.sg0,
      hh = C.hh,
      signOf = C.signOf,
      phaseOf = C.phaseOf,
      SIGNS = C.SIGNS,
      ELEM = C.ELEM,
      RULER = C.RULER,
      signTxt = C.signTxt,
      lonTxt = C.lonTxt,
      ASTROS = C.ASTROS,
      NM = C.NM,
      DIGN = C.DIGN,
      TRIP = C.TRIP,
      TERMOS = C.TERMOS,
      FACE_ORDER = C.FACE_ORDER,
      PTS = C.PTS,
      termRuler = C.termRuler,
      faceRuler = C.faceRuler,
      hasK = C.hasK,
      dignAll = C.dignAll,
      MOIETY_EXT = C.MOIETY_EXT,
      NARROW = C.NARROW,
      CONJ = C.CONJ,
      ASPECTS = C.ASPECTS,
      orbOf = C.orbOf,
      EXACT = C.EXACT,
      exactWrap = C.exactWrap,
      STAT_FRAC = C.STAT_FRAC,
      centuriesOf = C.centuriesOf,
      starLam = C.starLam,
      STARS = C.STARS,
      CHALD = C.CHALD,
      WDAY = C.WDAY,
      modelFor = C.modelFor,
      houseOf = C.houseOf,
      stationOf = C.stationOf;

  /* ================= linhas da leitura ================= */
  function dignLine(r) {
    var parts = r.items.map(function (x) { return '<b class="' + (x.good ? 'g' : 'w') + '">' + x.t + ' (' + sgn(x.p, 0) + ')</b>'; });
    if (r.peregrine) parts.push('<b class="w">Peregrino (' + sgn(PTS.per, 0) + ')</b> — nenhuma das cinco dignidades');
    return parts.join(' · ') + '<br>Pontuação de Lilly: <b class="' + (r.score >= 0 ? 'g' : 'w') + '">' + sg0(r.score) + '</b>';
  }
  function dignTail(lon, sect) {
    var s = signOf(lon), t = TRIP[s % 4], trip;
    if (t.d === t.n) trip = NM(t.d) + ' (diurna e noturna)';
    else if (sect === 'day') trip = NM(t.d) + ' (diurna)';
    else if (sect === 'night') trip = NM(t.n) + ' (noturna)';
    else trip = NM(t.d) + ' (diurna) / ' + NM(t.n) + ' (noturna)';
    return 'em ' + signTxt(s) + ' · regente ' + RULER[s] + ' · elemento ' + ELEM[s % 4] +
      '<br>termo ' + NM(termRuler(lon)) + ' · face ' + NM(faceRuler(lon)) + ' · triplicidade ' + trip;
  }
  function lineDignity(p, sect, dg) {
    var body;
    if (dg.same) body = dignLine(dg.d1);
    else body = '<span class="ou-empty">Se o mapa for diurno:</span> ' + dignLine(dg.d1) +
      '<br><span class="ou-empty">Se for noturno:</span> ' + dignLine(dg.d2);
    return body + '<br><span class="ou-empty">' + dignTail(p.lon, sect) + '</span>';
  }
  function lineConjunction(self, others) {
    var out = [];
    others.forEach(function (o) {
      var d = sep180(self.lon, o.lon), lim = orbOf(CONJ, self.m, o.m);
      var who = '<b>' + o.sym + SYMF + ' ' + o.name + '</b>';
      if (d <= lim) { var ln = who + ' a ' + dd(d) + '° (orbe ' + dd(lim) + '°)' + (d <= NARROW ? ' <b class="g">— conjunção estreita</b>' : ''); out.push(d < EXACT ? exactWrap(ln) : ln); }
      else if (signOf(o.lon) === signOf(self.lon)) out.push(who + ' no mesmo signo (' + signTxt(signOf(self.lon)) + '), a ' + dd(d) + '°');
    });
    if (!out.length) return '<span class="ou-empty">Nenhuma conjunção dentro do orbe (moieties somadas, teto de ' + CONJ.max + '°) e nenhum astro no mesmo signo</span>';
    return out.join(' · ');
  }
  /* conjunções de um ponto (nodo, ângulo, Fortuna) com os astros, pela mesma regra de orbe */
  function linePointConj(M, lon, m) {
    var out = [];
    M.pts.forEach(function (p) {
      var d = sep180(lon, p.lon), lim = orbOf(CONJ, m, p.m);
      if (d <= lim) { var lp = '<b>' + p.sym + SYMF + ' ' + p.name + '</b> a ' + dd(d) + '° (orbe ' + dd(lim) + '°)' + (d <= NARROW ? ' <b class="g">— conjunção estreita</b>' : ''); out.push(d < EXACT ? exactWrap(lp) : lp); }
    });
    return out.length ? out.join(' · ') : '<span class="ou-empty">Nenhum astro dentro do orbe</span>';
  }
  function lineAspects(self, others) {
    var found = [];
    others.forEach(function (o) {
      var d = sep180(self.lon, o.lon), dl = sep180(self.later, o.later);
      ASPECTS.forEach(function (a) {
        var lim = orbOf(a, self.m, o.m), orb = Math.abs(d - a.a);
        if (orb > lim) return;
        found.push({ o: o, a: a, d: d, orb: orb, lim: lim, appl: Math.abs(dl - a.a) < orb });
      });
    });
    if (!found.length) {
      var best = null;
      others.forEach(function (o) {
        var s2 = sep180(self.lon, o.lon);
        ASPECTS.forEach(function (a) {
          var orb2 = Math.abs(s2 - a.a), lim = orbOf(a, self.m, o.m), over = orb2 - lim;
          if (!best || over < best.over) best = { o: o, a: a, orb2: orb2, lim: lim, over: over };
        });
      });
      var hint = best ? ' — mais próximo: ' + best.a.g + ' ' + best.a.n + ' com ' + best.o.sym + SYMF + ' ' + best.o.name +
        ', a ' + dd(best.orb2) + '° da exatidão (orbe ' + dd(best.lim) + '°)' : '';
      return '<span class="ou-empty">Nenhum aspecto dentro do orbe</span>' + hint;
    }
    found.sort(function (x, y) { return (y.a.maj - x.a.maj) || (x.orb - y.orb); });
    return found.map(function (f) {
      var ln = (f.a.maj ? '' : '<span class="ou-empty">menor · </span>') +
        '<b>' + f.a.g + ' ' + f.a.n + '</b> com <b>' + f.o.sym + SYMF + ' ' + f.o.name + '</b> — ' +
        dd(f.d) + '° · orbe ' + dd(f.orb) + '° de ' + dd(f.lim) + '° · ' + (f.appl ? 'aplicativo' : 'separativo');
      return f.orb < EXACT ? exactWrap(ln) : ln;
    }).join('<br>');
  }
  function lineMove(M, p) {
    var out = ['Movimento ' + (p.retro ? '<b class="w">retrógrado</b>' : 'direto') + ' · ' + dd(Math.abs(p.speed), p.mean < 0.05 ? 3 : 1) + '°/dia'];
    var st = stationOf(M, p);
    if (st) out.push('<b class="w">Estacionário ' + (st === 'ret' ? 'retrógrado' : 'direto') + '</b> — velocidade abaixo de ' +
      Math.round(STAT_FRAC * 100) + ' % da média (' + dd(STAT_FRAC * p.mean, 3) + '°/dia); ' +
      (st === 'ret' ? 'prestes a retroceder' : 'prestes a seguir direto'));
    return out;
  }
  function lineDebility(M, p, dg) {
    var A = M.A, i = p.ci, out = lineMove(M, p);
    if (i === 3) {
      out.push('<span class="ou-empty">O Sol é a fonte da luz: não retrograda nem se queima.</span>');
    } else if (i === 0) {
      var dm = sep180(p.lon, A.sunLon);
      if (dm <= 0.283) out.push('<b class="g">Cazimi</b> — no coração do Sol');
      else if (dm <= 8.5) out.push('<b>Lua Nova</b> — colada ao Sol (' + dd(dm) + '°), submersa na sua luz');
      else if (dm >= 171.5) out.push('<b>Lua Cheia</b> — em oposição ao Sol (' + dd(dm) + '°), plena de luz');
      else if (dm <= 17) out.push('<b>Sob os raios do Sol</b> — ' + dd(dm) + '°');
    } else {
      var d3 = sep180(p.lon, A.sunLon);
      if (d3 <= 0.283) out.push('<b class="g">Cazimi</b> — no coração do Sol');
      else if (d3 <= 8.5) out.push('<b class="w">Combusto</b> — ' + dd(d3) + '° do Sol, submerso nas suas chamas');
      else if (d3 <= 17) out.push('<b>Sob os raios do Sol</b> — ' + dd(d3) + '°');
    }
    dg.d1.items.forEach(function (x) {
      if (!x.good) out.push('<b class="w">' + x.t + '</b> — ' + (x.k === 'det' ? 'o astro está em seu signo de exílio' : 'o astro está no signo da sua queda') + ' (' + signTxt(signOf(p.lon)) + ')');
    });
    if (dg.per === 'sim') out.push('<b class="w">Peregrino</b> — nenhuma das cinco dignidades essenciais');
    else if (dg.per === 'talvez') out.push('<b class="w">Peregrino</b> <span class="ou-empty">se o mapa for ' + (dg.d1.peregrine ? 'diurno' : 'noturno') + '</span>');
    return out.join(' · ');
  }
  function lineStars(lon, date) {
    var T = centuriesOf(date);
    var all = STARS.map(function (s) { var lm = starLam(s, T); return { s: s, lam: lm, d: sep180(lm, lon) }; }).sort(function (a, b) { return a.d - b.d; });
    function render(o, extra) {
      return '<b class="star">★ ' + esc(o.s.n) + '</b> (' + esc(o.s.d) + ' · ' + esc(o.s.con) + ') — ' + dd(o.d) + '° de longitude' +
        (extra ? ' <span class="ou-empty">(mais próxima)</span>' : (o.d <= 1 ? ' <b class="g">conjunção estreita</b>' : '')) +
        '<br>λ ' + lonTxt(o.lam) + ' · β ' + sgn(o.s.bet) + '° · magnitude ' + dd(o.s.m, 2);
    }
    var near = all.filter(function (o) { return o.d <= 5; }).slice(0, 4);
    if (near.length) return near.map(function (o) { return render(o, false); }).join('<br>');
    if (!all.length) return '<span class="ou-empty">Catálogo de estrelas indisponível.</span>';
    return '<span class="ou-empty">Nenhuma estrela nomeada a menos de 5° de longitude.</span><br>' + render(all[0], true);
  }

  /* ================= cartões =================
     Cada cartão é um <details> recolhível (o <summary> é o cabeçalho). `key` identifica o cartão entre
     redesenhos: o que a PESSOA abriu/fechou fica em userOpen e é reaplicado a cada reconstrução; sem
     escolha dela, só o astro mais relevante (relKey) nasce aberto. */
  var userOpen = {};
  var relKey = null;
  /* relevância do astro: menor distância entre (a) aspecto exato (orbe < 1°), (b) conjunção estreita
     (≤ NARROW) e (c) estrela fixa em conjunção estreita (≤ 1°). best = null se nenhuma ocorre. */
  function relevanceOf(M, p, others) {
    var best = null, exact = false;
    function cand(v) { if (best === null || v < best) best = v; }
    others.forEach(function (o) {
      var d = sep180(p.lon, o.lon);
      if (d <= orbOf(CONJ, p.m, o.m)) { if (d < EXACT) exact = true; if (d <= NARROW) cand(d); }
      ASPECTS.forEach(function (a) {
        var orb = Math.abs(d - a.a);
        if (orb <= orbOf(a, p.m, o.m) && orb < EXACT) { exact = true; cand(orb); }
      });
    });
    STARS.forEach(function (st2) { var ds = sep180(starLam(st2, M.T), p.lon); if (ds <= 1) cand(ds); });
    return { best: best, exact: exact };
  }
  function pickRelevant(M) {
    var best = null, key = 'c3'; /* padrão: o Sol */
    M.cl.forEach(function (p) {
      var r = relevanceOf(M, p, M.cl.filter(function (q) { return q !== p; }));
      if (r.best !== null && (best === null || r.best < best)) { best = r.best; key = 'c' + p.ci; }
    });
    M.ou.forEach(function (p) {
      var r = relevanceOf(M, p, M.pts.filter(function (q) { return q !== p; }));
      if (r.best !== null && (best === null || r.best < best)) { best = r.best; key = 'o' + p.key; }
    });
    return key;
  }
  function tag(t, warn, cls) { return '<span class="ou-astro-tag' + (warn ? ' warn' : '') + (cls ? ' ' + cls : '') + '">' + t + '</span>'; }
  function card(key, col, sym, name, tags, pos, rows) {
    var open = userOpen[key] === undefined ? (key === relKey || key === 'hora') : userOpen[key];  /* o mostrador da hora planetária já vem aberto */
    return '<details class="ou-astro" data-k="' + key + '"' + (open ? ' open' : '') + ' style="border-left-color:' + col + '">' +
      '<summary class="ou-astro-h"><span class="ou-chev" aria-hidden="true"></span>' +
      (sym ? '<span class="ou-astro-sym" style="color:' + col + '" aria-hidden="true">' + sym + SYMF + '</span>' : '') +
      '<span class="ou-astro-name">' + name + '</span>' + tags.join('') +
      (pos ? '<span class="ou-astro-pos">' + pos + '</span>' : '') + '</summary>' +
      '<dl class="ou-rows">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl></details>';
  }
  function houseRow(M, lon) { return M.known ? [['Casa', '<b>Casa ' + houseOf(M, lon) + '</b> <span class="ou-empty">· signo inteiro</span>']] : []; }
  function scoreTag(dg) {
    if (dg.same) return tag('Lilly ' + sg0(dg.d1.score), dg.d1.score < 0);
    return tag('Lilly ' + sg0(dg.d2.score) + ' (noite) · ' + sg0(dg.d1.score) + ' (dia)', false);
  }

  function classicCard(M, p) {
    var i = p.ci, A = M.A, dg = dignAll(i, p.lon, M.sect), d1 = dg.d1, tags = [];
    var others = M.cl.filter(function (q) { return q !== p; });
    if (p.retro) tags.push(tag('℞ Retrógrado', true));
    if (hasK(d1, 'det') || hasK(d1, 'fal')) tags.push(tag('Debilitado', true));
    else if (hasK(d1, 'dom') || hasK(d1, 'exa')) tags.push(tag('Digno'));
    if (dg.per === 'sim') tags.push(tag('Peregrino', true));
    tags.push(scoreTag(dg));
    if (relevanceOf(M, p, others).exact) tags.push(tag('◆ Aspecto exato', false, 'ou-exact-badge'));
    if (i === 0) {
      var lit = Math.round((1 - Math.cos(A.elong * D2R)) / 2 * 100);
      tags.push(tag(phaseOf(A.elong) + ' · ' + lit + '%'));
    }
    var rows = [['Dignidade', lineDignity(p, M.sect, dg)]].concat(houseRow(M, p.lon), [
      ['Conjunções', lineConjunction(p, others)],
      ['Aspectos', lineAspects(p, others)],
      ['Debilidades', lineDebility(M, p, dg)],
      ['Estrelas fixas', lineStars(p.lon, A.date)]
    ]);
    return card('c' + p.ci, p.col, p.sym, p.name, tags, lonTxt(p.lon), rows);
  }
  function outerCard(M, p) {
    var others = M.pts.filter(function (q) { return q !== p; }), s = signOf(p.lon), tags = [];
    tags.push(tag('Planeta exterior (sem dignidade tradicional)'));
    if (p.retro) tags.push(tag('℞ Retrógrado', true));
    if (relevanceOf(M, p, others).exact) tags.push(tag('◆ Aspecto exato', false, 'ou-exact-badge'));
    var rows = [['Dignidade', '<span class="ou-empty">Sem dignidade essencial tradicional — fora da tábua e da pontuação de Lilly · em ' +
      signTxt(s) + ' · regente tradicional do signo ' + RULER[s] + '</span>']].concat(houseRow(M, p.lon), [
      ['Conjunções', lineConjunction(p, others)],
      ['Aspectos', lineAspects(p, others)],
      ['Debilidades', lineMove(M, p).join(' · ')],
      ['Estrelas fixas', lineStars(p.lon, M.A.date)]
    ]);
    return card('o' + p.key, p.col, p.sym, p.name, tags, lonTxt(p.lon), rows);
  }
  function nodeCard(M, lon, name, sym, key) {
    var tags = [tag('Nodo médio'), tag('℞ Retrógrado', true)];
    var rows = houseRow(M, lon).concat([
      ['Movimento', 'Sempre <b class="w">retrógrado</b> (nodo médio) · ' + dd(Math.abs(M.node.speed) * 24, 3) + '°/dia'],
      ['Conjunções', linePointConj(M, lon, MOIETY_EXT)]
    ]);
    return card(key, '#9FB0C8', sym, name, tags, lonTxt(lon), rows);
  }
  function angleCard(M, lon, name, opp, extra, key) {
    var tags = [];
    if (M.polarLat) tags.push(tag('Latitude polar', true));
    var rows = [['Casa', '<b>Casa ' + houseOf(M, lon) + '</b> <span class="ou-empty">· signo inteiro</span>'], ['Oposto', opp + ' ' + lonTxt(lon + 180)]];
    if (extra) rows.push(extra);
    rows.push(['Conjunções', linePointConj(M, lon, MOIETY_EXT)]);
    return card(key, '#C9A84C', '', name, tags, lonTxt(lon), rows);
  }
  function hmsOf(h) { var t = Math.round(norm(h * 15) / 15 * 3600) % 86400; return pad(Math.floor(t / 3600)) + 'h ' + pad(Math.floor(t % 3600 / 60)) + 'm ' + pad(t % 60) + 's'; }
  function fortuneCard(M) {
    var lon = M.fortune, tags = [tag(M.sect === 'day' ? 'Mapa diurno' : 'Mapa noturno')], s = signOf(lon);
    var rows = [
      ['Casa', '<b>Casa ' + houseOf(M, lon) + '</b> <span class="ou-empty">· signo inteiro</span>'],
      ['Fórmula', M.sect === 'day' ? 'Ascendente + ☽ Lua − ☉ Sol (mapa diurno)' : 'Ascendente + ☉ Sol − ☽ Lua (mapa noturno, fórmula invertida)'],
      ['Regente', 'do signo ' + signTxt(s) + ': ' + RULER[s]],
      ['Conjunções', linePointConj(M, lon, MOIETY_EXT)]
    ];
    return card('fortuna', '#E2C36B', '⊗', 'Parte da Fortuna', tags, lonTxt(lon), rows);
  }
  /* ================= mostrador da hora planetária =================
     24 horas na borda (12 do dia, em dourado, e 12 da noite, em azul), cada uma com o símbolo do seu
     regente e o número da hora. O nascer do Sol fica à esquerda, o meio-dia no topo e o pôr do Sol à
     direita (a mesma convenção do mapa). A hora vigente é realçada e, no centro, ficam o regente
     (símbolo grande), o número da hora, o nome do regente e o intervalo em hora civil. */
  function hourDial(M) {
    var H = M.hour, A = M.A;
    if (!H || H.polar) return '';
    var cx = 150, cy = 150, f = function (v) { return v.toFixed(1); };
    var P = function (r, a) { var t = a * D2R; return [cx + r * Math.sin(t), cy - r * Math.cos(t)]; };
    var SYM = "font-family:'Noto Sans Symbols','Noto Sans Symbols 2','Segoe UI Symbol',serif";
    var UI = "font-family:'Inter',system-ui,sans-serif";
    var R0 = 98, R1 = 140;
    function seg(a1, a2) {
      var p1 = P(R1, a1), p2 = P(R1, a2), p3 = P(R0, a2), p4 = P(R0, a1);
      return 'M' + f(p1[0]) + ' ' + f(p1[1]) + 'A' + R1 + ' ' + R1 + ' 0 0 1 ' + f(p2[0]) + ' ' + f(p2[1]) +
        'L' + f(p3[0]) + ' ' + f(p3[1]) + 'A' + R0 + ' ' + R0 + ' 0 0 0 ' + f(p4[0]) + ' ' + f(p4[1]) + 'Z';
    }
    var base = CHALD.indexOf(H.dayRuler), g = '', n;
    for (n = 0; n < 24; n++) {
      var a1 = 270 + 15 * n, a2 = a1 + 15, mid = a1 + 7.5, on = n === H.n, day = n < 12;
      var rul = ASTROS[CHALD[(base + n) % 7]];
      var fill = on ? 'rgba(243,208,138,.38)' : day ? 'rgba(243,208,138,.08)' : 'rgba(110,140,215,.10)';
      var stroke = on ? '#f3d08a' : 'rgba(201,168,76,.28)';
      var sp = P(121, mid), np = P(104, mid);
      g += '<path d="' + seg(a1, a2) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + (on ? 1.6 : .7) + '"/>' +
        '<text x="' + f(sp[0]) + '" y="' + f(sp[1]) + '" text-anchor="middle" dominant-baseline="central" font-size="' + (on ? 17 : 14) +
        '" fill="' + (on ? '#f3d08a' : day ? '#d9c27c' : '#9fb4e6') + '" style="' + SYM + '">' + rul.s + SYMF + '</text>' +
        '<text x="' + f(np[0]) + '" y="' + f(np[1]) + '" text-anchor="middle" dominant-baseline="central" font-size="7.5" fill="' +
        (on ? '#f3d08a' : '#8197aa') + '" style="' + UI + '">' + ((n % 12) + 1) + '</text>';
    }
    /* ponteiro: posição dentro da hora vigente, arredondada a 0,5° para não redesenhar a cada segundo */
    var fr = ((((A.solarH - H.start) % 24) + 24) % 24) / H.len;
    fr = Math.max(0, Math.min(1, fr));
    var ang = Math.round((270 + 15 * (H.n + fr)) * 2) / 2, t1 = P(R0 - 3, ang), t2 = P(R1 + 6, ang);
    g += '<line x1="' + f(t1[0]) + '" y1="' + f(t1[1]) + '" x2="' + f(t2[0]) + '" y2="' + f(t2[1]) + '" stroke="#f3d08a" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="' + f(t2[0]) + '" cy="' + f(t2[1]) + '" r="3" fill="#f3d08a"/>';
    /* nascer, meio-dia e pôr do Sol */
    g += '<text x="' + f(P(R1 + 7, 270)[0]) + '" y="' + f(P(R1 + 7, 270)[1]) + '" text-anchor="middle" dominant-baseline="central" font-size="9" fill="#8197aa" style="' + SYM + '">☉' + SYMF + '</text>';
    /* centro */
    var rul = ASTROS[H.ruler], c = H.isDay ? '#f3d08a' : '#9fb4e6';
    g += '<circle cx="' + cx + '" cy="' + cy + '" r="92" fill="rgba(6,9,14,.75)" stroke="rgba(201,168,76,.3)"/>' +
      '<text x="' + cx + '" y="108" text-anchor="middle" dominant-baseline="central" font-size="40" fill="' + c + '" style="' + SYM + '">' + rul.s + SYMF + '</text>' +
      '<text x="' + cx + '" y="140" text-anchor="middle" font-size="12" font-weight="600" fill="#e6eefb" style="' + UI + '">' + ((H.n % 12) + 1) + 'ª hora ' + (H.isDay ? 'do dia' : 'da noite') + '</text>' +
      '<text x="' + cx + '" y="158" text-anchor="middle" font-size="11" fill="' + c + '" style="' + UI + '">regente ' + rul.n + '</text>' +
      '<text x="' + cx + '" y="177" text-anchor="middle" font-size="10" fill="#8197aa" style="' + UI + '">' + hh(H.start + A.off) + ' – ' + hh(H.end + A.off) + '</text>' +
      '<text x="' + cx + '" y="195" text-anchor="middle" font-size="9.5" fill="#8197aa" style="' + UI + '">' + WDAY[H.wd] + ' · ' + ASTROS[H.dayRuler].s + SYMF + '</text>';
    var lbl = 'Mostrador das horas planetárias: ' + ((H.n % 12) + 1) + 'ª hora ' + (H.isDay ? 'do dia' : 'da noite') + ', regida por ' + rul.n +
      ', das ' + hh(H.start + A.off) + ' às ' + hh(H.end + A.off) + '.';
    return '<div class="ou-hdial"><svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(lbl) + '" focusable="false">' + g + '</svg></div>';
  }
  function hourCard(M) {
    var H = M.hour, A = M.A;
    if (!H) return card('hora', '#F3D08A', '', 'Hora planetária', [], '', [['Hora', '<span class="ou-empty">Indisponível: sem nascer e pôr do Sol calculados para este local.</span>']]);
    if (H.polar) return card('hora', '#F3D08A', '', 'Hora planetária', [], '', [['Hora', '<span class="ou-empty">' +
      (H.polar === 'dia' ? 'Sol da meia-noite' : 'Noite polar') + ': sem nascer e pôr do Sol hoje neste local, as horas planetárias ficam indefinidas.</span>']]);
    var tags = [tag(H.isDay ? 'Hora diurna' : 'Hora noturna')];
    if (!M.known) tags.push(tag('Aproximada (sem latitude)', true));
    var rows = [
      ['Mostrador', hourDial(M)],
      ['Dia', WDAY[H.wd] + ' · regente ' + NM(H.dayRuler)],
      ['Hora', '<b>' + ((H.n % 12) + 1) + 'ª hora ' + (H.isDay ? 'do dia' : 'da noite') + '</b> <span class="ou-empty">(' + (H.n + 1) + 'ª desde o nascer do Sol)</span> · regente <b>' + NM(H.ruler) + '</b>'],
      ['Intervalo', hh(H.start + A.off) + ' – ' + hh(H.end + A.off) + ' <span class="ou-empty">(hora civil · duração ' + dd(H.len * 60, 0) + ' min)</span>']
    ];
    if (!M.known) rows.push(['Aviso', '<span class="ou-empty">Sem a latitude, o nascer e o pôr do Sol são aproximados (dia de 12 h); atualize a localização para a hora exata.</span>']);
    return card('hora', '#F3D08A', '', 'Hora planetária', tags, NM(H.ruler), rows);
  }
  function renderNotes(M) {
    var n = [];
    if (M.sect) n.push('Seita do mapa: <b>' + (M.sect === 'day' ? 'diurno' : 'noturno') + '</b> — Sol a ' + sgn(M.A.alt) + '° ' + (M.sect === 'day' ? 'acima' : 'abaixo') + ' do horizonte.');
    else n.push('<b>Seita não determinada</b> — sem a localização (latitude) não se sabe se o Sol está acima do horizonte. Mostram-se as duas triplicidades e a pontuação de Lilly para mapa diurno e noturno.');
    if (!M.known) n.push('Ascendente, Meio do Céu, casas por signo inteiro e Parte da Fortuna só aparecem com a localização conhecida: use “Atualizar localização”.');
    if (M.polarLat) n.push('<b class="w">Latitude polar (|φ| &gt; 66,5°):</b> o Ascendente e o Meio do Céu ficam instáveis (o Ascendente salta com o tempo) e as casas por signo inteiro perdem o sentido usual — leia com cautela.');
    return '<div class="ou-note">' + n.join('<br>') + '</div>';
  }
  function renderReadings(M) {
    relKey = pickRelevant(M);
    var h = renderNotes(M);
    h += '<h3 class="ou-group">Os sete astros clássicos</h3>' + M.cl.map(function (p) { return classicCard(M, p); }).join('');
    h += '<h3 class="ou-group">Planetas exteriores</h3>' + M.ou.map(function (p) { return outerCard(M, p); }).join('');
    h += '<h3 class="ou-group">Nodos, ângulos e pontos</h3>' + nodeCard(M, M.node.lon, 'Nodo Norte', '☊', 'nn') + nodeCard(M, M.node.south, 'Nodo Sul', '☋', 'ns');
    if (M.known) {
      h += angleCard(M, M.asc, 'Ascendente', 'Descendente', ['Tempo sideral local', hmsOf(M.ang.ramc / 15)], 'asc');
      h += angleCard(M, M.mc, 'Meio do Céu', 'Fundo do Céu', null, 'mc');
      if (M.fortune != null) h += fortuneCard(M);
    }
    h += '<h3 class="ou-group">Hora planetária</h3>' + hourCard(M);
    return h;
  }

  /* ================= estrelas fixas no mapa =================
     Chamado por buildAstralSVG (index.html) através do gancho AstralStars.
     Marca no anel das estrelas cada estrela em conjunção estreita com um
     astro, ligada a ele pelo traço da sua longitude. */
  var MAP_ORB = 1;
  var AstralStars = {
    svg: function (A, G) {
      var f = G.f, ha = G.ha, out = '';
      var UI = "font-family:'Inter',system-ui,sans-serif";
      var SYM = "font-family:'Noto Sans Symbols','Noto Sans Symbols 2','Segoe UI Symbol',serif";
      var rSt = G.rS0 - 22, marks = [], T = centuriesOf(A.date);
      A.bodies.forEach(function (b) {
        STARS.forEach(function (s) {
          var lm = starLam(s, T), d = sep180(lm, b.lon);
          if (d <= MAP_ORB) marks.push({ s: s, b: b, d: d, lam: lm });
        });
      });
      if (!marks.length) return '';
      marks.forEach(function (m) {
        var a = G.ang(m.lam);
        var ring = G.P(rSt, a), glyph = G.P(rSt - 13, a), foot = G.P(G.rOrb(m.b), a), lab = G.P(rSt + 17, a);
        var info = '★ ' + m.s.n + ' (' + m.s.d + ' · ' + m.s.con + ') — em conjunção com ' + m.b.sym + SYMF + ' ' + m.b.name +
          ' a ' + dd(m.d) + '° de longitude · λ ' + lonTxt(m.lam) + ' · β ' + sgn(m.s.bet) + '° · magnitude ' + dd(m.s.m, 2);
        out += '<g data-info="' + esc(info) + '">' +
          '<line x1="' + f(foot[0]) + '" y1="' + f(foot[1]) + '" x2="' + f(ring[0]) + '" y2="' + f(ring[1]) + '" stroke="' + ha(m.s.c, .5) + '" stroke-width="1.4"/>' +
          '<circle cx="' + f(ring[0]) + '" cy="' + f(ring[1]) + '" r="12" fill="rgba(10,14,20,.82)" stroke="' + ha(m.s.c, .9) + '" stroke-width="1.2"/>' +
          '<text x="' + f(glyph[0]) + '" y="' + f(glyph[1]) + '" text-anchor="middle" dominant-baseline="central" font-size="13" fill="' + m.s.c + '" style="' + SYM + '">★</text>' +
          '<text x="' + f(lab[0]) + '" y="' + f(lab[1]) + '" text-anchor="middle" dominant-baseline="central" font-size="9.5" fill="' + ha(m.s.c, .95) +
          '" stroke="#0a0e14" stroke-width="3" paint-order="stroke" style="' + UI + '">' + esc(m.s.n) + ' ' + dd(m.d) + '°</text>' +
          '</g>';
      });
      return out;
    }
  };

  /* ================= Ascendente e Meio do Céu no mapa =================
     Chamado por buildAstralSVG (index.html) através do gancho AstralPoints. Só desenha com a
     localização conhecida. Um traço fino e tracejado atravessa o anel dos signos na longitude do
     ponto, com o rótulo logo fora do anel. O mapa gira com a hora solar, então o MC fica sempre
     perto do topo e o ASC perto da esquerda (a diferença vem da obliquidade e da latitude). */
  var AstralPoints = {
    svg: function (A, G) {
      var M = modelFor(A);
      if (!M.known) return '';
      var f = G.f, ha = G.ha, rS1 = G.rS1 || (G.rS0 + 58), out = '';
      var UI = "font-family:'Inter',system-ui,sans-serif";
      [['ASC', 'Ascendente', M.asc], ['MC', 'Meio do Céu', M.mc]].forEach(function (pt) {
        var a = G.ang(pt[2]), p1 = G.P(G.rS0 - 6, a), p2 = G.P(rS1 + 6, a), lab = G.P(rS1 + 14, a);
        out += '<g data-info="' + esc(pt[1] + ' — ' + lonTxt(pt[2]) + ' · casas por signo inteiro') + '">' +
          '<line x1="' + f(p1[0]) + '" y1="' + f(p1[1]) + '" x2="' + f(p2[0]) + '" y2="' + f(p2[1]) + '" stroke="' + ha('#c9a84c', .6) + '" stroke-width="1.3" stroke-dasharray="4 3"/>' +
          '<text x="' + f(lab[0]) + '" y="' + f(lab[1]) + '" text-anchor="middle" dominant-baseline="central" font-size="10" font-weight="600" fill="' + ha('#c9a84c', .95) +
          '" stroke="#0a0e14" stroke-width="3" paint-order="stroke" style="' + UI + '">' + pt[0] + '</text></g>';
      });
      return out;
    }
  };

  /* ================= tábua e glossário ================= */
  function signsCell(list, mark) {
    if (!list.length) return '—';
    return list.map(function (s) { return SIGNS[s][0] + SYMF + ' <em>' + SIGNS[s][1] + '</em>' + (mark ? ' ' + mark : ''); }).join('<br>');
  }
  function tabWrap(head, rows) {
    return '<div class="ou-tab-wrap"><table class="ou-tab"><thead><tr>' + head + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
  }
  function buildTable() {
    var rows = DIGN.map(function (d, i) {
      return '<tr><td class="sym">' + ASTROS[i].s + SYMF + '</td><td>' + ASTROS[i].n + '</td>' +
        '<td>' + signsCell(d.dom) + '</td><td>' + signsCell(d.exa) + '</td>' +
        '<td>' + signsCell(d.det) + '</td><td>' + signsCell(d.fal) + '</td></tr>';
    }).join('');
    var t1 = tabWrap('<th>Astro</th><th></th><th>Domicílio</th><th>Exaltação</th><th>Detrimento</th><th>Queda</th>', rows);

    var tripRows = TRIP.map(function (t, e) {
      var sg = [e, e + 4, e + 8].map(function (s) { return SIGNS[s][0] + SYMF; }).join(' ');
      return '<tr><td>' + ELEM[e] + '</td><td>' + sg + '</td><td>' + NM(t.d) + '</td><td>' + NM(t.n) + '</td><td>' + NM(t.p) + '</td></tr>';
    }).join('');
    var t2 = '<p class="ou-gloss"><b>Triplicidades</b> (tábua de Lilly; a coluna “participante” é só informativa e não pontua)</p>' +
      tabWrap('<th>Elemento</th><th>Signos</th><th>Diurno</th><th>Noturno</th><th>Participante</th>', tripRows);

    var termRows = TERMOS.map(function (row, s) {
      var prev = 0;
      return '<tr><td>' + SIGNS[s][0] + SYMF + ' <em>' + SIGNS[s][1] + '</em></td><td>' + row.map(function (r) {
        var seg = ASTROS[r[0]].s + SYMF + ' ' + prev + '–' + r[1] + '°'; prev = r[1]; return seg;
      }).join(' · ') + '</td></tr>';
    }).join('');
    var t3 = '<p class="ou-gloss"><b>Termos egípcios</b> (só os cinco planetas; Sol e Lua não têm termos)</p>' +
      tabWrap('<th>Signo</th><th>Termos (grau inicial–final)</th>', termRows);

    var faceRows = SIGNS.map(function (sg, s) {
      var c = [0, 1, 2].map(function (k) { return '<td>' + NM(FACE_ORDER[(s * 3 + k) % 7]) + '</td>'; }).join('');
      return '<tr><td>' + sg[0] + SYMF + ' <em>' + sg[1] + '</em></td>' + c + '</tr>';
    }).join('');
    var t4 = '<p class="ou-gloss"><b>Faces caldeias</b> (decanatos de 10°)</p>' +
      tabWrap('<th>Signo</th><th>0°–10°</th><th>10°–20°</th><th>20°–30°</th>', faceRows);

    return t1 + t2 + t3 + t4 +
      '<p class="ou-gloss">' +
      '<b>Dignidades essenciais</b> — o astro <b>rege</b> o seu domicílio (+5), é <b>honrado</b> na exaltação (+4), governa a <b>triplicidade</b> do elemento do signo (+3; de dia ou de noite, conforme a seita), o <b>termo</b> (+2) e a <b>face</b> (+1) em que está. Cai no <b>detrimento</b> (−5, signo oposto ao domicílio) e na <b>queda</b> (−4, oposto à exaltação). É <b>peregrino</b> (−5) apenas quando não tem <b>nenhuma</b> das cinco dignidades. A pontuação é a de Lilly (<i>Christian Astrology</i>, 1647) e é a soma de tudo o que se aplica; os termos aqui são os egípcios (Lilly preferia os ptolomaicos) e, na Água, a triplicidade é a dele (♂ de dia e de noite; a tradição dorotheana põe ♀ de dia).' +
      '<br><b>Seita</b> — o mapa é <b>diurno</b> se o Sol está acima do horizonte (altura geométrica ≥ 0°) e <b>noturno</b> se abaixo. Sem a localização a seita não pode ser determinada: aparecem as duas triplicidades e a pontuação para os dois casos.' +
      '<br><b>Aspectos e orbes</b> — o orbe do aspecto é a <b>soma das moieties</b> dos dois astros (a moiety é metade do orbe do astro, segundo Lilly, <i>CA</i> p. 107, na lista que ele prefere): ☉ 7,5° · ☽ 6° · ♄ 4,5° · ♃ 4,5° · ♂ 3,75° · ♀ 3,5° · ☿ 3,5°; planetas exteriores, nodos, ângulos e Fortuna, 2,5° (orbe de 5°). Há um teto: conjunção ☌ 0°, oposição ☍ 180°, trígono △ 120° e quadratura □ 90° até 10°; sextil ⚹ 60° até 6°. Aspectos menores usam uma fração da soma, com teto menor: semissextil ⚺ 30°, semiquadratura ∠ 45° e sesquiquadratura ⚼ 135° (¼, até 2°); quincunce ⚻ 150° (0,4, até 3°). Os tetos e as frações são escolha de projeto. Um aspecto <b>aplicativo</b> ainda se fecha na hora seguinte; <b>separativo</b>, já se desfez.' +
      '<br><b>Debilidades</b> — <b>retrógrado</b>: percurso aparente inverso; <b>estacionário</b>: velocidade diária abaixo de 10 % da média do astro, <i>retrógrado</i> quando está para retroceder e <i>direto</i> quando está para seguir adiante; <b>combusto</b>: a menos de 8°30′ do Sol; <b>sob os raios</b>: a menos de 17°; <b>cazimi</b>: a 17′ ou menos, no coração do Sol; além do detrimento, da queda e da condição peregrina. A velocidade é dada em graus por dia.' +
      '<br><b>Estrelas fixas</b> — a conjunção é medida pela <b>longitude eclíptica</b> (λ) <b>da data</b> — as coordenadas J2000 do catálogo recebem a precessão (cerca de 1,4° por século) para ficarem no mesmo referencial do Sol, da Lua e dos planetas —, como manda a tradição; <b>β</b> é a latitude celeste da estrela (quanto maior, mais longe do caminho dos astros) e <b>m</b> a magnitude visual. No mapa, a estrela em conjunção estreita (≤ 1°) fica marcada no anel das estrelas, ligada ao astro pelo traço da sua longitude.' +
      '<br><b>Nodos</b> — nodo ascendente <b>médio</b> da Lua (Meeus); o Nodo Sul é o ponto oposto. <b>Ascendente e Meio do Céu</b> saem do tempo sideral local, da latitude e da longitude, e só existem com a localização conhecida (nos polos, |φ| &gt; 66,5°, ficam instáveis); as <b>casas</b> são por signo inteiro, a partir do signo do Ascendente. <b>Parte da Fortuna</b>: Ascendente + ☽ − ☉ de dia e Ascendente + ☉ − ☽ de noite. <b>Hora planetária</b>: dia e noite divididos em 12 horas desiguais, regidas na ordem caldeia a partir do regente do dia; usa o nascer e o pôr do Sol do mapa. Urano, Netuno e Plutão não têm dignidade tradicional e ficam fora da tábua.' +
      '<br><b>Precisão</b> — efemérides aproximadas, válidas de 1800 a 2050 (fora disso o mapa avisa). Sol, Lua e planetas sem nutação, aberração nem tempo-luz; erro típico de alguns minutos de arco (Júpiter e Saturno chegam a 7 a 10′).' +
      '</p>';
  }


  return { userOpen: userOpen, renderReadings: renderReadings, buildTable: buildTable, AstralStars: AstralStars, AstralPoints: AstralPoints };
})();
