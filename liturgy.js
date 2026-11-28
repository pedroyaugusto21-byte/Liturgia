/* ======================================================================
   LITURGIA
   ====================================================================== */
(function () {
const C = 500;
const WEEK = [
  { sym: '☉', astro: 'Sol', name: 'Domingo' },
  { sym: '☽', astro: 'Lua', name: 'Segunda-feira' },
  { sym: '♂', astro: 'Marte', name: 'Terça-feira' },
  { sym: '☿', astro: 'Mercúrio', name: 'Quarta-feira' },
  { sym: '♃', astro: 'Júpiter', name: 'Quinta-feira' },
  { sym: '♀', astro: 'Vênus', name: 'Sexta-feira' },
  { sym: '♄', astro: 'Saturno', name: 'Sábado' },
];
const ZODIAC = [['♈','Áries'],['♉','Touro'],['♊','Gêmeos'],['♋','Câncer'],['♌','Leão'],['♍','Virgem'],['♎','Libra'],['♏','Escorpião'],['♐','Sagitário'],['♑','Capricórnio'],['♒','Aquário'],['♓','Peixes']]
  .map(([s, n]) => ({ sym: s + '\uFE0E', name: n }));
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
const PHASES = ['Lua Nova','Crescente','Quarto Crescente','Crescente Gibosa','Lua Cheia','Minguante Gibosa','Quarto Minguante','Minguante'];
/* Hemisfério (etapa B): a roda é astronômica (o mês I começa no equinócio de março) e as datas das festas não mudam;
   o que muda é o NOME da estação de cada trimestre. Padrão: 'sul' (comportamento original). */
const SEASONS_HEMI = { sul: ['Outono', 'Inverno', 'Primavera', 'Verão'], norte: ['Primavera', 'Verão', 'Outono', 'Inverno'] };
const HEMI_KEY = 'calendarium.hemisferio';
const ehHemi = (v) => v === 'sul' || v === 'norte';
function lerHemi() { try { const v = window.localStorage.getItem(HEMI_KEY); return ehHemi(v) ? v : 'sul'; } catch (e) { return 'sul'; } }
let hemi = lerHemi();
const seasons = () => SEASONS_HEMI[hemi];
const ORDINALS = ['Primeiro','Segundo','Terceiro'];
const ZODIAC_OFFSET = 45;
const SYMBOL_FONT = "'Noto Sans Symbols','Noto Sans Symbols 2',serif";
const DAWN = 6;
const HOUR_MS = 3600000, DAY_MS = 86400000;

const ICONS = { 1:'wheat', 2:'bouquet', 4:'moonCircle', 5:'snowflake', 7:'flower', 8:'flowerBouquet', 10:'sun', 11:'sickle' };
const FESTIVALS = {
  1: { name: 'Mistérios Menores', date: 'Equinócio de Março', theme: 'Adônis (🝖) morre, Afrodite (♀) se lamenta; Zeus (♃) fulmina Semele (Σ) e Hades (🝁) sequestra Koré (🜟); nesta data e época, o Iniciado contempla os Símbolos Mistéricos, ele vaga como uma Alma no Hades, e contempla os mortos nos Campos dos Asfódelos, a imagem de Dioniso (𐃹) é coberta com um manto preto, e o iniciado passa por provações e ordálios; ele é um Titã Punido, um Deus despedaçado, um Amante assassinado.' },

  2: { name: 'Terceira Colheita', date: '1º de Maio', theme: 'Hades (🝁) se casa com Koré (🜟), Deméter (⚳) chora de luto e se lamenta; nesta data o Iniciado celebra em seu Lar (⚻) a consagração de seus objetos místicos, ele celebra o Hiero Gamos de Hades e Koré, agora Perséfone, a Mãe de Todos nós! Também choramos o Luto de Deméter e Jejuamos com a Deusa em seu sofrimento. Na Terceira Colheita reconhecemos as forças desagregadoras do Cosmo.' },

  4: { name: 'Banquete dos Mortos', date: 'Solstício de Junho', theme: 'Deméter (⚳) sofre e faz a Terra (⊕) sofrer; Zeus (♃) costura Baco na coxa, Perséfone (🜟) se une à Adônis(🝖) no submundo; nesta data o iniciado celebra com sua família o Banquete dos Mortos; neste banquete ele honra seus antepassados, os ancestrais e mortos de sua família; e chora e lamenta os sofrimentos de Deméter mas celebra a união da Donzela e do Rapaz ínfero; é nesta celebração que o iniciado reconhece a si mesmo como um morto, e despedece-se de si.'},

  5: { name: 'Candelária', date: '1º de Agosto', theme: 'Deméter (⚳) e Hécate (Ⱛ) saem em busca de Perséfone (🜟), Kuretes e Koribantes (ꗣ) dançam sua dança protetora; nesta data acendemos luzes para trazer as bênçãos da Luz que logo retornará; pois tais luzes são as tochas de Hécate que guia Deo em busca de sua filha, é um tempo de oráculos e celebrações locais, familiares e de caridade; Os mistérios dos Cabiros, Curetes e Koribantes são lembrados nesta data, bem como os Mistérios de Afrodite e seu Nascimento do Falo decepado de Urano (♅), por Cronos (♄).'}, 

  7: { name: 'Mistérios Maiores', date: 'Equinócio de Setembro', theme: 'Perséfone (🜟) retorna à Deo (⚳) trazida por Hermes (☿) e Hécate (Ⱛ); Adônis (🝖) retorna para o leito de Afrodite (♀); nesta data o Iniciado passa pela sua segunda iniciação: após ter participado do rito como Titã, agora ele o participa como Baco: ele ressurge das cinzas, ele renasce do Fogo. Como Perséfone que retorna do Hades, como Adônis para os braços da Citeréia, o iniciado é celebrado como "Duas vezes abençoado".'},

  8: { name: 'Florália', date: '1º de Novembro', theme: 'Afrodite (♀) e Adônis (🝖) celebram, Zeus se une a Perséfone para gerar Zagreus; nesta data o iniciado celebra a vitalidade da Natureza; celebra as bodas de Perséfone e Zeus e a geração inefável de Zagreus; celebra a união flórea de Afrodite e Adônis e a vida que retorna ao Cosmos; a plantação de um Jardim de Adônis é sugerida como ato votivo do recém-iniciado.'},

  10: { name: 'Banquete dos Vivos', date: 'Solstício de Dezembro', theme: 'Hélios Rei (⊙), Baco nasce da Virgem e é coroado Rei dos Deuses, Dioniso retorna triunfante das suas conquistas militares; nesta data o Iniciado celebra o Banquete dos Vivos; ele celebra o nascimento de Baco, celebra seu retorno e triúnfo; celebra os Mistérios da Vida; é coroado como oficiante dos ritos. Um pão e vinho são celebrados, uma segunda Comunhão, dessa vez em Vida e Liberdade.'},

 11: { name: 'Primeira Colheita', date: '1º de Fevereiro', theme: 'Os Titãs (⊖) iludem e despedaçam Iacco (𐃹), o Zagreus, Dioniso dos Mistérios, cozinham seus membors e o assam ritualmente, O Coração é salvo por Pallas Athena (⚴) e entregue à Zeus (♃), que o dá à Sêmele (Σ); seus membros são reunídos por Apollo (⛢) e Rheia-Deméter (🜪); nesta data começa a Jornada do Iniciado, é o primeiro dos ritos dos Mistérios; o devoto que irá se iniciar participa de seu Batismo e Primeira Comunhão, como Titã, ele despedaça o Deus e reconhece em si o Cosmo criado pelo Ódio e pela Discórdia! Nesta etapa, o buscador deve buscar dentro de si reconhecer os seus hábitos titânicos e começar uma vida órfica: uma vida de restrições e purificações, abstendo-se da fúria, do ódio e dos demais vícios...' },
};


let sunRays = '';
for (let i = 0; i < 16; i++) {
  const t = i * Math.PI / 8, r2 = i % 2 ? 8.5 : 11;
  sunRays += `M${12 + 6 * Math.sin(t)} ${12 - 6 * Math.cos(t)} L${12 + r2 * Math.sin(t)} ${12 - r2 * Math.cos(t)} `;
}
const ICON_PATHS = {
  wheat: '<path d="M12 22V8M12 8c-3 0-5-2-5-5M12 8c3 0 5-2 5-5M12 12c-3 0-5-2-5-5M12 12c3 0 5-2 5-5M12 16c-3 0-5-2-5-5M12 16c3 0 5-2 5-5"/>',
  bouquet: '<circle cx="7.5" cy="7" r="2.5"/><circle cx="16.5" cy="7" r="2.5"/><circle cx="12" cy="4.5" r="2.5"/><path d="M8 9.5L12 21M16 9.5L12 21M12 7v14M9.5 15.5h5"/>',
  moonCircle: '<circle cx="12" cy="12" r="10"/><path d="M15 7.2A5.2 5.2 0 1 0 15 16.8A5 5 0 0 1 15 7.2Z"/>',
  snowflake: '<path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/><path d="M12 6l-2-2M12 6l2-2M12 18l-2 2M12 18l2 2M6 12l-2-2M6 12l-2 2M18 12l2-2M18 12l2 2"/>',
  flower: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="7" r="2.3"/><circle cx="7.25" cy="10.45" r="2.3"/><circle cx="9.06" cy="16.05" r="2.3"/><circle cx="14.94" cy="16.05" r="2.3"/><circle cx="16.75" cy="10.45" r="2.3"/>',
  flowerBouquet: '<circle cx="7.5" cy="5.2" r="1"/><circle cx="7.5" cy="8.8" r="1"/><circle cx="5.7" cy="7" r="1"/><circle cx="9.3" cy="7" r="1"/><circle cx="7.5" cy="7" r="1.1"/><circle cx="16.5" cy="5.2" r="1"/><circle cx="16.5" cy="8.8" r="1"/><circle cx="14.7" cy="7" r="1"/><circle cx="18.3" cy="7" r="1"/><circle cx="16.5" cy="7" r="1.1"/><circle cx="12" cy="2.7" r="1"/><circle cx="12" cy="6.3" r="1"/><circle cx="10.2" cy="4.5" r="1"/><circle cx="13.8" cy="4.5" r="1"/><circle cx="12" cy="4.5" r="1.1"/><path d="M8 9.5L12 21M16 9.5L12 21M12 7v14M9.5 15.5h5"/>',
  sun: '<circle cx="12" cy="12" r="4.5"/><path d="' + sunRays + '"/>',
  sickle: '<path d="M4 21L9 16M9 16C4 10 8 3 15 3C20 3 22 7 21 10C19 6 15 5 12 7C9 9 9 13 10.5 15"/>',
};

const norm = (a) => ((a % 360) + 360) % 360;
const polar = (r, a) => { const t = a * Math.PI / 180; return [C + r * Math.sin(t), C - r * Math.cos(t)]; };
function sector(r1, r2, a1, a2) {
  const large = (a2 - a1) > 180 ? 1 : 0;
  const [x1, y1] = polar(r2, a1), [x2, y2] = polar(r2, a2), [x3, y3] = polar(r1, a2), [x4, y4] = polar(r1, a1);
  return `M${x1} ${y1} A${r2} ${r2} 0 ${large} 1 ${x2} ${y2} L${x3} ${y3} A${r1} ${r1} 0 ${large} 0 ${x4} ${y4} Z`;
}
function newMoonJD(k) {
  const T = k / 1236.85, T2 = T * T, T3 = T2 * T, T4 = T3 * T;
  const JDE = 2451550.09765 + 29.530588853 * k + 0.0001337 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;
  const r = Math.PI / 180;
  const M = (2.5534 + 29.10535669 * k - 0.0000014 * T2 - 0.00000011 * T3) * r;
  const Mp = (201.5643 + 385.81693528 * k + 0.0107438 * T2 + 0.00001239 * T3 - 0.000000058 * T4) * r;
  const F = (160.7108 + 390.67050274 * k - 0.0016341 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * r;
  return JDE
    - 0.40720 * Math.sin(Mp) + 0.17241 * Math.sin(M) + 0.01607 * Math.sin(2 * Mp)
    + 0.01039 * Math.sin(2 * F) + 0.00739 * Math.sin(Mp - M) - 0.00514 * Math.sin(Mp + M)
    + 0.00208 * Math.sin(2 * M) - 0.00111 * Math.sin(Mp - 2 * F) - 0.00057 * Math.sin(Mp + 2 * F)
    + 0.00056 * Math.sin(2 * Mp + M) - 0.00042 * Math.sin(3 * Mp);
}
const monthName = (i) => `${ORDINALS[i % 3]} da ${seasons()[Math.floor(i / 3)]}`;
/* Rótulo da data da festa. Equinócios e solstícios (1, 4, 7, 10) ganham a estação do hemisfério escolhido quando é o Norte
   ("Equinócio de Março · primavera"); no Sul o texto é o original. Festas de 1º do mês não dependem do hemisfério. */
const FEST_ASTRO = [1, 4, 7, 10];
function festData(k) {
  const f = FESTIVALS[k];
  return hemi === 'norte' && FEST_ASTRO.indexOf(k) >= 0 ? `${f.date} · ${seasons()[Math.floor(k / 3)].toLowerCase()}` : f.date;
}
/* ---------- amanhecer do dia litúrgico (etapa A) ----------
   DAWN (06:00) é o PADRÃO: vale sem localização, se a pessoa negar, e nos dias em que o Sol não nasce
   (noite polar) ou não se põe (Sol da meia-noite) no local. Com localização, o dia litúrgico começa no
   nascer do Sol real (OuranosCalc.sunriseNear, mesmas fórmulas do Mapa Astral). A localização vem da
   geolocalização que o ouranos.js já usa (eventos calendarium:localizacao[-erro]) e fica só em memória.
   "c" = número do dia civil local (dias desde 1970 da data local, como em civilOfLitDay). */
const AMANHECER_MAX = 800;
const aMemo = new Map();                    /* c -> { h, padrao, motivo } */
let aLoc = null;                            /* { lat, lon } ou null */
let aEstado = 'padrao';                     /* 'padrao' | 'pedindo' | 'negado' | 'indisponivel' | 'ok' */
function amanhecerDoDia(c) {
  let r = aMemo.get(c);
  if (r) return r;
  r = { h: DAWN, padrao: true, motivo: aLoc ? '' : 'sem-local' };
  const calc = window.OuranosCalc;
  if (aLoc && calc && typeof calc.sunriseNear === 'function') {
    const ds = civilOfLitDay(c);
    if (ds) {
      const ref = new Date(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8, 10), DAWN, 0, 0).getTime();
      let sol = null;
      try { sol = calc.sunriseNear(ref, aLoc.lat, aLoc.lon); } catch (e) { sol = null; }
      if (sol && sol.ms != null) {
        const dt = new Date(sol.ms), lm = sol.ms - dt.getTimezoneOffset() * 60000;
        const h = dt.getHours() + dt.getMinutes() / 60 + dt.getSeconds() / 3600;
        /* o nascer tem de cair neste dia civil, antes do meio-dia: garante dias litúrgicos sempre positivos
           (se o fuso do aparelho destoa muito do local, volta ao padrão em vez de embaralhar o calendário) */
        if (Math.floor(lm / DAY_MS) === c && h >= 0 && h < 12) r = { h, padrao: false, motivo: 'sol' };
        else r.motivo = 'fuso';
      } else if (sol) r.motivo = sol.polar === 'dia' ? 'sol-da-meia-noite' : 'noite-polar';
    }
  }
  if (aMemo.size >= AMANHECER_MAX) aMemo.clear();
  aMemo.set(c, r);
  return r;
}
function litDay(ms) {
  const lm = ms - new Date(ms).getTimezoneOffset() * 60000;
  const c = Math.floor(lm / DAY_MS);
  return lm >= c * DAY_MS + amanhecerDoDia(c).h * HOUR_MS ? c : c - 1;
}
const jdToMs = (jd) => (jd - 2440587.5) * DAY_MS;
const monthStartDay = (k) => litDay(jdToMs(newMoonJD(k))) + 1;

/* ---------- festas pessoais (window.Festas, festas.js) ---------- */
/* true: a marca azul só aparece no dia da festa; false: marca as festas do mês lunar exibido */
const FESTAS_SOMENTE_NO_DIA = true;
const escF = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/* Data civil ('AAAA-MM-DD') do dia litúrgico L (que começa às 06:00): inverso de litDay, independe do fuso */
function civilOfLitDay(L) {
  try { return new Date(L * DAY_MS).toISOString().slice(0, 10); } catch (e) { return ''; }
}
const fmtDataBR = (d) => d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4);
function festasEm(data) {
  const F = window.Festas;
  if (!F || typeof F.byDate !== 'function' || !data) return [];
  try { return F.byDate(data) || []; } catch (e) { return []; }
}
const festasDoDia = (s) => festasEm(civilOfLitDay(s.moonStartDay + s.moonIndex));
function festasMarks(s) {
  const out = [];
  const ini = FESTAS_SOMENTE_NO_DIA ? s.moonIndex : 0, fim = FESTAS_SOMENTE_NO_DIA ? s.moonIndex : s.moonDays - 1;
  for (let i = ini; i <= fim; i++) {
    const fs = festasEm(civilOfLitDay(s.moonStartDay + i));
    if (fs.length) out.push({ i, title: fs.map((f) => f.nome).join(' · ') });
  }
  return out;
}

function getState(now) {
  const ms = now.getTime();
  const hours = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
  const lm = ms - now.getTimezoneOffset() * 60000;
  const dawnHoje = amanhecerDoDia(Math.floor(lm / DAY_MS));
  const period = hours >= dawnHoje.h && hours < 12 ? 'Amanhecer (🜢)' : hours >= 12 && hours < 18 ? 'Entardecer (🜬)' : 'Noite (✧)';
  const L = litDay(ms);
  const dL = amanhecerDoDia(L), dN = amanhecerDoDia(L + 1);
  /* sem amanhecer real nos dois extremos do dia litúrgico: fórmulas originais, resultado idêntico ao de antes */
  const padrao = dL.padrao && dN.padrao;
  const iniL = L * DAY_MS + dL.h * HOUR_MS, iniN = (L + 1) * DAY_MS + dN.h * HOUR_MS;
  const litFrac = padrao ? ((hours - DAWN + 24) % 24) / 24 : (lm - iniL) / (iniN - iniL);
  const weekIndex = padrao ? new Date(ms - DAWN * HOUR_MS).getDay() : new Date(L * DAY_MS).getUTCDay();
  const SYN = 29.530588853;
  const jdNow = ms / DAY_MS + 2440587.5;
  let k0 = Math.floor((jdNow - 2451550.09765) / SYN);
  let nm0 = newMoonJD(k0);
  if (nm0 > jdNow) { k0--; nm0 = newMoonJD(k0); }
  const nm1 = newMoonJD(k0 + 1);
  const age = jdNow - nm0;
  const frac = age / (nm1 - nm0);
  const phaseName = PHASES[Math.floor(frac * 8 + 0.5) % 8];
  let k = k0;
  while (monthStartDay(k + 1) <= L) k++;
  while (monthStartDay(k) > L) k--;
  const startDay = monthStartDay(k);
  const moonDays = monthStartDay(k + 1) - startDay;
  const moonIndex = L - startDay;
  const month = (((k + 1) % 12) + 12) % 12;
  const n = (now - Date.UTC(2000, 0, 1, 12)) / 864e5;
  const Ls = 280.46 + 0.9856474 * n;
  const g = ((357.528 + 0.9856003 * n) * Math.PI) / 180;
  const lambda = norm(Ls + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g));
  const signIndex = Math.floor(lambda / 30);
  const moonProgress = (moonIndex + litFrac) / moonDays;
  return {
    hours, period, dawnH: dawnHoje.h, dawnPadrao: dawnHoje.padrao, dawnMotivo: dawnHoje.motivo, weekIndex, moonIndex, moonDays, moonStartDay: startDay, phaseName, age, month, signIndex,
    dayAngle: 180 + hours * 15,
    weekAngle: ((weekIndex + litFrac) / 7) * 360,
    moonAngle: moonProgress * 360,
    monthAngle: ((month + moonProgress) / 12) * 360,
    zodiacAngle: ZODIAC_OFFSET + lambda,
  };
}

