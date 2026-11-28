/* ======================================================================
   CALENDARIUM CRIPTO — criptografia de ponta a ponta (opcional) do Diário na nuvem
   window.CalendariumCripto = { disponivel, criar, ... }   (formato v1)

   - Script CLÁSSICO, sem dependências, só WebCrypto. Não toca no DOM nem na rede.
   - Desenho:
       frase → PBKDF2-SHA-256 (sal de 16 bytes, iterações gravadas no cofre) → chave que
       "embrulha" (AES-GCM) a CHAVE MESTRA, aleatória de 256 bits.
       Chave de recuperação (160 bits aleatórios, HKDF-SHA-256) embrulha a mesma chave mestra.
       Cada documento é cifrado com a chave mestra, AES-256-GCM, IV aleatório de 96 bits por gravação.
       AAD = calendarium|v1|uid|coleção|idDoDoc|salvoEm|kid  (amarra o texto ao dia e ao carimbo).
   - Trocar a frase só reembrulha a chave mestra: nenhum documento é recifrado.
   - Erros têm e.code = 'cofre/<codigo>' e e.cripto = '<codigo>':
       senha-errada, recuperacao-errada, cofre-invalido, corrompido, versao, kid,
       rng-ruim, rng-invalido, grande, indisponivel, frase-curta
   - criar({ crypto, rng }) devolve uma instância independente (os testes injetam um
     gerador aleatório falso); window.CalendariumCripto é a instância padrão.
   ====================================================================== */
