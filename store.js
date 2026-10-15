/* ======================================================================
   CALENDARIUM STORE
   Camada de dados assíncrona e isolada (pode ser trocada por REST depois).
   Stores (esquema v1): festas (chave 'id'), diario (chave 'data' = 'AAAA-MM-DD'),
   diario_log (autoincremento, chave 'seq').
   Backends, em ordem de preferência: IndexedDB → localStorage
   (chaves 'calendarium.store.<nome>') → memória. Nenhum método lança exceção
   nem rejeita a promessa: em falha total devolvem null / [] / {ok:false}.
   ====================================================================== */
(function () {
  'use strict';

  const DB_NAME = 'calendarium', DB_VERSION = 1;
  const LS_PREFIX = 'calendarium.store.';
  const SCHEMA = {
    festas:     { keyPath: 'id',   auto: false },
    diario:     { keyPath: 'data', auto: false },
    diario_log: { keyPath: 'seq',  auto: true },
  };
  const NOMES = Object.keys(SCHEMA);
  const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

  const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
  const clonar = (v) => JSON.parse(JSON.stringify(v));
  const ehObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  /* chave do registro: null se ausente/ inválida */
  function chaveDe(nome, valor) {
    if (!ehObj(valor)) return null;
    const k = valor[SCHEMA[nome].keyPath];
    if (k === undefined || k === null || k === '' || k === '__proto__') return null;
    if (typeof k !== 'string' && typeof k !== 'number') return null;
    return k;
  }
  const comparar = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  /* ---------- backend em "tabelas" (localStorage e memória compartilham a lógica) ---------- */
  function backendTabelas(nomeBackend, carregar, salvar) {
    return {
      nome: nomeBackend,
      get(n, k) {
        const t = carregar(n); const v = t.itens[String(k)];
        return v === undefined ? null : clonar(v);
      },
      put(n, v) {
        const kp = SCHEMA[n].keyPath, t = carregar(n);
        let k = chaveDe(n, v);
        const reg = clonar(v);
        if (k === null) {
          if (!SCHEMA[n].auto) return null;
          k = ++t.seq; reg[kp] = k;
        } else if (SCHEMA[n].auto && typeof k === 'number' && k > t.seq) t.seq = k;
        t.itens[String(k)] = reg; salvar(n, t);
        return k;
      },
      add(n, v) {
        if (!SCHEMA[n].auto) return this.put(n, v);
        if (!ehObj(v)) return null;
        const t = carregar(n), reg = clonar(v), k = ++t.seq;
        reg[SCHEMA[n].keyPath] = k; t.itens[String(k)] = reg; salvar(n, t);
        return k;
      },
      delete(n, k) {
        const t = carregar(n);
        if (t.itens[String(k)] !== undefined) { delete t.itens[String(k)]; salvar(n, t); }
        return true;
      },
      getAll(n) {
        const t = carregar(n), kp = SCHEMA[n].keyPath;
        return Object.keys(t.itens).map((k) => clonar(t.itens[k]))
          .sort((a, b) => comparar(a[kp], b[kp]));
      },
    };
  }
  const tabelaVazia = () => ({ seq: 0, itens: Object.create(null) });

  function backendLS() {
    const ls = window.localStorage;                       /* pode lançar (bloqueado) */
    const teste = LS_PREFIX + '__teste';
    ls.setItem(teste, '1'); ls.removeItem(teste);         /* disponibilidade real (modo privado, cota) */
    const carregar = (n) => {
      const t = safe(() => JSON.parse(ls.getItem(LS_PREFIX + n)), null);
      if (ehObj(t) && ehObj(t.itens)) {
        const itens = Object.create(null);
        Object.keys(t.itens).forEach((k) => { itens[k] = t.itens[k]; });
        return { seq: Number(t.seq) || 0, itens };
      }
      return tabelaVazia();
    };
    const salvar = (n, t) => ls.setItem(LS_PREFIX + n, JSON.stringify(t));
    return backendTabelas('localStorage', carregar, salvar);
  }

  function backendMemoria() {
    const dados = {};
    const carregar = (n) => (dados[n] || (dados[n] = tabelaVazia()));
    return backendTabelas('memoria', carregar, () => {});
  }

  /* ---------- backend IndexedDB ---------- */
  function abrirIDB() {
    return new Promise((resolve) => {
      let feito = false;
      const fim = (db) => { if (!feito) { feito = true; resolve(db); } };
      try {
        if (!window.indexedDB) return fim(null);
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          NOMES.forEach((n) => {
            if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: SCHEMA[n].keyPath, autoIncrement: SCHEMA[n].auto });
          });
        };
        req.onsuccess = () => {
          if (feito) { safe(() => req.result.close()); return; }   /* chegou depois do prazo */
          fim(req.result);
        };
        req.onerror = (e) => { safe(() => e.preventDefault()); fim(null); };
        req.onblocked = () => fim(null);
        setTimeout(() => fim(null), 4000);
      } catch (e) { fim(null); }
    });
  }

  function backendIDB(db) {
    safe(() => { db.onversionchange = () => db.close(); });
    const tx = (nome, modo, fn) => new Promise((resolve, reject) => {
      let t, res = null;
      try { t = db.transaction(nome, modo); } catch (e) { return reject(e); }
      t.oncomplete = () => resolve(res);
      t.onerror = () => reject(t.error || new Error('idb'));
      t.onabort = () => reject(t.error || new Error('idb abort'));
      try {
        const r = fn(t.objectStore(nome));
        r.onsuccess = () => { res = r.result; };
      } catch (e) { reject(e); }
    });
    return {
      nome: 'indexedDB',
      get: (n, k) => tx(n, 'readonly', (s) => s.get(k)).then((v) => (v === undefined ? null : v)),
      put: (n, v) => {
        if (chaveDe(n, v) === null && !SCHEMA[n].auto) return Promise.resolve(null);
        return tx(n, 'readwrite', (s) => s.put(v));
      },
      add: (n, v) => {
        if (!ehObj(v)) return Promise.resolve(null);
        return tx(n, 'readwrite', (s) => (SCHEMA[n].auto ? s.add(v) : s.put(v)));
      },
      delete: (n, k) => tx(n, 'readwrite', (s) => s.delete(k)).then(() => true),
      getAll: (n) => tx(n, 'readonly', (s) => s.getAll()).then((v) => v || []),
    };
  }

  /* ---------- fachada: escolhe o backend uma vez e rebaixa em caso de falha ---------- */
  let fila = null, iniciando = null;
  function iniciar() {
    if (!iniciando) {
      iniciando = abrirIDB().then((db) => {
        const f = [];
        if (db) f.push(backendIDB(db));
        const ls = safe(backendLS, null); if (ls) f.push(ls);
        f.push(backendMemoria());
        fila = f;
      });
    }
    return iniciando;
  }

  async function executar(op, args, vazio) {
    if (NOMES.indexOf(args[0]) < 0) return vazio;
    await iniciar();
    while (fila.length) {
      const b = fila[0];
      try { return await b[op].apply(b, args); }
      catch (e) { if (b.nome === 'memoria') return vazio; fila.shift(); }
    }
    return vazio;
  }

  async function exportAll() {
    const stores = {};
    for (const n of NOMES) stores[n] = (await executar('getAll', [n], [])) || [];
    return { app: 'calendarium', versao: DB_VERSION, exportadoEm: new Date().toISOString(), stores };
  }

  async function importAll(json) {
    let dados = json;
    if (typeof json === 'string') { dados = safe(() => JSON.parse(json), null); }
    if (!ehObj(dados) || dados.app !== 'calendarium' || !ehObj(dados.stores)) return { ok: false, erro: 'Arquivo não reconhecido.' };
    if (Number(dados.versao) > DB_VERSION) return { ok: false, erro: 'Versão de dados mais nova que a suportada.' };
    const importados = {}, ignorados = {};
    for (const n of NOMES) {
      importados[n] = 0; ignorados[n] = 0;
      const regs = Array.isArray(dados.stores[n]) ? dados.stores[n] : [];
      for (const r of regs) {
        let valido = ehObj(r);
        if (valido && n === 'festas') valido = typeof r.id === 'string' && r.id.length > 0 && r.id.length <= 100 && chaveDe(n, r) !== null;
        if (valido && n === 'diario') valido = typeof r.data === 'string' && RE_DATA.test(r.data);
        if (!valido) { ignorados[n]++; continue; }
        const usaPut = n !== 'diario_log' || (typeof r.seq === 'number' && isFinite(r.seq));
        const k = await executar(usaPut ? 'put' : 'add', [n, r], null);
        if (k === null) ignorados[n]++; else importados[n]++;
      }
    }
    return { ok: true, importados, ignorados };
  }

  window.CalendariumStore = {
    versao: DB_VERSION,
    stores: NOMES.slice(),
    ready: () => iniciar().then(() => (fila && fila[0] ? fila[0].nome : 'memoria')),
    get: (n, k) => executar('get', [n, k], null),
    put: (n, v) => executar('put', [n, v], null),
    delete: (n, k) => executar('delete', [n, k], false),
    getAll: (n) => executar('getAll', [n], []),
    add: (n, v) => executar('add', [n, v], null),
    exportAll,
    importAll,
  };
})();
