/* ======================================================================
   CALENDARIUM IMPORTAR — lógica do "Importar backup" (cartão da conta)
   window.CalendariumImportar = { MAX_BYTES, analisar(texto), aplicar(plano, modo) }

   - Script CLÁSSICO, sem dependências. Só lógica: a tela fica em conta.js.
   - Valida o arquivo com as MESMAS regras e limites que a sincronização usa (nuvem.js:
     limparDiario / limparLog / limparFesta). Cada registro é reconstruído campo a campo:
     nada do arquivo original é gravado como veio.
   - analisar(texto) NÃO grava nada. Devolve { ok, plano, resumo } para a prévia, ou { ok:false, erro }.
   - aplicar(plano, modo) grava via CalendariumStore (então a fila de sincronização enxerga
     as mudanças como qualquer edição) e devolve as contagens do que realmente aconteceu.
       modo 'mesclar'    — mesma regra da sincronização: diário vence o salvoEm mais recente
                           (empate: fica o do aparelho); festas só entram se o id é novo;
                           registros de horário são unidos (sem duplicar).
       modo 'substituir' — o aparelho passa a ter exatamente o conteúdo do arquivo. Grava
                           primeiro e só depois apaga o que sobrou, para uma falha no meio
                           nunca deixar o aparelho sem dados.
   - Depois de gravar, avisa as telas com o evento 'calendarium:nuvem-dados' (o mesmo que a
     sincronização usa), com origem:'importacao'.
   - Textos de erro em pt-BR; nenhum método lança exceção.
   ====================================================================== */
