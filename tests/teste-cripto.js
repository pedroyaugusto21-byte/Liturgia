/* Testes de cripto.js (Node, sem navegador). Uso: node tests/teste-cripto.js
   Regenerar a referência do formato v1 (só para mudança INTENCIONAL):  node tests/teste-cripto.js snap */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
global.window = globalThis;
require('../cripto.js');
const CC = window.CalendariumCripto;
const GOLD = path.join(__dirname, 'golden', 'cripto-v1.json');
const IT = CC.ITER_MIN;                       /* iterações baixas só nos testes */
let ok = 0, falhas = 0;
async function t(nome, fn) { try { await fn(); ok++; console.log('  ok  ' + nome); } catch (e) { falhas++; console.log('  FALHOU  ' + nome + '\n        ' + (e && e.stack || e)); } }
async function falha(p, codigo) {
  try { await p; } catch (e) { assert.strictEqual(e.cripto, codigo, 'esperava ' + codigo + ' e veio ' + (e.cripto || e.message)); assert.strictEqual(e.code, 'cofre/' + codigo); return; }
  assert.fail('deveria falhar com ' + codigo);
}
function rngDet() { let c = 0; return (n) => { c++; const a = new Uint8Array(n); for (let i = 0; i < n; i++) a[i] = (c * 31 + i * 7 + 13) & 255; return a; }; }
const FRASE = 'uma frase longa para o diário';
const ctx = { uid: 'uid1', colecao: 'diario', id: '2026-11-27', salvoEm: '2026-11-27T10:00:00.000Z' };
const payload = { texto: 'Olá, ação & "aspas"\nnova linha', clima: { amanhecer: ['sol'], entardecer: [], noite: ['lua'] }, photagogia: true, criadoEm: '2026-11-27T09:00:00.000Z', id: 'abc' };
const flip = (s, i) => { const b = CC.deb64u(s); b[i % b.length] ^= 1; return CC.b64u(b); };