function ring(r1, r2, count, offset, active, labelFn) {
  const step = 360 / count;
  let g = '';
  for (let i = 0; i < count; i++) {
    const a1 = offset + i * step;
    const [lx, ly] = polar((r1 + r2) / 2, a1 + step / 2);
    const on = i === active;
    const fill = on ? 'rgba(227,194,122,0.18)' : (i % 2 ? 'rgba(255,255,255,0.012)' : 'rgba(255,255,255,0.035)');
    g += `<path d="${sector(r1, r2, a1, a1 + step)}" fill="${fill}" stroke="rgba(201,164,92,0.28)" stroke-width="1"/>`;
    g += labelFn(i, lx, ly, on);
  }
  g += `<circle cx="500" cy="500" r="${r2}" fill="none" stroke="rgba(201,164,92,0.75)" stroke-width="1.2"/>`;
  return g;
}
function hand(angle, r1, r2, color, width) {
  width = width || 4;
  return `<g transform="rotate(${angle} 500 500)" style="filter:drop-shadow(0 0 6px ${color}66)"><polygon points="${500 - width},${500 - r1} 500,${500 - r2} ${500 + width},${500 - r1}" fill="${color}"/><circle cx="500" cy="${500 - r1}" r="${width + 1.5}" fill="#0b1120" stroke="${color}" stroke-width="1.5"/></g>`;
}
function moonGlyph(x, y, r, phase) {
  let g = `<circle cx="${x}" cy="${y}" r="${r}" fill="${phase === 'full' ? '#efe6d2' : '#0b1120'}" stroke="#efe6d2" stroke-width="1.2"/>`;
  if (phase === 'first') g += `<path d="M${x} ${y - r} A${r} ${r} 0 0 1 ${x} ${y + r} Z" fill="#efe6d2"/>`;
  if (phase === 'last') g += `<path d="M${x} ${y - r} A${r} ${r} 0 0 0 ${x} ${y + r} Z" fill="#efe6d2"/>`;
  return g;
}
function iconSVG(type, x, y, size, color, title) {
  return `<g style="cursor:pointer"><title>${title}</title><circle cx="${x}" cy="${y}" r="${size / 2 + 6}" fill="rgba(0,0,0,0.001)"/><svg x="${x - size / 2}" y="${y - size / 2}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none">${ICON_PATHS[type]}</svg></g>`;
}
function iconInline(type, size, color) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[type]}</svg>`;
}

function dayCore(r, period, idSuffix = '', dawnH = DAWN) {
  const da = 180 + dawnH * 15;                /* ângulo do amanhecer no mostrador (06:00 = 270°, como antes) */
  let g = `<defs><linearGradient id="dawn${idSuffix}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#3b3552"/><stop offset="1" stop-color="#c99a6b"/></linearGradient><linearGradient id="dusk${idSuffix}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b8776a"/><stop offset="1" stop-color="#3f2c46"/></linearGradient></defs>`;
  g += `<path d="${sector(0, r, 90, da)}" fill="#0f1830"/>`;
  g += `<path d="${sector(0, r, da, 360)}" fill="url(#dawn${idSuffix})" opacity="0.85"/>`;
  g += `<path d="${sector(0, r, 0, 90)}" fill="url(#dusk${idSuffix})" opacity="0.85"/>`;
  for (let h = 0; h < 24; h++) {
    const a = 180 + h * 15;
    const [x1, y1] = polar(r - (h % 6 === 0 ? 12 : 6), a), [x2, y2] = polar(r, a);
    g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e8dcc0" stroke-opacity="0.5" stroke-width="1"/>`;
  }
  [['Noite (✧)', 180, 62], ['Amanhecer (🜢)', 315, 58], ['Entardecer (🜬)', 45, 58]].forEach(([lab, a, rr]) => {
    const [x, y] = polar(rr, a);
    g += `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="9" letter-spacing="1" fill="#efe6d2" opacity="${period === lab ? 1 : 0.55}" style="font-family:'Jost',sans-serif;text-transform:uppercase">${lab}</text>`;
  });
  const [dx1, dy1] = polar(r - 20, da), [dx2, dy2] = polar(r, da);
  g += `<line x1="${dx1}" y1="${dy1}" x2="${dx2}" y2="${dy2}" stroke="#f3d08a" stroke-width="3" stroke-linecap="round"/>`;
  g += `<circle cx="500" cy="500" r="${r}" fill="none" stroke="rgba(201,164,92,0.85)" stroke-width="1.5"/>`;
  return g;
}
function weekRing(r1, r2, active) {
  return ring(r1, r2, 7, 0, active, (i, x, y, on) =>
    `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="28" fill="${on ? '#f3d08a' : '#e8dcc0'}" opacity="${on ? 1 : 0.75}" style="font-family:${SYMBOL_FONT}">${WEEK[i].sym}</text>`);
}
function moonRing(r1, r2, count, active, marks) {
  const phases = { 1: 'new', [Math.round(count / 4)]: 'first', [Math.round(count / 2)]: 'full', [Math.round(3 * count / 4)]: 'last' };
  const base = ring(r1, r2, count, 0, active, (i, x, y, on) => {
    const day = i + 1;
    return phases[day]
      ? moonGlyph(x, y, 9, phases[day])
      : `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="10" fill="${on ? '#f3d08a' : '#e8dcc0'}" opacity="${on ? 1 : 0.45}" style="font-family:'Jost',sans-serif">${day}</text>`;
  });
  if (!marks || !marks.length) return base;
  const step = 360 / count;
  return base + marks.map((mk) => `<path d="${sector(r1, r2, mk.i * step, (mk.i + 1) * step)}" fill="rgba(120,160,230,.28)" stroke="#4a7dd8" stroke-width="1.6"><title>${escF(mk.title)}</title></path>`).join('');
}
function monthRing(r1, r2, active) {
  return ring(r1, r2, 12, 0, active, (i, x, y, on) =>
    `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="24" fill="${on ? '#f3d08a' : '#efe6d2'}" opacity="${on ? 1 : 0.8}" style="font-family:'Cormorant Garamond',serif;font-weight:600">${ROMAN[i]}</text>`);
}
function seasonRing(r1, r2, active) {
  return ring(r1, r2, 12, 0, active, (i, x, y, on) => {
    const f = FESTIVALS[i];
    return f
      ? iconSVG(ICONS[i], x, y, 32, on ? '#f3d08a' : '#e8dcc0', `${f.name} — ${festData(i)}\n${f.theme}`)
      : `<circle cx="${x}" cy="${y}" r="2" fill="#c9a45c" opacity="0.5"/>`;
  });
}
function zodiacRing(r1, r2, active) {
  return ring(r1, r2, 12, ZODIAC_OFFSET, active, (i, x, y, on) =>
    `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="30" fill="${on ? '#f3d08a' : '#e8dcc0'}" opacity="${on ? 1 : 0.75}" style="font-family:${SYMBOL_FONT}">${ZODIAC[i].sym}</text>`);
}
function hourHand(angle, color) {
  return `<g transform="rotate(${angle} 500 500)" style="filter:drop-shadow(0 0 8px ${color}88)"><polygon points="495,518 500,404 505,518" fill="${color}"/><circle cx="500" cy="500" r="9" fill="#0b1120" stroke="${color}" stroke-width="2"/><circle cx="500" cy="500" r="3" fill="${color}"/></g>`;
}
function sunTip(cx, cy, r) {
  let rays = '';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const x1 = cx + (r + 2) * Math.sin(a), y1 = cy - (r + 2) * Math.cos(a);
    const x2 = cx + (r + 5) * Math.sin(a), y2 = cy - (r + 5) * Math.cos(a);
    rays += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#f3d08a" stroke-width="1.4" stroke-linecap="round"/>`;
  }
  return `<g style="filter:drop-shadow(0 0 4px #f3d08a99)">${rays}<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f3d08a" stroke="#0b1120" stroke-width="1"/></g>`;
}

