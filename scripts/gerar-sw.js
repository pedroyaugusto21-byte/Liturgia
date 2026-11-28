#!/usr/bin/env node
/* Gera a lista ARQUIVOS e a VERSAO do sw.js a partir do que o index.html realmente usa.
   Sem dependências (só módulos nativos do Node).

   Uso:  node scripts/gerar-sw.js              reescreve o trecho gerado do sw.js
         node scripts/gerar-sw.js --verificar  não escreve; sai com erro se algo faltar ou estiver desatualizado

   O que entra no cache: index.html e tudo que ele referencia por <script src>, <link href>
   (CSS, ícones, manifest), <img src>, <source src>, <audio/video src> locais; os ícones listados
   no manifest; e os url(...) locais dentro dos CSS referenciados. Links externos (https:, //, data:)
   e âncoras (#) ficam de fora. O sw.js em si não é guardado no cache (como antes).

   VERSAO = "calendarium-" + 10 primeiros hex do SHA-256 do conteúdo dos arquivos do cache + do sw.js
   (sem o trecho gerado). Qualquer mudança em arquivo do site muda a versão, então o app instalado
   baixa a atualização. Por isso: depois de editar o site, rode "npm run gerar-sw" antes de publicar. */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '..');
const HTML = 'index.html';
const SW = 'sw.js';
const INI = '/* @gerado-inicio — não edite à mão; rode: npm run gerar-sw */';
const FIM = '/* @gerado-fim */';
const verificar = process.argv.includes('--verificar');

const lerTxt = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');
const existe = (rel) => { try { return fs.statSync(path.join(RAIZ, rel)).isFile(); } catch (e) { return false; } };
const externo = (u) => /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(u);
const limpa = (u) => u.replace(/[?#].*$/, '');
const norm = (rel) => path.posix.normalize(rel.replace(/\\/g, '/')).replace(/^\.\//, '');

/* ---------- 1. o que o HTML referencia ---------- */
function referenciasHtml(html) {
  const refs = new Map();   /* arquivo -> motivo (primeira ocorrência) */
  const add = (u, motivo) => { if (!u || externo(u)) return; const f = norm(limpa(u)); if (f && !f.startsWith('..') && !refs.has(f)) refs.set(f, motivo); };
  const semComentarios = html.replace(/<!--[\s\S]*?-->/g, '');
  const tag = /<(script|link|img|source|audio|video)\b([^>]*)>/gi;
  let m;
  while ((m = tag.exec(semComentarios))) {
    const nome = m[1].toLowerCase(), attrs = m[2];
    const attr = (a) => { const r = new RegExp('\\b' + a + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\')', 'i').exec(attrs); return r ? (r[1] !== undefined ? r[1] : r[2]) : null; };
    if (nome === 'link') add(attr('href'), '<link ' + (attr('rel') || '') + '>');
    else { add(attr('src'), '<' + nome + ' src>'); if (nome === 'video') add(attr('poster'), '<video poster>'); }
  }
  return refs;
}

/* ---------- 2. manifest e CSS ---------- */
function referenciasManifest(refs) {
  const extra = new Map();
  for (const [f, motivo] of refs) {
    if (!/manifest/i.test(motivo) || !existe(f)) continue;
    let j; try { j = JSON.parse(lerTxt(f)); } catch (e) { throw new Error(f + ' não é um JSON válido: ' + e.message); }
    const dir = path.posix.dirname(f);
    const lista = [].concat(j.icons || [], j.screenshots || [], ...(j.shortcuts || []).map((s) => s.icons || []));
    lista.forEach((i) => { if (i && i.src && !externo(i.src)) extra.set(norm(path.posix.join(dir, limpa(i.src))), 'manifest (' + f + ')'); });
  }
  return extra;
}
function referenciasCss(refs) {
  const extra = new Map();
  for (const [f] of [...refs]) {
    if (!/\.css$/i.test(f) || !existe(f)) continue;
    const dir = path.posix.dirname(f);
    const css = lerTxt(f).replace(/\/\*[\s\S]*?\*\//g, '');
    const re = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]*))\s*\)/gi; let m;
    while ((m = re.exec(css))) {
      const u = m[1] || m[2] || m[3];
      if (u && !externo(u)) extra.set(norm(path.posix.join(dir, limpa(u))), 'url() em ' + f);
    }
  }
  return extra;
}

