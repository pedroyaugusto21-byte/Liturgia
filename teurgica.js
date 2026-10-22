/* ======================================================================
   TEÚRGICA (aba 5) — sub-abas Hinário · Diário · Relatório
   window.Teurgica     = { activate, deactivate, info }
   window.TeurgicaData = { TAGS, PERIODOS, EXCLUSOES, resumirDia, carregarDia, listarPeriodo }
   Dependências opcionais (falha segura): CalendariumStore, LiturgyKit, HINOS_ORFICOS.
   Único timer: o relógio do Diário (1 s) — só roda com a aba Teúrgica ativa,
   a sub-aba Diário visível e o documento visível.
   ====================================================================== */
(function () {
  'use strict';

  const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
  const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const pad = (n) => String(n).padStart(2, '0');

  const TAGS = Object.freeze(['quente', 'úmido', 'frio', 'seco', 'ameno', 'ensolarado', 'nublado', 'chuvoso', 'ventoso']);
  const PERIODOS = Object.freeze(['amanhecer', 'entardecer', 'noite']);
  const EXCLUSOES = Object.freeze({ quente: 'frio', frio: 'quente', 'úmido': 'seco', seco: 'úmido', ensolarado: 'nublado', nublado: 'ensolarado' });
  const PER_INFO = {
    amanhecer:  { sym: '🜢', rotulo: 'Clima ao amanhecer' },
    entardecer: { sym: '🜬', rotulo: 'Clima ao entardecer' },
    noite:      { sym: '✧', rotulo: 'Clima à noite' },
  };
  const TEXTO_MAX = 10000;
  const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
  const CHAVE_ABA = 'calendarium.teurgica.aba';
  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const DIAS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];

  /* ---------------- datas (sempre CIVIS e LOCAIS) ---------------- */
  const dataLocal = (d) => { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  const horaLocal = (d) => pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  const horasDecimais = (d) => d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  function dataValida(s) {
    if (typeof s !== 'string' || !RE_DATA.test(s)) return false;
    const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    if (y < 100) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }
  const dataExtenso = (d) => DIAS[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()] + ' de ' + d.getFullYear();
  const fmtBR = (s) => s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4);
  const novoId = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const store = () => window.CalendariumStore || null;

  /* ====================================================================
     DADOS (API para a etapa 4)
     ==================================================================== */
  function normalizarRegistro(r) {
    if (!r || typeof r !== 'object' || !dataValida(r.data)) return null;
    const clima = {};
    PERIODOS.forEach((p) => {
      const arr = r.clima && Array.isArray(r.clima[p]) ? r.clima[p] : [];
      clima[p] = TAGS.filter((t) => arr.indexOf(t) >= 0);
    });
    return {
      data: r.data,
      id: typeof r.id === 'string' ? r.id.slice(0, 64) : '',
      texto: typeof r.texto === 'string' ? r.texto.slice(0, TEXTO_MAX) : '',
      clima,
      criadoEm: typeof r.criadoEm === 'string' ? r.criadoEm : '',
      salvoEm: typeof r.salvoEm === 'string' ? r.salvoEm : '',
    };
  }

  /* Promise<registro|null> do dia civil 'AAAA-MM-DD' */
  async function carregarDia(data) {
    const S = store();
    if (!S || !dataValida(data)) return null;
    try { return normalizarRegistro(await S.get('diario', data)); } catch (e) { return null; }
  }

  /* Promise<registro[]> entre duas datas civis (inclusive), em ordem de data */
  async function listarPeriodo(de, ate) {
    const S = store();
    if (!S || !dataValida(de) || !dataValida(ate)) return [];
    try {
      const todos = await S.getAll('diario');
      return (Array.isArray(todos) ? todos : []).map(normalizarRegistro)
        .filter((r) => r && r.data >= de && r.data <= ate)
        .sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
    } catch (e) { return []; }
  }

  /* Promise<log[]> de salvamentos (diario_log) entre duas datas civis (inclusive), em ordem de salvamento.
     Descarta linhas malformadas; uma única leitura por período. */
  async function listarLogs(de, ate) {
    const S = store();
    if (!S || !dataValida(de) || !dataValida(ate)) return [];
    try {
      const todos = await S.getAll('diario_log');
      return (Array.isArray(todos) ? todos : [])
        .filter((l) => l && typeof l === 'object' && typeof l.data === 'string' && l.data >= de && l.data <= ate && dataValida(l.data))
        .sort((a, b) => (String(a.salvoEm) < String(b.salvoEm) ? -1 : String(a.salvoEm) > String(b.salvoEm) ? 1 : 0));
    } catch (e) { return []; }
  }

  /* "a", "a e b", "a, b e c" */
  function juntarTags(lista) {
    if (lista.length <= 1) return lista.join('');
    return lista.slice(0, -1).join(', ') + ' e ' + lista[lista.length - 1];
  }

  /* Tags em destaque: as que aparecem em pelo menos 2 dos 3 horários; se nenhuma chega a 2,
     as de maior contagem. Ordem: mais frequentes primeiro, depois a ordem de TAGS. */
  function destacarTags(tags) {
    const presentes = TAGS.filter((t) => tags[t] > 0);
    if (!presentes.length) return [];
    const max = Math.max.apply(null, presentes.map((t) => tags[t]));
    const corte = max >= 2 ? 2 : max;
    return presentes.filter((t) => tags[t] >= corte)
      .sort((a, b) => (tags[b] - tags[a]) || (TAGS.indexOf(a) - TAGS.indexOf(b)));
  }

  /* resumo síncrono (função pura) de um registro:
     { data, temRegistro, temTexto, caracteres, clima, tags:{tag:n}, total, periodosComClima, destaque:[tag], texto }
     texto: "Dia chuvoso" · "Dia chuvoso e frio" · "Sem clima registrado" (há registro, sem clima) · "Sem registro" */
  function resumirDia(reg) {
    const r = normalizarRegistro(reg);
    if (!r) {
      return { data: null, temRegistro: false, temTexto: false, caracteres: 0, clima: { amanhecer: [], entardecer: [], noite: [] }, tags: {}, total: 0, periodosComClima: 0, destaque: [], texto: 'Sem registro' };
    }
    const tags = {}; let total = 0, periodos = 0;
    PERIODOS.forEach((p) => { if (r.clima[p].length) periodos++; r.clima[p].forEach((t) => { tags[t] = (tags[t] || 0) + 1; total++; }); });
    const destaque = destacarTags(tags);
    return {
      data: r.data, temRegistro: true, temTexto: r.texto.trim().length > 0, caracteres: r.texto.length, clima: r.clima,
      tags, total, periodosComClima: periodos, destaque,
      texto: destaque.length ? 'Dia ' + juntarTags(destaque) : 'Sem clima registrado',
    };
  }

  window.TeurgicaData = { TAGS, PERIODOS, EXCLUSOES, resumirDia, carregarDia, listarPeriodo, listarLogs };

  /* ====================================================================
     ÍCONES (SVG 24×24, traço fino como o da lira)
     ==================================================================== */
  const SVG_A = '<svg aria-hidden="true" focusable="false" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">';
  const LYRE = '<path d="M7 5.2h10"/><path d="M7 5.2Q4.4 9.6 8 15"/><path d="M17 5.2Q19.6 9.6 16 15"/><path d="M8 15a4 2.9 0 0 0 8 0"/><path d="M8.8 6.2v10.54"/><path d="M10.4 6.2v11.46"/><path d="M12 6.2v11.7"/><path d="M13.6 6.2v11.46"/><path d="M15.2 6.2v10.54"/>';
  const ICON_HINARIO = SVG_A +
    '<g transform="translate(0 3.4)">' + LYRE + '</g>' +
    '<g transform="translate(0 .3)"><circle cx="12" cy="4.1" r="1.3"/><path d="M12 1.8L12 0.8 M13.63 2.47L14.33 1.77 M14.3 4.1L15.3 4.1 M13.63 5.73L14.33 6.43 M12 6.4L12 7.4 M10.37 5.73L9.67 6.43 M9.7 4.1L8.7 4.1 M10.37 2.47L9.67 1.77"/></g></svg>';
  const ICON_DIARIO = SVG_A +
    '<path d="M2.5 14C5.5 9.6 8.8 8.6 12 8.6s6.5 1 9.5 5.4c-3 4.4-6.3 5.4-9.5 5.4S5.5 18.4 2.5 14z"/>' +
    '<circle cx="12" cy="14" r="3.2"/><circle cx="12" cy="14" r=".8"/>' +
    '<path d="M12 6.9V3.6 M7.2 8.3L5.6 5.6 M16.8 8.3L18.4 5.6 M3.9 11.3L1.7 9.5 M20.1 11.3L22.3 9.5"/></svg>';
  const ICON_RELATORIO = SVG_A +
    '<path d="M12 3 L15.9 20.11 L4.96 6.39 L20.77 14 L3.23 14 L19.04 6.39 L8.1 20.11 Z"/></svg>';

  /* ====================================================================
     ESTADO E ESQUELETO
     ==================================================================== */
  const view = document.getElementById('teurgicaView');
  const SUBS = [
    { id: 'hinario', nome: 'Hinário', icone: ICON_HINARIO },
    { id: 'diario', nome: 'Diário', icone: ICON_DIARIO },
    { id: 'relatorio', nome: 'Relatório', icone: ICON_RELATORIO },
  ];
  let construido = false, ativa = false, sub = null, timer = null;
  let hinarioPronto = false, diarioPronto = false;
  let relPronto = false, relSujo = false;                /* Relatório (5.3): construído sob demanda; sujo = há dados novos */
  const el = {};            /* referências do DOM */

  function lerSessao() { try { const v = window.sessionStorage.getItem(CHAVE_ABA); return SUBS.some((s) => s.id === v) ? v : null; } catch (e) { return null; } }
  function gravarSessao(v) { try { window.sessionStorage.setItem(CHAVE_ABA, v); } catch (e) { /* ignora */ } }

  function construir() {
    if (construido || !view) return;
    construido = true;
    const wrap = view.querySelector('.teu-wrap') || view;
    const tabs = SUBS.map((s) =>
      '<button type="button" class="teu-tab" role="tab" id="teuTab-' + s.id + '" aria-controls="teuPanel-' + s.id + '" aria-selected="false" tabindex="-1" aria-label="' + s.nome + '" title="' + s.nome + '">' +
      s.icone + '<span class="teu-tab-nome" aria-hidden="true">' + s.nome + '</span></button>').join('');
    const paineis = SUBS.map((s) =>
      '<div class="teu-panel" role="tabpanel" id="teuPanel-' + s.id + '" aria-labelledby="teuTab-' + s.id + '" hidden></div>').join('');
    wrap.insertAdjacentHTML('beforeend',
      '<p class="teu-lede">Hinário órfico, diário do dia e relatório da prática.</p>' +
      '<div class="teu-tabs" role="tablist" aria-label="Seções da Teúrgica">' + tabs + '</div>' + paineis);
    el.tablist = wrap.querySelector('.teu-tabs');
    SUBS.forEach((s) => { el['tab_' + s.id] = document.getElementById('teuTab-' + s.id); el['panel_' + s.id] = document.getElementById('teuPanel-' + s.id); });

    el.tablist.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('.teu-tab'); if (b) selecionar(b.id.slice(7), true); });
    el.tablist.addEventListener('keydown', (e) => {
      const i = SUBS.findIndex((s) => s.id === sub);
      let j = -1;
      if (e.key === 'ArrowRight') j = (i + 1) % SUBS.length;
      else if (e.key === 'ArrowLeft') j = (i - 1 + SUBS.length) % SUBS.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = SUBS.length - 1;
      if (j < 0) return;
      e.preventDefault();
      selecionar(SUBS[j].id, true);
    });
    document.addEventListener('visibilitychange', ajustarRelogio);
  }

  /* troca de sub-aba (painéis + roving tabindex + aria-selected) */
  function selecionar(id, foco) {
    if (!construido || !SUBS.some((s) => s.id === id)) id = 'hinario';
    sub = id; gravarSessao(id);
    SUBS.forEach((s) => {
      const on = s.id === id, t = el['tab_' + s.id], p = el['panel_' + s.id];
      t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1;
      p.hidden = !on;
    });
    if (foco) safe(() => el['tab_' + id].focus());
    if (id === 'hinario' && !hinarioPronto) { hinarioPronto = true; safe(montarHinario); }
    if (id === 'diario') safe(mostrarDiario);
    if (id === 'relatorio') safe(mostrarRelatorio);
    ajustarRelogio();
  }

  /* ====================================================================
     5.1 HINÁRIO — <details> com texto em renderização preguiçosa
     ==================================================================== */
  function montarHinario() {
    const painel = el.panel_hinario;
    const dados = safe(() => (typeof HINOS_ORFICOS !== 'undefined' ? HINOS_ORFICOS : null), null);
    const lista = Array.isArray(dados) ? dados.filter((h) => h && typeof h === 'object' && typeof h.texto === 'string' && h.texto.length) : [];
    if (!lista.length) { painel.innerHTML = '<p class="teu-vazio">Hinário indisponível</p>'; return; }
    const box = document.createElement('div');
    box.className = 'teu-hinos';
    lista.forEach((h) => {
      const d = document.createElement('details');
      d.className = 'teu-hino';
      const s = document.createElement('summary');
      s.className = 'teu-hino-h';
      const chev = document.createElement('span'); chev.className = 'teu-chev'; chev.setAttribute('aria-hidden', 'true');
      const t = document.createElement('span'); t.className = 'teu-hino-t';
      t.textContent = 'Hino ' + (h.n !== undefined && h.n !== null ? h.n : '') + ' — ' + (h.deus || '');
      s.appendChild(chev); s.appendChild(t);
      if (h.incenso) { s.appendChild(document.createTextNode(' ')); const i = document.createElement('span'); i.className = 'teu-hino-i'; i.textContent = 'Incenso: ' + h.incenso; s.appendChild(i); }
      d.appendChild(s);
      d.addEventListener('toggle', () => {                       /* o texto só entra no DOM ao abrir */
        if (d.open && !d.querySelector('.teu-hino-texto')) {
          const p = document.createElement('div'); p.className = 'teu-hino-texto'; p.textContent = h.texto; d.appendChild(p);
        }
      });
      box.appendChild(d);
    });
    painel.appendChild(box);
  }

  /* ====================================================================
     5.2 DIÁRIO
     ==================================================================== */
  let dataSel = '', seguirHoje = true, sujo = false, ocupado = false, tokenCarga = 0, ultimaDataExt = '';

  function montarDiario() {
    const grupos = PERIODOS.map((p) =>
      '<div class="teu-clima-grupo" role="group" aria-label="' + PER_INFO[p].rotulo + '">' +
        '<span class="teu-per-sym" aria-hidden="true">' + PER_INFO[p].sym + '</span>' +
        '<div class="teu-chips">' + TAGS.map((t) => '<button type="button" class="teu-chip" data-per="' + p + '" data-tag="' + t + '" aria-pressed="false">' + t + '</button>').join('') + '</div>' +
      '</div>').join('');
    el.panel_diario.innerHTML =
      '<div class="teu-diario-topo">' +
        '<div class="teu-dial" id="teuDial"></div>' +
        '<div class="teu-stamp">' +
          '<b class="teu-hora" id="teuHora" role="timer" aria-live="off">--:--:--</b>' +
          '<span class="teu-dataext" id="teuDataExt"></span>' +
          '<div class="teu-data-sel"><label for="teuData">Dia registrado</label><input type="date" id="teuData"></div>' +
        '</div>' +
      '</div>' +
      '<div class="teu-diario-corpo">' +
        '<div class="teu-diario-esq">' +
          '<label class="teu-lab" for="teuTexto">Como foi o seu dia?</label>' +
          '<textarea id="teuTexto" maxlength="' + TEXTO_MAX + '" rows="12"></textarea>' +
          '<button type="button" class="teu-phi" id="teuPhi" aria-expanded="false" aria-controls="teuVersos" aria-label="Versos Áureos de Pitágoras" title="Versos Áureos de Pitágoras"><span aria-hidden="true">Φ</span></button>' +
          '<section class="teu-versos" id="teuVersos" aria-labelledby="teuVersosH" hidden><h2 class="teu-versos-h" id="teuVersosH">Versos Áureos de Pitágoras</h2><ol class="teu-versos-lista" id="teuVersosLista"></ol></section>' +
          '<div class="teu-acoes"><button type="button" class="teu-btn teu-btn-ok" id="teuSalvar">Salvar</button>' +
          '<p class="teu-estado" id="teuEstado" aria-live="polite" aria-atomic="true"></p></div>' +
        '</div>' +
        '<div class="teu-clima" role="group" aria-labelledby="teuClimaTit"><h2 class="teu-clima-h" id="teuClimaTit">Clima</h2>' + grupos + '</div>' +
      '</div>' +
      '<section class="teu-salvos" aria-labelledby="teuSalvosH"><h2 id="teuSalvosH">Salvamentos deste dia</h2><ul id="teuSalvos"></ul></section>' +
      '<div class="teu-copia" role="group" aria-label="Cópia dos dados">' +
        '<button type="button" class="teu-btn teu-btn-disc" id="teuExportar">Exportar cópia</button>' +
        '<button type="button" class="teu-btn teu-btn-disc" id="teuImportar">Importar cópia</button>' +
        '<input type="file" id="teuArquivo" accept="application/json,.json" hidden>' +
        '<p class="teu-estado" id="teuCopiaEstado" aria-live="polite" aria-atomic="true"></p>' +
      '</div>';
    ['teuPhi', 'teuVersos', 'teuVersosLista', 'teuDial', 'teuHora', 'teuDataExt', 'teuData', 'teuTexto', 'teuSalvar', 'teuEstado', 'teuSalvos', 'teuExportar', 'teuImportar', 'teuArquivo', 'teuCopiaEstado']
      .forEach((id) => { el[id] = document.getElementById(id); });

    el.teuTexto.addEventListener('input', () => { sujo = true; });
    el.teuPhi.addEventListener('click', alternarVersos);
    el.panel_diario.querySelectorAll('.teu-chip').forEach((b) => b.addEventListener('click', () => alternarChip(b)));
    el.teuSalvar.addEventListener('click', salvar);
    el.teuData.addEventListener('change', trocarData);
    el.teuExportar.addEventListener('click', exportar);
    el.teuImportar.addEventListener('click', () => el.teuArquivo.click());
    el.teuArquivo.addEventListener('change', importar);
  }

  /* Φ: mostra/oculta os Versos Áureos (texto entra no DOM só na primeira abertura) */
  function alternarVersos() {
    const abrir = el.teuVersos.hidden;
    if (abrir && !el.teuVersosLista.childNodes.length) {
      const dados = safe(() => (typeof VERSOS_AUREOS !== 'undefined' ? VERSOS_AUREOS : null), null);
      const lista = Array.isArray(dados) ? dados.filter((v) => typeof v === 'string' && v.length) : [];
      if (!lista.length) { const p = document.createElement('p'); p.className = 'teu-vazio'; p.textContent = 'Versos indisponíveis'; el.teuVersosLista.appendChild(p); }
      else lista.forEach((v) => { const li = document.createElement('li'); li.textContent = v; el.teuVersosLista.appendChild(li); });
    }
    el.teuVersos.hidden = !abrir;
    el.teuPhi.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  }

  const confirmar = (msg) => safe(() => window.confirm(msg) === true, false);
  function estado(msg, erro) { el.teuEstado.textContent = msg ? (erro ? '⚠ ' : '') + msg : ''; el.teuEstado.classList.toggle('teu-erro', !!(msg && erro)); }
  function estadoCopia(msg, erro) { el.teuCopiaEstado.textContent = msg ? (erro ? '⚠ ' : '') + msg : ''; el.teuCopiaEstado.classList.toggle('teu-erro', !!(msg && erro)); }

  function alternarChip(b) {
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    const oposto = EXCLUSOES[b.dataset.tag];
    if (on && oposto) {                       /* exclusão mútua dentro do MESMO período */
      const o = el.panel_diario.querySelector('.teu-chip[data-per="' + b.dataset.per + '"][data-tag="' + oposto + '"]');
      if (o) o.setAttribute('aria-pressed', 'false');
    }
    sujo = true;
  }
  function lerClima() {
    const c = { amanhecer: [], entardecer: [], noite: [] };
    el.panel_diario.querySelectorAll('.teu-chip[aria-pressed="true"]').forEach((b) => { if (c[b.dataset.per]) c[b.dataset.per].push(b.dataset.tag); });
    return c;
  }
  function aplicarClima(c) {
    el.panel_diario.querySelectorAll('.teu-chip').forEach((b) => {
      const arr = c && Array.isArray(c[b.dataset.per]) ? c[b.dataset.per] : [];
      b.setAttribute('aria-pressed', arr.indexOf(b.dataset.tag) >= 0 ? 'true' : 'false');
    });
  }

  /* lista de horários de salvamento do dia (diario_log), em ordem */
  async function atualizarSalvos() {
    const S = store();
    let itens = [];
    if (S) {
      try { itens = (await S.getAll('diario_log') || []).filter((l) => l && l.data === dataSel && typeof l.hora === 'string').sort((a, b) => (a.salvoEm < b.salvoEm ? -1 : a.salvoEm > b.salvoEm ? 1 : 0)); } catch (e) { itens = []; }
    }
    el.teuSalvos.innerHTML = itens.length
      ? itens.map((l) => '<li><span class="teu-salvo-h">' + esc(l.hora) + '</span> <span class="teu-salvo-a">' + esc(l.acao === 'criou' || l.acao === 'atualizou' ? l.acao : '—') + '</span></li>').join('')
      : '<li class="teu-salvo-vazio">Nenhum salvamento neste dia.</li>';
  }

  async function carregarNoForm(anunciar) {
    const meu = ++tokenCarga, data = dataSel;
    const r = await carregarDia(data);
    if (meu !== tokenCarga) return;
    el.teuTexto.value = r ? r.texto : '';
    aplicarClima(r ? r.clima : null);
    sujo = false;
    await atualizarSalvos();
    if (meu !== tokenCarga) return;
    estado(anunciar ? (r ? 'Registro de ' + fmtBR(data) + ' carregado.' : 'Novo registro para ' + fmtBR(data) + '.') : '', false);
  }

  function trocarData() {
    const hoje = dataLocal();
    let v = el.teuData.value;
    if (!dataValida(v)) { el.teuData.value = dataSel; return; }
    if (v > hoje) v = hoje;
    if (v === dataSel) { el.teuData.value = v; return; }
    if (sujo && !confirmar('Descartar as alterações não salvas deste dia?')) { el.teuData.value = dataSel; return; }
    dataSel = v; seguirHoje = v === hoje; el.teuData.value = v;
    carregarNoForm(true);
  }

  async function salvar() {
    if (ocupado) return;
    const texto = el.teuTexto.value.slice(0, TEXTO_MAX).trim();
    const clima = lerClima();
    if (!texto && !PERIODOS.some((p) => clima[p].length)) { estado('Escreva algo ou marque o clima antes de salvar.', true); el.teuTexto.focus(); return; }
    const S = store();
    if (!S) { estado('Armazenamento indisponível neste navegador.', true); return; }
    ocupado = true;
    try {
      const data = dataSel;
      const existente = await carregarDia(data);
      const agora = new Date(), iso = agora.toISOString();
      const reg = { data, id: (existente && existente.id) || novoId(), texto, clima, criadoEm: (existente && existente.criadoEm) || iso, salvoEm: iso };
      if ((await S.put('diario', reg)) === null) throw new Error('put');
      await S.add('diario_log', { data, salvoEm: iso, hora: horaLocal(agora), horas: Math.round(horasDecimais(agora) * 1e5) / 1e5, acao: existente ? 'atualizou' : 'criou' });
      sujo = false;
      relSujo = true;                                   /* o relatório se redesenha na próxima vez que for aberto */
      estado('Salvo às ' + horaLocal(agora), false);
      await atualizarSalvos();
    } catch (e) {
      estado('Não foi possível salvar. Tente novamente.', true);
    } finally { ocupado = false; }
  }

  /* ---------- cópia de segurança ---------- */
  async function exportar() {
    const S = store();
    if (!S) { estadoCopia('Armazenamento indisponível neste navegador.', true); return; }
    try {
      const dados = await S.exportAll();
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'calendarium-copia-' + dataLocal() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => safe(() => URL.revokeObjectURL(url)), 4000);
      estadoCopia('Cópia exportada.', false);
    } catch (e) { estadoCopia('Não foi possível exportar a cópia.', true); }
  }
  async function importar() {
    const f = el.teuArquivo.files && el.teuArquivo.files[0];
    el.teuArquivo.value = '';
    if (!f) return;
    const S = store();
    if (!S) { estadoCopia('Armazenamento indisponível neste navegador.', true); return; }
    if (f.size > 5 * 1024 * 1024) { estadoCopia('Arquivo grande demais (máximo 5 MB).', true); return; }
    if (!confirmar('Importar esta cópia? Os dados serão mesclados aos atuais; dias e festas com a mesma chave serão substituídos.')) { estadoCopia('Importação cancelada.', false); return; }
    try {
      const texto = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('leitura')); r.readAsText(f); });
      const r = await S.importAll(texto);
      if (!r || !r.ok) { estadoCopia((r && r.erro) || 'Arquivo não reconhecido.', true); return; }
      const im = r.importados || {};
      relSujo = true;
      estadoCopia('Cópia importada: ' + (im.diario || 0) + ' dia(s), ' + (im.diario_log || 0) + ' salvamento(s), ' + (im.festas || 0) + ' festa(s).' + (im.festas ? ' Recarregue a página para ver as festas.' : ''), false);
      if (!sujo) carregarNoForm(false); else atualizarSalvos();
    } catch (e) { estadoCopia('Não foi possível importar a cópia.', true); }
  }

  /* ---------- mostrador e carimbo (único timer) ---------- */
  function tick() {
    safe(() => {
      const agora = new Date();
      el.teuHora.textContent = horaLocal(agora);
      const ext = dataExtenso(agora);
      if (ext !== ultimaDataExt) {
        ultimaDataExt = ext; el.teuDataExt.textContent = ext;
        const hoje = dataLocal(agora);
        el.teuData.max = hoje;                                   /* virou o dia com a aba aberta */
        if (seguirHoje && dataSel !== hoje && !sujo) { dataSel = hoje; el.teuData.value = hoje; carregarNoForm(false); }
      }
      el.teuDial.innerHTML = safe(() => window.LiturgyKit.dialSVG(horasDecimais(agora), { id: 'teu-dia' }), '') || '<p class="teu-vazio">Mostrador indisponível</p>';
    });
  }
  const deveRodar = () => ativa && sub === 'diario' && !document.hidden;
  function ajustarRelogio() {
    const quer = deveRodar();
    if (quer && !timer) { tick(); timer = setInterval(tick, 1000); }
    else if (!quer && timer) { clearInterval(timer); timer = null; }
  }

  function mostrarDiario() {
    if (!diarioPronto) {
      diarioPronto = true;
      montarDiario();
      dataSel = dataLocal(); seguirHoje = true;
      el.teuData.max = dataSel; el.teuData.value = dataSel;
      carregarNoForm(false);
    } else {
      const hoje = dataLocal();
      el.teuData.max = hoje;
      if (seguirHoje && dataSel !== hoje && !sujo) { dataSel = hoje; el.teuData.value = hoje; carregarNoForm(false); }
    }
  }

  /* ====================================================================
     5.3 RELATÓRIO — Semanal e Mensal
     Sem timers: só redesenha ao navegar, ao trocar de tipo ou quando um diário foi salvo/importado.
     Datas sempre CIVIS e LOCAIS (chave 'AAAA-MM-DD').
     ==================================================================== */
  /* true: hoje, ainda sem diário, já aparece em vermelho (o dia pode ser escrito até o fim); false: hoje fica neutro até salvar */
  const HOJE_SEM_DIARIO_VERMELHO = true;
  const ANO_MIN = 1900, ANO_MAX = 2200;
  const COR_OK = '#7AC97A', COR_NO = '#E05555', COR_OURO = '#f3d08a';
  const SEMANA_FALLBACK = [
    { sym: '☉', name: 'Domingo' }, { sym: '☽', name: 'Segunda-feira' }, { sym: '♂', name: 'Terça-feira' }, { sym: '☿', name: 'Quarta-feira' },
    { sym: '♃', name: 'Quinta-feira' }, { sym: '♀', name: 'Sexta-feira' }, { sym: '♄', name: 'Sábado' },
  ];
  const planetasDaSemana = () => safe(() => { const w = window.LiturgyKit && window.LiturgyKit.WEEK; return Array.isArray(w) && w.length === 7 ? w : null; }, null) || SEMANA_FALLBACK;
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const mk = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt !== undefined) n.textContent = txt; return n; };
  const domingoDe = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  const somaDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const anoOk = (d) => d.getFullYear() >= ANO_MIN && d.getFullYear() <= ANO_MAX;
  const dataDeStr = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const ddmm = (s) => s.slice(8, 10) + '/' + s.slice(5, 7);
  const hhmmss = (h) => {
    const t = Math.floor((((h % 24) + 24) % 24) * 3600 + 1e-6) % 86400;
    return pad(Math.floor(t / 3600)) + ':' + pad(Math.floor((t % 3600) / 60)) + ':' + pad(t % 60);
  };

  let relModo = 'semanal', relSemIni = null, relMes = null, relToken = 0, relFoco = null, relArmado = null, relToque = 0;
  const relAbertos = new Set();                            /* dias (AAAA-MM-DD) abertos na visão semanal: sobrevive aos redesenhos */
  const rel = {};                                          /* referências do DOM */

  function rotuloSemana(ini) {
    const fim = somaDias(ini, 6), a = ini.getDate(), b = fim.getDate();
    if (ini.getMonth() === fim.getMonth()) return a + ' a ' + b + ' de ' + MESES[fim.getMonth()] + ' de ' + fim.getFullYear();
    if (ini.getFullYear() === fim.getFullYear()) return a + ' de ' + MESES[ini.getMonth()] + ' a ' + b + ' de ' + MESES[fim.getMonth()] + ' de ' + fim.getFullYear();
    return a + ' de ' + MESES[ini.getMonth()] + ' de ' + ini.getFullYear() + ' a ' + b + ' de ' + MESES[fim.getMonth()] + ' de ' + fim.getFullYear();
  }

  /* linha do log já validada (dados importados nunca chegam crus à tela) */
  function linhaLog(l) {
    let h = typeof l.horas === 'number' && isFinite(l.horas) && l.horas >= 0 && l.horas < 24 ? l.horas : null;
    if (h === null && typeof l.salvoEm === 'string') { const d = new Date(l.salvoEm); if (!isNaN(d.getTime())) h = horasDecimais(d); }
    const hora = typeof l.hora === 'string' && /^\d{2}:\d{2}:\d{2}$/.test(l.hora) ? l.hora : (h !== null ? hhmmss(h) : '—');
    return { horas: h, hora, acao: l.acao === 'criou' || l.acao === 'atualizou' ? l.acao : '—' };
  }
  /* hora do ÚLTIMO salvamento do dia (log; senão o salvoEm do registro) */
  function ultimoSalvamento(reg, logsDia) {
    for (let i = logsDia.length - 1; i >= 0; i--) { const L = linhaLog(logsDia[i]); if (L.horas !== null) return L; }
    if (reg && reg.salvoEm) { const d = new Date(reg.salvoEm); if (!isNaN(d.getTime())) { const h = horasDecimais(d); return { horas: h, hora: hhmmss(h), acao: '—' }; } }
    return null;
  }

  /* informações de um dia, comuns à semana e ao mês */
  function infoDia(s, reg, hojeS) {
    const futuro = s > hojeS;
    return { s, reg, tem: !!reg, futuro, hoje: s === hojeS, texto: reg ? resumirDia(reg).texto : (futuro ? 'Dia futuro' : 'Sem registro') };
  }

  /* ---------- visão semanal ---------- */
  function montarDetalhe(det, s, reg, logsDia) {
    if (det.querySelector('.teu-det, .teu-det-sem')) return;
    if (!reg) { det.appendChild(mk('p', 'teu-det-sem', s > dataLocal() ? 'Este dia ainda não chegou.' : 'Sem registro neste dia.')); return; }
    const box = mk('div', 'teu-det');
    const esq = mk('div', 'teu-det-esq');
    const ult = ultimoSalvamento(reg, logsDia);
    if (ult && ult.horas !== null) {
      const dial = mk('div', 'teu-dial teu-dial-rel');
      const svg = safe(() => window.LiturgyKit.dialSVG(ult.horas, { id: 'teu-rel-' + s }), '');
      if (svg) dial.innerHTML = svg; else dial.textContent = 'Mostrador indisponível';
      esq.appendChild(dial);
      esq.appendChild(mk('p', 'teu-det-hora', 'Anotado às ' + ult.hora));
    } else esq.appendChild(mk('p', 'teu-det-hora', 'Hora do salvamento não registrada.'));
    box.appendChild(esq);

    const dir = mk('div', 'teu-det-dir');
    dir.appendChild(mk('p', 'teu-det-texto' + (reg.texto ? '' : ' teu-det-sem-texto'), reg.texto ? reg.texto : 'Sem texto: só o clima foi registrado.'));
    const clima = mk('div', 'teu-det-clima');
    PERIODOS.forEach((p) => {
      const gp = mk('div', 'teu-det-per'); gp.setAttribute('role', 'group'); gp.setAttribute('aria-label', PER_INFO[p].rotulo);
      const sy = mk('span', 'teu-per-sym', PER_INFO[p].sym); sy.setAttribute('aria-hidden', 'true'); gp.appendChild(sy);
      const chips = mk('span', 'teu-chips');
      if (reg.clima[p].length) reg.clima[p].forEach((t) => chips.appendChild(mk('span', 'teu-tag', t)));
      else chips.appendChild(mk('span', 'teu-nada', 'não registrado'));
      gp.appendChild(chips); clima.appendChild(gp);
    });
    dir.appendChild(clima);
    dir.appendChild(mk('h3', 'teu-det-h', 'Salvamentos'));
    const ul = mk('ul', 'teu-det-log');
    if (logsDia.length) {
      logsDia.forEach((l) => {
        const L = linhaLog(l), li = mk('li');
        li.appendChild(mk('span', 'teu-salvo-h', L.hora)); li.appendChild(document.createTextNode(' ')); li.appendChild(mk('span', 'teu-salvo-a', L.acao));
        ul.appendChild(li);
      });
    } else ul.appendChild(mk('li', 'teu-salvo-vazio', 'Nenhum salvamento registrado.'));
    dir.appendChild(ul);
    box.appendChild(dir);
    det.appendChild(box);
  }

  function montarSemana(corpo, ini, mapa, logsPorDia) {
    const hojeS = dataLocal(), plan = planetasDaSemana();
    const ul = mk('ul', 'teu-sem-lista');
    for (let i = 0; i < 7; i++) {
      const s = dataLocal(somaDias(ini, i)), reg = mapa[s] || null, inf = infoDia(s, reg, hojeS), logsDia = logsPorDia[s] || [];
      const li = mk('li');
      const det = mk('details', 'teu-dia' + (inf.hoje ? ' teu-hoje' : '')); det.setAttribute('data-data', s);
      const sm = mk('summary', 'teu-dia-h');
      const chev = mk('span', 'teu-chev'); chev.setAttribute('aria-hidden', 'true'); sm.appendChild(chev);
      const pl = mk('span', 'teu-planeta', plan[i].sym); pl.setAttribute('aria-hidden', 'true'); sm.appendChild(pl);
      sm.appendChild(mk('span', 'ou-sr', plan[i].name + ', '));
      sm.appendChild(mk('span', 'teu-sem-data', ddmm(s) + (inf.hoje ? ' · hoje' : '')));
      sm.appendChild(mk('span', 'teu-sem-res', inf.texto));
      if (inf.tem) sm.appendChild(mk('span', 'teu-marca teu-marca-ok', '✓ diário'));
      else if (!inf.futuro) sm.appendChild(mk('span', 'teu-marca teu-marca-no', 'sem diário'));
      det.appendChild(sm);
      det.addEventListener('toggle', () => {                       /* o conteúdo do dia só entra no DOM ao abrir */
        if (det.open) { relAbertos.add(s); montarDetalhe(det, s, reg, logsDia); } else relAbertos.delete(s);
      });
      if (relAbertos.has(s)) { det.open = true; montarDetalhe(det, s, reg, logsDia); }
      li.appendChild(det); ul.appendChild(li);
    }
    corpo.appendChild(ul);
  }

  /* ---------- visão mensal ---------- */
  const pol = (r, a) => { const t = a * Math.PI / 180; return [500 + r * Math.sin(t), 500 - r * Math.cos(t)]; };
  const n2 = (x) => +x.toFixed(2);
  function setor(r1, r2, a1, a2) {
    const g = (a2 - a1) > 180 ? 1 : 0;
    const [x1, y1] = pol(r2, a1), [x2, y2] = pol(r2, a2), [x3, y3] = pol(r1, a2), [x4, y4] = pol(r1, a1);
    return 'M' + n2(x1) + ' ' + n2(y1) + 'A' + r2 + ' ' + r2 + ' 0 ' + g + ' 1 ' + n2(x2) + ' ' + n2(y2) + 'L' + n2(x3) + ' ' + n2(y3) + 'A' + r1 + ' ' + r1 + ' 0 ' + g + ' 0 ' + n2(x4) + ' ' + n2(y4) + 'Z';
  }
  /* disco lunar: mesma técnica de ouranos.js (disco escuro + parte iluminada; espelhado quando a elongação passa de 180°) */
  function discoLua(x, y, R, elong) {
    const cE = Math.cos(elong * Math.PI / 180), rx = (R * Math.abs(cE)).toFixed(2);
    return '<g transform="translate(' + n2(x) + ' ' + n2(y) + ')' + (elong > 180 ? ' scale(-1 1)' : '') + '" aria-hidden="true">' +
      '<circle r="' + R + '" fill="#141a26" stroke="rgba(159,176,200,.6)"/>' +
      '<path d="M0 ' + (-R) + 'A' + R + ' ' + R + ' 0 0 1 0 ' + R + 'A' + rx + ' ' + R + ' 0 0 ' + (cE > 0 ? 0 : 1) + ' 0 ' + (-R) + 'Z" fill="#F0EBD8"/></g>';
  }
  /* Período do mês exibido: mês LUNAR do Calendário Litúrgico (LiturgyKit.lunarMonth); sem o kit, cai no mês civil.
     ref = {k} (lunar) ou {y, m} (civil). Os dias são sempre chaves civis 'AAAA-MM-DD'. */
  function mesDe(ref) {
    const K = window.LiturgyKit;
    if (ref && ref.k !== undefined && K && typeof K.lunarMonthK === 'function') {
      const lm = safe(() => K.lunarMonthK(ref.k), null);
      if (lm && lm.dates && lm.dates.length) {
        const ini = lm.dates[0], fim = lm.dates[lm.dates.length - 1];
        return { ref: { k: lm.k }, lunar: true, dias: lm.dates, nome: lm.name, romano: lm.roman, ini, fim,
          intervalo: ddmm(ini) + ' a ' + ddmm(fim) + '/' + fim.slice(0, 4),
          titulo: 'Mês ' + lm.roman + ' · ' + lm.name };
      }
    }
    const y = ref.y, m = ref.m, n = new Date(y, m + 1, 0).getDate(), dias = [];
    for (let d = 1; d <= n; d++) dias.push(y + '-' + pad(m + 1) + '-' + pad(d));
    return { ref: { y, m }, lunar: false, dias, nome: cap(MESES[m]), romano: '', ini: dias[0], fim: dias[n - 1], intervalo: String(y), titulo: cap(MESES[m]) + ' de ' + y };
  }
  function refDeData(s) {
    const K = window.LiturgyKit, lm = K && typeof K.lunarMonth === 'function' ? safe(() => K.lunarMonth(s), null) : null;
    if (lm && lm.dates && lm.dates.length) return { k: lm.k };
    const d = dataDeStr(s); return { y: d.getFullYear(), m: d.getMonth() };
  }
  function refVizinha(ref, dir) {
    if (ref.k !== undefined) return { k: ref.k + dir };
    const d = new Date(ref.y, ref.m + dir, 1); return { y: d.getFullYear(), m: d.getMonth() };
  }
  function estadoMes(inf) {
    if (inf.tem) return 'ok';
    if (inf.futuro) return 'neutro';
    if (inf.hoje && !HOJE_SEM_DIARIO_VERMELHO) return 'neutro';
    return 'no';
  }

  function montarMes(corpo, mi, mapa) {
    const n = mi.dias.length, hojeS = dataLocal(), step = 360 / n;
    const K = window.LiturgyKit, temLua = !!(K && typeof K.moonInfo === 'function');
    const R1 = 250, R2 = 440, R_NUM = 305, R_LUA = 386, R_CHK = 268;
    const dias = []; let feitos = 0, passados = 0, idxTab = 0;
    for (let d = 1; d <= n; d++) {
      const s = mi.dias[d - 1], inf = infoDia(s, mapa[s] || null, hojeS);
      inf.dia = d;
      inf.lua = temLua ? safe(() => K.moonInfo(dataDeStr(s).setHours(12)), null) : null;
      if (!inf.futuro) { passados++; if (inf.tem) feitos++; }
      if (inf.hoje) idxTab = d - 1;
      dias.push(inf);
    }
    const contagem = passados === 0 ? 'Mês ainda não começou' : feitos + ' de ' + passados + (passados === 1 ? ' dia registrado' : ' dias registrados');
    const titulo = mi.titulo + ' (' + mi.intervalo + ')';

    let g = '<circle cx="500" cy="500" r="' + (R2 + 6) + '" fill="none" stroke="rgba(201,164,92,0.15)" stroke-width="1"/>';
    dias.forEach((inf, i) => {
      const a1 = i * step, a2 = (i + 1) * step, mid = a1 + step / 2, st = estadoMes(inf);
      const info = 'Dia ' + inf.dia + (mi.lunar ? ' (' + ddmm(inf.s) + ')' : '') + ' · ' + inf.texto;
      const rotulo = 'Dia ' + inf.dia + (mi.lunar ? ' (' + ddmm(inf.s) + ')' : '') + (inf.lua ? ', ' + inf.lua.phaseName : '') + '. ' + inf.texto + '.' + (inf.tem ? ' Diário feito.' : '') + (inf.hoje ? ' Hoje.' : '');
      g += '<g class="teu-mes-dia" data-dia="' + inf.dia + '" data-data="' + inf.s + '" data-info="' + esc(info) + '" role="button" tabindex="' + (i === idxTab ? 0 : -1) + '" aria-label="' + esc(rotulo) + '">';
      g += '<path class="teu-seg" d="' + setor(R1, R2, a1, a2) + '" fill="' + (i % 2 ? 'rgba(255,255,255,0.012)' : 'rgba(255,255,255,0.035)') + '" stroke="rgba(201,164,92,0.28)" stroke-width="1"/>';
      if (st === 'ok') g += '<path class="teu-st-ok" d="' + setor(R1 + 5, R2 - 5, a1 + 0.8, a2 - 0.8) + '" fill="none" stroke="' + COR_OK + '" stroke-width="3.5" stroke-linejoin="round"/>';
      else if (st === 'no') g += '<path class="teu-st-no" d="' + setor(R1 + 5, R2 - 5, a1 + 0.8, a2 - 0.8) + '" fill="none" stroke="' + COR_NO + '" stroke-width="3" stroke-dasharray="9 6" stroke-linejoin="round"/>';
      if (inf.lua) { const [lx, ly] = pol(R_LUA, mid); g += discoLua(lx, ly, 26, inf.lua.elong); }
      const [nx, ny] = pol(R_NUM, mid);
      g += '<text class="teu-mes-num" x="' + n2(nx) + '" y="' + n2(ny) + '" text-anchor="middle" dominant-baseline="central" font-size="24" font-weight="' + (inf.hoje ? 700 : 400) + '" fill="' + (inf.hoje ? COR_OURO : '#efe6d2') + '" style="font-family:\'Jost\',sans-serif">' + inf.dia + '</text>';
      if (inf.tem) { const [cx, cy] = pol(R_CHK, mid); g += '<text class="teu-mes-chk" x="' + n2(cx) + '" y="' + n2(cy) + '" text-anchor="middle" dominant-baseline="central" font-size="22" font-weight="700" fill="' + COR_OK + '">✓</text>'; }
      if (inf.hoje) {
        const [p1x, p1y] = pol(R2 + 8, mid), [p2x, p2y] = pol(R2 + 28, mid - 2), [p3x, p3y] = pol(R2 + 28, mid + 2);
        g += '<path class="teu-mes-hoje" d="M' + n2(p1x) + ' ' + n2(p1y) + 'L' + n2(p2x) + ' ' + n2(p2y) + 'L' + n2(p3x) + ' ' + n2(p3y) + 'Z" fill="' + COR_OURO + '"/>';
      }
      g += '</g>';
    });
    const partes = mi.lunar ? mi.nome.split(' da ') : [mi.nome];
    const linhas = mi.lunar
      ? [['Mês ' + mi.romano, 28, 410, '#8197aa', 'Cinzel'], [partes[0] + (partes[1] ? ' da' : ''), 46, 462, COR_OURO, 'Cormorant Garamond'], [partes[1] || '', 46, 514, COR_OURO, 'Cormorant Garamond'], [mi.intervalo, 24, 566, '#efe6d2', 'Jost'], [contagem, 22, 610, '#8197aa', 'Jost']]
      : [[mi.nome, 54, 452, COR_OURO, 'Cormorant Garamond'], [mi.ref.y, 38, 514, '#efe6d2', 'Cinzel'], [contagem, 22, 574, '#8197aa', 'Jost']];
    g += '<g class="teu-mes-centro" aria-hidden="true">' + linhas.filter((l) => l[0] !== '').map((l, i, a) =>
      '<text' + (l[0] === contagem ? ' class="teu-mes-cont"' : '') + ' x="500" y="' + l[2] + '" text-anchor="middle" font-size="' + l[1] + '" fill="' + l[3] + '" style="font-family:\'' + l[4] + '\',serif;font-weight:500">' + esc(String(l[0])) + '</text>').join('') + '</g>';

    const box = mk('div', 'teu-mes');
    box.appendChild(mk('p', 'ou-sr', titulo + ': ' + contagem + '. Use as setas para percorrer os dias e Enter para abrir o dia na visão semanal.'));
    box.insertAdjacentHTML('beforeend',
      '<svg class="teu-mes-svg" viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg" role="group" focusable="false" aria-label="' + esc('Círculo de ' + titulo + ': um segmento por dia, com a fase da lua') + '">' + g + '</svg>' +
      '<ul class="teu-leg" aria-label="Legenda">' +
        '<li class="teu-leg-ok"><i aria-hidden="true">✓</i> diário feito (contorno verde)</li>' +
        '<li class="teu-leg-no"><i aria-hidden="true"></i> sem diário (contorno vermelho tracejado)</li>' +
        '<li class="teu-leg-hoje"><i aria-hidden="true">▾</i> hoje (marcador dourado)</li>' +
      '</ul>');
    corpo.appendChild(box);
  }

  /* ---------- controles, renderização e navegação ---------- */
  const INFO_PADRAO_MES = 'Passe o mouse, toque ou use as setas sobre um dia para ver o resumo.';
  function mostrarInfo(t) {
    if (!rel.info) return;
    const v = t == null ? (relModo === 'mensal' ? INFO_PADRAO_MES : '') : t;
    if (rel.info.textContent !== v) rel.info.textContent = v;
  }
  function atualizarControles() {
    const sem = relModo === 'semanal';
    rel.modos.forEach((b) => b.setAttribute('aria-pressed', b.dataset.modo === relModo ? 'true' : 'false'));
    const ant = sem ? 'Semana anterior' : 'Mês anterior', prox = sem ? 'Próxima semana' : 'Próximo mês';
    rel.prev.setAttribute('aria-label', ant); rel.prev.title = ant;
    rel.next.setAttribute('aria-label', prox); rel.next.title = prox;
    rel.hoje.textContent = sem ? 'Esta semana' : 'Este mês';
    rel.info.hidden = sem;
  }

  async function renderRelatorio() {
    const meu = ++relToken; relSujo = false;
    atualizarControles();
    const sem = relModo === 'semanal';
    const mi = sem ? null : mesDe(relMes);
    if (!sem) relMes = mi.ref;
    const sDe = sem ? dataLocal(relSemIni) : mi.ini, sAte = sem ? dataLocal(somaDias(relSemIni, 6)) : mi.fim;
    const [regs, logs] = await Promise.all([listarPeriodo(sDe, sAte), sem ? listarLogs(sDe, sAte) : Promise.resolve([])]);
    if (meu !== relToken) return;                              /* uma navegação mais nova já assumiu */
    const mapa = {}; regs.forEach((r) => { mapa[r.data] = r; });
    rel.aviso.hidden = !!store();
    rel.corpo.textContent = '';
    relArmado = null;
    if (sem) {
      rel.tit.textContent = rotuloSemana(relSemIni);
      const porDia = {}; logs.forEach((l) => { (porDia[l.data] || (porDia[l.data] = [])).push(l); });
      montarSemana(rel.corpo, relSemIni, mapa, porDia);
    } else {
      rel.tit.textContent = mi.lunar ? mi.titulo + ' · ' + mi.intervalo : mi.titulo;
      montarMes(rel.corpo, mi, mapa);
    }
    mostrarInfo(null);
    if (relFoco) {
      const s = relFoco; relFoco = null;
      const sm = rel.corpo.querySelector('details.teu-dia[data-data="' + s + '"] summary');
      if (sm) { safe(() => sm.focus()); safe(() => sm.scrollIntoView({ block: 'nearest' })); }
    }
  }

  function navegar(dir) {
    if (relModo === 'semanal') {
      const novo = somaDias(relSemIni, 7 * dir);
      if (!anoOk(novo) || !anoOk(somaDias(novo, 6))) return;
      relSemIni = novo;
    } else {
      const novo = mesDe(refVizinha(relMes, dir));
      if (!anoOk(dataDeStr(novo.ini)) || !anoOk(dataDeStr(novo.fim))) return;
      relMes = novo.ref;
    }
    renderRelatorio();
  }
  function irHoje() {
    const h = new Date();
    relSemIni = domingoDe(h); relMes = refDeData(dataLocal(h));
    renderRelatorio();
  }
  function trocarModo(modo) {
    if (modo === relModo || (modo !== 'semanal' && modo !== 'mensal')) return;
    if (modo === 'mensal') relMes = refDeData(dataLocal(somaDias(relSemIni, 3)));
    else {
      const mi = mesDe(relMes), hs = dataLocal();
      relSemIni = domingoDe(dataDeStr(mi.dias.indexOf(hs) >= 0 ? hs : mi.ini));
    }
    relModo = modo;
    renderRelatorio();
  }
  /* do círculo do mês para o detalhe do dia na visão semanal */
  function abrirDia(s) {
    if (!dataValida(s)) return;
    relModo = 'semanal'; relSemIni = domingoDe(dataDeStr(s)); relAbertos.add(s); relFoco = s;
    renderRelatorio();
  }

  function montarRelatorio() {
    const h = new Date();
    relSemIni = domingoDe(h); relMes = refDeData(dataLocal(h)); relModo = 'semanal';
    el.panel_relatorio.innerHTML =
      '<div class="teu-rel">' +
        '<div class="teu-rel-modos" role="group" aria-label="Tipo de relatório">' +
          '<button type="button" class="teu-btn teu-modo" data-modo="semanal" aria-pressed="true">Semanal</button>' +
          '<button type="button" class="teu-btn teu-modo" data-modo="mensal" aria-pressed="false">Mensal</button>' +
        '</div>' +
        '<div class="teu-rel-nav" role="group" aria-label="Período">' +
          '<button type="button" class="teu-btn teu-nav" id="teuRelPrev"><span aria-hidden="true">‹</span></button>' +
          '<h2 class="teu-rel-tit" id="teuRelTit" aria-live="polite" aria-atomic="true"></h2>' +
          '<button type="button" class="teu-btn teu-nav" id="teuRelNext"><span aria-hidden="true">›</span></button>' +
          '<button type="button" class="teu-btn teu-btn-disc" id="teuRelHoje"></button>' +
        '</div>' +
        '<p class="teu-estado teu-erro" id="teuRelAviso" hidden>⚠ Armazenamento indisponível neste navegador: o relatório aparece vazio.</p>' +
        '<div class="teu-rel-corpo" id="teuRelCorpo"></div>' +
        '<p class="teu-rel-info" id="teuRelInfo" aria-live="polite" aria-atomic="true" hidden></p>' +
      '</div>';
    rel.modos = Array.prototype.slice.call(el.panel_relatorio.querySelectorAll('.teu-modo'));
    ['teuRelPrev', 'teuRelNext', 'teuRelHoje', 'teuRelTit', 'teuRelAviso', 'teuRelCorpo', 'teuRelInfo'].forEach((id) => { rel[id.slice(6).toLowerCase()] = document.getElementById(id); });
    /* nomes em rel: prev, next, hoje, tit, aviso, corpo, info */

    rel.modos.forEach((b) => b.addEventListener('click', () => trocarModo(b.dataset.modo)));
    rel.prev.addEventListener('click', () => navegar(-1));
    rel.next.addEventListener('click', () => navegar(1));
    rel.hoje.addEventListener('click', irHoje);

    /* círculo do mês: hover / toque / foco mostram o resumo; clique ou Enter abrem o dia */
    const alvo = (e) => (e.target && e.target.closest ? e.target.closest('.teu-mes-dia') : null);
    rel.corpo.addEventListener('mouseover', (e) => { const t = alvo(e); if (t && Date.now() - relToque > 800) relArmado = null; if (t) mostrarInfo(t.getAttribute('data-info')); });
    rel.corpo.addEventListener('mouseleave', () => { if (!relArmado) mostrarInfo(null); });   /* no toque o resumo fica até o próximo toque */
    rel.corpo.addEventListener('focusin', (e) => { const t = alvo(e); if (t) mostrarInfo(t.getAttribute('data-info')); });
    rel.corpo.addEventListener('focusout', (e) => { if (!relArmado && alvo(e) && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.teu-mes-dia'))) mostrarInfo(null); });
    rel.corpo.addEventListener('touchstart', (e) => { relToque = Date.now(); const t = alvo(e); if (t) mostrarInfo(t.getAttribute('data-info')); }, { passive: true });
    rel.corpo.addEventListener('click', (e) => {
      const t = alvo(e); if (!t) return;
      const s = t.getAttribute('data-data');
      const toque = e.pointerType === 'touch' || (Date.now() - relToque < 800);
      if (toque && relArmado !== s) {                          /* no toque: o 1º toque mostra o resumo, o 2º abre o dia */
        relArmado = s; mostrarInfo(t.getAttribute('data-info') + ' — toque de novo para abrir'); return;
      }
      relArmado = null; abrirDia(s);
    });
    rel.corpo.addEventListener('keydown', (e) => {
      const t = alvo(e); if (!t) return;
      const dias = Array.prototype.slice.call(rel.corpo.querySelectorAll('.teu-mes-dia')), i = dias.indexOf(t), n = dias.length;
      let j;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % n;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + n) % n;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = n - 1;
      else if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); abrirDia(t.getAttribute('data-data')); return; }
      else return;
      e.preventDefault();
      dias.forEach((d) => d.setAttribute('tabindex', '-1'));
      dias[j].setAttribute('tabindex', '0'); safe(() => dias[j].focus());
    });
  }

  function mostrarRelatorio() {
    if (!relPronto) { relPronto = true; montarRelatorio(); renderRelatorio(); }
    else if (relSujo) renderRelatorio();
  }

  /* ====================================================================
     API
     ==================================================================== */
  function activate() {
    try {
      if (!view) return;
      ativa = true; construir();
      selecionar(sub || lerSessao() || 'hinario', false);
    } catch (e) { /* falha segura */ }
  }
  function deactivate() {
    try { ativa = false; ajustarRelogio(); } catch (e) { /* falha segura */ }
  }
  window.Teurgica = { activate, deactivate, info: () => ({ ativa, sub, relogio: !!timer }) };
})();
