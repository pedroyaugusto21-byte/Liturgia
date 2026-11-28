/* ======================================================================
   LUNAR
   ====================================================================== */
(function () {
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const PHASE_NAMES  = ['Lua Nova','Crescente Côncava','Quarto Crescente','Crescente Convexa','Lua Cheia','Minguante Convexa','Quarto Minguante','Minguante Côncava'];
let current = new Date();
let hovered = null;

const CYCLE = 29.53058867;
/* Reserva (ciclo médio): usada só se MansoesLunares/OuranosCalc não estiverem disponíveis */
function lunarAgeMean(date) {
  const ref = new Date(Date.UTC(2000, 0, 6, 18, 14, 0)); /* Lua Nova de referência em UTC (independe do fuso do navegador) */
  const diff = (date - ref) / 86400000;
  return ((diff % CYCLE) + CYCLE) % CYCLE;
}
/* Idade lunar equivalente à elongação Sol–Lua (Meeus), em dias do ciclo médio */
function lunarAge(date) {
  try {
    if (window.MansoesLunares && MansoesLunares.elongation) {
      const e = MansoesLunares.elongation(date);
      if (e !== null && isFinite(e)) return (e / 360) * CYCLE;
    }
  } catch (err) { /* usa o ciclo médio */ }
  return lunarAgeMean(date);
}
function phaseIdx(age)  { return Math.floor((age / 29.53058867) * 8) % 8; }
function phaseName(age) { return PHASE_NAMES[phaseIdx(age)]; }
function keyPhase(age) {
  if (age < 1.5 || age > 28.2)           return 'nova';
  if (Math.abs(age - 7.38)  < 1.1)       return 'cres';
  if (Math.abs(age - 14.77) < 1.1)       return 'cheia';
  if (Math.abs(age - 22.15) < 1.1)       return 'min';
  return null;
}

/* Fases principais do mês exibido: dia do mês -> 'nova'|'cres'|'cheia'|'min'.
   Usa o instante exato (elongação 0/90/180/270°) no dia LOCAL; sem MansoesLunares, volta às janelas do ciclo médio. */
let keyDays = {};
function computeKeyDays(y, m) {
  const map = {};
  try {
    if (window.MansoesLunares && MansoesLunares.phaseInstants) {
      const list = MansoesLunares.phaseInstants(new Date(y, m, 1).getTime(), new Date(y, m + 1, 1).getTime());
      if (list.length) {
        list.forEach(p => { const d = new Date(p.ms).getDate(); if (!map[d]) map[d] = p.k; });
        return map;
      }
    }
  } catch (err) { /* usa a reserva */ }
  const days = new Date(y, m + 1, 0).getDate();
  for (let d = 1; d <= days; d++) { const k = keyPhase(lunarAge(new Date(y, m, d))); if (k) map[d] = k; }
  return map;
}

/* Dimensões do canvas (etapa C): recalculadas no carregamento e a cada resize/giro (ver o fim do arquivo).
   O estado da aba (current, hovered, keyDays) fica fora daqui e não é tocado. */
let DPR = 1, SIZE = 360, CX = 180, CY = 180, R_OUTER = 0, R_INNER = 0, R_LABEL = 0, R_MOON = 0;
const canvas = document.getElementById('moonCanvas');
const ctx = canvas.getContext('2d');
function dimensiona() {
  const dpr = window.devicePixelRatio || 1;
  const size = Math.max(160, Math.min(window.innerWidth - 80, 360));
  if (size === SIZE && dpr === DPR && canvas.width) return false;   /* nada mudou (ex.: só a altura, na barra do navegador) */
  DPR = dpr; SIZE = size;
  canvas.width  = Math.round(SIZE * DPR);
  canvas.height = Math.round(SIZE * DPR);
  canvas.style.width  = SIZE + 'px';
  canvas.style.height = SIZE + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);   /* setTransform (e não scale): redimensionar o canvas zera a matriz, e assim ela nunca se acumula */
  CX = SIZE / 2; CY = SIZE / 2;
  R_OUTER = SIZE * 0.41; R_INNER = SIZE * 0.295; R_LABEL = SIZE * 0.345; R_MOON = SIZE * 0.13;
  return true;
}
dimensiona();

function drawMoon(cx, cy, r, age) {
  const frac = age / 29.53;
  const illum = frac < 0.5 ? frac * 2 : (1 - frac) * 2;
  const wax   = frac < 0.5;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a18';
  ctx.fill();
  const isNew  = age < 1.2 || age > 28.3;
  const isFull = Math.abs(age - 14.77) < 1.5;
  if (!isNew) {
    if (isFull) {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#e8d5a3'; ctx.fill();
    } else {
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
      const side = wax ? [Math.PI / 2, -Math.PI / 2, false] : [-Math.PI / 2, Math.PI / 2, false];
      ctx.beginPath(); ctx.arc(cx, cy, r, side[0], side[1], side[2]); ctx.fillStyle = '#e8d5a3'; ctx.fill();
      const ex = r * Math.abs(1 - illum * 2);
      ctx.beginPath(); ctx.ellipse(cx, cy, ex, r, 0, 0, Math.PI * 2);
      ctx.fillStyle = illum < 0.5 ? '#0a0a18' : '#e8d5a3'; ctx.fill();
      ctx.restore();
    }
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(201,168,76,0.55)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, SIZE, SIZE);
  const y = current.getFullYear(), m = current.getMonth();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const isNow = today.getFullYear() === y && today.getMonth() === m;
  const seg = (Math.PI * 2) / daysInMonth;
  [R_OUTER + 10, R_OUTER, R_INNER - 2, R_MOON + 8].forEach((r, i) => {
    ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(201,168,76,${[0.08, 0.18, 0.12, 0.1][i]})`;
    ctx.lineWidth = i === 1 ? 0.5 : 0.3; ctx.stroke();
  });
  for (let d = 1; d <= daysInMonth; d++) {
    const age = lunarAge(new Date(y, m, d));
    const pi  = phaseIdx(age);
    const sa  = -Math.PI / 2 + (d - 1) * seg;
    const ea  = sa + seg - 0.018;
    const mid = sa + seg / 2;
    const isToday   = isNow && today.getDate() === d;
    const isHovered = hovered === d;
    const isKey     = keyDays[d] || null;
    ctx.beginPath();
    ctx.arc(CX, CY, R_OUTER, sa, ea);
    ctx.arc(CX, CY, R_INNER, ea, sa, true);
    ctx.closePath();
    if (isToday)        ctx.fillStyle = 'rgba(201,168,76,0.42)';
    else if (isHovered) ctx.fillStyle = 'rgba(201,168,76,0.2)';
    else { const a = 0.03 + (pi / 8) * 0.13; ctx.fillStyle = `rgba(170,190,255,${a})`; }
    ctx.fill();
    ctx.strokeStyle = 'rgba(201,168,76,0.16)'; ctx.lineWidth = 0.4; ctx.stroke();
    const lx = CX + R_LABEL * Math.cos(mid), ly = CY + R_LABEL * Math.sin(mid);
    ctx.save();
    ctx.translate(lx, ly); ctx.rotate(mid + Math.PI / 2);
    ctx.font = `${isToday ? '600' : '400'} ${SIZE * 0.026}px Raleway, sans-serif`;
    ctx.fillStyle = isToday ? '#C9A84C' : isHovered ? '#e0d4b0' : 'rgba(210,225,255,0.6)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(d, 0, 0);
    ctx.restore();
    if (isKey) {
      const dr = R_INNER - 7;
      ctx.beginPath(); ctx.arc(CX + dr * Math.cos(mid), CY + dr * Math.sin(mid), 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#C9A84C'; ctx.fill();
    }
  }
  const displayDay = hovered || (isNow ? today.getDate() : 1);
  const displayAge = lunarAge(new Date(y, m, displayDay));
  /* Mansões Lunares: mostra a mansão do dia em foco (hoje, ou o dia sob o mouse/toque) */
  if (window.MansoesLunares) { try { MansoesLunares.setLunar(isNow && !hovered ? new Date() : new Date(y, m, displayDay, 12), isNow && !hovered); } catch (e) { /* ignora */ } }
  drawMoon(CX, CY, R_MOON, displayAge);
  const words = phaseName(displayAge).split(' ');
  ctx.font = `400 ${SIZE * 0.026}px Cinzel, sans-serif`;
  ctx.fillStyle = 'rgba(201,168,76,0.7)';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lineH = SIZE * 0.034, startY = CY + R_MOON + SIZE * 0.048;
  words.forEach((w, i) => ctx.fillText(w, CX, startY + i * lineH));
  const compR = R_OUTER + SIZE * 0.052;
  [[-Math.PI/2,'N'],[0,'L'],[Math.PI/2,'S'],[Math.PI,'O']].forEach(([a,l]) => {
    ctx.font = `400 ${SIZE * 0.024}px Cinzel, sans-serif`;
    ctx.fillStyle = 'rgba(201,168,76,0.3)';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(l, CX + compR * Math.cos(a), CY + compR * Math.sin(a));
  });
}

function updatePhases() {
  const y = current.getFullYear(), m = current.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const found = [], seen = new Set();
  const meta = { nova: ['🌑','Lua Nova'], cres: ['🌓','Quarto Crescente'], cheia: ['🌕','Lua Cheia'], min: ['🌗','Quarto Minguante'] };
  for (let d = 1; d <= days; d++) {
    const k = keyDays[d];
    if (k && !seen.has(k)) { seen.add(k); found.push({ d, ...meta[k] }); }
  }
  document.getElementById('phaseGrid').innerHTML = found.map(f => `
    <div class="phase-card"><div class="phase-icon">${f[0]}</div><div><div class="phase-name">${f[1]}</div><div class="phase-day">Dia ${f.d} do mês</div></div></div>`).join('');
}

function dayFromPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const mx = (clientX - rect.left) * (SIZE / rect.width);
  const my = (clientY - rect.top)  * (SIZE / rect.height);
  const dx = mx - CX, dy = my - CY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < R_INNER || dist > R_OUTER) return null;
  const days = new Date(current.getFullYear(), current.getMonth() + 1, 0).getDate();
  let angle = Math.atan2(dy, dx) + Math.PI / 2;
  if (angle < 0) angle += Math.PI * 2;
  const d = Math.floor(angle / ((Math.PI * 2) / days)) + 1;
  return d >= 1 && d <= days ? d : null;
}
canvas.addEventListener('mousemove', e => {
  const d = dayFromPoint(e);
  if (d === hovered) return;
  hovered = d;
  const info = document.getElementById('hoverInfo');
  if (d) { const age = lunarAge(new Date(current.getFullYear(), current.getMonth(), d)); info.textContent = `Dia ${d} · ${phaseName(age)} · Idade lunar: ${age.toFixed(1)}d`; }
  else info.textContent = 'Passe o mouse sobre um dia';
  draw();
});
canvas.addEventListener('mouseleave', () => { hovered = null; document.getElementById('hoverInfo').textContent = 'Passe o mouse sobre um dia'; draw(); });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  const d = dayFromPoint(e);
  if (d === hovered) return;
  hovered = d;
  const info = document.getElementById('hoverInfo');
  if (d) { const age = lunarAge(new Date(current.getFullYear(), current.getMonth(), d)); info.textContent = `Dia ${d} · ${phaseName(age)} · Idade: ${age.toFixed(1)}d`; }
  else info.textContent = 'Toque em um dia';
  draw();
}, { passive: false });

function changeMonth(delta) {
  current = new Date(current.getFullYear(), current.getMonth() + delta, 1);
  hovered = null;
  document.getElementById('hoverInfo').textContent = 'Passe o mouse sobre um dia';
  render();
}
function render() {
  const m = current.getMonth(), y = current.getFullYear();
  document.getElementById('monthYear').textContent = MONTHS[m] + ' · ' + y;
  keyDays = computeKeyDays(y, m);
  updatePhases(); draw();
}
window.changeMonth = changeMonth;
/* botões ‹ › do mês: ligados aqui (antes eram onclick inline no index.html); continuam <button> com aria-label, então Enter/Espaço funcionam como antes */
document.querySelectorAll('[data-mes]').forEach(function (b) { b.addEventListener('click', function () { changeMonth(Number(b.getAttribute('data-mes'))); }); });
window.lunarRender = render;
/* resize / giro de tela: recalcula o tamanho e redesenha o mês que está na tela (mesmo mês, mesmo dia sob o cursor) */
if (window.CalendariumResize) window.CalendariumResize.aoRedimensionar(function () { if (dimensiona()) draw(); });
render();
if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
})();
