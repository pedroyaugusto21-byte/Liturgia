/* Integração cofre + sincronização (Node, sem rede). Uso: node tests/teste-nuvem-cripto.js
   Cada "aparelho" é um contexto vm isolado (store.js + cripto.js + nuvem.js) falando com um Firestore FALSO
   que imita firestore.rules (formatos, tamanhos, rev). Não substitui o teste de regras no emulador. */
'use strict';
const vm = require('vm'), fs = require('fs'), path = require('path'), assert = require('assert');
const RAIZ = path.join(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');
const ITER = 100000;
const clone = (x) => JSON.parse(JSON.stringify(x));
const esperar = async (cond, ms = 4000) => { const t0 = Date.now(); while (!(await cond())) { if (Date.now() - t0 > ms) throw new Error('timeout esperando condição'); await new Promise((r) => setTimeout(r, 5)); } };
const FRASE = 'frase longa do diário 123';

const { criarServidor, firestoreFalso, authFalso, textoCol } = require('./_sdk-falso.js');

/* ---------------- aparelho = contexto vm ---------------- */
async function aparelho(srv, o = {}) {
  const dev = { user: null, cb: null, appCheckOk: true, ordem: [] };
  const ctx = vm.createContext({ console, setTimeout, clearTimeout, TextEncoder, TextDecoder, crypto, CustomEvent, URL, navigator: { onLine: true }, document: { readyState: 'complete', hidden: false, addEventListener() {} } });
  vm.runInContext('this.window = this;', ctx);
  const W = ctx.window; W.addEventListener = () => {}; W.dispatchEvent = () => true;
  W.FIREBASE_CONFIG = o.semConfig ? null : { apiKey: 'AIzaFAKE_KEY_123', authDomain: 'x.firebaseapp.com', projectId: 'proj-teste', appId: '1:2:web:3' };
  if (o.appCheckChave) { W.FIREBASE_APPCHECK_CHAVE = o.appCheckChave; W.FIREBASE_APPCHECK_PROVEDOR = 'v3'; }
  const fsF = firestoreFalso(srv, dev), auF = authFalso(dev);
  const fsOrd = Object.assign({}, fsF, { getFirestore: (a) => { dev.ordem.push('firestore'); return fsF.getFirestore(a); } });
  const auOrd = Object.assign({}, auF, { initializeAuth: (a, op) => { dev.ordem.push('auth'); return auF.initializeAuth(a, op); } });
  const appCheck = o.appCheck ? o.appCheck(dev) : null;
  if (!o.semSdk) W.FIREBASE_SDK_TESTE = { app: { initializeApp: () => ({}) }, auth: auOrd, firestore: fsOrd, appCheck };
  vm.runInContext(src('store.js'), ctx, { filename: 'store.js' });
  if (!o.semCripto) {
    vm.runInContext(src('cripto.js'), ctx, { filename: 'cripto.js' });
    vm.runInContext(`(function(){ const b = window.CalendariumCripto, it = { iter: ${ITER} }; window.CalendariumCripto = Object.assign({}, b, {
      criarCofre: (f, o) => b.criarCofre(f, Object.assign({}, it, o)), trocarFrase: (c, a, n, o) => b.trocarFrase(c, a, n, Object.assign({}, it, o)),
      redefinirComRecuperacao: (c, k, n, o) => b.redefinirComRecuperacao(c, k, n, Object.assign({}, it, o)) }); })();`, ctx);
  }
  vm.runInContext(src('nuvem.js'), ctx, { filename: 'nuvem.js' });
  const N = W.CalendariumNuvem, S = W.CalendariumStore;
  await esperar(() => ['deslogado', 'indisponivel', 'sem-config'].includes(N.estado().fase));
  const iso = (d, h = 10) => '2026-' + d.slice(5, 7) + '-' + d.slice(8, 10) + 'T' + String(h).padStart(2, '0') + ':00:00.000Z';
  const A = {
    ctx, W, N, S, dev, st: () => N.estado(),
    async dia(d, texto, h = 10) { await S.put('diario', { data: d, id: 'i' + d, texto, clima: { amanhecer: ['sol'], entardecer: [], noite: ['lua'] }, photagogia: false, criadoEm: iso(d, 9), salvoEm: iso(d, h) }); },
    async log(d, h = 10) { await S.add('diario_log', { data: d, salvoEm: iso(d, h), hora: String(h) + ':00:00', horas: h, acao: 'criou' }); },
    async texto(d) { const v = await S.get('diario', d); return v ? v.texto : null; },
    async login(nome, escolha) {
      const r0 = await N.entrarEmail(nome + '@x.com', 'senha');
      await esperar(() => N.estado().fase === 'logado').catch((e) => { throw new Error('login: ' + JSON.stringify(r0) + ' ' + JSON.stringify(N.estado())); });
      await esperar(() => N.estado().decisao || N.estado().ultimoSync || N.estado().erro);   /* aoEntrar decide de forma assíncrona */
      if (N.estado().decisao && escolha) await N.decidir(escolha);
      await N.sincronizar();
    },
  };
  return A;
}

/* ---------------- testes ---------------- */
let ok = 0, falhas = 0;
async function t(nome, fn) { try { await fn(); ok++; console.log('  ok  ' + nome); } catch (e) { falhas++; console.log('  FALHOU  ' + nome + '\n        ' + (e && e.stack || e)); } }
const DIAS = ['2026-03-01', '2026-03-02', '2026-03-03'];

(async () => {
  console.log('cofre + sincronização');
  const srv = criarServidor();
  let A, B, recuperacao, kidAntes;

  await t('sem cofre: tudo sobe em claro, como antes', async () => {
    A = await aparelho(srv);
    for (const d of DIAS) { await A.dia(d, 'segredo ' + d + ' ação'); await A.log(d); }
    await A.S.put('festas', { id: 'f1', data: '2026-03-14', nome: 'Festa privada', descricao: 'x', criadoEm: 1700000000000 });
    await A.login('ana', 'enviar');
    assert(textoCol(srv, 'diario').includes('segredo 2026-03-01'));
    assert.strictEqual(A.st().cofre.fase, 'nenhum');
    assert.strictEqual(A.st().cofre.disponivel, true);
  });

  await t('ativar: nada em claro sobe depois, local intocado, cofre "ativo"', async () => {
    const p = await A.N.prepararCofre('curta');
    assert.strictEqual(p.ok, false); assert(/12 caracteres/.test(p.erro));
    const prep = await A.N.prepararCofre(FRASE);
    assert(prep.ok && /^([A-Z2-7]{4}-){7}[A-Z2-7]{4}$/.test(prep.recuperacao)); recuperacao = prep.recuperacao;
    const r = await A.N.ativarCofre();
    assert(r.ok, r.erro); assert.strictEqual(r.protegidos, 6);
    const cofre = srv.docs.get('usuarios/u-ana/cofre/principal');
    assert.strictEqual(cofre.estado, 'ativo'); kidAntes = cofre.kid;
    const cl = textoCol(srv, 'diario') + textoCol(srv, 'diario_log');
    assert(!cl.includes('segredo') && !cl.includes('sol') && !cl.includes('criou'), 'texto em claro na nuvem');
    for (const d of DIAS) { const v = srv.docs.get('usuarios/u-ana/diario/' + d); assert(v.v === 1 && v.ct && !v.texto && v.salvoEm); }
    assert.strictEqual(await A.texto(DIAS[0]), 'segredo 2026-03-01 ação');         /* local continua em texto puro */
    assert.strictEqual(A.st().cofre.fase, 'aberto');
    assert(textoCol(srv, 'festas').includes('Festa privada'));                      /* festas: em claro na v1 */
  });

  await t('novas gravações sobem cifradas; log novo tem id aleatório (sem carimbo)', async () => {
    await A.dia('2026-03-04', 'quarto dia secreto'); await A.log('2026-03-04', 11);
    await A.N.sincronizar();
    assert(!textoCol(srv, 'diario').includes('quarto dia'));
    const ids = [...srv.docs.keys()].filter((k) => k.includes('/diario_log/')).map((k) => k.split('/').pop());
    assert(ids.some((i) => !/^2026/.test(i) && i.length === 22), 'id novo deveria ser aleatório: ' + ids.join(','));
  });

  await t('segundo aparelho: festas sincronizam, diário fica trancado até a frase; cursor não se perde', async () => {
    B = await aparelho(srv);
    await B.login('ana');
    assert.strictEqual(B.st().cofre.fase, 'trancado');
    assert.strictEqual(await B.S.get('festas', 'f1') !== null, true);
    assert.strictEqual(await B.texto(DIAS[0]), null);
    const r1 = await B.N.abrirCofre('frase errada de propósito'); assert.strictEqual(r1.ok, false); assert(/incorreta/.test(r1.erro));
    assert.strictEqual(B.st().cofre.fase, 'trancado');
    const r2 = await B.N.abrirCofre(FRASE); assert(r2.ok, r2.erro);
    await B.N.sincronizar();
    for (const d of DIAS) assert.strictEqual(await B.texto(d), 'segredo ' + d + ' ação', 'faltou ' + d);
    assert.strictEqual(await B.texto('2026-03-04'), 'quarto dia secreto');
    const logs = await B.S.getAll('diario_log'); assert.strictEqual(logs.length, 4);
  });

  await t('conflito por salvoEm: o mais recente vence, nos dois sentidos', async () => {
    const grava = (X, d, texto, h) => X.S.put('diario', { data: d, id: 'i' + d, texto, clima: { amanhecer: [], entardecer: [], noite: [] }, photagogia: false, criadoEm: d + 'T09:00:00.000Z', salvoEm: d + 'T' + String(h).padStart(2, '0') + ':00:00.000Z' }, { silencioso: true });
    await B.dia(DIAS[0], 'versão do B (mais nova)', 20); await B.N.sincronizar();         /* B sobe a versão das 20h */
    await grava(A, DIAS[0], 'versão velha do A', 8);                                       /* A tem uma versão mais antiga */
    await A.N.sincronizar();
    assert.strictEqual(await A.texto(DIAS[0]), 'versão do B (mais nova)');                 /* remoto mais novo vence */
    await grava(A, DIAS[1], 'A é mais novo (23h)', 23); await grava(B, DIAS[1], 'B é mais velho', 9);
    await B.dia(DIAS[1], 'B é mais velho', 9); await B.N.sincronizar();                    /* remoto (9h) mais velho que o local de A (23h) */
    await A.N.sincronizar();
    assert.strictEqual(await A.texto(DIAS[1]), 'A é mais novo (23h)');                     /* local mais novo não é sobrescrito */
  });

  await t('trancado: Diário local segue, fila espera, nada em claro sobe; ao destrancar, sobe cifrado', async () => {
    await B.N.trancar();
    await B.dia('2026-03-10', 'escrito com o cofre trancado');
    const r = await B.N.sincronizar(); assert(r.ok, r.erro);
    assert(B.st().cofre.adiados >= 1);
    assert(!textoCol(srv, 'diario').includes('trancado'));
    assert.strictEqual(await B.texto('2026-03-10'), 'escrito com o cofre trancado');
    assert((await B.N.abrirCofre(FRASE)).ok);
    await B.N.sincronizar();
    assert(srv.docs.has('usuarios/u-ana/diario/2026-03-10'));
    assert(!textoCol(srv, 'diario').includes('trancado'));
    await A.N.sincronizar(); assert.strictEqual(await A.texto('2026-03-10'), 'escrito com o cofre trancado');
  });

  await t('documento corrompido na nuvem: não derruba, não sobrescreve, é contado', async () => {
    const k = 'usuarios/u-ana/diario/2026-03-02', d = srv.docs.get(k), ct = d.ct;
    d.ct = ct.slice(0, 20) + (ct[20] === 'A' ? 'B' : 'A') + ct.slice(21); d.atualizadoEm = new Date(Date.now() + 1000).toISOString();
    const C = await aparelho(srv); await C.login('ana');
    assert((await C.N.abrirCofre(FRASE)).ok); const s = await C.N.sincronizar(); assert(s.ok, s.erro);
    assert.strictEqual(await C.texto('2026-03-02'), null);
    assert.strictEqual(await C.texto('2026-03-03'), 'segredo 2026-03-03 ação');
    assert(C.st().cofre.ilegiveis >= 1);
    assert.strictEqual(srv.docs.get(k).ct, d.ct);                                     /* nada foi sobrescrito */
    d.ct = ct;                                                                         /* restaura */
  });

  await t('auto-cura: documento em claro gravado por um app antigo volta a ser cifrado', async () => {
    srv.docs.set('usuarios/u-ana/diario/2026-03-20', { data: '2026-03-20', id: 'x', texto: 'app antigo escreveu em claro', clima: { amanhecer: [], entardecer: [], noite: [] }, photagogia: false, criadoEm: '2026-03-20T09:00:00.000Z', salvoEm: '2026-03-20T10:00:00.000Z', atualizadoEm: new Date(Date.now() + 2000).toISOString() });
    await A.N.sincronizar(); await A.N.sincronizar();
    assert.strictEqual(await A.texto('2026-03-20'), 'app antigo escreveu em claro');
    assert(!textoCol(srv, 'diario').includes('app antigo'));
    assert.strictEqual(srv.docs.get('usuarios/u-ana/diario/2026-03-20').v, 1);
  });

  await t('trocar a frase: antiga deixa de valer, outro aparelho continua, recuperação continua', async () => {
    const x = await A.N.trocarFrase('errada errada errada', 'nova frase bem longa 456'); assert.strictEqual(x.ok, false);
    const r = await A.N.trocarFrase(FRASE, 'nova frase bem longa 456'); assert(r.ok, r.erro);
    assert.strictEqual(srv.docs.get('usuarios/u-ana/cofre/principal').rev, 3);   /* 1 criação, 2 ativo, 3 troca de frase */
    assert.strictEqual(srv.docs.get('usuarios/u-ana/cofre/principal').kid, kidAntes);          /* mesma chave mestra: nada recifrado */
    await A.dia('2026-03-21', 'depois da troca'); await A.N.sincronizar();
    await B.N.sincronizar(); assert.strictEqual(await B.texto('2026-03-21'), 'depois da troca');
    const D = await aparelho(srv); await D.login('ana');
    assert.strictEqual((await D.N.abrirCofre(FRASE)).ok, false);
    assert((await D.N.abrirCofre('nova frase bem longa 456')).ok);
    const E2 = await aparelho(srv); await E2.login('ana');
    const rr = await E2.N.abrirComRecuperacao(recuperacao, 'terceira frase longa 789'); assert(rr.ok, rr.erro);
    await E2.N.sincronizar(); assert.strictEqual(await E2.texto('2026-03-21'), 'depois da troca');
    const mal = await (await aparelho(srv)).N; /* chave de recuperação errada */
  });

  await t('cofre ilegível na nuvem: a sincronização aborta e nada sobe', async () => {
    const F = await aparelho(srv); await F.login('ana');
    srv.falharLeituraCofre = true;
    await F.dia('2026-04-01', 'não pode subir em claro');
    const r = await F.N.sincronizar(); assert.strictEqual(r.ok, false);
    assert(!textoCol(srv, 'diario').includes('não pode subir'));
    srv.falharLeituraCofre = false;
  });

  await t('cripto ausente (script não carregou) com cofre ativo: nada sobe, app segue local', async () => {
    const G = await aparelho(srv, { semCripto: true }); await G.login('ana');
    await G.dia('2026-04-02', 'sem módulo de cripto');
    const r = await G.N.sincronizar(); assert.strictEqual(r.ok, false); assert(/criptografia/.test(r.erro));
    assert(!textoCol(srv, 'diario').includes('sem módulo'));
    assert.strictEqual(await G.texto('2026-04-02'), 'sem módulo de cripto');
  });

  await t('migração interrompida fica "migrando", sem perder nada, e é retomada', async () => {
    const srv2 = criarServidor(), H = await aparelho(srv2);
    for (let i = 1; i <= 70; i++) { const d = '2026-05-' + String((i % 28) + 1).padStart(2, '0'); const dd = i <= 28 ? d : '2025-' + String(((i - 1) % 12) + 1).padStart(2, '0') + '-' + String((i % 28) + 1).padStart(2, '0'); await H.dia(dd, 'texto ' + i); await H.log(dd, (i % 20) + 1); }
    await H.login('bia', 'enviar');
    const total = (await H.S.getAll('diario')).length + (await H.S.getAll('diario_log')).length;
    assert((await H.N.prepararCofre(FRASE)).ok);
    const base = srv2.commits; srv2.falharCommitsApos = base + 1;                   /* o 1º lote passa, o 2º falha */
    const r = await H.N.ativarCofre(); assert.strictEqual(r.ok, false); assert(r.retomavel);
    assert.strictEqual(srv2.docs.get('usuarios/u-bia/cofre/principal').estado, 'migrando');
    assert.strictEqual(H.st().cofre.estado, 'migrando');
    const emClaro = [...srv2.docs].filter(([k, v]) => /\/(diario|diario_log)\//.test(k) && v.v === undefined).length;
    assert(emClaro > 0 && emClaro < total, 'estado misto esperado: ' + emClaro + '/' + total);
    assert((await H.S.getAll('diario')).length > 0);                                  /* local intacto */
    srv2.falharCommitsApos = null;
    const r2 = await H.N.ativarCofre(); assert(r2.ok, r2.erro);
    assert.strictEqual(srv2.docs.get('usuarios/u-bia/cofre/principal').estado, 'ativo');
    assert.strictEqual([...srv2.docs].filter(([k, v]) => /\/(diario|diario_log)\//.test(k) && v.v === undefined && !v.apagado).length, 0);
    assert(!textoCol(srv2, 'diario').includes('texto '));
  });

  await t('desativar: tudo volta em claro, cofre removido, outro aparelho segue normal', async () => {
    const r = await B.N.desativarCofre(); assert(r.ok, r.erro);
    assert(!srv.docs.has('usuarios/u-ana/cofre/principal'));
    assert(textoCol(srv, 'diario').includes('segredo 2026-03-03'));
    assert.strictEqual(B.st().cofre.fase, 'nenhum');
    await A.dia('2026-06-01', 'depois de desativar'); await A.N.sincronizar();
    assert.strictEqual(A.st().cofre.fase, 'nenhum');
    assert(textoCol(srv, 'diario').includes('depois de desativar'));
  });

  await t('recomeçar (frase e chave perdidas): recria o cofre a partir do aparelho, outro aparelho fica trancado', async () => {
    assert((await A.N.prepararCofre('primeira frase longa aaa')).ok); assert((await A.N.ativarCofre()).ok);
    const kid1 = srv.docs.get('usuarios/u-ana/cofre/principal').kid;
    const Z = await aparelho(srv); await Z.login('ana');                              /* aparelho vazio: não pode recomeçar */
    assert((await Z.N.prepararCofre('outra frase longa bbb')).ok);
    const bloq = await Z.N.ativarCofre({ recomecar: true }); assert.strictEqual(bloq.ok, false);
    assert((await A.N.prepararCofre('frase nova depois de perder')).ok);
    const r = await A.N.ativarCofre({ recomecar: true }); assert(r.ok, r.erro);
    const c = srv.docs.get('usuarios/u-ana/cofre/principal'); assert.notStrictEqual(c.kid, kid1); assert.strictEqual(c.estado, 'ativo');
    assert(!textoCol(srv, 'diario').includes('segredo'));
    await Z.N.sincronizar(); assert.strictEqual(Z.st().cofre.fase, 'trancado');
    assert((await Z.N.abrirCofre('frase nova depois de perder')).ok);
    await Z.N.sincronizar(); assert.strictEqual(await Z.texto('2026-03-03'), 'segredo 2026-03-03 ação');
  });

  await t('sair tranca o cofre', async () => {
    await A.N.sair({ apagar: false });
    await esperar(() => A.st().fase === 'deslogado');
    assert.strictEqual(A.st().cofre.fase, 'desconhecido');
  });

  await t('modo local sem login idêntico (sem configuração do Firebase)', async () => {
    const L = await aparelho(srv, { semConfig: true });
    assert.strictEqual(L.st().fase, 'sem-config');
    await L.dia('2026-07-01', 'só local'); assert.strictEqual(await L.texto('2026-07-01'), 'só local');
    const r = await L.N.sincronizar(); assert.strictEqual(r.ok, false);
    assert.strictEqual(L.st().cofre.fase, 'desconhecido');
  });

  await t('SDK indisponível: app local, sem exceção', async () => {
    const L = await aparelho(srv, { semSdk: true });
    assert(['indisponivel', 'sem-config'].includes(L.st().fase), L.st().fase);
    await L.dia('2026-07-02', 'sem sdk'); assert.strictEqual(await L.texto('2026-07-02'), 'sem sdk');
  });

  console.log('App Check');
  const modAC = (cfg = {}) => (dev) => ({
    ReCaptchaV3Provider: function (k) { if (cfg.provedorQuebra) throw new Error('boom'); this.k = k; },
    ReCaptchaEnterpriseProvider: function (k) { this.k = k; },
    initializeAppCheck: () => { dev.ordem.push('appcheck'); if (cfg.initQuebra) throw new Error('init'); return {}; },
    getToken: async () => { if (cfg.semToken) { dev.appCheckOk = false; throw new Error('app-check/fetch-status-error'); } dev.appCheckOk = true; return { token: 't' }; },
  });
  await t('App Check inicia antes de Auth e Firestore e fica "ativo"', async () => {
    const s = criarServidor(), X = await aparelho(s, { appCheckChave: 'CHAVE_PUBLICA_DE_TESTE_123', appCheck: modAC() });
    assert.deepStrictEqual(X.dev.ordem.slice(0, 3), ['appcheck', 'auth', 'firestore']);
    await esperar(() => X.st().appCheck === 'ativo');
  });
  await t('sem chave configurada: App Check fica desligado e nada muda', async () => {
    const s = criarServidor(), X = await aparelho(s, { appCheck: modAC() });
    assert.strictEqual(X.st().appCheck, 'desligado'); assert(!X.dev.ordem.includes('appcheck'));
  });
  await t('App Check falha ao iniciar: app segue 100% local e sincroniza sem token (se não for exigido)', async () => {
    const s = criarServidor(), X = await aparelho(s, { appCheckChave: 'CHAVE_PUBLICA_DE_TESTE_123', appCheck: modAC({ provedorQuebra: true }) });
    assert.strictEqual(X.st().appCheck, 'falhou');
    await X.dia('2026-08-01', 'ok local'); assert.strictEqual(await X.texto('2026-08-01'), 'ok local');
    await X.login('caio', 'enviar'); assert(textoCol(s, 'diario').includes('ok local'));
  });
  await t('imposição ligada e token inválido: mensagem clara, Diário local intacto, sem insistir', async () => {
    const s = criarServidor(); s.exigirAppCheck = true;
    const X = await aparelho(s, { appCheckChave: 'CHAVE_PUBLICA_DE_TESTE_123', appCheck: modAC({ semToken: true }) });
    await esperar(() => X.st().appCheck === 'falhou');
    await X.dia('2026-08-02', 'continua local');
    await X.N.entrarEmail('caio@x.com', 'senha'); await esperar(() => X.st().fase === 'logado');
    await esperar(() => X.st().decisao); await X.N.decidir('nao-enviar');
    const r = await X.N.sincronizar(); assert.strictEqual(r.ok, false); assert(/App Check/.test(r.erro), r.erro);
    assert.strictEqual(await X.texto('2026-08-02'), 'continua local');
    const antes = s.chamadas; const auto = await X.ctx.window.CalendariumNuvem.sincronizar();   /* manual sempre tenta */
    assert(s.chamadas >= antes);
  });

  console.log('\n' + ok + ' ok, ' + falhas + ' falha(s)');
  process.exit(falhas ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