(function () {
  'use strict';

  const MAX_BYTES = 5 * 1024 * 1024;       /* igual ao "Importar cópia" do Diário */
  const MAX_REGISTROS = 20000;             /* por coleção: barra arquivos absurdos */
  const TEXTO_MAX = 10000;
  const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
  const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;
  const RE_HORA = /^\d{2}:\d{2}:\d{2}$/;
  const PERIODOS = ['amanhecer', 'entardecer', 'noite'];

  const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
  const ehObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : '');
  const store = () => window.CalendariumStore || null;

  function dataValida(s) {
    if (typeof s !== 'string' || !RE_DATA.test(s)) return false;
    const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    if (y < 100) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  /* ---------- limpeza: espelho de nuvem.js (há um teste que compara as duas) ---------- */
  function limparDiario(d) {
    if (!ehObj(d) || !dataValida(d.data)) return null;
    if (typeof d.texto !== 'string' || d.texto.length > TEXTO_MAX) return null;
    const clima = {};
    PERIODOS.forEach((p) => {
      const a = ehObj(d.clima) && Array.isArray(d.clima[p]) ? d.clima[p] : [];
      clima[p] = a.filter((t) => typeof t === 'string' && t.length > 0 && t.length <= 20).slice(0, 12);
    });
    return { data: d.data, id: str(d.id, 64), texto: d.texto, clima, photagogia: d.photagogia === true, criadoEm: str(d.criadoEm, 40), salvoEm: str(d.salvoEm, 40) };
  }
  /* registro de horário; nuvemId é opcional no arquivo (backups antigos não têm) */
  function limparLog(d) {
    if (!ehObj(d)) return null;
    if (!dataValida(d.data) || typeof d.salvoEm !== 'string' || !d.salvoEm || d.salvoEm.length > 40) return null;
    if (typeof d.hora !== 'string' || !RE_HORA.test(d.hora)) return null;
    if (typeof d.horas !== 'number' || !isFinite(d.horas) || d.horas < 0 || d.horas > 24) return null;
    if (d.acao !== 'criou' && d.acao !== 'atualizou') return null;
    const r = { data: d.data, salvoEm: d.salvoEm, hora: d.hora, horas: d.horas, acao: d.acao };
    if (typeof d.nuvemId === 'string' && d.nuvemId.length > 0 && d.nuvemId.length <= 80) r.nuvemId = d.nuvemId;
    return r;
  }
  function limparFesta(d) {
    if (!ehObj(d) || typeof d.id !== 'string' || !RE_ID.test(d.id) || !dataValida(d.data)) return null;
    const nome = typeof d.nome === 'string' ? d.nome.replace(/\s+/g, ' ').trim() : '';
    if (!nome || nome.length > 60) return null;
    const descricao = typeof d.descricao === 'string' ? d.descricao : '';
    if (descricao.length > 280) return null;
    if (typeof d.criadoEm !== 'number' || !isFinite(d.criadoEm)) return null;
    return { id: d.id, data: d.data, nome, descricao, criadoEm: d.criadoEm };
  }

  /* identidade de um registro de horário: nuvemId, e (para os sem nuvemId) a assinatura dos campos */
  const assinatura = (l) => l.data + '|' + l.salvoEm + '|' + l.hora + '|' + l.acao;
  function chavesLog(l) {
    const k = [assinatura(l)];
    if (typeof l.nuvemId === 'string' && l.nuvemId) k.push('id:' + l.nuvemId);
    return k;
  }

  /* ---------- 1. ler e validar o arquivo ---------- */
  function lerArquivo(texto) {
    if (typeof texto !== 'string' || !texto.trim()) return { ok: false, erro: 'O arquivo está vazio.' };
    if (texto.length > MAX_BYTES) return { ok: false, erro: 'Arquivo grande demais (máximo 5 MB).' };
    const dados = safe(() => JSON.parse(texto.charCodeAt(0) === 0xFEFF ? texto.slice(1) : texto), undefined);
    if (dados === undefined) return { ok: false, erro: 'O arquivo não é um JSON válido.' };
    if (!ehObj(dados) || dados.app !== 'calendarium' || !ehObj(dados.stores)) return { ok: false, erro: 'Este arquivo não parece ser um backup do Calendarium.' };
    const S = store(), maxVersao = S && typeof S.versao === 'number' ? S.versao : 1;
    const v = dados.versao === undefined ? 1 : Number(dados.versao);
    if (!isFinite(v) || v < 1) return { ok: false, erro: 'A versão deste backup não é válida.' };
    if (v > maxVersao) return { ok: false, erro: 'Este backup é de uma versão mais nova do Calendarium. Atualize o app e tente de novo.' };
    const brutos = {};
    for (const n of ['diario', 'diario_log', 'festas']) {
      const a = dados.stores[n];
      if (a === undefined) { brutos[n] = []; continue; }
      if (!Array.isArray(a)) return { ok: false, erro: 'O backup está com a seção "' + n + '" em formato inválido.' };
      if (a.length > MAX_REGISTROS) return { ok: false, erro: 'O backup tem registros demais em "' + n + '" (máximo ' + MAX_REGISTROS + ').' };
      brutos[n] = a;
    }
    return { ok: true, brutos, exportadoEm: str(dados.exportadoEm, 40) };
  }

  /* registros válidos e sem repetição dentro do próprio arquivo */
  function limparArquivo(brutos) {
    const out = { diario: [], diario_log: [], festas: [] }, inval = { diario: 0, diario_log: 0, festas: 0 }, dup = { diario: 0, diario_log: 0, festas: 0 };
    const porDia = new Map();
    brutos.diario.forEach((r) => {
      const l = limparDiario(r);
      if (!l) { inval.diario++; return; }
      const antes = porDia.get(l.data);
      if (!antes) { porDia.set(l.data, l); return; }
      dup.diario++;
      if (String(l.salvoEm) > String(antes.salvoEm)) porDia.set(l.data, l);   /* mesma regra: o mais recente vence */
    });
    out.diario = Array.from(porDia.values()).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
    const porId = new Map();
    brutos.festas.forEach((r) => {
      const l = limparFesta(r);
      if (!l) { inval.festas++; return; }
      if (porId.has(l.id)) { dup.festas++; return; }
      porId.set(l.id, l);
    });
    out.festas = Array.from(porId.values());
    const vistos = new Set();
    brutos.diario_log.forEach((r) => {
      const l = limparLog(r);
      if (!l) { inval.diario_log++; return; }
      const k = chavesLog(l);
      if (k.some((x) => vistos.has(x))) { dup.diario_log++; return; }
      k.forEach((x) => vistos.add(x));
      out.diario_log.push(l);
    });
    return { registros: out, invalidos: inval, repetidos: dup };
  }

  /* ---------- 2. comparar com o que já existe no aparelho (só leitura) ---------- */
  async function lerLocais() {
    const S = store();
    if (!S) return null;
    const diario = new Map(), festas = new Map(), logs = [];
    ((await S.getAll('diario')) || []).forEach((r) => { if (ehObj(r) && typeof r.data === 'string') diario.set(r.data, r); });
    ((await S.getAll('festas')) || []).forEach((r) => { if (ehObj(r) && typeof r.id === 'string') festas.set(r.id, r); });
    ((await S.getAll('diario_log')) || []).forEach((r) => { if (ehObj(r)) logs.push(r); });
    return { diario, festas, logs };
  }
  const logChaves = (logs) => { const s = new Set(); logs.forEach((l) => { chavesLog(l).forEach((k) => s.add(k)); }); return s; };

  function comparar(reg, loc) {
    const r = { diario: { total: reg.diario.length, novos: 0, atualizam: 0, mantidos: 0, apagariam: 0 },
      festas: { total: reg.festas.length, novos: 0, mantidos: 0, apagariam: 0 },
      logs: { total: reg.diario_log.length, novos: 0, mantidos: 0, apagariam: 0 } };
    const dias = new Set(), ids = new Set();
    reg.diario.forEach((d) => {
      dias.add(d.data);
      const l = loc.diario.get(d.data);
      if (!l) r.diario.novos++;
      else if (String(d.salvoEm) > String(l.salvoEm || '')) r.diario.atualizam++;
      else r.diario.mantidos++;
    });
    loc.diario.forEach((l, dia) => { if (!dias.has(dia)) r.diario.apagariam++; });
    reg.festas.forEach((f) => { ids.add(f.id); if (loc.festas.has(f.id)) r.festas.mantidos++; else r.festas.novos++; });
    loc.festas.forEach((f, id) => { if (!ids.has(id)) r.festas.apagariam++; });
    const doAparelho = logChaves(loc.logs), doArquivo = new Set();
    reg.diario_log.forEach((l) => { const k = chavesLog(l); k.forEach((x) => doArquivo.add(x)); if (k.some((x) => doAparelho.has(x))) r.logs.mantidos++; else r.logs.novos++; });
    loc.logs.forEach((l) => { if (!chavesLog(l).some((x) => doArquivo.has(x))) r.logs.apagariam++; });
    return r;
  }

  async function analisar(texto) {
    try {
      if (!store()) return { ok: false, erro: 'Armazenamento indisponível neste navegador.' };
      const lido = lerArquivo(texto);
      if (!lido.ok) return lido;
      const limpo = limparArquivo(lido.brutos);
      const n = limpo.registros;
      if (!n.diario.length && !n.festas.length && !n.diario_log.length) {
        const ign = limpo.invalidos.diario + limpo.invalidos.festas + limpo.invalidos.diario_log;
        return { ok: false, erro: ign ? 'Nenhum registro válido neste backup (' + ign + ' ignorado' + (ign === 1 ? '' : 's') + ' por estar fora do formato).' : 'Este backup não tem diário, festas nem registros de horário.' };
      }
      const loc = await lerLocais();
      if (!loc) return { ok: false, erro: 'Armazenamento indisponível neste navegador.' };
      return { ok: true, exportadoEm: lido.exportadoEm, plano: { registros: n }, resumo: Object.assign(comparar(n, loc), { invalidos: limpo.invalidos, repetidos: limpo.repetidos }) };
    } catch (e) { return { ok: false, erro: 'Não foi possível ler o backup.' }; }
  }

  /* ---------- 3. gravar ---------- */
  function avisarTelas(detalhe) {
    safe(() => window.dispatchEvent(new CustomEvent('calendarium:nuvem-dados', { detail: Object.assign({ origem: 'importacao' }, detalhe) })));
  }

  async function aplicar(plano, modo) {
    try {
      const S = store();
      if (!S) return { ok: false, erro: 'Armazenamento indisponível neste navegador.' };
      if (modo !== 'mesclar' && modo !== 'substituir') return { ok: false, erro: 'Escolha inválida.' };
      if (!plano || !ehObj(plano.registros)) return { ok: false, erro: 'Nada para importar.' };
      const reg = plano.registros;
      const loc = await lerLocais();               /* lido de novo AGORA: a prévia pode ter ficado velha */
      if (!loc) return { ok: false, erro: 'Armazenamento indisponível neste navegador.' };
      const subst = modo === 'substituir';
      const res = { modo, diario: { gravados: 0, mantidos: 0, apagados: 0 }, festas: { gravados: 0, mantidos: 0, apagados: 0 }, logs: { gravados: 0, mantidos: 0, apagados: 0 }, falhas: 0 };
      const diasMudados = [];

      /* 3a. grava */
      for (const d of reg.diario) {
        const l = loc.diario.get(d.data);
        const vence = subst ? true : (!l || String(d.salvoEm) > String(l.salvoEm || ''));
        if (!vence) { res.diario.mantidos++; continue; }
        if (subst && l && JSON.stringify(l) === JSON.stringify(d)) { res.diario.mantidos++; continue; }
        const k = await S.put('diario', d);
        if (k === null) res.falhas++; else { res.diario.gravados++; diasMudados.push(d.data); }
      }
      for (const f of reg.festas) {
        if (loc.festas.has(f.id)) { res.festas.mantidos++; continue; }
        const k = await S.put('festas', f);
        if (k === null) res.falhas++; else res.festas.gravados++;
      }
      const doAparelho = logChaves(loc.logs);
      for (const l of reg.diario_log) {
        if (chavesLog(l).some((x) => doAparelho.has(x))) { res.logs.mantidos++; continue; }
        const k = await S.add('diario_log', l);      /* sem seq: o store dá o número; o seq do arquivo poderia colidir com o daqui */
        if (k === null) res.falhas++; else res.logs.gravados++;
      }

      /* 3b. só no modo substituir, e só se nada falhou: apaga o que não está no arquivo */
      if (subst && res.falhas === 0) {
        const dias = new Set(reg.diario.map((d) => d.data)), ids = new Set(reg.festas.map((f) => f.id)), doArquivo = new Set();
        reg.diario_log.forEach((l) => { chavesLog(l).forEach((x) => doArquivo.add(x)); });
        for (const dia of loc.diario.keys()) if (!dias.has(dia)) { if (await S.delete('diario', dia)) { res.diario.apagados++; diasMudados.push(dia); } else res.falhas++; }
        for (const id of loc.festas.keys()) if (!ids.has(id)) { if (await S.delete('festas', id)) res.festas.apagados++; else res.falhas++; }
        for (const l of loc.logs) if (!chavesLog(l).some((x) => doArquivo.has(x)) && l.seq !== undefined) { if (await S.delete('diario_log', l.seq)) res.logs.apagados++; else res.falhas++; }
      }

      avisarTelas({ diario: diasMudados, logs: res.logs.gravados > 0 || res.logs.apagados > 0, festas: res.festas.gravados > 0 || res.festas.apagados > 0, tudo: subst });
      return Object.assign({ ok: res.falhas === 0 }, res, res.falhas ? { erro: 'Parte do backup não pôde ser gravada ou apagada (' + res.falhas + ' registro(s)). Confira os seus dados e tente de novo; importar de novo é seguro.' } : {});
    } catch (e) { return { ok: false, erro: 'Não foi possível importar o backup.' }; }
  }

  window.CalendariumImportar = { MAX_BYTES, analisar, aplicar };
})();
