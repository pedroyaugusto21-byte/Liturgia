/* ======================================================================
   TEÚRGICA — CÁLCULO DO RELATÓRIO (window.TeurgicaRelCalc)
   Datas da semana/mês (inclusive mês lunar via LiturgyKit, opcional), rótulos, linha do log, info do dia,
   estado do mês e geometria SVG em texto (setor, disco lunar). Sem DOM.
   Carregar DEPOIS de teurgica-dados.js e ANTES de teurgica.js.
   Código MOVIDO de teurgica.js sem reescrever. Escopo: um IIFE; único global novo = o namespace acima.
   ====================================================================== */
window.TeurgicaRelCalc = (function () {
  'use strict';
  var B = window.TeurgicaBase;
  const { safe, pad, MESES, horasDecimais, resumirDia } = B;

  const HOJE_SEM_DIARIO_VERMELHO = true;
  const ANO_MIN = 1900, ANO_MAX = 2200;
  const SEMANA_FALLBACK = [
    { sym: '☉', name: 'Domingo' }, { sym: '☽', name: 'Segunda-feira' }, { sym: '♂', name: 'Terça-feira' }, { sym: '☿', name: 'Quarta-feira' },
    { sym: '♃', name: 'Quinta-feira' }, { sym: '♀', name: 'Sexta-feira' }, { sym: '♄', name: 'Sábado' },
  ];
  const planetasDaSemana = () => safe(() => { const w = window.LiturgyKit && window.LiturgyKit.WEEK; return Array.isArray(w) && w.length === 7 ? w : null; }, null) || SEMANA_FALLBACK;
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const domingoDe = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  const somaDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const anoOk = (d) => d.getFullYear() >= ANO_MIN && d.getFullYear() <= ANO_MAX;
  const dataDeStr = (s) => new Date(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
  const ddmm = (s) => s.slice(8, 10) + '/' + s.slice(5, 7);
  const hhmmss = (h) => {
    const t = Math.floor((((h % 24) + 24) % 24) * 3600 + 1e-6) % 86400;
    return pad(Math.floor(t / 3600)) + ':' + pad(Math.floor((t % 3600) / 60)) + ':' + pad(t % 60);
  };

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
    const phot = reg && reg.photagogia ? 'feito' : futuro ? 'futuro' : s === hojeS ? 'aberto' : 'nao';   /* 'nao': o dia virou sem a Photagogia */
    return { s, reg, tem: !!reg, phot, futuro, hoje: s === hojeS, texto: reg ? resumirDia(reg).texto : (futuro ? 'Dia futuro' : 'Sem registro') };
  }

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


  return { HOJE_SEM_DIARIO_VERMELHO, ANO_MIN, SEMANA_FALLBACK, planetasDaSemana, cap, domingoDe, somaDias, anoOk, dataDeStr, ddmm, hhmmss, rotuloSemana, linhaLog, ultimoSalvamento, infoDia, pol, n2, setor, discoLua, mesDe, refDeData, refVizinha, estadoMes, ANO_MAX };
})();
