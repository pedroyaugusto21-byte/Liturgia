/* Regras do cofre no EMULADOR do Firestore. Uso:
   npx firebase emulators:exec --only firestore "node tests/teste-regras-cripto.js"
   Requer: npm i -D @firebase/rules-unit-testing firebase-tools (e Java). Não roda sem o emulador. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const B = (n) => 'A'.repeat(n);
const cifDia = (dia, o) => Object.assign({ data: dia, v: 1, alg: 'A256GCM', kid: B(11), iv: B(16), ct: B(200), salvoEm: '2026-03-01T10:00:00.000Z', atualizadoEm: '2026-03-01T10:00:00.000Z' }, o);
const cifLog = (id, o) => Object.assign({ nuvemId: id, v: 1, alg: 'A256GCM', kid: B(11), iv: B(16), ct: B(100), atualizadoEm: '2026-03-01T10:00:00.000Z' }, o);
const cofre = (o) => Object.assign({ v: 1, estado: 'migrando', kid: B(11), rev: 1, kdf: { alg: 'PBKDF2-SHA256', iter: 600000, salt: B(22) }, senha: { iv: B(16), ct: B(64) }, recuperacao: { salt: B(22), iv: B(16), ct: B(64) }, criadoEm: '2026-03-01T10:00:00.000Z', atualizadoEm: '2026-03-01T10:00:00.000Z' }, o);
(async () => {
  const env = await initializeTestEnvironment({ projectId: 'regras-cofre', firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8') } });
  const db = env.authenticatedContext('u1').firestore(), outro = env.authenticatedContext('u2').firestore(), anon = env.unauthenticatedContext().firestore();
  const d = (x, ...p) => x.doc(...p);
  const testes = [
    ['diário cifrado válido', () => assertSucceeds(d(db, 'usuarios/u1/diario/2026-03-01').set(cifDia('2026-03-01')))],
    ['diário cifrado com teto exato (90.000)', () => assertSucceeds(d(db, 'usuarios/u1/diario/2026-03-02').set(cifDia('2026-03-02', { ct: B(90000) })))],
    ['diário cifrado acima do teto', () => assertFails(d(db, 'usuarios/u1/diario/2026-03-03').set(cifDia('2026-03-03', { ct: B(90001) })))],
    ['diário cifrado com campo extra (texto em claro junto)', () => assertFails(d(db, 'usuarios/u1/diario/2026-03-04').set(cifDia('2026-03-04', { texto: 'x' })))],
    ['diário cifrado sem salvoEm', () => assertFails(d(db, 'usuarios/u1/diario/2026-03-05').set((() => { const x = cifDia('2026-03-05'); delete x.salvoEm; return x; })()))],
    ['diário cifrado com IV de tamanho errado', () => assertFails(d(db, 'usuarios/u1/diario/2026-03-06').set(cifDia('2026-03-06', { iv: B(15) })))],
    ['diário cifrado com versão 2', () => assertFails(d(db, 'usuarios/u1/diario/2026-03-07').set(cifDia('2026-03-07', { v: 2 })))],
    ['diário em claro ainda aceito (migração gradual)', () => assertSucceeds(d(db, 'usuarios/u1/diario/2026-03-08').set({ data: '2026-03-08', texto: 'x', clima: {}, photagogia: false, atualizadoEm: 'a' }))],
    ['diário em claro acima de 10.000 continua recusado', () => assertFails(d(db, 'usuarios/u1/diario/2026-03-09').set({ data: '2026-03-09', texto: B(10001), clima: {}, photagogia: false, atualizadoEm: 'a' }))],
    ['log cifrado válido', () => assertSucceeds(d(db, 'usuarios/u1/diario_log/abc').set(cifLog('abc')))],
    ['log cifrado com nuvemId diferente do id', () => assertFails(d(db, 'usuarios/u1/diario_log/abc2').set(cifLog('outro')))],
    ['cofre: criar com rev 1', () => assertSucceeds(d(db, 'usuarios/u1/cofre/principal').set(cofre()))],
    ['cofre: id diferente de principal', () => assertFails(d(db, 'usuarios/u1/cofre/outro').set(cofre()))],
    ['cofre: update com rev + 1', () => assertSucceeds(d(db, 'usuarios/u1/cofre/principal').set(cofre({ rev: 2 })))],
    ['cofre: update repetindo o rev', () => assertFails(d(db, 'usuarios/u1/cofre/principal').set(cofre({ rev: 2 })))],
    ['cofre: update trocando o kid', () => assertFails(d(db, 'usuarios/u1/cofre/principal').set(cofre({ rev: 3, kid: B(10) + 'B' })))],
    ['cofre: iterações abaixo da faixa', async () => { await d(db, 'usuarios/u1/cofre/principal').delete(); return assertFails(d(db, 'usuarios/u1/cofre/principal').set(cofre({ kdf: { alg: 'PBKDF2-SHA256', iter: 1000, salt: B(22) } }))); }],
    ['cofre: estado inválido', () => assertFails(d(db, 'usuarios/u1/cofre/principal').set(cofre({ estado: 'x' })))],
    ['cofre: outra pessoa não lê', () => assertFails(d(outro, 'usuarios/u1/cofre/principal').get())],
    ['cofre: anônimo não lê', () => assertFails(d(anon, 'usuarios/u1/cofre/principal').get())],
    ['cofre: outra pessoa não escreve', () => assertFails(d(outro, 'usuarios/u1/cofre/principal').set(cofre()))],
    ['coleção desconhecida continua proibida', () => assertFails(d(db, 'usuarios/u1/segredos/x').set({ a: 1 }))],
  ];
  let ok = 0, f = 0;
  for (const [n, fn] of testes) { try { await fn(); ok++; console.log('  ok  ' + n); } catch (e) { f++; console.log('  FALHOU  ' + n + '\n        ' + e.message); } }
  await env.cleanup(); console.log('\n' + ok + ' ok, ' + f + ' falha(s)'); process.exit(f ? 1 : 0);
})();
