/* ======================================================================
   MANSÕES LUNARES
   As 28 mansões da Lua (tradição árabe / Picatrix). Cada mansão ocupa 360°/28 ≈ 12°51′26″
   do zodíaco, contadas a partir de 0° de Áries; a mansão da vez é a que contém a longitude da Lua.
   Cálculo e interface vêm do app "Mansões Lunares" (mansoes.js), aqui isolados em um módulo próprio; os DADOS
   das 28 mansões ficam em mansoes-dados.js (window.MansoesDados), que deve ser carregado ANTES deste arquivo.
   Fora isso, nada vaza para o escopo global além de window.MansoesLunares.
   Usado por duas abas:
     · Lunar        → #lunarMansoes   (lunar.js chama MansoesLunares.setLunar a cada redesenho)
     · Mapa Astral  → #astralMansoes  (ouranos.js chama MansoesLunares.setAstral a cada mapa novo)
   Lua: série truncada de Meeus (cap. 47), erro de alguns minutos de arco — suficiente para
   decidir a mansão; só muito perto da fronteira entre duas mansões o horário pode variar em minutos.
   ====================================================================== */
(function () {
  'use strict';
  var SEG = 360 / 28;
  var SYMF = '\uFE0E';
  var SIGNS = ["Áries","Touro","Gêmeos","Câncer","Leão","Virgem","Libra","Escorpião","Sagitário","Capricórnio","Aquário","Peixes"];
  var GLYPHS = ["♈","♉","♊","♋","♌","♍","♎","♏","♐","♑","♒","♓"];

  /* Dados: mansoes-dados.js (window.MansoesDados.MANSOES, 28 linhas; formato no cabeçalho daquele arquivo). */
  var M = window.MansoesDados && window.MansoesDados.MANSOES;
  if (!Array.isArray(M) || M.length !== 28) {
    /* sem os dados não há mansão a mostrar: não define window.MansoesLunares; lunar.js e ouranos.js já tratam a ausência */
    if (window.console && console.warn) console.warn('MansoesLunares: mansoes-dados.js não carregou; mansões lunares indisponíveis.');
    return;
  }

  /* ---------- astronomia ---------- */
  function rad(d) { return d * Math.PI / 180; }
  function norm(d) { d = d % 360; return d < 0 ? d + 360 : d; }
  function T(date) { return (date.getTime() / 86400000 + 2440587.5 - 2451545) / 36525; }
  function moonLon(date) {
    var t = T(date);
    var L = 218.3164477 + 481267.88123421 * t;
    var D = rad(297.8501921 + 445267.1114034 * t);
    var Ms = rad(357.5291092 + 35999.0502909 * t);
    var Mm = rad(134.9633964 + 477198.8675055 * t);
    var F = rad(93.2720950 + 483202.0175233 * t);
    var s = 6.288774 * Math.sin(Mm) + 1.274027 * Math.sin(2 * D - Mm) + 0.658314 * Math.sin(2 * D)
      + 0.213618 * Math.sin(2 * Mm) - 0.185116 * Math.sin(Ms) - 0.114332 * Math.sin(2 * F)
      + 0.058793 * Math.sin(2 * D - 2 * Mm) + 0.057066 * Math.sin(2 * D - Ms - Mm)
      + 0.053322 * Math.sin(2 * D + Mm) + 0.045758 * Math.sin(2 * D - Ms)
      - 0.040923 * Math.sin(Ms - Mm) - 0.034720 * Math.sin(D) - 0.030383 * Math.sin(Ms + Mm)
      + 0.015327 * Math.sin(2 * D - 2 * F) - 0.012528 * Math.sin(Mm + 2 * F)
      + 0.010980 * Math.sin(Mm - 2 * F) + 0.010675 * Math.sin(4 * D - Mm)
      + 0.010034 * Math.sin(3 * Mm) + 0.008548 * Math.sin(4 * D - 2 * Mm)
      - 0.007888 * Math.sin(2 * D + Ms - Mm) - 0.006766 * Math.sin(2 * D + Ms)
      - 0.005163 * Math.sin(D - Mm) + 0.004987 * Math.sin(D + Ms)
      + 0.004036 * Math.sin(2 * D - Ms + Mm) + 0.003994 * Math.sin(2 * D + 2 * Mm)
      + 0.003861 * Math.sin(4 * D) + 0.003665 * Math.sin(2 * D - 3 * Mm);
    return norm(L + s);
  }
  function mansionAt(ms) { return Math.floor(moonLon(new Date(ms)) / SEG) % 28; }

  /* ---------- fases: elongação Sol–Lua ----------
     Mesma Lua da mansão (moonLon acima) e o mesmo Sol do Mapa Astral (OuranosCalc.sunLon, Meeus cap. 25),
     com a aberração anual do Sol (−0,00569°). Precisa de ouranos-calc.js carregado ANTES deste arquivo;
     sem ele, elongation() devolve null e quem chama (lunar.js) volta ao ciclo médio. */
  var ABERR_SOL = 0.00569;
  var FASES = ['nova', 'cres', 'cheia', 'min'];   /* elongação 0°, 90°, 180°, 270° */
  function elongation(date) {
    try {
      var OC = window.OuranosCalc;
      if (!OC || typeof OC.sunLon !== 'function' || typeof OC.centuries !== 'function') return null;
      var e = norm(moonLon(date) - (OC.sunLon(OC.centuries(date)) - ABERR_SOL));
      return isFinite(e) ? e : null;
    } catch (err) { return null; }
  }
  function quadrante(ms) { var e = elongation(new Date(ms)); return e === null ? null : Math.floor(e / 90) % 4; }
  /* instantes exatos (ms) das fases principais entre fromMs e toMs: [{k:'nova'|'cres'|'cheia'|'min', ms}] */
  function phaseInstants(fromMs, toMs) {
    var out = [];
    try {
      var passo = 6 * 3600000, t = fromMs, q = quadrante(t);
      if (q === null) return out;
      while (t < toMs) {
        var n = Math.min(t + passo, toMs), qn = quadrante(n);
        if (qn === null) return out;
        if (qn !== q) {
          var a = t, b = n, k;
          for (k = 0; k < 26; k++) { var m = (a + b) / 2; if (quadrante(m) === q) a = m; else b = m; }
          out.push({ k: FASES[qn], ms: Math.round((a + b) / 2) });
        }
        t = n; q = qn;
      }
    } catch (err) { /* devolve o que já achou */ }
    return out;
  }

  /* instante (ms) em que a Lua sai da mansão `from`, para frente (dir = 1) ou para trás (dir = -1) */
  function boundary(ms, from, dir) {
    var step = 10 * 60000 * dir, t = ms, i;
    for (i = 0; i < 500; i++) {
      var n = t + step;
      if (mansionAt(n) !== from) {
        var a = t, b = n, k;
        for (k = 0; k < 24; k++) {
          var m = (a + b) / 2;
          if (mansionAt(m) === from) a = m; else b = m;
        }
        return (a + b) / 2;
      }
      t = n;
    }
    return null;
  }

  /* início e fim da mansão `idx` que contém `ms`; guarda o último resultado (o mapa redesenha a cada segundo) */
  var bcache = null;
  function bounds(ms, idx) {
    if (bcache && bcache.idx === idx && bcache.s !== null && bcache.e !== null && ms >= bcache.s && ms < bcache.e) return bcache;
    bcache = { idx: idx, s: boundary(ms, idx, -1), e: boundary(ms, idx, 1) };
    return bcache;
  }

  /* ---------- formatação ---------- */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function zPos(lon) {
    lon = norm(lon);
    var s = Math.floor(lon / 30) % 12, d = lon - s * 30, deg = Math.floor(d), min = Math.floor((d - deg) * 60);
    return deg + '°' + pad(min) + '′ ' + GLYPHS[s] + SYMF + ' ' + SIGNS[s];
  }
  function dayTxt(ms) {
    var d = new Date(ms), now = new Date();
    var o = { day: '2-digit', month: '2-digit' };
    if (d.getFullYear() !== now.getFullYear()) o.year = 'numeric';
    return d.toLocaleDateString('pt-BR', o);
  }
  function timeTxt(ms) { return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
  function stampTxt(ms) { return dayTxt(ms) + ' ' + timeTxt(ms); }

  function tags(list, cls) {
    if (!list.length) return '<span class="mans-none">—</span>';
    return list.map(function (t) { return '<span class="mans-tag ' + cls + '">' + esc(t) + '</span>'; }).join('');
  }
  function rowsHtml(m) {
    return '<div class="mans-rows">' +
      '<div><b>Favorece</b><span>' + tags(m[4], 'ok') + '</span></div>' +
      '<div><b>Desfavorece</b><span>' + tags(m[5], 'no') + '</span></div>' +
      '<div><b>Anjo regente</b><span>' + esc(m[7]) + '</span></div></div>';
  }

  /* ---------- cálculo para um instante ---------- */
  function at(date, lonShown) {
    var ms = date.getTime(), own = moonLon(date), idx = Math.floor(own / SEG) % 28;
    var b = bounds(ms, idx);
    return {
      idx: idx, m: M[idx], ms: ms,
      lon: lonShown == null ? own : lonShown,
      progress: Math.max(0, Math.min(1, (own - idx * SEG) / SEG)),
      start: b.s, end: b.e
    };
  }

  /* ---------- HTML ---------- */
  function nowHtml(r, label) {
    var m = r.m, pc = Math.round(r.progress * 100);
    var range = (r.start !== null && r.end !== null)
      ? '<div class="mans-meta">Do início ' + esc(stampTxt(r.start)) + ' ao fim ' + esc(stampTxt(r.end)) + '</div>' : '';
    return '<article class="mans-now" aria-label="' + esc(label) + '">' +
      '<div class="mans-kicker">' + esc(label) + '</div>' +
      '<div class="mans-head"><span class="mans-num" aria-hidden="true">' + (r.idx + 1) + '</span>' +
        '<div><h3>Mansão ' + (r.idx + 1) + ' · ' + esc(m[1]) + '</h3>' +
        '<span class="mans-ar" lang="ar" dir="rtl">' + esc(m[0]) + '</span></div></div>' +
      '<p class="mans-epi">' + esc(m[3]) + ' <span class="mans-pic">· no Picatrix: ' + esc(m[2]) + '</span></p>' +
      '<div class="mans-bar" role="img" aria-label="A Lua percorreu ' + pc + '% desta mansão"><i style="width:' + pc + '%"></i></div>' +
      '<div class="mans-meta">☽' + SYMF + ' Lua em ' + esc(zPos(r.lon)) + ' · ' + pc + '% da mansão</div>' +
      range +
      '<p class="mans-text">' + esc(m[6]) + '</p>' +
      rowsHtml(m) + '</article>';
  }
  function listHtml(cur) {
    var out = '<ol class="mans-ol">', i;
    for (i = 0; i < 28; i++) {
      var m = M[i], on = i === cur;
      out += '<li><details class="mans-item' + (on ? ' cur' : '') + '"' + (on ? ' aria-current="true"' : '') + '>' +
        '<summary><span class="n">' + (i + 1) + '</span><span class="nm">' + esc(m[1]) + (on ? ' <em>· agora</em>' : '') + '</span>' +
        '<span class="ep">' + esc(m[3]) + '</span><span class="pos">a partir de ' + esc(zPos(i * SEG)) + '</span></summary>' +
        '<div class="mans-body"><span class="mans-ar" lang="ar" dir="rtl">' + esc(m[0]) + '</span>' +
        '<p class="mans-pic">No Picatrix: ' + esc(m[2]) + '</p><p class="mans-text">' + esc(m[6]) + '</p>' + rowsHtml(m) + '</div>' +
        '</details></li>';
    }
    return out + '</ol>';
  }

  /* ---------- montagem nos contêineres ---------- */
  function hostOf(id) {
    var sec = document.getElementById(id);
    if (!sec) return null;
    var h = sec.querySelector('.mans-host');
    if (!h) return null;
    if (!h._m) {
      h.innerHTML = '<div class="mans-now-h"></div>' +
        '<details class="mans-all"><summary>As 28 mansões</summary><div class="mans-list-h"></div></details>';
      h._m = { now: h.querySelector('.mans-now-h'), list: h.querySelector('.mans-list-h'), nowHtml: '', idx: -1 };
    }
    return h._m;
  }
  function paint(id, r, label) {
    var h = hostOf(id);
    if (!h) return;
    var html = nowHtml(r, label);
    if (html !== h.nowHtml) { h.nowHtml = html; h.now.innerHTML = html; }
    if (h.idx !== r.idx) { h.idx = r.idx; h.list.innerHTML = listHtml(r.idx); }
  }

  /* aba Lunar: `live` = dia de hoje sem passar o mouse em outro dia */
  var lunarKey = '';
  function setLunar(date, live) {
    var key = (live ? 'L' : 'D') + Math.floor(date.getTime() / (live ? 60000 : 3600000));
    if (key === lunarKey) return;
    lunarKey = key;
    var r = at(date);
    paint('lunarMansoes', r, live ? 'Mansão da Lua agora' : 'Mansão da Lua em ' + dayTxt(date.getTime()) + ' · ao meio-dia');
  }
  /* aba Urano · Mapa Astral: `lon` = longitude da Lua que o mapa está mostrando */
  function setAstral(date, lon) {
    var r = at(date, lon);
    paint('astralMansoes', r, 'Mansão da Lua neste mapa · ' + stampTxt(date.getTime()));
  }

  window.MansoesLunares = {
    data: M,
    moonLon: moonLon,
    elongation: elongation,
    phaseInstants: phaseInstants,
    at: at,
    setLunar: setLunar,
    setAstral: setAstral,
    refresh: function () { lunarKey = ''; }
  };
})();