function coletar() {
  if (!existe(HTML)) throw new Error(HTML + ' não encontrado em ' + RAIZ);
  const refs = referenciasHtml(lerTxt(HTML));
  refs.set(HTML, refs.get(HTML) || 'página');
  for (const [f, m] of referenciasManifest(refs)) if (!refs.has(f)) refs.set(f, m);
  for (const [f, m] of referenciasCss(refs)) if (!refs.has(f)) refs.set(f, m);
  refs.delete(SW);
  return refs;
}

/* ---------- 3. trecho gerado ---------- */
function partesSw(sw) {
  const i = sw.indexOf(INI), j = sw.indexOf(FIM);
  if (i < 0 || j < i) throw new Error('sw.js sem os marcadores ' + INI + ' ... ' + FIM);
  return { antes: sw.slice(0, i), depois: sw.slice(j + FIM.length) };
}
function versao(arquivos, swSemTrecho) {
  const h = crypto.createHash('sha256');
  [...arquivos].sort().forEach((f) => { h.update(f + '\0'); h.update(fs.readFileSync(path.join(RAIZ, f))); h.update('\0'); });
  h.update('sw\0' + swSemTrecho);
  return 'calendarium-' + h.digest('hex').slice(0, 10);
}
function trecho(arquivos, ver) {
  const lista = ['./', ...[...arquivos].sort()];
  return INI + '\nconst VERSAO = \'' + ver + '\';\nconst ARQUIVOS = [' + lista.map((a) => '\'' + a + '\'').join(', ') + '];\n' + FIM;
}

/* ---------- 4. execução ---------- */
const erros = [];
let refs;
try { refs = coletar(); } catch (e) { console.error('ERRO: ' + e.message); process.exit(1); }

const faltando = [...refs].filter(([f]) => !existe(f));
faltando.forEach(([f, m]) => erros.push('referenciado (' + m + ') mas não existe no disco: ' + f));
const arquivos = [...refs.keys()].filter(existe);

const sw = lerTxt(SW);
let partes; try { partes = partesSw(sw); } catch (e) { console.error('ERRO: ' + e.message); process.exit(1); }
const gerado = trecho(arquivos, versao(arquivos, partes.antes + partes.depois));
const novo = partes.antes + gerado + partes.depois;

if (!verificar) {
  if (erros.length) { erros.forEach((e) => console.error('ERRO: ' + e)); process.exit(1); }
  if (novo === sw) console.log('sw.js já está atualizado (' + arquivos.length + ' arquivos).');
  else { fs.writeFileSync(path.join(RAIZ, SW), novo); console.log('sw.js atualizado: ' + arquivos.length + ' arquivos, ' + /VERSAO = '([^']+)'/.exec(gerado)[1]); }
  process.exit(0);
}

/* --verificar: confere o ARQUIVOS que está de fato no sw.js, sem depender do trecho gerado ser igual */
let noCache = [];
try {
  const mm = /const ARQUIVOS = (\[[\s\S]*?\]);/.exec(sw);
  noCache = vm.runInNewContext(mm[1]);
  if (!Array.isArray(noCache)) throw new Error('ARQUIVOS não é uma lista');
} catch (e) { erros.push('não consegui ler ARQUIVOS do sw.js: ' + e.message); }
const setCache = new Set(noCache.map((a) => (a === './' ? a : norm(a))));
for (const [f, m] of refs) if (existe(f) && !setCache.has(f)) erros.push('falta no cache do sw.js (' + m + '): ' + f);
noCache.forEach((a) => { if (a !== './' && !existe(norm(a))) erros.push('está no cache do sw.js mas não existe no disco: ' + a); });
if (!setCache.has('./') && !setCache.has('index.html')) erros.push('o cache do sw.js não tem "./" nem index.html');
if (!erros.length && novo !== sw) erros.push('trecho gerado do sw.js desatualizado (versão ou lista): rode "npm run gerar-sw"');

if (erros.length) { erros.forEach((e) => console.error('FALHOU  ' + e)); process.exit(1); }
console.log('OK      sw.js em dia: ' + arquivos.length + ' arquivos referenciados por ' + HTML + ' estão no cache; ' + /VERSAO = '([^']+)'/.exec(sw)[1]);