function buildSVG(s) {
  let g = `<circle cx="500" cy="500" r="438" fill="none" stroke="rgba(201,164,92,0.35)" stroke-width="1"/><circle cx="500" cy="500" r="446" fill="none" stroke="rgba(201,164,92,0.15)" stroke-width="1"/>`;
  g += zodiacRing(345, 420, s.signIndex);
  g += seasonRing(282, 345, s.month);
  g += monthRing(230, 282, s.month);
  g += moonRing(170, 230, s.moonDays, s.moonIndex, festasMarks(s));
  g += weekRing(110, 170, s.weekIndex);
  g += dayCore(110, s.period, '', s.dawnH);
  g += hand(s.weekAngle, 110, 158, '#efe6d2');
  g += hand(s.moonAngle, 170, 214, '#b9c6db');
  g += hand(s.monthAngle, 230, 268, '#e0906a');
  g += hand(s.zodiacAngle, 345, 400, '#a9c4a4');
  g += hourHand(s.dayAngle, '#f3d08a');
  const [zx, zy] = polar(400, s.zodiacAngle);
  g += sunTip(zx, zy, 7);
  const [hx, hy] = polar(96, s.dayAngle);
  g += sunTip(hx, hy, 6);
  return `<svg viewBox="40 40 920 920" class="clock" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
}

/* Diagrama dos Mistérios: mesmos anéis e símbolos, sem ponteiros nem pontas. */
function buildMystSVG(s) {
  let g = `<circle cx="500" cy="500" r="438" fill="none" stroke="rgba(201,164,92,0.35)" stroke-width="1"/><circle cx="500" cy="500" r="446" fill="none" stroke="rgba(201,164,92,0.15)" stroke-width="1"/>`;
  g += zodiacRing(345, 420, s.signIndex);
  g += seasonRing(282, 345, s.month);
  g += monthRing(230, 282, s.month);
  g += moonRing(170, 230, s.moonDays, s.moonIndex);
  g += weekRing(110, 170, s.weekIndex);
  g += dayCore(110, s.period, '', s.dawnH);
  return `<svg viewBox="40 40 920 920" class="clock" xmlns="http://www.w3.org/2000/svg">${g}</svg>`;
}
function buildMystList() {
  const order = [11, 1, 2, 4, 5, 7, 8, 10];
  return order.map((k) => {
    const f = FESTIVALS[k];
    const icon = iconInline(ICONS[k], 28, '#c9a45c');
    return `<div class="myst-item"><div class="myst-icon">${icon}</div><div class="myst-text"><h3>${f.name} <span class="myst-date">· ${festData(k)}</span></h3><p>${f.theme}</p></div></div>`;
  }).join('');
}

const fmtHM = (h) => { const t = Math.round(h * 60); return pad(Math.floor(t / 60) % 24) + ':' + pad(t % 60); };
function dawnDetalhe(s) {
  if (!s.dawnPadrao) return 'Nascer do Sol no seu local';
  const m = s.dawnMotivo;
  if (m === 'noite-polar') return 'Padrão · o Sol não nasce hoje neste local';
  if (m === 'sol-da-meia-noite') return 'Padrão · o Sol não se põe hoje neste local';
  if (m === 'fuso') return 'Padrão · nascer incompatível com o fuso do aparelho';
  if (aEstado === 'negado') return 'Padrão · localização não autorizada';
  if (aEstado === 'pedindo') return 'Padrão · obtendo localização…';
  if (aEstado === 'indisponivel') return 'Padrão · localização indisponível';
  return 'Padrão · sem localização';
}
function buildInfo(s, now) {
  const rows = [
    ['#f3d08a', 'Hora', now.toLocaleTimeString('pt-BR'), s.period],
    ['#f3d08a', 'Amanhecer', fmtHM(s.dawnH), escF(dawnDetalhe(s))],
    ['#efe6d2', 'Dia', WEEK[s.weekIndex].name, WEEK[s.weekIndex].sym + ' ' + WEEK[s.weekIndex].astro],
    ['#b9c6db', 'Lua', s.phaseName, `Dia ${s.moonIndex + 1} de ${s.moonDays}`],
    ['#e0906a', 'Mês', monthName(s.month), `Mês ${ROMAN[s.month]}`],
    ['#a9c4a4', 'Sol em', ZODIAC[s.signIndex].name, ZODIAC[s.signIndex].sym],
  ];
  const fd = festasDoDia(s);
  if (fd.length) rows.push(['#4a7dd8', 'Festa', escF(fd.map((f) => f.nome).join(' · ')), fmtDataBR(fd[0].data)]);
  return rows.map(([c, l, v, d]) =>
    `<div class="row"><span class="dot" style="background:${c};box-shadow:0 0 10px ${c}"></span><span class="label">${l}</span><div class="val"><p class="v">${v}</p><p class="d">${d}</p></div></div>`).join('');
}

let mode = 'live', simTime = Date.now(), speed = 3600, direction = 1, intervalId = null;
const SPEEDS = [{ label: '1 min/s', v: 60 }, { label: '1 h/s', v: 3600 }, { label: '1 dia/s', v: 86400 }, { label: '1 sem/s', v: 604800 }];
const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

function render() {
  const now = new Date(simTime);
  const s = getState(now);
  document.getElementById('clockdiv').innerHTML = buildSVG(s);
  document.getElementById('info').innerHTML = buildInfo(s, now);
  document.getElementById('dt').value = toLocalInput(now);
  document.getElementById('modeLabel').textContent = mode === 'live' ? 'Ao vivo' : mode === 'playing' ? 'Reproduzindo' : 'Pausado';
  document.getElementById('btnPlay').innerHTML = mode === 'playing' ? '⏸ Pausar' : '▶ Reproduzir';
  document.getElementById('btnPast').className = 'btn' + (direction === -1 ? ' btn-on' : '');
  document.getElementById('btnFut').className = 'btn' + (direction === 1 ? ' btn-on' : '');
}
function start() {
  clearInterval(intervalId);
  if (mode === 'live') {
    simTime = Date.now();
    intervalId = setInterval(() => { simTime = Date.now(); render(); }, 1000);
  } else if (mode === 'playing') {
    intervalId = setInterval(() => { simTime += direction * speed * 100; render(); }, 100);
  }
  render();
}
document.getElementById('btnNow').onclick = () => { mode = 'live'; start(); };
document.getElementById('btnPlay').onclick = () => { mode = mode === 'playing' ? 'paused' : 'playing'; start(); };
document.getElementById('btnPast').onclick = () => { direction = -1; if (mode !== 'playing') { mode = 'playing'; } start(); };
document.getElementById('btnFut').onclick = () => { direction = 1; if (mode !== 'playing') { mode = 'playing'; } start(); };
document.getElementById('dt').onchange = (e) => { if (e.target.value) { simTime = new Date(e.target.value).getTime(); mode = 'paused'; start(); } };
document.getElementById('speeds').innerHTML = SPEEDS.map((sp) =>
  `<button class="speed${sp.v === speed ? ' speed-on' : ''}" data-v="${sp.v}">${sp.label}</button>`).join('');
document.getElementById('speeds').querySelectorAll('button').forEach((b) => {
  b.onclick = () => { speed = Number(b.dataset.v); start(); };
});
start();

window.liturgyRender = render;
window.liturgyStart = start;
window.mystRender = function () {
  const now = new Date(simTime);
  const s = getState(now);
  document.getElementById('mystClockdiv').innerHTML = buildMystSVG(s);
  document.getElementById('mystList').innerHTML = buildMystList();
  mystLocalRender();
};

/* ---------- aba 4: Festas Locais ---------- */
const FESTA_PENA = '<svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#c9a45c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/></svg>';
function mystLocalRender() {
  const el = document.getElementById('mystLocal');
  if (!el) return;
  let lista = [];
  try { lista = (window.Festas && window.Festas.list()) || []; } catch (e) { lista = []; }
  const hoje = civilOfLitDay(litDay(simTime));
  const itens = lista.map((f) => {
    const passada = f.data < hoje;
    const nome = escF(f.nome);
    return `<div class="myst-item festa-item${passada ? ' festa-past' : ''}"><div class="myst-icon">${FESTA_PENA}</div><div class="myst-text"><h3>${nome} <span class="myst-date">· ${fmtDataBR(f.data)}${passada ? ' · passada' : ''}</span></h3>${f.descricao ? `<p>${escF(f.descricao)}</p>` : ''}</div><button type="button" class="festa-del" data-id="${escF(f.id)}" aria-label="Remover festa ${nome}" title="Remover festa"><span aria-hidden="true">×</span></button></div>`;
  }).join('');
  el.innerHTML = `<div class="festa-local"><h2 class="festa-local-title" tabindex="-1">Festas Locais</h2>${itens ? `<div class="festa-local-list">${itens}</div>` : '<p class="festa-local-vazio">Nenhuma festa pessoal registrada. Use "Personalizar" na aba Liturgia.</p>'}</div>`;
}
(function () {
  const el = document.getElementById('mystLocal');
  if (!el) return;
  el.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('.festa-del');
    if (!b || !window.Festas) return;
    const id = b.getAttribute('data-id');
    const f = window.Festas.list().find((x) => x.id === id);
    if (!f) return;
    let ok = false;
    try { ok = typeof window.confirm === 'function' && window.confirm('Remover a festa "' + f.nome + '"?') === true; } catch (err) { ok = false; }
    if (!ok) return;
    window.Festas.remove(id);
    const h = el.querySelector('h2');           /* o botão some: leva o foco ao título da seção */
    if (h) { try { h.focus({ preventScroll: true }); } catch (err) { /* ignora */ } }
  });
})();

/* ---------- amanhecer real: localização, botão e mensagens (etapa A) ---------- */
const MSG_AMANHECER = {
  ok: 'Amanhecer calculado pelo nascer do Sol no seu local.',
  pedindo: 'Obtendo a localização…',
  negado: 'Localização não autorizada: o dia litúrgico segue começando às 06:00. Para usar o nascer do Sol, libere a localização nas configurações do navegador.',
  indisponivel: 'Não foi possível obter a localização agora: o dia litúrgico segue começando às 06:00.',
};
function atualizaControleAmanhecer() {
  const btn = document.getElementById('btnDawnLoc'), msg = document.getElementById('dawnMsg');
  if (btn) {
    btn.textContent = aEstado === 'ok' ? 'Atualizar localização' : 'Usar minha localização para o amanhecer';
    btn.setAttribute('aria-busy', aEstado === 'pedindo' ? 'true' : 'false');
  }
  if (msg) {
    const t = MSG_AMANHECER[aEstado] || '';
    if (msg.textContent !== t) msg.textContent = t;     /* região aria-live: só anuncia quando o texto muda */
  }
}
function mudouAmanhecer() {
  aMemo.clear();
  atualizaControleAmanhecer();
  render();
  const myst = document.getElementById('mysteriesView');
  if (myst && myst.style.display === 'block' && typeof window.mystRender === 'function') window.mystRender();
  try { document.dispatchEvent(new CustomEvent('calendarium:amanhecer-mudou')); } catch (e) { /* ignora */ }
}
function definirLocal(lat, lon) {
  lat = Number(lat); lon = Number(lon);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;
  aLoc = { lat, lon }; aEstado = 'ok';
  mudouAmanhecer();
  return true;
}
function limparLocal(estado) {
  aLoc = null; aEstado = estado || 'padrao';
  mudouAmanhecer();
}
function pedirLocal(forcar) {
  const O = typeof Ouranos !== 'undefined' ? Ouranos : null;
  if (!O || typeof O.requestLocation !== 'function') { aEstado = 'indisponivel'; atualizaControleAmanhecer(); render(); return; }
  const atual = O.location();
  if (!forcar && atual && atual.src === 'gps' && atual.lat != null) { definirLocal(atual.lat, atual.lon); return; }   /* já obtida (ex.: no Mapa Astral) */
  if (atual && atual.pending) { aEstado = 'pedindo'; atualizaControleAmanhecer(); render(); return; }
  aEstado = 'pedindo'; atualizaControleAmanhecer(); render();
  O.requestLocation(true);
}
document.addEventListener('calendarium:localizacao', (e) => { const d = e && e.detail; if (d) definirLocal(d.lat, d.lon); });
document.addEventListener('calendarium:localizacao-erro', (e) => {
  const d = (e && e.detail) || {};
  if (d.negado) limparLocal('negado');                       /* negou: esquece a localização e volta às 06:00 */
  else if (aLoc) { aEstado = 'ok'; atualizaControleAmanhecer(); render(); }   /* falha passageira: mantém a que já tinha */
  else { aEstado = 'indisponivel'; atualizaControleAmanhecer(); render(); }
});
(function () {
  const btn = document.getElementById('btnDawnLoc');
  if (btn) btn.addEventListener('click', () => pedirLocal(true));
  atualizaControleAmanhecer();
  /* Sem pedir nada por conta própria: só reaproveita a localização se a permissão JÁ foi concedida antes
     (assim não aparece um aviso do navegador ao abrir o app). Quem ainda não decidiu usa o botão. */
  window.addEventListener('load', () => {
    try {
      if (!navigator.permissions || typeof navigator.permissions.query !== 'function') return;
      navigator.permissions.query({ name: 'geolocation' }).then((p) => {
        if (p.state === 'granted') pedirLocal(false);
        else if (p.state === 'denied') { aEstado = 'negado'; atualizaControleAmanhecer(); render(); }
        p.onchange = () => { if (p.state === 'granted') pedirLocal(true); else if (p.state === 'denied') limparLocal('negado'); };
      }).catch(() => { /* ignora */ });
    } catch (e) { /* ignora */ }
  });
})();

/* ---------- seletor de hemisfério (etapa B) ---------- */
/* Só local: o esquema do store (festas/diario/diario_log) e as regras da nuvem não têm lugar para preferências,
   então nada disto vai para a sincronização. localStorage sempre em try/catch (bloqueado = vale só nesta sessão). */
function atualizaControleHemi() {
  ['sul', 'norte'].forEach((h) => {
    const b = document.getElementById(h === 'sul' ? 'btnHemiSul' : 'btnHemiNorte');
    if (!b) return;
    b.setAttribute('aria-pressed', hemi === h ? 'true' : 'false');
    b.className = 'btn' + (hemi === h ? ' btn-on' : '');
  });
}
function definirHemi(h) {
  if (!ehHemi(h)) return false;
  if (h === hemi) { atualizaControleHemi(); return true; }
  hemi = h;
  try { window.localStorage.setItem(HEMI_KEY, h); } catch (e) { /* sem armazenamento: vale só nesta sessão */ }
  atualizaControleHemi();
  render();
  const myst = document.getElementById('mysteriesView');
  if (myst && myst.style.display === 'block' && typeof window.mystRender === 'function') window.mystRender();
  try { document.dispatchEvent(new CustomEvent('calendarium:hemisferio-mudou', { detail: { hemisferio: h } })); } catch (e) { /* ignora */ }
  return true;
}
(function () {
  const sul = document.getElementById('btnHemiSul'), norte = document.getElementById('btnHemiNorte');
  if (sul) sul.addEventListener('click', () => definirHemi('sul'));
  if (norte) norte.addEventListener('click', () => definirHemi('norte'));
  atualizaControleHemi();
})();

/* ---------- kit para as etapas 2 e 3 (sem efeito visível agora) ---------- */
let dialSeq = 0;
function dialSVG(horas, opts) {
  let h = Number(horas); if (!isFinite(h)) h = 0;
  h = ((h % 24) + 24) % 24;
  const tot = Math.floor(h * 60 + 1e-6) % 1440;
  const raw = opts && opts.id != null ? String(opts.id).replace(/[^\w-]/g, '_') : '';
  const sfx = '-' + (raw || 'dial' + (++dialSeq));            /* IDs únicos: nunca colidem com os do relógio principal */
  const dw = opts && typeof opts.dawn === 'number' && opts.dawn >= 0 && opts.dawn < 12 ? opts.dawn : DAWN;   /* amanhecer opcional (padrão 06:00) */
  const period = h >= dw && h < 12 ? 'Amanhecer (🜢)' : h >= 12 && h < 18 ? 'Entardecer (🜬)' : 'Noite (✧)';
  const [x, y] = polar(96, 180 + h * 15);
  return `<svg viewBox="375 375 250 250" class="dial" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mostrador de 24 horas, ${pad(Math.floor(tot / 60))}:${pad(tot % 60)}" focusable="false">${dayCore(110, period, sfx, dw)}${sunTip(x, y, 6)}</svg>`;
}
function moonInfo(date) {
  const ms = date instanceof Date ? date.getTime() : Number(date);
  if (!isFinite(ms)) return null;
  const jd = ms / DAY_MS + 2440587.5;
  let k = Math.floor((jd - 2451550.09765) / 29.530588853);
  while (newMoonJD(k + 1) <= jd) k++;
  while (newMoonJD(k) > jd) k--;
  const nm0 = newMoonJD(k), nm1 = newMoonJD(k + 1);
  const age = jd - nm0, frac = age / (nm1 - nm0);
  const phaseIndex = Math.floor(frac * 8 + 0.5) % 8;
  return { age, frac, elong: frac * 360, phaseName: PHASES[phaseIndex], phaseIndex };
}
/* Mês lunar do Calendário Litúrgico (começa no dia litúrgico seguinte à Lua Nova; nome e número como no relógio) */
function lunarMonthK(k) {
  const startDay = monthStartDay(k), next = monthStartDay(k + 1), month = (((k + 1) % 12) + 12) % 12;
  const dates = [];
  for (let L = startDay; L < next; L++) dates.push(civilOfLitDay(L));
  return { k, month, name: monthName(month), roman: ROMAN[month], days: next - startDay, startDay, dates, start: dates[0], end: dates[dates.length - 1] };
}
function lunarMonth(x) {
  const ms = x instanceof Date ? x.getTime() : (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? new Date(+x.slice(0, 4), +x.slice(5, 7) - 1, +x.slice(8, 10), 12).getTime() : Number(x));
  if (!isFinite(ms)) return null;
  const L = litDay(ms);
  let k = Math.floor((ms / DAY_MS + 2440587.5 - 2451550.09765) / 29.530588853);
  while (monthStartDay(k + 1) <= L) k++;
  while (monthStartDay(k) > L) k--;
  return lunarMonthK(k);
}
/* amanhecer(data) → { horas, padrao, motivo, estado }: horas = hora local decimal em que começa o dia litúrgico daquela data civil */
function amanhecer(x) {
  const ms = x instanceof Date ? x.getTime() : Number(x);
  if (!isFinite(ms)) return null;
  const r = amanhecerDoDia(Math.floor((ms - new Date(ms).getTimezoneOffset() * 60000) / DAY_MS));
  return { horas: r.h, padrao: r.padrao, motivo: r.motivo, estado: aEstado };
}
window.LiturgyKit = { dialSVG, moonInfo, civilOfLitDay, WEEK, PHASES, litDay, lunarMonth, lunarMonthK, amanhecer, setLocal: definirLocal, setHemisferio: definirHemi, hemisferio: () => hemi, estacoes: () => seasons().slice(), clearLocal: () => limparLocal('padrao'), DAWN };
})();
