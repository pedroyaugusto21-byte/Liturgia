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

  /* resumo síncrono de um registro: { data, temTexto, caracteres, clima, tags:{tag:n}, total, periodosComClima } */
  function resumirDia(reg) {
    const r = normalizarRegistro(reg);
    if (!r) return null;
    const tags = {}; let total = 0, periodos = 0;
    PERIODOS.forEach((p) => { if (r.clima[p].length) periodos++; r.clima[p].forEach((t) => { tags[t] = (tags[t] || 0) + 1; total++; }); });
    return { data: r.data, temTexto: r.texto.trim().length > 0, caracteres: r.texto.length, clima: r.clima, tags, total, periodosComClima: periodos };
  }

  window.TeurgicaData = { TAGS, PERIODOS, EXCLUSOES, resumirDia, carregarDia, listarPeriodo };

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
    el.panel_relatorio.innerHTML = '<p class="teu-vazio">Em breve</p>';
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
    ['teuDial', 'teuHora', 'teuDataExt', 'teuData', 'teuTexto', 'teuSalvar', 'teuEstado', 'teuSalvos', 'teuExportar', 'teuImportar', 'teuArquivo', 'teuCopiaEstado']
      .forEach((id) => { el[id] = document.getElementById(id); });

    el.teuTexto.addEventListener('input', () => { sujo = true; });
    el.panel_diario.querySelectorAll('.teu-chip').forEach((b) => b.addEventListener('click', () => alternarChip(b)));
    el.teuSalvar.addEventListener('click', salvar);
    el.teuData.addEventListener('change', trocarData);
    el.teuExportar.addEventListener('click', exportar);
    el.teuImportar.addEventListener('click', () => el.teuArquivo.click());
    el.teuArquivo.addEventListener('change', importar);
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