(async () => {
  console.log('cripto.js');
  await t('plataforma: PBKDF2-HMAC-SHA256 bate com vetores conhecidos', async () => {
    const s = crypto.subtle, enc = new TextEncoder();
    const base = await s.importKey('raw', enc.encode('password'), 'PBKDF2', false, ['deriveBits']);
    const hex = (b) => Buffer.from(b).toString('hex');
    assert.strictEqual(hex(await s.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('salt'), iterations: 1 }, base, 256)), '120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b');
    assert.strictEqual(hex(await s.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('salt'), iterations: 4096 }, base, 256)), 'c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a');
  });
  await t('ida e volta; documento só tem campos técnicos em claro', async () => {
    const { cofre, chave } = await CC.criarCofre(FRASE, { iter: IT });
    const doc = await CC.cifrar(chave, ctx, payload);
    assert.deepStrictEqual(Object.keys(doc).sort(), ['alg', 'ct', 'iv', 'kid', 'v']);
    assert.strictEqual(doc.v, 1); assert.strictEqual(doc.alg, 'A256GCM'); assert.strictEqual(doc.iv.length, 16);
    assert(!JSON.stringify(doc).includes('Olá'));
    const aberta = await CC.abrir(cofre, FRASE);
    assert.deepStrictEqual(await CC.decifrar(aberta, ctx, doc), payload);
  });
  await t('formato v1 congelado (referência em tests/golden)', async () => {
    const C2 = CC.criar({ rng: rngDet() });
    const { cofre, chave, recuperacao } = await C2.criarCofre(FRASE, { iter: IT });
    cofre.criadoEm = '2026-01-01T00:00:00.000Z';
    const doc = await C2.cifrar(chave, ctx, payload);
    const atual = { cofre, recuperacao, doc };
    if (process.argv[2] === 'snap') { fs.writeFileSync(GOLD, JSON.stringify(atual, null, 2)); console.log('        referência gravada'); return; }
    const ref = JSON.parse(fs.readFileSync(GOLD, 'utf8'));
    assert.deepStrictEqual(atual, ref);
    const ab = await CC.abrir(ref.cofre, FRASE);                         /* versões futuras precisam abrir isto */
    assert.deepStrictEqual(await CC.decifrar(ab, ctx, ref.doc), payload);
    const ab2 = await CC.abrirRecuperacao(ref.cofre, ref.recuperacao);
    assert.deepStrictEqual(await CC.decifrar(ab2, ctx, ref.doc), payload);
  });
  await t('senha errada falha com código próprio e sem vazar nada', async () => {
    const { cofre } = await CC.criarCofre(FRASE, { iter: IT });
    await falha(CC.abrir(cofre, FRASE + 'x'), 'senha-errada');
    await CC.abrir(cofre, '  ' + FRASE + ' ');      /* espaços nas pontas não contam (teclados de celular) */
    await falha(CC.abrir(cofre, 'outra frase bem longa aqui'), 'senha-errada');
    await falha(CC.abrir(cofre, ''), 'senha-errada');
  });
  await t('frase em NFC e NFD gera a mesma chave (teclados diferentes)', async () => {
    const nfc = 'não esqueço a frase do diário', nfd = nfc.normalize('NFD');
    assert.notStrictEqual(nfc, nfd);
    const { cofre, chave } = await CC.criarCofre(nfc, { iter: IT });
    const doc = await CC.cifrar(chave, ctx, payload);
    assert.deepStrictEqual(await CC.decifrar(await CC.abrir(cofre, nfd), ctx, doc), payload);
  });
  await t('frase curta e cripto indisponível', async () => {
    await falha(CC.criarCofre('curta', { iter: IT }), 'frase-curta');
    await falha(CC.criarCofre('           ', { iter: IT }), 'frase-curta');
    const sem = CC.criar({ crypto: null });
    assert.strictEqual(sem.disponivel(), false);
    await falha(sem.criarCofre(FRASE, { iter: IT }), 'indisponivel');
  });
  await t('chave de recuperação: certa, errada, com erro de digitação, sem recuperação', async () => {
    const { cofre, chave, recuperacao } = await CC.criarCofre(FRASE, { iter: IT });
    assert(/^([A-Z2-7]{4}-){7}[A-Z2-7]{4}$/.test(recuperacao));
    const doc = await CC.cifrar(chave, ctx, payload);
    const k = await CC.abrirRecuperacao(cofre, recuperacao.toLowerCase().replace(/-/g, ' '));
    assert.deepStrictEqual(await CC.decifrar(k, ctx, doc), payload);
    const errada = recuperacao.slice(0, -1) + (recuperacao.slice(-1) === 'A' ? 'B' : 'A');
    await falha(CC.abrirRecuperacao(cofre, errada), 'recuperacao-errada');
    await falha(CC.abrirRecuperacao(cofre, 'ABC'), 'recuperacao-errada');
    await falha(CC.abrirRecuperacao(cofre, 'não é base32!!'), 'recuperacao-errada');
    const sem = await CC.criarCofre(FRASE, { iter: IT, recuperacao: false });
    assert.strictEqual(sem.recuperacao, null); assert.strictEqual(sem.cofre.recuperacao, undefined);
    await falha(CC.abrirRecuperacao(sem.cofre, recuperacao), 'recuperacao-errada');
  });
  await t('trocar a frase: antiga deixa de valer, documentos antigos continuam, recuperação continua', async () => {
    const { cofre, chave, recuperacao } = await CC.criarCofre(FRASE, { iter: IT });
    const doc = await CC.cifrar(chave, ctx, payload);
    const { cofre: novo } = await CC.trocarFrase(cofre, FRASE, 'frase nova bem diferente', { iter: IT });
    assert.strictEqual(novo.rev, cofre.rev + 1); assert.strictEqual(novo.kid, cofre.kid);
    assert.notStrictEqual(novo.kdf.salt, cofre.kdf.salt);
    await falha(CC.abrir(novo, FRASE), 'senha-errada');
    assert.deepStrictEqual(await CC.decifrar(await CC.abrir(novo, 'frase nova bem diferente'), ctx, doc), payload);
    assert.deepStrictEqual(await CC.decifrar(await CC.abrirRecuperacao(novo, recuperacao), ctx, doc), payload);
    await falha(CC.trocarFrase(cofre, 'errada errada errada', 'frase nova bem diferente', { iter: IT }), 'senha-errada');
    const r = await CC.redefinirComRecuperacao(novo, recuperacao, 'terceira frase longa ok', { iter: IT });
    assert.deepStrictEqual(await CC.decifrar(await CC.abrir(r.cofre, 'terceira frase longa ok'), ctx, doc), payload);
  });
  await t('documento corrompido: cada alteração é detectada', async () => {
    const { chave } = await CC.criarCofre(FRASE, { iter: IT });
    const doc = await CC.cifrar(chave, ctx, payload);
    const casos = {
      'bit no texto cifrado': Object.assign({}, doc, { ct: flip(doc.ct, 3) }),
      'bit na tag (último byte)': Object.assign({}, doc, { ct: flip(doc.ct, CC.deb64u(doc.ct).length - 1) }),
      'bit no IV': Object.assign({}, doc, { iv: flip(doc.iv, 0) }),
      'texto cifrado truncado': Object.assign({}, doc, { ct: doc.ct.slice(0, doc.ct.length - 8) }),
      'texto cifrado vazio': Object.assign({}, doc, { ct: '' }),
      'ct fora do base64url': Object.assign({}, doc, { ct: '***' + doc.ct.slice(3) }),
      'IV com tamanho errado': Object.assign({}, doc, { iv: doc.iv.slice(0, 10) }),
      'alg trocado': Object.assign({}, doc, { alg: 'A128GCM' }),
      'v = 0': Object.assign({}, doc, { v: 0 }),
    };
    for (const [nome, d] of Object.entries(casos)) await falha(CC.decifrar(chave, ctx, d), 'corrompido').catch((e) => { throw new Error(nome + ': ' + e.message); });
    await falha(CC.decifrar(chave, ctx, null), 'corrompido');
    await falha(CC.decifrar(chave, ctx, 'texto'), 'corrompido');
    await falha(CC.decifrar(chave, ctx, Object.assign({}, doc, { v: 2 })), 'versao');
    await falha(CC.decifrar(chave, ctx, Object.assign({}, doc, { kid: 'outroKid1234' })), 'kid');
    const grande = Object.assign({}, doc, { ct: 'A'.repeat(CC.CT_MAX + 4) });
    await falha(CC.decifrar(chave, ctx, grande), 'corrompido');
  });
  await t('AAD: texto de um dia não vale em outro dia, coleção, conta ou carimbo', async () => {
    const { chave } = await CC.criarCofre(FRASE, { iter: IT });
    const doc = await CC.cifrar(chave, ctx, payload);
    for (const alt of [{ id: '2026-11-28' }, { colecao: 'diario_log' }, { uid: 'uid2' }, { salvoEm: '2026-11-27T10:00:00.001Z' }, { salvoEm: '' }])
      await falha(CC.decifrar(chave, Object.assign({}, ctx, alt), doc), 'corrompido');
  });
  await t('payload que não é objeto é recusado', async () => {
    const { chave } = await CC.criarCofre(FRASE, { iter: IT });
    await falha(CC.decifrar(chave, ctx, await CC.cifrar(chave, ctx, 'só um texto')), 'corrompido');
    await falha(CC.decifrar(chave, ctx, await CC.cifrar(chave, ctx, [1, 2])), 'corrompido');
  });
  await t('chave de outro cofre não abre (kid diferente e, forçando o kid, a tag falha)', async () => {
    const a = await CC.criarCofre(FRASE, { iter: IT }), b = await CC.criarCofre(FRASE, { iter: IT });
    const doc = await CC.cifrar(a.chave, ctx, payload);
    await falha(CC.decifrar(b.chave, ctx, doc), 'kid');
    await falha(CC.decifrar({ key: b.chave.key, kid: a.chave.kid }, ctx, doc), 'corrompido');
  });
  await t('cofre corrompido ou fora da faixa', async () => {
    const { cofre } = await CC.criarCofre(FRASE, { iter: IT });
    const c = (m) => Object.assign({}, cofre, m);
    const casos = {
      'sem senha': c({ senha: undefined }), 'iv da senha curto': c({ senha: { iv: 'abc', ct: cofre.senha.ct } }),
      'ct da senha curto': c({ senha: { iv: cofre.senha.iv, ct: cofre.senha.ct.slice(4) } }),
      'iterações baixas demais': c({ kdf: Object.assign({}, cofre.kdf, { iter: 5 }) }),
      'iterações absurdas': c({ kdf: Object.assign({}, cofre.kdf, { iter: 9e9 }) }),
      'iterações não inteiras': c({ kdf: Object.assign({}, cofre.kdf, { iter: 123456.5 }) }),
      'sal curto': c({ kdf: Object.assign({}, cofre.kdf, { salt: 'abcd' }) }),
      'kdf desconhecido': c({ kdf: Object.assign({}, cofre.kdf, { alg: 'MD5' }) }),
      'estado inválido': c({ estado: 'qualquer' }), 'rev inválido': c({ rev: 0 }), 'kid inválido': c({ kid: 'x' }),
      'recuperação malformada': c({ recuperacao: { salt: 'a', iv: 'b', ct: 'c' } }),
    };
    for (const [nome, x] of Object.entries(casos)) await falha(CC.abrir(x, FRASE), 'cofre-invalido').catch((e) => { throw new Error(nome + ': ' + e.message); });
    await falha(CC.abrir(c({ v: 2 }), FRASE), 'versao');
    await falha(CC.abrir(null, FRASE), 'cofre-invalido');
    await falha(CC.abrir(c({ senha: { iv: cofre.senha.iv, ct: flip(cofre.senha.ct, 5) } }), FRASE), 'senha-errada');   /* tag inválida */
    await falha(CC.abrir(c({ kid: CC.b64u(new Uint8Array(8)) }), FRASE), 'senha-errada');                           /* kid trocado: AAD do embrulho não confere */
  });
  await t('IV repetido: dois envios iguais nunca repetem IV nem texto cifrado', async () => {
    const { chave } = await CC.criarCofre(FRASE, { iter: IT });
    const a = await CC.cifrar(chave, ctx, payload), b = await CC.cifrar(chave, ctx, payload);
    assert.notStrictEqual(a.iv, b.iv); assert.notStrictEqual(a.ct, b.ct);
    const ivs = new Set(); for (let i = 0; i < 1500; i++) ivs.add((await CC.cifrar(chave, ctx, { n: i })).iv);
    assert.strictEqual(ivs.size, 1500);
  });
  await t('IV repetido: o módulo detecta a repetição e sorteia outro', async () => {
    const X = new Uint8Array(12).fill(7), Y = new Uint8Array(12).fill(9); const fila = [X, X, Y];
    const C2 = CC.criar({ rng: (n) => (n === 12 ? fila.shift() || crypto.getRandomValues(new Uint8Array(12)) : crypto.getRandomValues(new Uint8Array(n))) });
    const { chave } = await C2.criarCofre(FRASE, { iter: IT, recuperacao: false });   /* embrulho da frase gastou o 1º IV (X) */
    const d = await C2.cifrar(chave, ctx, payload);                                   /* sorteia X (repetido, descartado) e depois Y */
    assert.strictEqual(d.iv, C2.b64u(Y));
  });
  await t('IV repetido: gerador travado falha e não produz documento', async () => {
    const C2 = CC.criar({ rng: (n) => new Uint8Array(n).fill(5) });
    await falha(C2.criarCofre(FRASE, { iter: IT }), 'rng-ruim');                      /* 2º embrulho (recuperação) repetiria o IV */
    const C3 = CC.criar({ rng: (n) => (n === 12 ? new Uint8Array(12).fill(5) : crypto.getRandomValues(new Uint8Array(n))) });
    const { chave } = await C3.criarCofre(FRASE, { iter: IT, recuperacao: false });
    await falha(C3.cifrar(chave, ctx, payload), 'rng-ruim');
  });
  await t('gerador com tamanho errado é recusado', async () => {
    await falha(CC.criar({ rng: () => new Uint8Array(3) }).criarCofre(FRASE, { iter: IT }), 'rng-invalido');
  });
  await t('tamanho: limites do texto de 10.000 caracteres cabem no teto das regras', async () => {
    const { chave } = await CC.criarCofre(FRASE, { iter: IT });
    const clima = (s) => ({ amanhecer: Array(12).fill(s), entardecer: Array(12).fill(s), noite: Array(12).fill(s) });
    const pior = await CC.cifrar(chave, ctx, { texto: '\u0001'.repeat(10000), clima: clima('\u0001'.repeat(20)), photagogia: true, criadoEm: '2026-11-27T12:00:00.000Z', id: 'x'.repeat(64) });
    assert(pior.ct.length <= CC.CT_MAX && pior.ct.length > 80000, 'pior caso: ' + pior.ct.length);
    const acento = await CC.cifrar(chave, ctx, { texto: 'ã'.repeat(10000), clima: clima(''), photagogia: false, criadoEm: '2026-11-27T12:00:00.000Z', id: 'x'.repeat(22) });
    assert(acento.ct.length < 30000, 'acentuado: ' + acento.ct.length);
    await falha(CC.cifrar(chave, ctx, { texto: '\u0001'.repeat(30000) }), 'grande');
  });
  await t('a chave mestra não é extraível', async () => {
    const { chave } = await CC.criarCofre(FRASE, { iter: IT });
    await assert.rejects(crypto.subtle.exportKey('raw', chave.key));
  });
  await t('chave guardada: sem IndexedDB devolve nulo/falso, sem lançar', async () => {
    const { chave } = await CC.criarCofre(FRASE, { iter: IT });
    assert.strictEqual(await CC.guardarChave('u', chave), false);
    assert.strictEqual(await CC.lerChave('u', chave.kid), null);
    assert.strictEqual(await CC.esquecerChave('u'), false);
  });
  console.log('\n' + ok + ' ok, ' + falhas + ' falha(s)');
  process.exit(falhas ? 1 : 0);
})();
