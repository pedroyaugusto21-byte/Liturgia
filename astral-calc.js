/* ======================================================================
   MAPA ASTRAL — CÁLCULO (window.AstralCore)
   Constantes, dignidades, aspectos, efemérides dos planetas exteriores, nodo, ângulos, hora planetária
   e o modelo do momento (modelFor/buildModel). SEM DOM, SEM HTML, SEM estado de interface.
   Carregar DEPOIS de ouranos-data.js e ANTES de astral-vista.js e astral.js.
   Código MOVIDO de astral.js sem reescrever. Escopo: um IIFE; único global novo = o namespace acima.
   ====================================================================== */
window.AstralCore = (function () {
  'use strict';

  var SYMF = '\uFE0E';
  var D2R = Math.PI / 180;
  var OBL = 23.4392911 * D2R;
  var norm = function (a) { return ((a % 360) + 360) % 360; };
  var sep180 = function (a, b) { var d = (((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; };
  var sdelta = function (a, b) { return norm(a - b + 180) - 180; }; /* diferença com sinal, em (−180, 180] */
  var pad = function (n) { return String(n).padStart(2, '0'); };
  /* escapa texto vindo de dados (nomes de estrelas e constelações) antes de entrar em HTML ou atributo */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  var dd = function (v, n) { return v.toFixed(n === undefined ? 1 : n).replace('.', ','); };
  var sgn = function (v, n) { return (v < 0 ? '\u2212' : '+') + dd(Math.abs(v), n); };
  var sg0 = function (v) { return v === 0 ? '0' : sgn(v, 0); };
  var hh = function (h) { var m = Math.round((((h % 24) + 24) % 24) * 60) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  var signOf = function (lon) { return Math.floor(norm(lon) / 30) % 12; };
  var PHASES = ['Lua Nova','Crescente Côncava','Quarto Crescente','Crescente Convexa','Lua Cheia','Minguante Convexa','Quarto Minguante','Minguante Côncava'];
  function phaseOf(elong) { return PHASES[Math.floor((norm(elong) + 22.5) / 45) % 8]; }

  /* ================= signos, elementos e regentes ================= */
  var SIGNS = [['♈','Áries'],['♉','Touro'],['♊','Gêmeos'],['♋','Câncer'],['♌','Leão'],['♍','Virgem'],['♎','Libra'],['♏','Escorpião'],['♐','Sagitário'],['♑','Capricórnio'],['♒','Aquário'],['♓','Peixes']];
  var ELEM = ['Fogo','Terra','Ar','Água']; /* elemento do signo s = ELEM[s % 4] */
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
     Índices de ASTROS (usados em todas as tabelas abaixo):
       0 Lua · 1 Mercúrio · 2 Vênus · 3 Sol · 4 Marte · 5 Júpiter · 6 Saturno
     dom = domicílio · exa = exaltação · det = detrimento · fal = queda    */
  var ASTROS = [
    { n: 'Lua',      s: '☽' }, { n: 'Mercúrio', s: '☿' }, { n: 'Vênus',  s: '♀' },
    { n: 'Sol',      s: '☉' }, { n: 'Marte',    s: '♂' }, { n: 'Júpiter', s: '♃' },
    { n: 'Saturno',  s: '♄' },
  ];
  function NM(i) { return ASTROS[i].s + SYMF + ' ' + ASTROS[i].n; }
  /* Domicílio, exaltação, detrimento e queda — tábua ptolomaica, conferida com Lilly,
     Christian Astrology (1647) p. 104 (reproduzida na Wikipédia, "Essential dignity"). */
  var DIGN = [
    { dom: [3],    exa: [1],  det: [9],    fal: [7]  },
    { dom: [2, 5], exa: [5],  det: [8, 11], fal: [11] },
    { dom: [1, 6], exa: [11], det: [7, 0], fal: [5]  },
    { dom: [4],    exa: [0],  det: [10],   fal: [6]  },
    { dom: [0, 7], exa: [9],  det: [6, 1], fal: [3]  },
    { dom: [8, 11], exa: [3], det: [2, 5], fal: [9]  },
    { dom: [9, 10], exa: [6], det: [3, 4], fal: [0]  },
  ];

  /* Triplicidades (regente diurno d, noturno n; p = participante, só informativo).
     Por elemento: 0 Fogo, 1 Terra, 2 Ar, 3 Água.
     Tábua de Lilly (Christian Astrology, 1647): Fogo ☉/♃, Terra ♀/☽, Ar ♄/☿ e Água ♂/♂
     (Marte de dia e de noite). Conferida em Wikipédia "Triplicity", Skyscript e Houlding.
     A tradição dorotheana (helenística) difere só na Água: ♀ de dia, ♂ à noite, ☽ participante.
     Para usá-la, troque TRIP = TRIP_DOROTEU. */
  var TRIP_LILLY = [{ d: 3, n: 5, p: 6 }, { d: 2, n: 0, p: 4 }, { d: 6, n: 1, p: 5 }, { d: 4, n: 4, p: 0 }];
  var TRIP_DOROTEU = [{ d: 3, n: 5, p: 6 }, { d: 2, n: 0, p: 4 }, { d: 6, n: 1, p: 5 }, { d: 2, n: 4, p: 0 }];
  var TRIP = TRIP_LILLY;

  /* Termos EGÍPCIOS: por signo, lista [regente, grau final]; o regente vale do fim da faixa
     anterior até o grau final. Só os cinco planetas (♃ 5, ♀ 2, ☿ 1, ♂ 4, ♄ 6).
     Fonte: Ptolomeu, Tetrabiblos I.21 (tábua "egípcia"), conforme a transcrição de Augurine
     (augurine.com/learn/planetary-bounds). Conferência linha a linha: cada signo traz os cinco
     planetas, soma 30°, e os totais por planeta (♄ 57, ♃ 79, ♂ 66, ♀ 82, ☿ 76) reproduzem os
     "anos maiores" planetários (Valens/Ptolomeu). Atenção: Lilly usava os termos ptolomaicos. */
  var TERMOS = [
    [[5, 6], [2, 12], [1, 20], [4, 25], [6, 30]],  /* Áries       */
    [[2, 8], [1, 14], [5, 22], [6, 27], [4, 30]],  /* Touro       */
    [[1, 6], [5, 12], [2, 17], [4, 24], [6, 30]],  /* Gêmeos      */
    [[4, 7], [2, 13], [1, 19], [5, 26], [6, 30]],  /* Câncer      */
    [[5, 6], [2, 11], [6, 18], [1, 24], [4, 30]],  /* Leão        */
    [[1, 7], [2, 17], [5, 21], [4, 28], [6, 30]],  /* Virgem      */
    [[6, 6], [1, 14], [5, 21], [2, 28], [4, 30]],  /* Libra       */
    [[4, 7], [2, 11], [1, 19], [5, 24], [6, 30]],  /* Escorpião   */
    [[5, 12], [2, 17], [1, 21], [6, 26], [4, 30]], /* Sagitário   */
    [[1, 7], [5, 14], [2, 22], [6, 26], [4, 30]],  /* Capricórnio */
    [[1, 7], [2, 13], [5, 20], [4, 25], [6, 30]],  /* Aquário     */
    [[2, 12], [5, 16], [1, 19], [4, 28], [6, 30]]  /* Peixes      */
  ];

  /* Faces (decanatos) CALDEIAS: 36 faixas de 10°, a partir de 0° de Áries, na ordem
     Marte, Sol, Vênus, Mercúrio, Lua, Saturno, Júpiter, repetida (Áries: ♂ ☉ ♀; Touro: ☿ ☽ ♄ ...;
     Peixes: ♄ ♃ ♂). Fonte: Lilly, Christian Astrology (1647) / Skyscript; ordem caldeia
     Saturno, Júpiter, Marte, Sol, Vênus, Mercúrio, Lua (Augurine, "Decan calculator"). */
  var FACE_ORDER = [4, 3, 2, 1, 0, 6, 5];

  /* Pontuação de Lilly (Christian Astrology, 1647): domicílio +5, exaltação +4, triplicidade +3,
     termo +2, face +1; detrimento −5, queda −4; peregrino −5 (nenhuma das cinco dignidades). */
  var PTS = { dom: 5, exa: 4, trip: 3, term: 2, face: 1, det: -5, fal: -4, per: -5 };

  function termRuler(lon) {
    var l = norm(lon), s = Math.floor(l / 30) % 12, d = l - s * 30, row = TERMOS[s];
    for (var k = 0; k < row.length; k++) if (d < row[k][1]) return row[k][0];
    return row[row.length - 1][0];
  }
  function faceRuler(lon) { return FACE_ORDER[Math.floor(norm(lon) / 10) % 7]; }

  /* Dignidade do astro i na longitude lon, para a seita 'day' ou 'night'. */
  function dignityOf(i, lon, sect) {
    var s = signOf(lon), d = DIGN[i], tr = TRIP[s % 4], items = [], score = 0, own = 0;
    function add(k, t, ok) { items.push({ k: k, t: t, p: PTS[k], good: ok }); score += PTS[k]; if (ok) own++; }
    if (d.dom.indexOf(s) >= 0) add('dom', 'Domicílio', true);
    if (d.exa.indexOf(s) >= 0) add('exa', 'Exaltação', true);
    if ((sect === 'day' ? tr.d : tr.n) === i) add('trip', 'Triplicidade ' + (sect === 'day' ? 'diurna' : 'noturna'), true);
    if (termRuler(lon) === i) add('term', 'Termo', true);
    if (faceRuler(lon) === i) add('face', 'Face', true);
    if (d.det.indexOf(s) >= 0) add('det', 'Detrimento', false);
    if (d.fal.indexOf(s) >= 0) add('fal', 'Queda', false);
    var peregrine = own === 0;
    if (peregrine) score += PTS.per;
    return { items: items, score: score, peregrine: peregrine };
  }
  function hasK(r, k) { for (var j = 0; j < r.items.length; j++) if (r.items[j].k === k) return true; return false; }
  function sameDign(a, b) {
    if (a.score !== b.score || a.peregrine !== b.peregrine || a.items.length !== b.items.length) return false;
    for (var j = 0; j < a.items.length; j++) if (a.items[j].k !== b.items[j].k) return false;
    return true;
  }
  /* Resultado para a seita conhecida ou, sem ela, para as duas. per: 'sim' | 'talvez' | 'nao' */
  function dignAll(i, lon, sect) {
    var d1 = dignityOf(i, lon, sect || 'day'), d2 = sect ? d1 : dignityOf(i, lon, 'night');
    return { d1: d1, d2: d2, same: sameDign(d1, d2),
      per: (d1.peregrine && d2.peregrine) ? 'sim' : ((d1.peregrine || d2.peregrine) ? 'talvez' : 'nao') };
  }

  /* ================= aspectos e orbes por moiety =================
     Orbe do aspecto = soma das moieties dos dois astros (Lilly), limitada por um teto e,
     nos aspectos menores, reduzida a uma fração da soma.
     Moiety = metade do orbe do astro. Fonte: Lilly, Christian Astrology (1647) p. 107, segunda
     lista — a que Lilly prefere: Sol 15°, Lua 12°, Saturno 9°, Júpiter 9°, Marte 7½°, Vênus 7°,
     Mercúrio 7° (Skyscript, "Table to show Orbs for Aspectual Contact"; Houlding, glossário "Moiety").
     Planetas exteriores, nodos, ângulos e Parte da Fortuna: orbe de 5° (convenção Skyscript) = 2,5°.
     Atenção: Saturno 4,5° (orbe 9°), e não 5° (orbe 10°, que vem da outra lista de Lilly).
     Tetos e frações (escolha de projeto, não vêm de Lilly): ver ASPECTS. */
  var MOIETY = [6, 3.5, 3.5, 7.5, 3.75, 4.5, 4.5]; /* índices de ASTROS */
  var MOIETY_EXT = 2.5;
  var NARROW = 2; /* conjunção "estreita": até 2° */
  var CONJ = { n: 'Conjunção', g: '☌', a: 0, f: 1, max: 10, maj: true };
  var ASPECTS = [
    { n: 'Oposição',         g: '☍', a: 180, f: 1,   max: 10, maj: true },
    { n: 'Trígono',          g: '△', a: 120, f: 1,   max: 10, maj: true },
    { n: 'Quadratura',       g: '□', a: 90,  f: 1,   max: 10, maj: true },
    { n: 'Sextil',           g: '⚹', a: 60,  f: 1,   max: 6,  maj: true },
    { n: 'Semissextil',      g: '⚺', a: 30,  f: .25, max: 2,  maj: false },
    { n: 'Semiquadratura',   g: '∠', a: 45,  f: .25, max: 2,  maj: false },
    { n: 'Sesquiquadratura', g: '⚼', a: 135, f: .25, max: 2,  maj: false },
    { n: 'Quincunce',        g: '⚻', a: 150, f: .4,  max: 3,  maj: false }
  ];
  function orbOf(a, m1, m2) { return Math.min(a.max, a.f * (m1 + m2)); }
  /* Aspecto "exato": orbe < 1° (D3). Marcado por símbolo ◆, peso de fonte e a palavra "exato" — nunca só por cor. */
  var EXACT = 1;
  function exactWrap(inner) {
    return '<span class="ou-exact"><span class="ou-mark" aria-hidden="true">◆</span> ' + inner + ' <span class="ou-exact-tag">exato</span></span>';
  }

  /* ================= estacionário =================
     Velocidade diária muito baixa: |v| < STAT_FRAC × velocidade média diária do astro.
     Médias = taxa de L dos elementos de Standish ÷ 36525 (°/dia); Mercúrio e Vênus usam a da
     Terra (a longitude geocêntrica média de um planeta interior acompanha a do Sol).
     STAT_FRAC = 10 % é escolha de projeto (não há norma): Mercúrio ≈ 0,10°/dia, Marte ≈ 0,05°/dia,
     Júpiter ≈ 0,008°/dia. Sol e Lua nunca estacionam. */
  var STAT_FRAC = 0.1;
  var STAT_MEAN = [null, 35999.37244981 / 36525, 35999.37244981 / 36525, null,
    19140.30268499 / 36525, 3034.74612775 / 36525, 1222.49362201 / 36525];

  /* ================= estrelas fixas: RA/Dec → λ/β eclípticas =================
     RA/Dec de ouranos-data.js são J2000, então λ e β pré-calculadas abaixo estão na eclíptica J2000.
     Sol, Lua e planetas do mapa estão na eclíptica DA DATA: a λ da estrela é corrigida na hora do uso
     por starLam() (precessão geral em longitude, IAU 1976: 5029,0966″/século = 1,3969713°/século;
     Fricke 1977; IAU/IERS). A latitude β quase não muda em séculos e fica em J2000. */
  var PREC = 1.3969713; /* graus por século juliano */
  function centuriesOf(date) { return (date.getTime() / 86400000 + 2440587.5 - 2451545) / 36525; }
  function starLam(s, T) { return norm(s.lam + PREC * T); }
  var STARS = (typeof NAMED_STARS !== 'undefined' ? NAMED_STARS : []).map(function (s) {
    var ra = (s.ra / 24) * 360 * D2R, dec = s.dec * D2R;
    var lam = norm(Math.atan2(Math.sin(ra) * Math.cos(OBL) + Math.tan(dec) * Math.sin(OBL), Math.cos(ra)) / D2R);
    var raw = Math.sin(dec) * Math.cos(OBL) - Math.cos(dec) * Math.sin(OBL) * Math.sin(ra);
    var bet = Math.asin(Math.max(-1, Math.min(1, raw))) / D2R;
    var ab = String(s.d || '').split(' ').pop();
    var cat = (typeof SYMBOL_CATALOG !== 'undefined' ? SYMBOL_CATALOG : []).filter(function (c) { return c.a === ab; })[0];
    return { n: s.n, d: s.d, m: s.m, c: /^#[0-9a-f]{3,8}$/i.test(s.c) ? s.c : '#e8d9b4', lam: lam, bet: bet, con: cat ? cat.p : ab };
  });

  /* ================= planetas exteriores: Urano, Netuno e Plutão =================
     Elementos keplerianos de Standish & Williams, "Orbital Ephemerides of the Sun, Moon, and
     Planets" (JPL, cap. 8 do Explanatory Supplement), tabela 8.10.2, válida para 1800–2050, em
     relação à eclíptica e ao equinócio J2000. Urano e Netuno também conferidos em
     ssd.jpl.nasa.gov/planets/approx_pos.html (tabela 1); Plutão só consta do capítulo (a página
     atual do JPL o removeu). Cada elemento: [valor em J2000, taxa por século juliano].
     A Terra é o baricentro Terra-Lua (mesma linha usada pelo index.html).
     Tratamento idêntico ao dos planetas clássicos: longitude geocêntrica J2000 + PREC·T. */
  var STD = {
    earth:   { a: [1.00000261, 0.00000562], e: [0.01671123, -0.00004392], I: [-0.00001531, -0.01294668], L: [100.46457166, 35999.37244981], w: [102.93768193, 0.32327364], O: [0, 0] },
    uranus:  { a: [19.18916464, -0.00196176], e: [0.04725744, -0.00004397], I: [0.77263783, -0.00242939], L: [313.23810451, 428.48202785], w: [170.95427630, 0.40805281], O: [74.01692503, 0.04240589] },
    neptune: { a: [30.06992276, 0.00026291], e: [0.00859048, 0.00005105], I: [1.77004347, 0.00035372], L: [-55.12002969, 218.45945325], w: [44.96476227, -0.32241464], O: [131.78422574, -0.00508664] },
    pluto:   { a: [39.48211675, -0.00031596], e: [0.24882730, 0.00005170], I: [17.14001206, 0.00004818], L: [238.92903833, 145.20780515], w: [224.06891629, -0.04062942], O: [110.30393684, -0.01183482] }
  };
  var OUTERS = [
    { key: 'uranus',  n: 'Urano',   s: '♅', col: '#7FD6E0' },
    { key: 'neptune', n: 'Netuno',  s: '♆', col: '#6A8CFF' },
    { key: 'pluto',   n: 'Plutão',  s: '♇', col: '#B38AFF' }
  ];
  function helio(key, T) {
    var el = STD[key];
    var a = el.a[0] + el.a[1] * T, e = el.e[0] + el.e[1] * T, inc = (el.I[0] + el.I[1] * T) * D2R;
    var L = norm(el.L[0] + el.L[1] * T), peri = el.w[0] + el.w[1] * T, node = el.O[0] + el.O[1] * T;
    var M = (norm(L - peri + 180) - 180) * D2R; /* anomalia média em [−180°, +180°) */
    var E = M + e * Math.sin(M);
    for (var k = 0; k < 30; k++) {
      var dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
      E += dE;
      if (Math.abs(dE) < 1e-12) break;
    }
    var xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
    var w = (peri - node) * D2R, O = node * D2R;
    var cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(inc), si = Math.sin(inc);
    return [
      (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp,
      (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp,
      (sw * si) * xp + (cw * si) * yp
    ];
  }
  function geoLonOuter(key, T) {
    var e = helio('earth', T), p = helio(key, T);
    return norm(Math.atan2(p[1] - e[1], p[0] - e[0]) / D2R + PREC * T);
  }

  /* ================= nodo médio da Lua =================
     Longitude do nodo ascendente médio (equinócio médio da data), Meeus, Astronomical Algorithms,
     cap. 22 (argumento Ω da nutação):
       Ω = 125,04452° − 1934,136261°·T + 0,0020708°·T² + T³/450000
     (T em séculos julianos desde J2000; conferido por implementação independente, hex.pm/azan_ex;
     a forma curta 125,0443° − 1934,1363°·T difere < 0,001°). Nodo Norte = Ω; Nodo Sul = Ω + 180°.
     O nodo médio é sempre retrógrado (≈ −0,053°/dia). */
  function meanNode(T) { return norm(125.04452 - 1934.136261 * T + 0.0020708 * T * T + T * T * T / 450000); }

  /* ================= Ascendente e Meio do Céu =================
     Tempo sideral médio de Greenwich (Meeus, cap. 12, eq. 12.4, IAU 1982):
       θ0 = 280,46061837° + 360,98564736629°·(JD − 2451545) + 0,000387933°·T² − T³/38710000
     TSL (ascensão reta do meridiano, RAMC) = θ0 + longitude leste.
     Obliquidade média da data: ε = 23,4392911° − 0,0130042°·T (Meeus, cap. 22; termos em T² desprezíveis).
       MC  = atan2( sen RAMC , cos RAMC · cos ε )
       ASC = atan2( cos RAMC , −( sen RAMC · cos ε + tan φ · sen ε ) )     (φ = latitude)
     Casas por signo inteiro: a Casa 1 é o signo do Ascendente. */
  function gmstDeg(date) {
    var jd = date.getTime() / 86400000 + 2440587.5, T = (jd - 2451545) / 36525;
    return norm(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - T * T * T / 38710000);
  }
  function anglesOf(date, latDeg, lonDeg) {
    var T = centuriesOf(date), eps = (23.4392911 - 0.0130042 * T) * D2R;
    var ramc = norm(gmstDeg(date) + lonDeg), th = ramc * D2R;
    var phi = Math.max(-89.9999, Math.min(89.9999, latDeg)) * D2R;
    return {
      ramc: ramc, eps: eps / D2R,
      mc: norm(Math.atan2(Math.sin(th), Math.cos(th) * Math.cos(eps)) / D2R),
      asc: norm(Math.atan2(Math.cos(th), -(Math.sin(th) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) / D2R)
    };
  }

  /* ================= hora planetária =================
     Dia (nascer → pôr do Sol) e noite (pôr → nascer) são divididos em 12 horas desiguais cada.
     A 1ª hora após o nascer do Sol pertence ao regente do dia da semana (dom ☉, seg ☽, ter ♂,
     qua ☿, qui ♃, sex ♀, sáb ♄) e as seguintes percorrem a ordem caldeia (Saturno, Júpiter, Marte,
     Sol, Vênus, Mercúrio, Lua), sem interrupção, dia e noite. O dia planetário vai de um nascer do
     Sol ao seguinte. Fontes: Kerykeion/Astrologer API "Planetary hours", dekhopanchang.com/hora. */
  var DAYRULER = [3, 0, 4, 1, 5, 2, 6];
  var CHALD = [6, 5, 4, 3, 2, 1, 0];
  var WDAY = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
  function planetaryHour(A) {
    if (A.polar) return { polar: A.polar };
    if (A.rise == null || A.set == null || A.lon == null) return null;
    /* dia da semana pelo meio-dia/meia-noite SOLAR do local (independe do fuso do aparelho) */
    var tot = A.date.getTime() / 3600000 + A.lon / 15 + A.eot / 60;
    var wd = (((Math.floor(tot / 24) + 4) % 7) + 7) % 7; /* 1/1/1970 foi quinta (4); 0 = domingo */
    var sh = A.solarH, dayLen = A.set - A.rise, len, n, start, isDay;
    if (sh >= A.rise && sh < A.set) {
      isDay = true; len = dayLen / 12; n = Math.min(11, Math.floor((sh - A.rise) / len)); start = A.rise + n * len;
    } else {
      isDay = false; len = (24 - dayLen) / 12;
      var t = sh >= A.set ? sh - A.set : sh + 24 - A.set, k = Math.min(11, Math.floor(t / len));
      n = 12 + k; start = A.set + k * len;
      if (sh < A.rise) wd = (wd + 6) % 7; /* madrugada: ainda é o dia planetário da véspera */
    }
    var dayRuler = DAYRULER[wd];
    return { wd: wd, n: n, isDay: isDay, len: len, start: start, end: start + len, dayRuler: dayRuler,
      ruler: CHALD[(CHALD.indexOf(dayRuler) + n) % 7], key: wd + '.' + n };
  }

  /* ================= modelo do momento =================
     Tudo que a leitura precisa, calculado uma vez por instante/local. */
  var memo = { key: '', M: null };
  function modelFor(A) {
    var key = A.date.getTime() + '|' + A.lat + '|' + A.lon;
    if (memo.key !== key) { memo.M = buildModel(A); memo.key = key; }
    return memo.M;
  }
  function buildModel(A) {
    var date = A.date, T = centuriesOf(date), dT = 1 / (24 * 36525);
    var M = { A: A, T: T, cl: [], ou: [], pts: [] };
    M.known = !!A.known && A.lat != null && A.lon != null;
    M.sect = (A.known && A.alt != null) ? (A.alt >= 0 ? 'day' : 'night') : null;
    A.bodies.forEach(function (b, i) {
      var later = A.laterLons[i];
      var p = { ci: i, name: b.name, sym: b.sym, col: b.col, lon: b.lon, later: later, speed: sdelta(later, b.lon) * 24,
        retro: b.retro, m: MOIETY[i], mean: STAT_MEAN[i] };
      M.cl.push(p); M.pts.push(p);
    });
    OUTERS.forEach(function (o) {
      var lon = geoLonOuter(o.key, T), later = geoLonOuter(o.key, T + dT), sp = sdelta(later, lon) * 24;
      var p = { ci: -1, key: o.key, name: o.n, sym: o.s, col: o.col, lon: lon, later: later, speed: sp, retro: sp < 0,
        m: MOIETY_EXT, mean: STAT_RATE[o.key] / 36525 };
      M.ou.push(p); M.pts.push(p);
    });
    var nl = meanNode(T), nl2 = meanNode(T + dT);
    M.node = { lon: nl, south: norm(nl + 180), speed: sdelta(nl2, nl) * 24 };
    if (M.known) {
      M.polarLat = Math.abs(A.lat) > 66.5;
      M.ang = anglesOf(date, A.lat, A.lon);
      M.asc = M.ang.asc; M.mc = M.ang.mc; M.ascSign = signOf(M.asc);
      if (M.sect) {
        var moon = A.bodies[0].lon, sun = A.bodies[3].lon;
        M.fortune = norm(M.asc + (M.sect === 'day' ? moon - sun : sun - moon));
      }
    }
    M.hour = planetaryHour(A);
    return M;
  }
  var STAT_RATE = { uranus: 428.48202785, neptune: 218.45945325, pluto: 145.20780515 }; /* L̇ de Standish, °/século */
  function houseOf(M, lon) { return ((signOf(lon) - M.ascSign + 12) % 12) + 1; }
  function inRange(date) { var y = date.getUTCFullYear(); return y >= 1800 && y <= 2050; }

  /* velocidade (°/dia) do astro p num instante deslocado de `days` dias — só para o estacionário */
  function speedAt(M, p, days) {
    var ms = M.A.date.getTime() + days * 864e5;
    if (p.ci >= 0) {
      var A2 = Ouranos.astral(new Date(ms));
      return sdelta(A2.laterLons[p.ci], A2.bodies[p.ci].lon) * 24;
    }
    var T0 = (ms / 86400000 + 2440587.5 - 2451545) / 36525, T1 = T0 + 1 / (24 * 36525);
    return sdelta(geoLonOuter(p.key, T1), geoLonOuter(p.key, T0)) * 24;
  }
  /* 'ret' = estaciona para retroceder (a velocidade passa de + a −); 'dir' = estaciona para seguir direto */
  function stationOf(M, p) {
    if (p.mean == null || Math.abs(p.speed) >= STAT_FRAC * p.mean) return null;
    return speedAt(M, p, 1) < speedAt(M, p, -1) ? 'ret' : 'dir';
  }


  return { SYMF, D2R, norm, sep180, pad, esc, dd, sgn, sg0, hh, signOf, phaseOf, SIGNS, ELEM, RULER, signTxt, lonTxt, ASTROS, NM, DIGN, TRIP, TERMOS, FACE_ORDER, PTS, termRuler, faceRuler, dignityOf, hasK, dignAll, MOIETY, MOIETY_EXT, NARROW, CONJ, ASPECTS, orbOf, EXACT, exactWrap, STAT_FRAC, centuriesOf, starLam, STARS, geoLonOuter, meanNode, anglesOf, CHALD, WDAY, planetaryHour, modelFor, houseOf, inRange, stationOf };
})();
