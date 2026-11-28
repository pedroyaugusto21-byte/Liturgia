/* ======================================================================
   TEÚRGICA — DADOS (window.TeurgicaBase e window.TeurgicaData)
   Constantes, datas civis locais, validação/normalização do registro do Diário, resumo do dia e leitura
   do CalendariumStore (carregarDia, listarPeriodo, listarLogs). Sem DOM. TeurgicaData mantém o mesmo formato.
   Carregar ANTES de teurgica-relatorio-calc.js e teurgica.js (CalendariumStore é opcional: falha segura).
   Código MOVIDO de teurgica.js sem reescrever. Escopo: um IIFE; único global novo = o namespace acima.
   ====================================================================== */
window.TeurgicaBase = (function () {
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
      photagogia: r.photagogia === true,
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

  return { safe, esc, pad, TAGS, PERIODOS, EXCLUSOES, PER_INFO, TEXTO_MAX, CHAVE_ABA, MESES, dataLocal, horaLocal, horasDecimais, dataValida, dataExtenso, fmtBR, novoId, store, carregarDia, listarPeriodo, listarLogs, resumirDia };
})();
