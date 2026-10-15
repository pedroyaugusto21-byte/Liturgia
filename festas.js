/* ======================================================================
   FESTAS PESSOAIS + DIÁLOGO "PERSONALIZAR"
   window.Festas: list(), byDate('AAAA-MM-DD'), add({data,nome,descricao}),
   remove(id), onChange(cb), ready().
   Leitura SÍNCRONA a partir de um cache em memória (o render() da Liturgia
   roda a cada 1 s); a gravação é assíncrona via CalendariumStore.
   Festas são por data civil exata, sem recorrência.
   ====================================================================== */
(function () {
  'use strict';

  const STORE = 'festas';
  const NOME_MAX = 60, DESC_MAX = 280;
  const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
  const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DIAS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
  const DIAS_CURTOS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const ANO_MIN = 1900, ANO_MAX = 2200;

  const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (y, m, d) => y + '-' + pad(m + 1) + '-' + pad(d);

  function dataValida(s) {
    if (typeof s !== 'string' || !RE_DATA.test(s)) return false;
    const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    if (y < 100) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  /* devolve um registro limpo e congelado, ou null se inválido */
  function normalizar(r) {
    if (r === null || typeof r !== 'object') return null;
    if (typeof r.id !== 'string' || !RE_ID.test(r.id)) return null;
    if (!dataValida(r.data)) return null;
    const nome = typeof r.nome === 'string' ? r.nome.replace(/\s+/g, ' ').trim().slice(0, NOME_MAX) : '';
    if (!nome) return null;
    const descricao = typeof r.descricao === 'string' ? r.descricao.replace(/\r\n?/g, '\n').trim().slice(0, DESC_MAX) : '';
    const criadoEm = typeof r.criadoEm === 'number' && isFinite(r.criadoEm) ? r.criadoEm : 0;
    return Object.freeze({ id: r.id, data: r.data, nome, descricao, criadoEm });
  }

  /* ---------------- cache e API ---------------- */
  let cache = [];
  const removidos = new Set();      /* evita "ressuscitar" na hidratação algo removido antes dela terminar */
  const ouvintes = [];

  const ordenar = () => cache.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.nome.localeCompare(b.nome, 'pt-BR') || (a.id < b.id ? -1 : 1)));
  const novoId = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function renderizarAbas() {
    safe(() => { if (typeof window.liturgyRender === 'function') window.liturgyRender(); });
    safe(() => { if (typeof window.mystRender === 'function') window.mystRender(); });
  }
  function notificar() {
    ouvintes.slice().forEach((cb) => safe(() => cb(cache.slice())));
    renderizarAbas();
  }
  const gravar = (promessa) => { if (promessa && typeof promessa.catch === 'function') promessa.catch(() => {}); };

  function list() { return cache.slice(); }
  function byDate(data) { return cache.filter((f) => f.data === data); }
  function add(dados) {
    const f = normalizar(Object.assign({}, dados, { id: novoId(), criadoEm: Date.now() }));
    if (!f) return null;
    cache.push(f); ordenar();
    const S = window.CalendariumStore;
    if (S) gravar(safe(() => S.put(STORE, f), null));
    notificar();
    return f;
  }
  function remove(id) {
    const i = cache.findIndex((f) => f.id === id);
    if (i < 0) return false;
    cache.splice(i, 1); removidos.add(id);
    const S = window.CalendariumStore;
    if (S) gravar(safe(() => S.delete(STORE, id), null));
    notificar();
    return true;
  }
  function onChange(cb) {
    if (typeof cb !== 'function') return () => {};
    ouvintes.push(cb);
    return () => { const i = ouvintes.indexOf(cb); if (i >= 0) ouvintes.splice(i, 1); };
  }

  /* hidratação: ao concluir, re-renderiza as abas 1 e 4 */
  let hidratada = Promise.resolve();
  (function hidratar() {
    const S = window.CalendariumStore;
    if (!S) return;
    hidratada = Promise.resolve(safe(() => S.getAll(STORE), []))
      .then((regs) => {
        let mudou = false;
        (Array.isArray(regs) ? regs : []).forEach((r) => {
          const f = normalizar(r);
          if (f && !removidos.has(f.id) && !cache.some((c) => c.id === f.id)) { cache.push(f); mudou = true; }
        });
        if (mudou) { ordenar(); ouvintes.slice().forEach((cb) => safe(() => cb(cache.slice()))); }
        renderizarAbas();
      })
      .catch(() => {});
  })();

  window.Festas = { list, byDate, add, remove, onChange, ready: () => hidratada };

  /* ====================================================================
     DIÁLOGO
     <dialog> + showModal quando existir; senão overlay simples (div).
     ==================================================================== */
  const btn = document.getElementById('btnPersonalizar');
  if (!btn || !document.body) return;

  const nativo = typeof window.HTMLDialogElement === 'function' && typeof window.HTMLDialogElement.prototype.showModal === 'function';
  let raiz = null, form, mesEl, grade, nomeEl, descEl, erroEl;
  let aberto = false, mousedownNoFundo = false;
  let sel = { y: 2000, m: 0, d: 1 };       /* dia escolhido (m: 0–11) */
  let inertados = [];

  const TEMPLATE =
    '<div class="festa-box">' +
      '<h2 class="festa-h" id="festaDialogTitle">Adicionar festa pessoal</h2>' +
      '<form class="festa-form" novalidate>' +
        '<div class="festa-cal">' +
          '<div class="festa-cal-nav">' +
            '<button type="button" class="festa-nav" data-nav="-1" aria-label="Mês anterior"><span aria-hidden="true">‹</span></button>' +
            '<div class="festa-cal-mes" id="festaMes" aria-live="polite"></div>' +
            '<button type="button" class="festa-nav" data-nav="1" aria-label="Próximo mês"><span aria-hidden="true">›</span></button>' +
          '</div>' +
          '<div class="festa-cal-sem" aria-hidden="true">' + DIAS_CURTOS.map((d) => '<span>' + d + '</span>').join('') + '</div>' +
          '<div class="festa-cal-grade" id="festaGrade" role="group" aria-labelledby="festaMes"></div>' +
        '</div>' +
        '<div class="festa-campo"><label for="festaNome">Nome</label>' +
          '<input type="text" id="festaNome" maxlength="' + NOME_MAX + '" required aria-required="true" autocomplete="off" aria-describedby="festaErro"></div>' +
        '<div class="festa-campo"><label for="festaDesc">Breve descrição</label>' +
          '<textarea id="festaDesc" maxlength="' + DESC_MAX + '" rows="3"></textarea></div>' +
        '<p class="festa-erro" id="festaErro" role="alert"></p>' +
        '<div class="festa-acoes">' +
          '<button type="button" class="festa-btn" data-act="cancelar">Cancelar</button>' +
          '<button type="submit" class="festa-btn festa-btn-ok">Adicionar festa</button>' +
        '</div>' +
      '</form>' +
    '</div>';

  function construir() {
    if (raiz) return;
    raiz = document.createElement(nativo ? 'dialog' : 'div');
    raiz.id = 'festaDialog';
    raiz.className = nativo ? 'festa-root' : 'festa-root festa-overlay';
    raiz.setAttribute('aria-labelledby', 'festaDialogTitle');
    if (!nativo) { raiz.setAttribute('role', 'dialog'); raiz.setAttribute('aria-modal', 'true'); raiz.hidden = true; }
    raiz.innerHTML = TEMPLATE;
    document.body.appendChild(raiz);

    form = raiz.querySelector('form');
    mesEl = raiz.querySelector('#festaMes');
    grade = raiz.querySelector('#festaGrade');
    nomeEl = raiz.querySelector('#festaNome');
    descEl = raiz.querySelector('#festaDesc');
    erroEl = raiz.querySelector('#festaErro');

    raiz.addEventListener('mousedown', (e) => { mousedownNoFundo = e.target === raiz; });
    raiz.addEventListener('click', (e) => { if (e.target === raiz && mousedownNoFundo) fechar(); mousedownNoFundo = false; });
    if (nativo) raiz.addEventListener('close', finalizar);
    raiz.querySelector('[data-act="cancelar"]').addEventListener('click', fechar);
    raiz.querySelectorAll('.festa-nav').forEach((b) => b.addEventListener('click', () => mudarMes(Number(b.getAttribute('data-nav')))));
    grade.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('.festa-dia');
      if (b) { sel.d = Number(b.getAttribute('data-d')); desenhar(false); const nb = grade.querySelector('.festa-dia[data-d="' + sel.d + '"]'); if (nb) nb.focus(); }
    });
    grade.addEventListener('keydown', teclaGrade);
    nomeEl.addEventListener('input', () => limparErro());
    form.addEventListener('submit', enviar);
  }

  /* ---------- calendário cívico ---------- */
  const diasNoMes = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const diaSemana = (y, m, d) => new Date(Date.UTC(y, m, d)).getUTCDay();
  const dentro = (y) => y >= ANO_MIN && y <= ANO_MAX;

  function desenhar(foco) {
    const { y, m } = sel;
    mesEl.textContent = MESES[m] + ' de ' + y;
    grade.textContent = '';
    const frag = document.createDocumentFragment();
    const ini = diaSemana(y, m, 1), n = diasNoMes(y, m);
    for (let i = 0; i < ini; i++) { const v = document.createElement('span'); v.className = 'festa-vazio'; v.setAttribute('aria-hidden', 'true'); frag.appendChild(v); }
    for (let d = 1; d <= n; d++) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'festa-dia'; b.setAttribute('data-d', d);
      b.textContent = d;
      b.setAttribute('aria-label', DIAS[diaSemana(y, m, d)] + ', ' + d + ' de ' + MESES[m].toLowerCase() + ' de ' + y);
      const on = d === sel.d;
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      frag.appendChild(b);
    }
    grade.appendChild(frag);
    if (foco) { const nb = grade.querySelector('.festa-dia[data-d="' + sel.d + '"]'); if (nb) nb.focus(); }
  }

  /* move a seleção para (y, m, d) já normalizados; respeita os limites de ano */
  function irPara(y, m, d, foco) {
    const dt = new Date(Date.UTC(y, m, d));
    const ny = dt.getUTCFullYear();
    if (!dentro(ny)) return;
    sel = { y: ny, m: dt.getUTCMonth(), d: dt.getUTCDate() };
    desenhar(foco);
  }
  function mudarMes(delta) {
    const y = sel.y + Math.floor((sel.m + delta) / 12), m = ((sel.m + delta) % 12 + 12) % 12;
    if (!dentro(y)) return;
    sel = { y, m, d: Math.min(sel.d, diasNoMes(y, m)) };     /* a seleção acompanha o mês exibido */
    desenhar(false);
  }
  function teclaGrade(e) {
    if (!e.target.closest || !e.target.closest('.festa-dia')) return;
    const { y, m, d } = sel, ds = diaSemana(y, m, d);
    let alvo = null;
    switch (e.key) {
      case 'ArrowLeft': alvo = [y, m, d - 1]; break;
      case 'ArrowRight': alvo = [y, m, d + 1]; break;
      case 'ArrowUp': alvo = [y, m, d - 7]; break;
      case 'ArrowDown': alvo = [y, m, d + 7]; break;
      case 'Home': alvo = [y, m, d - ds]; break;
      case 'End': alvo = [y, m, d + (6 - ds)]; break;
      case 'PageUp': case 'PageDown': {
        const dl = e.key === 'PageUp' ? -1 : 1;
        const ny = y + Math.floor((m + dl) / 12), nm = ((m + dl) % 12 + 12) % 12;
        alvo = [ny, nm, Math.min(d, diasNoMes(ny, nm))]; break;
      }
      default: return;
    }
    e.preventDefault();
    irPara(alvo[0], alvo[1], alvo[2], true);
  }

  /* ---------- erro, envio ---------- */
  function mostrarErro(msg) { erroEl.textContent = msg; nomeEl.setAttribute('aria-invalid', 'true'); }
  function limparErro() { erroEl.textContent = ''; nomeEl.removeAttribute('aria-invalid'); }
  function enviar(e) {
    e.preventDefault();
    const nome = nomeEl.value.replace(/\s+/g, ' ').trim();
    if (!nome) { mostrarErro('Informe o nome da festa.'); nomeEl.focus(); return; }
    const f = add({ data: iso(sel.y, sel.m, sel.d), nome, descricao: descEl.value });
    if (!f) { mostrarErro('Não foi possível adicionar a festa. Confira a data e o nome.'); nomeEl.focus(); return; }
    fechar();
  }

  /* ---------- abrir / fechar ---------- */
  function dataExibida() {
    const dt = document.getElementById('dt');
    const m = dt && /^(\d{4})-(\d{2})-(\d{2})T/.exec(dt.value || '');
    if (m && dataValida(m[1] + '-' + m[2] + '-' + m[3])) return { y: +m[1], m: +m[2] - 1, d: +m[3] };
    const h = new Date();
    return { y: h.getFullYear(), m: h.getMonth(), d: h.getDate() };
  }
  function focaveis() {
    return Array.prototype.filter.call(raiz.querySelectorAll('button, input, textarea'), (el) => !el.disabled && el.tabIndex >= 0 && el.offsetParent !== null);
  }
  function teclaFallback(e) {
    if (!aberto) return;
    if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); e.stopPropagation(); fechar(); return; }
    if (e.key !== 'Tab') return;
    const f = focaveis(); if (!f.length) return;
    const primeiro = f[0], ultimo = f[f.length - 1], ativo = document.activeElement;
    if (!raiz.contains(ativo)) { e.preventDefault(); primeiro.focus(); }
    else if (e.shiftKey && ativo === primeiro) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && ativo === ultimo) { e.preventDefault(); primeiro.focus(); }
  }

  function abrir() {
    if (aberto) return;
    construir();
    sel = dataExibida();
    nomeEl.value = ''; descEl.value = ''; limparErro();
    desenhar(false);
    aberto = true;
    if (nativo) {
      try { raiz.showModal(); } catch (e) { safe(() => raiz.setAttribute('open', '')); }
    } else {
      /* fallback: fundo inerte + armadilha de foco + Esc */
      inertados = [];
      Array.prototype.forEach.call(document.body.children, (el) => {
        if (el !== raiz && el.tagName !== 'SCRIPT' && !el.hasAttribute('inert')) { el.setAttribute('inert', ''); inertados.push(el); }
      });
      raiz.hidden = false;
      document.addEventListener('keydown', teclaFallback, true);
    }
    safe(() => nomeEl.focus());
  }
  function fechar() {
    if (!aberto) return;
    if (nativo) {
      if (safe(() => { raiz.close(); return true; }, false)) return;     /* finalizar() roda no evento 'close' */
      safe(() => raiz.removeAttribute('open'));
    } else { raiz.hidden = true; }
    finalizar();
  }
  function finalizar() {
    if (!aberto) return;
    aberto = false;
    document.removeEventListener('keydown', teclaFallback, true);
    inertados.forEach((el) => el.removeAttribute('inert')); inertados = [];
    safe(() => btn.focus({ preventScroll: true }));
  }

  btn.addEventListener('click', abrir);
})();
