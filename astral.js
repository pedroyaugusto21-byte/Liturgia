/* global Ouranos, NAMED_STARS, SYMBOL_CATALOG */
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
(function () {
  'use strict';

  if (typeof Ouranos === 'undefined' || typeof Ouranos.astral !== 'function') return;

  var SYMF = '\uFE0E';
  var D2R = Math.PI / 180;
  var OBL = 23.4392911 * D2R;
  var norm = function (a) { return ((a % 360) + 360) % 360; };
  var sep180 = function (a, b) { var d = (((a - b) % 360) + 360) % 360; return d > 180 ? 360 - d : d; };
  var sdelta = function (a, b) { return norm(a - b + 180) - 180; }; /* diferença com sinal, em (−180, 180] */
  var pad = function (n) { return String(n).padStart(2, '0'); };
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
    return { n: s.n, d: s.d, m: s.m, c: s.c || '#e8d9b4', lam: lam, bet: bet, con: cat ? cat.p : ab };
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
      if (d <= lim) out.push(who + ' a ' + dd(d) + '° (orbe ' + dd(lim) + '°)' + (d <= NARROW ? ' <b class="g">— conjunção estreita</b>' : ''));
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
      if (d <= lim) out.push('<b>' + p.sym + SYMF + ' ' + p.name + '</b> a ' + dd(d) + '° (orbe ' + dd(lim) + '°)' + (d <= NARROW ? ' <b class="g">— conjunção estreita</b>' : ''));
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
      return (f.a.maj ? '' : '<span class="ou-empty">menor · </span>') +
        '<b>' + f.a.g + ' ' + f.a.n + '</b> com <b>' + f.o.sym + SYMF + ' ' + f.o.name + '</b> — ' +
        dd(f.d) + '° · orbe ' + dd(f.orb) + '° de ' + dd(f.lim) + '° · ' + (f.appl ? 'aplicativo' : 'separativo');
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
      return '<b class="star">★ ' + o.s.n + '</b> (' + o.s.d + ' · ' + o.s.con + ') — ' + dd(o.d) + '° de longitude' +
        (extra ? ' <span class="ou-empty">(mais próxima)</span>' : (o.d <= 1 ? ' <b class="g">conjunção estreita</b>' : '')) +
        '<br>λ ' + lonTxt(o.lam) + ' · β ' + sgn(o.s.bet) + '° · magnitude ' + dd(o.s.m, 2);
    }
    var near = all.filter(function (o) { return o.d <= 5; }).slice(0, 4);
    if (near.length) return near.map(function (o) { return render(o, false); }).join('<br>');
    if (!all.length) return '<span class="ou-empty">Catálogo de estrelas indisponível.</span>';
    return '<span class="ou-empty">Nenhuma estrela nomeada a menos de 5° de longitude.</span><br>' + render(all[0], true);
  }

  /* ================= cartões ================= */
  function tag(t, warn) { return '<span class="ou-astro-tag' + (warn ? ' warn' : '') + '">' + t + '</span>'; }
  function card(col, sym, name, tags, pos, rows) {
    return '<article class="ou-astro" style="border-left-color:' + col + '"><div class="ou-astro-h">' +
      (sym ? '<span class="ou-astro-sym" style="color:' + col + '">' + sym + SYMF + '</span>' : '') +
      '<span class="ou-astro-name">' + name + '</span>' + tags.join('') +
      (pos ? '<span class="ou-astro-pos">' + pos + '</span>' : '') + '</div>' +
      '<dl class="ou-rows">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl></article>';
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
    return card(p.col, p.sym, p.name, tags, lonTxt(p.lon), rows);
  }
  function outerCard(M, p) {
    var others = M.pts.filter(function (q) { return q !== p; }), s = signOf(p.lon), tags = [];
    tags.push(tag('Planeta exterior (sem dignidade tradicional)'));
    if (p.retro) tags.push(tag('℞ Retrógrado', true));
    var rows = [['Dignidade', '<span class="ou-empty">Sem dignidade essencial tradicional — fora da tábua e da pontuação de Lilly · em ' +
      signTxt(s) + ' · regente tradicional do signo ' + RULER[s] + '</span>']].concat(houseRow(M, p.lon), [
      ['Conjunções', lineConjunction(p, others)],
      ['Aspectos', lineAspects(p, others)],
      ['Debilidades', lineMove(M, p).join(' · ')],
      ['Estrelas fixas', lineStars(p.lon, M.A.date)]
    ]);
    return card(p.col, p.sym, p.name, tags, lonTxt(p.lon), rows);
  }
  function nodeCard(M, lon, name, sym, sul) {
    var tags = [tag('Nodo médio'), tag('℞ Retrógrado', true)];
    var rows = houseRow(M, lon).concat([
      ['Movimento', 'Sempre <b class="w">retrógrado</b> (nodo médio) · ' + dd(Math.abs(M.node.speed) * 24, 3) + '°/dia'],
      ['Conjunções', linePointConj(M, lon, MOIETY_EXT)]
    ]);
    return card('#9FB0C8', sym, name, tags, lonTxt(lon), rows);
  }
  function angleCard(M, lon, name, opp, extra) {
    var tags = [];
    if (M.polarLat) tags.push(tag('Latitude polar', true));
    var rows = [['Casa', '<b>Casa ' + houseOf(M, lon) + '</b> <span class="ou-empty">· signo inteiro</span>'], ['Oposto', opp + ' ' + lonTxt(lon + 180)]];
    if (extra) rows.push(extra);
    rows.push(['Conjunções', linePointConj(M, lon, MOIETY_EXT)]);
    return card('#C9A84C', '', name, tags, lonTxt(lon), rows);
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
    return card('#E2C36B', '⊗', 'Parte da Fortuna', tags, lonTxt(lon), rows);
  }
  function hourCard(M) {
    var H = M.hour, A = M.A;
    if (!H) return card('#F3D08A', '', 'Hora planetária', [], '', [['Hora', '<span class="ou-empty">Indisponível: sem nascer e pôr do Sol calculados para este local.</span>']]);
    if (H.polar) return card('#F3D08A', '', 'Hora planetária', [], '', [['Hora', '<span class="ou-empty">' +
      (H.polar === 'dia' ? 'Sol da meia-noite' : 'Noite polar') + ': sem nascer e pôr do Sol hoje neste local, as horas planetárias ficam indefinidas.</span>']]);
    var tags = [tag(H.isDay ? 'Hora diurna' : 'Hora noturna')];
    if (!M.known) tags.push(tag('Aproximada (sem latitude)', true));
    var rows = [
      ['Dia', WDAY[H.wd] + ' · regente ' + NM(H.dayRuler)],
      ['Hora', '<b>' + ((H.n % 12) + 1) + 'ª hora ' + (H.isDay ? 'do dia' : 'da noite') + '</b> <span class="ou-empty">(' + (H.n + 1) + 'ª desde o nascer do Sol)</span> · regente <b>' + NM(H.ruler) + '</b>'],
      ['Intervalo', hh(H.start + A.off) + ' – ' + hh(H.end + A.off) + ' <span class="ou-empty">(hora civil · duração ' + dd(H.len * 60, 0) + ' min)</span>']
    ];
    if (!M.known) rows.push(['Aviso', '<span class="ou-empty">Sem a latitude, o nascer e o pôr do Sol são aproximados (dia de 12 h); atualize a localização para a hora exata.</span>']);
    return card('#F3D08A', '', 'Hora planetária', tags, NM(H.ruler), rows);
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
    var h = renderNotes(M);
    h += '<h3 class="ou-group">Os sete astros clássicos</h3>' + M.cl.map(function (p) { return classicCard(M, p); }).join('');
    h += '<h3 class="ou-group">Planetas exteriores</h3>' + M.ou.map(function (p) { return outerCard(M, p); }).join('');
    h += '<h3 class="ou-group">Nodos, ângulos e pontos</h3>' + nodeCard(M, M.node.lon, 'Nodo Norte', '☊') + nodeCard(M, M.node.south, 'Nodo Sul', '☋');
    if (M.known) {
      h += angleCard(M, M.asc, 'Ascendente', 'Descendente', ['Tempo sideral local', hmsOf(M.ang.ramc / 15)]);
      h += angleCard(M, M.mc, 'Meio do Céu', 'Fundo do Céu');
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
  window.AstralStars = {
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

  /* ================= Ascendente e Meio do Céu no mapa =================
     Chamado por buildAstralSVG (index.html) através do gancho AstralPoints. Só desenha com a
     localização conhecida. Um traço fino e tracejado atravessa o anel dos signos na longitude do
     ponto, com o rótulo logo fora do anel. O mapa gira com a hora solar, então o MC fica sempre
     perto do topo e o ASC perto da esquerda (a diferença vem da obliquidade e da latitude). */
  window.AstralPoints = {
    svg: function (A, G) {
      var M = modelFor(A);
      if (!M.known) return '';
      var f = G.f, ha = G.ha, rS1 = G.rS1 || (G.rS0 + 58), out = '';
      var UI = "font-family:'Inter',system-ui,sans-serif";
      [['ASC', 'Ascendente', M.asc], ['MC', 'Meio do Céu', M.mc]].forEach(function (pt) {
        var a = G.ang(pt[2]), p1 = G.P(G.rS0 - 6, a), p2 = G.P(rS1 + 6, a), lab = G.P(rS1 + 14, a);
        out += '<g data-info="' + pt[1] + ' — ' + lonTxt(pt[2]) + ' · casas por signo inteiro">' +
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
    termRuler: termRuler, faceRuler: faceRuler, inRange: inRange
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
      '<div class="ou-time-clock" id="ou-astral-clock"></div>' +
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
    el.warn = document.getElementById('ou-ephem-warn');
    el.speeds = document.getElementById('ou-ast-speed-group');
    el.list = document.getElementById('ou-astro-list');
    el.box = box;

    el.speeds.innerHTML = SPEEDS.map(function (s) {
      return '<button class="ou-pill' + (s.v === st.speed ? ' active' : '') + '" data-as="' + s.v + '">' + s.l + '</button>';
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
    if (el.warn) el.warn.classList.toggle('on', !inRange(d));
    if (el.dt && document.activeElement !== el.dt) {
      var v = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      if (el.dt.value !== v) el.dt.value = v;
    }
  }

  /* ================= laço de atualização ================= */
  var signature = '';
  function signatureOf(M) {
    var s = M.pts.map(function (p) { return p.name + p.lon.toFixed(1) + p.speed.toFixed(2) + (p.retro ? 'R' : ''); }).join('|');
    s += '|N' + M.node.lon.toFixed(1) + '|' + (M.sect || '-') + (M.known ? 'K' : 'u');
    if (M.known) s += '|A' + M.asc.toFixed(1) + 'M' + M.mc.toFixed(1) + (M.fortune != null ? 'F' + M.fortune.toFixed(1) : '');
    s += '|H' + (M.hour ? (M.hour.polar || M.hour.key) : '-') + '|' + M.A.alt;
    return s;
  }
  function renderReadings_(A) {
    if (!el.list) return;
    var M = modelFor(A), sig = signatureOf(M);
    if (sig === signature) return;
    signature = sig;
    el.list.innerHTML = renderReadings(M);
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