(function () {
  'use strict';

  const V = 1, ALG = 'A256GCM', KDF = 'PBKDF2-SHA256';
  const ITER_PADRAO = 600000, ITER_MIN = 100000, ITER_MAX = 5000000;
  const CT_MAX = 90000;                  /* igual ao teto de firestore.rules */
  const FRASE_MIN = 12;
  const DB_NOME = 'calendarium-cofre';
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  const ehObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  function erro(codigo, msg) { const e = new Error(msg || codigo); e.code = 'cofre/' + codigo; e.cripto = codigo; return e; }

  /* ---------- base64url sem preenchimento (estrito) ---------- */
  function b64u(bytes) {
    let s = '', i = 0;
    for (; i + 2 < bytes.length; i += 3) {
      const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
      s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    }
    if (i + 1 === bytes.length) { const n = bytes[i] << 16; s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63]; }
    else if (i + 2 === bytes.length) { const n = (bytes[i] << 16) | (bytes[i + 1] << 8); s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63]; }
    return s;
  }
  function deb64u(s) {                        /* null se inválido */
    if (typeof s !== 'string' || s.length % 4 === 1) return null;
    const out = new Uint8Array(Math.floor(s.length * 3 / 4));
    let acc = 0, bits = 0, k = 0;
    for (let i = 0; i < s.length; i++) {
      const v = B64.indexOf(s[i]);
      if (v < 0) return null;
      acc = (acc << 6) | v; bits += 6;
      if (bits >= 8) { bits -= 8; out[k++] = (acc >> bits) & 255; acc &= (1 << bits) - 1; }
    }
    if (acc !== 0) return null;               /* bits finais não nulos: forma não canônica */
    return out;
  }
  const compr = (s, n) => { const b = deb64u(s); return !!b && b.length === n; };

  /* ---------- base32 (chave de recuperação) ---------- */
  function b32(bytes) {
    let s = '', acc = 0, bits = 0;
    for (let i = 0; i < bytes.length; i++) {
      acc = (acc << 8) | bytes[i]; bits += 8;
      while (bits >= 5) { bits -= 5; s += B32[(acc >> bits) & 31]; }
      acc &= (1 << bits) - 1;
    }
    if (bits > 0) s += B32[(acc << (5 - bits)) & 31];
    return s;
  }
  function deb32(s) {
    const out = []; let acc = 0, bits = 0;
    for (let i = 0; i < s.length; i++) {
      const v = B32.indexOf(s[i]);
      if (v < 0) return null;
      acc = (acc << 5) | v; bits += 5;
      if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 255); acc &= (1 << bits) - 1; }
    }
    return new Uint8Array(out);
  }
  const formatarRec = (s) => s.match(/.{1,4}/g).join('-');
  const lerRec = (txt) => (typeof txt === 'string' ? txt.toUpperCase().replace(/[\s-]/g, '') : '');

  const normalizar = (f) => (typeof f === 'string' ? f.normalize('NFKC') : '');

  function criar(opcoes) {
    const o = opcoes || {};
    const C = 'crypto' in o ? o.crypto : ((typeof window !== 'undefined' && window.crypto) || (typeof globalThis !== 'undefined' && globalThis.crypto) || null);
    const subtle = C && C.subtle ? C.subtle : null;
    const sorteio = o.rng || ((n) => { const a = new Uint8Array(n); C.getRandomValues(a); return a; });
    const enc = new TextEncoder(), dec = new TextDecoder('utf-8', { fatal: true });
    const usados = new Set();                 /* IVs já usados nesta sessão */

    const disponivel = () => !!(subtle && typeof subtle.importKey === 'function' && C && typeof C.getRandomValues === 'function');
    const exige = () => { if (!disponivel()) throw erro('indisponivel', 'WebCrypto indisponível'); };

    function bytesAleatorios(n) {
      const b = sorteio(n);
      if (!(b instanceof Uint8Array) || b.length !== n) throw erro('rng-invalido');
      return b;
    }
    /* IV de 96 bits, nunca repetido na sessão; gerador travado → falha em vez de reutilizar */
    function novoIv() {
      for (let t = 0; t < 5; t++) {
        const iv = bytesAleatorios(12), k = b64u(iv);
        if (!usados.has(k)) {
          usados.add(k);
          if (usados.size > 20000) usados.delete(usados.values().next().value);
          return iv;
        }
      }
      throw erro('rng-ruim');
    }
    const aad = (partes) => enc.encode(partes.join('|'));

    async function chaveDaFrase(frase, salt, iter) {
      const base = await subtle.importKey('raw', enc.encode(normalizar(frase)), 'PBKDF2', false, ['deriveKey']);
      return subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }
    async function chaveDaRecuperacao(raw, salt) {
      const base = await subtle.importKey('raw', raw, 'HKDF', false, ['deriveKey']);
      return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('calendarium-recuperacao-v1') }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    }
    async function embrulhar(kek, raw, contexto) {
      const iv = novoIv();
      const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(contexto), tagLength: 128 }, kek, raw);
      return { iv: b64u(iv), ct: b64u(new Uint8Array(ct)) };
    }
    async function desembrulhar(kek, emb, contexto, codigo) {
      const iv = emb && deb64u(emb.iv), ct = emb && deb64u(emb.ct);
      if (!iv || iv.length !== 12 || !ct || ct.length !== 48) throw erro('cofre-invalido');
      try { return new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad(contexto), tagLength: 128 }, kek, ct)); }
      catch (e) { throw erro(codigo); }
    }
    const importarMestra = (raw) => subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);   /* não extraível */

    /* ---------- validação do documento do cofre ---------- */
    function validar(c) {
      const ruim = () => erro('cofre-invalido');
      if (!ehObj(c) || c.v !== V) { if (ehObj(c) && typeof c.v === 'number' && c.v > V) throw erro('versao'); throw ruim(); }
      if (c.estado !== 'migrando' && c.estado !== 'ativo') throw ruim();
      if (typeof c.kid !== 'string' || !compr(c.kid, 8)) throw ruim();
      if (!Number.isInteger(c.rev) || c.rev < 1) throw ruim();
      const k = c.kdf;
      if (!ehObj(k) || k.alg !== KDF || !Number.isInteger(k.iter) || k.iter < ITER_MIN || k.iter > ITER_MAX || !compr(k.salt, 16)) throw ruim();
      const s = c.senha;
      if (!ehObj(s) || !compr(s.iv, 12) || !compr(s.ct, 48)) throw ruim();
      if (c.recuperacao !== undefined) {
        const r = c.recuperacao;
        if (!ehObj(r) || !compr(r.salt, 16) || !compr(r.iv, 12) || !compr(r.ct, 48)) throw ruim();
      }
      return c;
    }
    const ctxEmb = (tipo, kid) => ['calendarium', 'v1', 'cofre', tipo, kid];

    function exigeFrase(frase) {
      if (normalizar(frase).trim().length < FRASE_MIN) throw erro('frase-curta');
    }
    const fraseUsada = (f) => normalizar(f).trim();
    function exigeIter(iter) { if (!Number.isInteger(iter) || iter < ITER_MIN || iter > ITER_MAX) throw erro('cofre-invalido', 'iterações fora da faixa'); return iter; }

    /* ---------- criar / abrir / trocar ---------- */
    async function criarCofre(frase, opc) {
      exige(); exigeFrase(frase);
      const op = opc || {};
      const iter = exigeIter(op.iter === undefined ? ITER_PADRAO : op.iter);
      const raw = bytesAleatorios(32), kid = b64u(bytesAleatorios(8)), salt = bytesAleatorios(16);
      const cofre = { v: V, estado: 'migrando', kid, rev: 1, kdf: { alg: KDF, iter, salt: b64u(salt) }, criadoEm: new Date().toISOString() };
      cofre.senha = await embrulhar(await chaveDaFrase(fraseUsada(frase), salt, iter), raw, ctxEmb('senha', kid));
      let codigo = null;
      if (op.recuperacao !== false) {
        const rec = bytesAleatorios(20), rsalt = bytesAleatorios(16);
        const emb = await embrulhar(await chaveDaRecuperacao(rec, rsalt), raw, ctxEmb('recuperacao', kid));
        cofre.recuperacao = { salt: b64u(rsalt), iv: emb.iv, ct: emb.ct };
        codigo = formatarRec(b32(rec));
      }
      const chave = { key: await importarMestra(raw), kid };
      raw.fill(0);
      return { cofre, chave, recuperacao: codigo };
    }
    async function rawPorFrase(cofre, frase) {
      validar(cofre); exige();
      const kek = await chaveDaFrase(fraseUsada(frase), deb64u(cofre.kdf.salt), cofre.kdf.iter);
      return desembrulhar(kek, cofre.senha, ctxEmb('senha', cofre.kid), 'senha-errada');
    }
    async function rawPorRecuperacao(cofre, codigo) {
      validar(cofre); exige();
      if (!cofre.recuperacao) throw erro('recuperacao-errada', 'sem chave de recuperação');
      const rec = deb32(lerRec(codigo));
      if (!rec || rec.length !== 20) throw erro('recuperacao-errada');
      const kek = await chaveDaRecuperacao(rec, deb64u(cofre.recuperacao.salt));
      return desembrulhar(kek, cofre.recuperacao, ctxEmb('recuperacao', cofre.kid), 'recuperacao-errada');
    }
    async function abrir(cofre, frase) {
      const raw = await rawPorFrase(cofre, frase);
      const chave = { key: await importarMestra(raw), kid: cofre.kid };
      raw.fill(0); return chave;
    }
    async function abrirRecuperacao(cofre, codigo) {
      const raw = await rawPorRecuperacao(cofre, codigo);
      const chave = { key: await importarMestra(raw), kid: cofre.kid };
      raw.fill(0); return chave;
    }
    async function reembrulhar(cofre, raw, fraseNova, opc) {
      exigeFrase(fraseNova);
      const op = opc || {};
      const iter = exigeIter(op.iter === undefined ? Math.max(cofre.kdf.iter, ITER_PADRAO) : op.iter);
      const salt = bytesAleatorios(16);
      const novo = Object.assign({}, cofre, { rev: cofre.rev + 1, kdf: { alg: KDF, iter, salt: b64u(salt) } });
      novo.senha = await embrulhar(await chaveDaFrase(fraseUsada(fraseNova), salt, iter), raw, ctxEmb('senha', cofre.kid));
      const chave = { key: await importarMestra(raw), kid: cofre.kid };
      raw.fill(0);
      return { cofre: novo, chave };
    }
    async function trocarFrase(cofre, fraseAtual, fraseNova, opc) { return reembrulhar(cofre, await rawPorFrase(cofre, fraseAtual), fraseNova, opc); }
    async function redefinirComRecuperacao(cofre, codigo, fraseNova, opc) { return reembrulhar(cofre, await rawPorRecuperacao(cofre, codigo), fraseNova, opc); }
    function mudarEstado(cofre, estado) { return Object.assign({}, cofre, { estado, rev: cofre.rev + 1 }); }

    /* ---------- cifrar / decifrar documentos ---------- */
    const aadDoc = (ctx, kid) => aad(['calendarium', 'v1', ctx.uid, ctx.colecao, ctx.id, ctx.salvoEm || '', kid]);
    async function cifrar(chave, ctx, payload) {
      exige();
      if (!chave || !chave.key || typeof chave.kid !== 'string') throw erro('cofre-invalido', 'sem chave');
      const iv = novoIv();
      const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aadDoc(ctx, chave.kid), tagLength: 128 }, chave.key, enc.encode(JSON.stringify(payload)));
      const s = b64u(new Uint8Array(ct));
      if (s.length > CT_MAX) throw erro('grande');
      return { v: V, alg: ALG, kid: chave.kid, iv: b64u(iv), ct: s };
    }
    async function decifrar(chave, ctx, doc) {
      exige();
      if (!ehObj(doc) || doc.v === undefined) throw erro('corrompido');
      if (typeof doc.v === 'number' && doc.v > V) throw erro('versao');
      if (doc.v !== V || doc.alg !== ALG) throw erro('corrompido');
      if (!chave || doc.kid !== chave.kid) throw erro('kid');
      const iv = deb64u(doc.iv), ct = deb64u(doc.ct);
      if (!iv || iv.length !== 12 || !ct || ct.length < 17 || typeof doc.ct !== 'string' || doc.ct.length > CT_MAX) throw erro('corrompido');
      let pt;
      try { pt = new Uint8Array(await subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aadDoc(ctx, chave.kid), tagLength: 128 }, chave.key, ct)); }
      catch (e) { throw erro('corrompido'); }
      let obj;
      try { obj = JSON.parse(dec.decode(pt)); } catch (e) { throw erro('corrompido'); }
      if (!ehObj(obj)) throw erro('corrompido');
      return obj;
    }

    /* ---------- chave guardada neste aparelho (CryptoKey NÃO extraível, em IndexedDB próprio) ---------- */
    function abrirDB() {
      return new Promise((resolve) => {
        let feito = false; const fim = (v) => { if (!feito) { feito = true; resolve(v); } };
        try {
          const idb = typeof window !== 'undefined' ? window.indexedDB : null;
          if (!idb) return fim(null);
          const r = idb.open(DB_NOME, 1);
          r.onupgradeneeded = () => { try { r.result.createObjectStore('chaves'); } catch (e) { /* ignora */ } };
          r.onsuccess = () => fim(r.result);
          r.onerror = () => fim(null); r.onblocked = () => fim(null);
          setTimeout(() => fim(null), 4000);
        } catch (e) { fim(null); }
      });
    }
    async function comDB(modo, fn) {          /* { val } em sucesso; null se não houver IndexedDB ou se falhar */
      const db = await abrirDB();
      if (!db) return null;
      return new Promise((resolve) => {
        try {
          const tx = db.transaction('chaves', modo); let val = null;
          const fecha = () => { try { db.close(); } catch (e) { /* ignora */ } };
          tx.oncomplete = () => { fecha(); resolve({ val }); };
          tx.onerror = tx.onabort = () => { fecha(); resolve(null); };
          const r = fn(tx.objectStore('chaves'));
          if (r) r.onsuccess = () => { val = r.result === undefined ? null : r.result; };
        } catch (e) { resolve(null); }
      });
    }
    const guardarChave = (uid, chave) => comDB('readwrite', (s) => s.put({ kid: chave.kid, key: chave.key }, String(uid))).then((r) => !!r, () => false);
    const lerChave = (uid, kid) => comDB('readonly', (s) => s.get(String(uid))).then((r) => (r && r.val && r.val.kid === kid && r.val.key ? { key: r.val.key, kid } : null), () => null);
    const esquecerChave = (uid) => comDB('readwrite', (s) => s.delete(String(uid))).then((r) => !!r, () => false);

    return {
      V, ALG, KDF, ITER_PADRAO, ITER_MIN, ITER_MAX, CT_MAX, FRASE_MIN,
      disponivel, validar, criarCofre, abrir, abrirRecuperacao, trocarFrase, redefinirComRecuperacao, mudarEstado,
      cifrar, decifrar, guardarChave, lerChave, esquecerChave,
      ehCifrado: (d) => ehObj(d) && d.v !== undefined,
      aleatorioId: () => b64u(bytesAleatorios(16)),
      normalizar, b64u, deb64u,
    };
  }

  const padrao = criar();
  padrao.criar = criar;
  if (typeof window !== 'undefined') window.CalendariumCripto = padrao;
})();
