/* ======================================================================
   CALENDARIUM NUVEM — login (Firebase Authentication) e sincronização (Firestore)
   window.CalendariumNuvem = { disponivel, estado, onEstado, entrarEmail, entrarGoogle,
     recuperarSenha, sair, sincronizar, decidir, versaoSdk }

   - Script CLÁSSICO (como os demais). O SDK do Firebase é carregado por import() dinâmico,
     então, se a rede ou o CDN falharem, CalendariumNuvem continua existindo (estado
     "indisponível") e o site segue 100% local.
   - Local-first: o CalendariumStore continua sendo a fonte; a nuvem é uma réplica.
     Escrita: fila persistente (localStorage) → Firestore. Leitura: incremental, por
     'atualizadoEm'. Nenhum polling: só eventos (gravação, online, voltar à aba, botão).
   - Dados em  usuarios/{uid}/diario|diario_log|festas  (ver firestore.rules).
   - Conflito: vence o salvoEm mais recente (diário); log unido por nuvemId; festas por id
     (exclusão = documento com apagado:true).
   ====================================================================== */
(function () {
  'use strict';

  const VERSAO_SDK = '13.4.0';
  const BASE = 'https://www.gstatic.com/firebasejs/' + VERSAO_SDK + '/';
  const COLECOES = ['diario', 'diario_log', 'festas'];
  const LS_FILA = 'calendarium.nuvem.fila.', LS_META = 'calendarium.nuvem.meta';
  const PRAZO_REDE = Number(window.FIREBASE_PRAZO_MS) > 0 ? Number(window.FIREBASE_PRAZO_MS) : 20000;   /* só os testes mudam isto */
  const TEXTO_MAX = 10000, LOTE = 400, MARGEM_RELOGIO = 10 * 60 * 1000, ESPERA_ENVIO = 800, INTERVALO_MIN = 20000;
  const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
  const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;
  const RE_HORA = /^\d{2}:\d{2}:\d{2}$/;
  const PERIODOS = ['amanhecer', 'entardecer', 'noite'];

  const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
  const ehObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const clonar = (v) => JSON.parse(JSON.stringify(v));
  const store = () => window.CalendariumStore || null;
  const agora = () => new Date().toISOString();
  const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : '');

  function dataValida(s) {
    if (typeof s !== 'string' || !RE_DATA.test(s)) return false;
    const y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    if (y < 100) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
  }

  /* ---------- armazenamento local da própria sincronização (fila e meta) ---------- */
  const memLS = Object.create(null);
  const lsGet = (k) => { try { const v = window.localStorage.getItem(k); return v === null ? (memLS[k] === undefined ? null : memLS[k]) : v; } catch (e) { return memLS[k] === undefined ? null : memLS[k]; } };
  const lsSet = (k, v) => { memLS[k] = v; try { window.localStorage.setItem(k, v); } catch (e) { /* segue na memória */ } };
  const lsDel = (k) => { delete memLS[k]; try { window.localStorage.removeItem(k); } catch (e) { /* ignora */ } };
  const lsJson = (k, fb) => { const t = lsGet(k); if (t === null) return fb; try { return JSON.parse(t); } catch (e) { return fb; } };

  /* ---------- estado público ---------- */
  const E = { fase: 'carregando', usuario: null, sincronizando: false, pendencias: 0, ultimoSync: null, erro: null, offline: false, decisao: null };
  const ouvintesEstado = [];
  const copiaEstado = () => ({ fase: E.fase, usuario: E.usuario ? { uid: E.usuario.uid, email: E.usuario.email } : null, sincronizando: E.sincronizando, pendencias: E.pendencias, ultimoSync: E.ultimoSync, erro: E.erro, offline: E.offline, decisao: E.decisao ? clonar(E.decisao) : null });
  function notificar() { const c = copiaEstado(); ouvintesEstado.slice().forEach((fn) => safe(() => fn(c))); }
  function onEstado(fn) {
    if (typeof fn !== 'function') return () => {};
    ouvintesEstado.push(fn);
    return () => { const i = ouvintesEstado.indexOf(fn); if (i >= 0) ouvintesEstado.splice(i, 1); };
  }

  /* ---------- erros em português ---------- */
  function msgErro(e) {
    const c = e && (e.code || e.message) ? String(e.code || e.message) : '';
    const mapa = {
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/wrong-password': 'E-mail ou senha incorretos.',
      'auth/user-not-found': 'E-mail ou senha incorretos.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/missing-password': 'Digite a senha.',
      'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
      'auth/network-request-failed': 'Sem conexão com a internet. Tente de novo quando estiver online.',
      'auth/popup-blocked': 'O navegador bloqueou a janela de login do Google. Permita pop-ups para este site.',
      'auth/popup-closed-by-user': 'A janela de login foi fechada antes de terminar.',
      'auth/cancelled-popup-request': 'A janela de login foi fechada antes de terminar.',
      'auth/unauthorized-domain': 'Este endereço do site não está autorizado. No console do Firebase, vá em Authentication → Configurações → Domínios autorizados e adicione o domínio.',
      'auth/admin-restricted-operation': 'O cadastro de novas contas está fechado. Entre com a conta já criada.',
      'auth/operation-not-allowed': 'Este método de login não está ativado no console do Firebase.',
      'auth/user-disabled': 'Esta conta foi desativada.',
      'auth/web-storage-unsupported': 'O navegador bloqueou o armazenamento necessário para o login.',
      'auth/operation-not-supported-in-this-environment': 'Este navegador não permite esse tipo de login.',
      'permission-denied': 'O servidor recusou a operação. Confira se as regras do Firestore foram publicadas e se você entrou com a conta certa.',
      'unavailable': 'Serviço indisponível no momento. Tentaremos de novo.',
      'resource-exhausted': 'Limite diário gratuito do Firebase atingido. Tentaremos amanhã.',
      'timeout': 'A nuvem não respondeu. Tentaremos de novo quando houver conexão.',
    };
    const chave = Object.keys(mapa).find((k) => c === k || c.indexOf(k) >= 0);
    return chave ? mapa[chave] : 'Não foi possível concluir a operação. Tente novamente.';
  }
  const comTimeout = (p, ms) => {
    let t;
    return Promise.race([Promise.resolve(p), new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error('timeout'), { code: 'timeout' })), ms); })])
      .finally(() => clearTimeout(t));
  };

  /* ---------- validação/limpeza (vale para o que SOBE e para o que DESCE) ---------- */
  function limparDiario(d, id) {
    if (!ehObj(d) || !dataValida(id) || d.data !== id) return null;
    if (typeof d.texto !== 'string' || d.texto.length > TEXTO_MAX) return null;
    const clima = {};
    PERIODOS.forEach((p) => {
      const a = ehObj(d.clima) && Array.isArray(d.clima[p]) ? d.clima[p] : [];
      clima[p] = a.filter((t) => typeof t === 'string' && t.length > 0 && t.length <= 20).slice(0, 12);
    });
    return { data: id, id: str(d.id, 64), texto: d.texto, clima, photagogia: d.photagogia === true, criadoEm: str(d.criadoEm, 40), salvoEm: str(d.salvoEm, 40) };
  }
  function limparLog(d, id) {
    if (!ehObj(d) || typeof id !== 'string' || !id || id.length > 80) return null;
    if (!dataValida(d.data) || typeof d.salvoEm !== 'string' || !d.salvoEm || d.salvoEm.length > 40) return null;
    if (typeof d.hora !== 'string' || !RE_HORA.test(d.hora)) return null;
    if (typeof d.horas !== 'number' || !isFinite(d.horas) || d.horas < 0 || d.horas > 24) return null;
    if (d.acao !== 'criou' && d.acao !== 'atualizou') return null;
    return { data: d.data, salvoEm: d.salvoEm, hora: d.hora, horas: d.horas, acao: d.acao, nuvemId: id };
  }
  function limparFesta(d, id) {
    if (!ehObj(d) || typeof id !== 'string' || !RE_ID.test(id) || d.id !== id) return null;
    if (!dataValida(d.data)) return null;
    const nome = typeof d.nome === 'string' ? d.nome.replace(/\s+/g, ' ').trim() : '';
    if (!nome || nome.length > 60) return null;
    const descricao = typeof d.descricao === 'string' ? d.descricao : '';
    if (descricao.length > 280) return null;
    if (typeof d.criadoEm !== 'number' || !isFinite(d.criadoEm)) return null;
    return { id, data: d.data, nome, descricao, criadoEm: d.criadoEm };
  }
  const LIMPAR = { diario: limparDiario, diario_log: limparLog, festas: limparFesta };
  const lapide = (n, id) => (n === 'diario' ? { data: id, apagado: true, atualizadoEm: agora() } : n === 'festas' ? { id, apagado: true, atualizadoEm: agora() } : { apagado: true, atualizadoEm: agora() });

  function novoNuvemId(salvoEm) {
    const base = String(salvoEm || agora()).replace(/[^0-9A-Za-z:.\-]/g, '').slice(0, 40) || agora();
    return base + '_' + Math.random().toString(36).slice(2, 6);
  }

  /* ---------- meta e fila (persistentes) ---------- */
  let meta = { uid: null, cursor: null, enviarLocais: false };
  function lerMeta() { const m = lsJson(LS_META, null); meta = ehObj(m) ? { uid: typeof m.uid === 'string' ? m.uid : null, cursor: typeof m.cursor === 'string' ? m.cursor : null, enviarLocais: m.enviarLocais === true } : { uid: null, cursor: null, enviarLocais: false }; }
  function gravarMeta() { lsSet(LS_META, JSON.stringify(meta)); }
  let fila = [], filaUid = null, contador = 0;
  function carregarFila(uid) {
    filaUid = uid;
    const f = uid ? lsJson(LS_FILA + uid, []) : [];
    fila = (Array.isArray(f) ? f : []).filter((i) => ehObj(i) && COLECOES.indexOf(i.n) >= 0 && (typeof i.k === 'string' || typeof i.k === 'number') && (i.op === 'put' || i.op === 'delete')).map((i) => ({ n: i.n, k: i.k, op: i.op, t: ++contador }));
    E.pendencias = fila.length;
  }
  function gravarFila() { if (filaUid) { if (fila.length) lsSet(LS_FILA + filaUid, JSON.stringify(fila.map((i) => ({ n: i.n, k: i.k, op: i.op })))); else lsDel(LS_FILA + filaUid); } E.pendencias = fila.length; }

  /* ---------- SDK ---------- */
  let fb = null;                 /* { auth, fs, app, db, a } depois de carregar */
  const online = () => safe(() => navigator.onLine !== false, true);
  const pode = () => !!(fb && E.fase === 'logado' && E.usuario && !E.decisao && meta.uid === E.usuario.uid);
  const caminho = (n) => ['usuarios', E.usuario.uid, n];

  let timerEnvio = null;
  function agendarEnvio() {
    if (timerEnvio || !pode()) return;
    timerEnvio = setTimeout(() => { timerEnvio = null; sincronizar(false); }, ESPERA_ENVIO);
  }

  /* o store avisa cada gravação/remoção (menos as feitas por esta própria sincronização) */
  function aoMudarStore(ev) {
    if (!ev || COLECOES.indexOf(ev.nome) < 0 || (ev.op !== 'put' && ev.op !== 'add' && ev.op !== 'delete')) return;
    if (E.decisao) return;
    const uid = (E.usuario && E.usuario.uid) || meta.uid;
    if (!uid || meta.uid !== uid) return;
    if (filaUid !== uid) carregarFila(uid);
    const op = ev.op === 'delete' ? 'delete' : 'put';
    const i = fila.findIndex((x) => x.n === ev.nome && String(x.k) === String(ev.chave));
    if (i >= 0) { fila[i].op = op; fila[i].t = ++contador; } else fila.push({ n: ev.nome, k: ev.chave, op, t: ++contador });
    gravarFila(); notificar(); agendarEnvio();
  }

  /* ---------- envio ---------- */
  async function montarDocs(itens) {
    const S = store(), docs = [], concluidos = [];
    for (const it of itens) {
      if (it.op === 'delete') { docs.push({ n: it.n, id: String(it.k), dados: lapide(it.n, String(it.k)), item: it }); continue; }
      let v = await S.get(it.n, it.k);
      if (!v) { concluidos.push(it); continue; }          /* sumiu localmente: nada a enviar */
      let id;
      if (it.n === 'diario_log') {
        if (!v.nuvemId) { v = Object.assign({}, v, { nuvemId: novoNuvemId(v.salvoEm) }); await S.put('diario_log', v, { silencioso: true }); }
        id = v.nuvemId;
      } else id = String(it.k);
      const limpo = LIMPAR[it.n](v, id);
      if (!limpo) { concluidos.push(it); continue; }      /* inválido: não sobe (as regras também recusariam) */
      docs.push({ n: it.n, id, dados: Object.assign({}, limpo, { atualizadoEm: agora() }), item: it });
    }
    return { docs, concluidos };
  }
  async function gravarDocs(docs) {
    for (let i = 0; i < docs.length; i += LOTE) {
      const b = fb.fs.writeBatch(fb.db);
      docs.slice(i, i + LOTE).forEach((d) => b.set(fb.fs.doc(fb.db, ...caminho(d.n), d.id), d.dados));
      await comTimeout(b.commit(), PRAZO_REDE);
    }
  }
  async function enviarFila() {
    if (!pode() || !online() || !fila.length) return 0;
    const itens = fila.slice();
    const { docs, concluidos } = await montarDocs(itens);
    await gravarDocs(docs);
    const feitos = concluidos.concat(docs.map((d) => d.item));
    fila = fila.filter((x) => !feitos.some((f) => f.n === x.n && String(f.k) === String(x.k) && f.t === x.t));   /* o que mudou durante o envio continua na fila */
    gravarFila();
    return docs.length;
  }

  /* ---------- recebimento ---------- */
  const novoCtx = () => ({ diario: [], logs: 0, festas: false, tudo: false, recebidos: 0, invalidos: 0, maxAtual: '' });
  async function aplicarRemoto(n, id, d, ctx, locais) {
    const S = store();
    if (ehObj(d) && typeof d.atualizadoEm === 'string' && d.atualizadoEm > ctx.maxAtual) ctx.maxAtual = d.atualizadoEm;
    if (ehObj(d) && d.apagado === true) {
      if (n === 'festas' && locais.festas[id]) { await S.delete('festas', id, { silencioso: true }); ctx.festas = true; ctx.recebidos++; }
      return;
    }
    const limpo = LIMPAR[n](d, id);
    if (!limpo) { ctx.invalidos++; return; }
    if (n === 'diario') {
      const loc = locais.diario[id];
      if (!loc || String(limpo.salvoEm) > String(loc.salvoEm || '')) { await S.put('diario', limpo, { silencioso: true }); ctx.diario.push(id); ctx.recebidos++; }
    } else if (n === 'festas') {
      if (!locais.festas[id]) { await S.put('festas', limpo, { silencioso: true }); ctx.festas = true; ctx.recebidos++; }
    } else if (!locais.logs[id]) { await S.add('diario_log', limpo, { silencioso: true }); ctx.logs++; ctx.recebidos++; }
  }
  async function lerLocais() {
    const S = store(), out = { diario: {}, logs: {}, festas: {}, listaLogs: [] };
    (await S.getAll('diario') || []).forEach((r) => { if (r && typeof r.data === 'string') out.diario[r.data] = r; });
    (await S.getAll('festas') || []).forEach((r) => { if (r && typeof r.id === 'string') out.festas[r.id] = r; });
    out.listaLogs = (await S.getAll('diario_log') || []).filter((r) => ehObj(r));
    out.listaLogs.forEach((r) => { if (typeof r.nuvemId === 'string') out.logs[r.nuvemId] = r; });
    return out;
  }
  async function lerColecao(n, desde) {
    const q = desde ? fb.fs.query(fb.fs.collection(fb.db, ...caminho(n)), fb.fs.where('atualizadoEm', '>', desde)) : fb.fs.collection(fb.db, ...caminho(n));
    const snap = await comTimeout(fb.fs.getDocs(q), PRAZO_REDE);
    const out = [];
    snap.forEach((d) => out.push({ id: d.id, dados: d.data() }));
    return out;
  }
  function avisarDados(ctx) {
    if (!ctx.diario.length && !ctx.logs && !ctx.festas && !ctx.tudo) return;
    safe(() => window.dispatchEvent(new CustomEvent('calendarium:nuvem-dados', { detail: { diario: ctx.diario.slice(), logs: ctx.logs > 0, festas: ctx.festas, tudo: ctx.tudo } })));
  }

  async function puxarIncremental() {
    if (!pode() || !online()) return { recebidos: 0 };
    const ctx = novoCtx(), locais = await lerLocais();
    const desde = new Date(Math.max(0, Date.parse(meta.cursor) - MARGEM_RELOGIO)).toISOString();
    for (const n of COLECOES) { for (const r of await lerColecao(n, desde)) await aplicarRemoto(n, r.id, r.dados, ctx, locais); }
    if (ctx.maxAtual && ctx.maxAtual > meta.cursor) { meta.cursor = ctx.maxAtual; gravarMeta(); }
    avisarDados(ctx);
    return ctx;
  }
  /* primeiro contato com a conta neste aparelho (ou após troca): lê tudo; opcionalmente envia o que só existe aqui */
  async function reconciliarCompleto(enviar) {
    if (!fb || !E.usuario || !online()) throw Object.assign(new Error('offline'), { code: 'auth/network-request-failed' });
    const S = store(), ctx = novoCtx(), locais = await lerLocais(), remotos = { diario: {}, logs: {}, festas: {} };
    for (const n of COLECOES) {
      for (const r of await lerColecao(n, null)) {
        if (n === 'diario') remotos.diario[r.id] = r.dados; else if (n === 'festas') remotos.festas[r.id] = r.dados; else remotos.logs[r.id] = r.dados;
        await aplicarRemoto(n, r.id, r.dados, ctx, locais);
      }
    }
    let enviados = 0;
    if (enviar) {
      const docs = [];
      Object.keys(locais.diario).forEach((dia) => {
        const loc = limparDiario(locais.diario[dia], dia), rem = remotos.diario[dia];
        if (loc && (!rem || (rem.apagado !== true && String(loc.salvoEm) > String(rem.salvoEm || '')))) docs.push({ n: 'diario', id: dia, dados: Object.assign({}, loc, { atualizadoEm: agora() }) });
      });
      Object.keys(locais.festas).forEach((id) => {
        const loc = limparFesta(locais.festas[id], id);
        if (loc && !remotos.festas[id]) docs.push({ n: 'festas', id, dados: Object.assign({}, loc, { atualizadoEm: agora() }) });
      });
      for (const r of locais.listaLogs) {
        let v = r;
        if (!v.nuvemId) { v = Object.assign({}, v, { nuvemId: novoNuvemId(v.salvoEm) }); await S.put('diario_log', v, { silencioso: true }); }
        if (remotos.logs[v.nuvemId]) continue;
        const loc = limparLog(v, v.nuvemId);
        if (loc) docs.push({ n: 'diario_log', id: v.nuvemId, dados: Object.assign({}, loc, { atualizadoEm: agora() }) });
      }
      await gravarDocs(docs);
      enviados = docs.length;
    }
    ctx.enviados = enviados;
    meta.cursor = agora();            /* o que chegar depois tem atualizadoEm maior (a leitura incremental ainda recua 10 min, por causa de relógios) */
    meta.enviarLocais = false;
    gravarMeta();
    avisarDados(ctx);
    return ctx;
  }

  /* ---------- sincronização (serializada) ---------- */
  let cadeia = Promise.resolve();
  const serializar = (fn) => { const r = cadeia.then(() => fn()); cadeia = r.catch(() => {}); return r; };
  let ultimaTentativa = 0;

  function sincronizar(manual) {
    return serializar(async () => {
      if (!pode()) return { ok: false, erro: E.decisao ? 'Responda primeiro à pergunta pendente.' : 'Entre na conta para sincronizar.' };
      if (!online()) { E.offline = true; notificar(); return { ok: false, erro: 'Sem conexão. As alterações ficam na fila.' }; }
      ultimaTentativa = Date.now();
      E.sincronizando = true; E.erro = null; notificar();
      try {
        let enviados = await enviarFila(), recebidos = 0;
        if (meta.cursor) recebidos = (await puxarIncremental()).recebidos || 0;
        else { const c = await reconciliarCompleto(meta.enviarLocais); recebidos = c.recebidos || 0; enviados += c.enviados || 0; }
        E.ultimoSync = agora(); E.erro = null;
        return { ok: true, enviados, recebidos };
      } catch (e) {
        E.erro = msgErro(e);
        return { ok: false, erro: E.erro };
      } finally { E.sincronizando = false; notificar(); }
    });
  }

  /* ---------- entrada na conta ---------- */
  async function contarLocais() {
    const S = store();
    if (!S) return { diario: 0, diario_log: 0, festas: 0, total: 0 };
    const d = (await S.getAll('diario') || []).length, l = (await S.getAll('diario_log') || []).length, f = (await S.getAll('festas') || []).length;
    return { diario: d, diario_log: l, festas: f, total: d + l + f };
  }
  function aoEntrar() {
    return serializar(async () => {
      const u = E.usuario;
      if (!u || !store()) return;
      lerMeta();
      const locais = await contarLocais();
      try {
        if (meta.uid && meta.uid !== u.uid) {
          if (locais.total > 0) { E.decisao = { tipo: 'outra-conta', locais }; notificar(); return; }
          meta = { uid: u.uid, cursor: null, enviarLocais: false }; gravarMeta(); carregarFila(u.uid);
        } else if (!meta.uid) {
          if (locais.total > 0) { E.decisao = { tipo: 'migracao', locais }; notificar(); return; }
          meta = { uid: u.uid, cursor: null, enviarLocais: false }; gravarMeta(); carregarFila(u.uid);
        } else carregarFila(u.uid);
      } finally { notificar(); }
    }).then(() => (pode() ? sincronizar(false) : null));
  }

  function aoMudarUsuario(user) {
    if (!user) {
      if (timerEnvio) { clearTimeout(timerEnvio); timerEnvio = null; }
      E.usuario = null; E.decisao = null; E.sincronizando = false; E.fase = fb ? 'deslogado' : E.fase;
      lerMeta(); carregarFila(meta.uid);      /* edições feitas sem login continuam na fila da última conta */
      notificar(); return;
    }
    E.usuario = { uid: String(user.uid), email: String(user.email || '') };
    E.fase = 'logado'; E.erro = null; notificar();
    aoEntrar();
  }

  async function entrar(fn) {
    if (!fb) return { ok: false, erro: 'Login indisponível neste momento.' };
    try { await fn(); return { ok: true }; } catch (e) { return { ok: false, erro: msgErro(e), codigo: e && e.code ? String(e.code) : '' }; }
  }
  function entrarEmail(email, senha) {
    const e = typeof email === 'string' ? email.trim() : '', s = typeof senha === 'string' ? senha : '';
    if (!e) return Promise.resolve({ ok: false, erro: 'Digite o e-mail.' });
    if (!s) return Promise.resolve({ ok: false, erro: 'Digite a senha.' });
    return entrar(() => fb.a.signInWithEmailAndPassword(fb.auth, e, s));
  }
  async function entrarGoogle() {
    if (!fb) return { ok: false, erro: 'Login indisponível neste momento.' };
    const p = new fb.a.GoogleAuthProvider();
    safe(() => p.setCustomParameters({ prompt: 'select_account' }));
    try { await fb.a.signInWithPopup(fb.auth, p, fb.a.browserPopupRedirectResolver); return { ok: true }; }
    catch (e) {
      const c = e && e.code ? String(e.code) : '';
      if (c === 'auth/popup-blocked' || c === 'auth/operation-not-supported-in-this-environment') {
        try { await fb.a.signInWithRedirect(fb.auth, p, fb.a.browserPopupRedirectResolver); return { ok: true, redirecionando: true }; } catch (e2) { return { ok: false, erro: msgErro(e2), codigo: e2 && e2.code ? String(e2.code) : '' }; }
      }
      return { ok: false, erro: msgErro(e), codigo: c };
    }
  }
  function recuperarSenha(email) {
    const e = typeof email === 'string' ? email.trim() : '';
    if (!e) return Promise.resolve({ ok: false, erro: 'Digite o e-mail para receber o link.' });
    return entrar(() => fb.a.sendPasswordResetEmail(fb.auth, e)).then((r) => (r.ok ? { ok: true, aviso: 'Se este e-mail tiver conta, enviamos um link para criar uma nova senha.' } : r));
  }

  /* sair: opcoes = { apagar: bool, forcar: bool } */
  function sair(opcoes) {
    const o = ehObj(opcoes) ? opcoes : {};
    return serializar(async () => {
      if (!fb || !E.usuario) return { ok: false, erro: 'Você não está conectado.' };
      if (pode() && online() && fila.length) {
        try { await enviarFila(); } catch (e) { E.erro = msgErro(e); }
      }
      if (fila.length && !o.forcar) return { ok: false, pendentes: fila.length, erro: fila.length + ' alteração(ões) ainda não subiram para a nuvem.' };
      if (timerEnvio) { clearTimeout(timerEnvio); timerEnvio = null; }
      const uid = E.usuario.uid;
      try { await fb.a.signOut(fb.auth); } catch (e) { return { ok: false, erro: msgErro(e) }; }
      if (o.apagar) {
        const S = store();
        if (S && typeof S.clearAll === 'function') await S.clearAll();
        lsDel(LS_FILA + uid); lsDel(LS_META);
        meta = { uid: null, cursor: null, enviarLocais: false }; fila = []; filaUid = null; E.pendencias = 0;
        const ctx = novoCtx(); ctx.tudo = true; avisarDados(ctx);
      }
      return { ok: true, apagou: !!o.apagar };
    });
  }

  /* resposta às perguntas de primeiro login / troca de conta */
  function decidir(escolha) {
    return serializar(async () => {
      const d = E.decisao, u = E.usuario, S = store();
      if (!d || !u || !S || !fb) return { ok: false, erro: 'Nada pendente.' };
      try {
        if (d.tipo === 'outra-conta') {
          if (escolha === 'cancelar') { E.decisao = null; await fb.a.signOut(fb.auth); return { ok: true, saiu: true }; }
          if (escolha !== 'apagar-local') return { ok: false, erro: 'Escolha inválida.' };
          if (!online()) return { ok: false, erro: 'Sem conexão. Tente de novo quando estiver online.' };
          const antigo = meta.uid;
          await S.clearAll();
          if (antigo) lsDel(LS_FILA + antigo);
          meta = { uid: u.uid, cursor: null, enviarLocais: false }; gravarMeta(); carregarFila(u.uid);
          E.decisao = null; notificar();
          const ctx = novoCtx(); ctx.tudo = true; avisarDados(ctx);
        } else {
          if (escolha !== 'enviar' && escolha !== 'nao-enviar') return { ok: false, erro: 'Escolha inválida.' };
          if (!online()) return { ok: false, erro: 'Sem conexão. Tente de novo quando estiver online.' };
          meta = { uid: u.uid, cursor: null, enviarLocais: escolha === 'enviar' }; gravarMeta(); carregarFila(u.uid);
          E.decisao = null; notificar();
        }
      } catch (e) { return { ok: false, erro: msgErro(e) }; }
      return { ok: true };
    }).then((r) => {
      if (!r.ok || r.saiu) return r;
      return sincronizar(true).then((s) => Object.assign({ ok: s.ok }, s));
    });
  }

  /* ---------- inicialização ---------- */
  function configValida(c) {
    return ehObj(c) && ['apiKey', 'authDomain', 'projectId', 'appId'].every((k) => typeof c[k] === 'string' && c[k].length > 5 && !/COLE|SEU_|YOUR_/i.test(c[k]));
  }
  async function carregarSdk() {
    const [app, auth, fs] = await Promise.all([import(BASE + 'firebase-app.js'), import(BASE + 'firebase-auth.js'), import(BASE + 'firebase-firestore.js')]);
    const a = app.initializeApp(window.FIREBASE_CONFIG);
    let au;
    try { au = auth.initializeAuth(a, { persistence: [auth.indexedDBLocalPersistence, auth.browserLocalPersistence, auth.inMemoryPersistence], popupRedirectResolver: auth.browserPopupRedirectResolver }); }
    catch (e) { au = auth.getAuth(a); }
    fb = { app: a, auth: au, a: auth, fs, db: fs.getFirestore(a) };
  }
  async function iniciar() {
    try {
      await carregarSdk();
      api.disponivel = true; E.fase = 'deslogado'; notificar();
      safe(() => fb.a.getRedirectResult(fb.auth, fb.a.browserPopupRedirectResolver).catch((e) => { E.erro = msgErro(e); notificar(); }));
      fb.a.onAuthStateChanged(fb.auth, aoMudarUsuario, (e) => { E.erro = msgErro(e); notificar(); });
    } catch (e) { E.fase = 'indisponivel'; E.erro = 'Não foi possível carregar o login (sem internet?). O diário segue funcionando só neste aparelho.'; notificar(); }
  }

  const api = { disponivel: false, versaoSdk: VERSAO_SDK, estado: copiaEstado, onEstado, entrarEmail, entrarGoogle, recuperarSenha, sair, sincronizar: () => sincronizar(true), decidir };
  window.CalendariumNuvem = api;

  E.offline = !online();
  lerMeta(); carregarFila(meta.uid);
  if (!configValida(window.FIREBASE_CONFIG)) { E.fase = 'sem-config'; return; }
  const S0 = store();
  if (S0 && typeof S0.onChange === 'function') S0.onChange(aoMudarStore);
  safe(() => window.addEventListener('online', () => { E.offline = false; notificar(); if (pode()) sincronizar(false); }));
  safe(() => window.addEventListener('offline', () => { E.offline = true; notificar(); }));
  safe(() => document.addEventListener('visibilitychange', () => { if (!document.hidden && pode() && Date.now() - ultimaTentativa > (typeof window.FIREBASE_INTERVALO_MS === 'number' ? window.FIREBASE_INTERVALO_MS : INTERVALO_MIN)) sincronizar(false); }));
  if (document.readyState === 'complete') iniciar(); else window.addEventListener('load', iniciar, { once: true });
})();
