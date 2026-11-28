/* SDK do Firebase FALSO (Firestore em memória que imita firestore.rules + Auth), usado pelos testes de Node
   (teste-nuvem-cripto.js) e do navegador (teste-cofre-ui.py). Não faz rede. */
(function () {
  'use strict';
  const clone = (x) => JSON.parse(JSON.stringify(x));
/* ---------------- Firestore falso (espelha firestore.rules) ---------------- */
function perm(msg) { const e = new Error(msg || 'permission-denied'); e.code = 'permission-denied'; return e; }
const ks = (d) => Object.keys(d).sort().join(',');
const soTem = (d, l, obrig) => Object.keys(d).every((k) => l.includes(k)) && obrig.every((k) => k in d);
const str = (v, a, b) => typeof v === 'string' && v.length >= a && v.length <= b;
function cifBase(d) { return d.v === 1 && d.alg === 'A256GCM' && str(d.kid, 1, 16) && str(d.iv, 16, 16) && str(d.ct, 22, 90000); }
function regra(segs, d, antigo) {
  const [, , col, id] = segs;
  if (!d || typeof d !== 'object') throw perm('não é mapa');
  if (col === 'cofre') {
    if (id !== 'principal') throw perm('id do cofre');
    if (!soTem(d, ['v', 'estado', 'kid', 'rev', 'kdf', 'senha', 'recuperacao', 'criadoEm', 'atualizadoEm'], ['v', 'estado', 'kid', 'rev', 'kdf', 'senha', 'criadoEm', 'atualizadoEm'])) throw perm('chaves do cofre');
    if (d.v !== 1 || !['migrando', 'ativo'].includes(d.estado) || !(d.kdf.iter >= 100000 && d.kdf.iter <= 5000000)) throw perm('cofre');
    if (antigo ? d.rev !== antigo.rev + 1 : d.rev !== 1) throw perm('rev');
    return;
  }
  if (d.apagado === true) { if (ks(d) !== ['apagado', 'atualizadoEm'].concat(col === 'diario' ? ['data'] : col === 'festas' ? ['id'] : []).sort().join(',')) throw perm('lápide'); return; }
  if (col === 'diario') {
    if (ehCif(d)) {
      if (ks(d) !== 'alg,atualizadoEm,ct,data,iv,kid,salvoEm,v' || !cifBase(d) || d.data !== id || !str(d.salvoEm, 1, 40)) throw perm('diario cifrado');
    } else if (!(soTem(d, ['data', 'id', 'texto', 'clima', 'photagogia', 'criadoEm', 'salvoEm', 'atualizadoEm'], ['data', 'texto', 'clima', 'photagogia', 'atualizadoEm']) && d.data === id && str(d.texto, 0, 10000))) throw perm('diario normal');
  } else if (col === 'diario_log') {
    if (ehCif(d)) {
      if (ks(d) !== 'alg,atualizadoEm,ct,iv,kid,nuvemId,v' || !cifBase(d) || d.nuvemId !== id) throw perm('log cifrado');
    } else if (!(soTem(d, ['data', 'salvoEm', 'hora', 'horas', 'acao', 'nuvemId', 'atualizadoEm'], ['data', 'salvoEm', 'hora', 'horas', 'acao', 'nuvemId', 'atualizadoEm']) && d.nuvemId === id)) throw perm('log normal');
  } else if (col === 'festas') {
    if (ehCif(d)) throw perm('festas não são cifradas');
  } else throw perm('coleção desconhecida');
}
const ehCif = (d) => d && d.v !== undefined;

function criarServidor() { return { docs: new Map(), commits: 0, falharCommitsApos: null, falharLeituraCofre: false, exigirAppCheck: false, chamadas: 0 }; }
const textoCol = (srv, col) => JSON.stringify([...srv.docs].filter(([k]) => k.includes('/' + col + '/')));

function firestoreFalso(srv, dev) {
  const ref = (db, ...segs) => ({ path: segs.join('/'), segs, id: segs[segs.length - 1] });
  const porta = () => { srv.chamadas++; if (srv.exigirAppCheck && !dev.appCheckOk) throw perm('permission-denied (app check)'); };
  const gravar = (r, d) => { regra(r.segs, d, srv.docs.get(r.path)); srv.docs.set(r.path, clone(d)); };
  const getDoc = async (r) => { porta(); if (srv.falharLeituraCofre && r.path.endsWith('/cofre/principal')) { const e = new Error('unavailable'); e.code = 'unavailable'; throw e; } const v = srv.docs.get(r.path); return { exists: () => v !== undefined, data: () => clone(v) }; };
  return {
    getFirestore: () => ({ dev }),
    doc: ref, collection: ref,
    where: (campo, op, val) => ({ campo, op, val }),
    query: (col, w) => ({ col, w }),
    getDocs: async (q) => {
      porta();
      const itens = []; const pre = (q.col ? q.col.path : q.path) + '/';
      srv.docs.forEach((v, k) => { if (k.startsWith(pre) && !k.slice(pre.length).includes('/') && (!q.w || String(v[q.w.campo]) > q.w.val)) itens.push({ id: k.slice(pre.length), data: () => clone(v) }); });
      return { forEach: (fn) => itens.forEach(fn), size: itens.length };
    },
    getDoc,
    setDoc: async (r, d) => { porta(); gravar(r, d); },
    deleteDoc: async (r) => { porta(); srv.docs.delete(r.path); },
    writeBatch: () => { const ops = []; return { set: (r, d) => ops.push(['s', r, d]), delete: (r) => ops.push(['d', r]), commit: async () => {
      porta(); srv.commits++;
      if (srv.falharCommitsApos !== null && srv.commits > srv.falharCommitsApos) { const e = new Error('unavailable'); e.code = 'unavailable'; throw e; }
      const antes = new Map(srv.docs);
      try { ops.forEach((o) => (o[0] === 's' ? gravar(o[1], o[2]) : srv.docs.delete(o[1].path))); } catch (e) { srv.docs = antes; throw e; }   /* atômico */
    } }; },
    runTransaction: async (db, fn) => { porta(); const pend = []; await fn({ get: (r) => getDoc(r), set: (r, d) => pend.push([r, d]) }); pend.forEach(([r, d]) => gravar(r, d)); },
  };
}
function authFalso(dev) {
  const au = {};
  const nota = () => Promise.resolve().then(() => dev.cb && dev.cb(dev.user));
  return {
    initializeAuth: () => au, getAuth: () => au, indexedDBLocalPersistence: {}, browserLocalPersistence: {}, inMemoryPersistence: {}, browserPopupRedirectResolver: {},
    onAuthStateChanged: (a, cb) => { dev.cb = cb; nota(); return () => {}; },
    getRedirectResult: async () => null,
    signInWithEmailAndPassword: async (a, email) => { dev.user = { uid: 'u-' + email.split('@')[0], email }; nota(); return {}; },
    signOut: async () => { dev.user = null; nota(); },
    createUserWithEmailAndPassword: async () => { throw Object.assign(new Error('x'), { code: 'auth/admin-restricted-operation' }); },
    GoogleAuthProvider: function () {}, signInWithPopup: async () => ({}), signInWithRedirect: async () => ({}), sendPasswordResetEmail: async () => {},
  };
}


  const api = { criarServidor, firestoreFalso, authFalso, textoCol, regra };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else window.SdkFalso = api;
})();
