/* Ambiente mínimo para rodar os scripts clássicos do Calendarium no Node (sem navegador, sem dependências).
   Um DOM "falso" que guarda o que os scripts escrevem (innerHTML, textContent, atributos) e dispara eventos.
   Uso:  const { carregar } = require('./_ambiente');
         const amb = carregar(['ouranos-data.js', 'ouranos-calc.js', 'liturgy.js'], { raiz, geolocation, permissions });  */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* contexto 2D que REGISTRA as chamadas (log) e as propriedades atribuídas (props), para os testes de canvas */
function criarContexto() {
  const log = [], props = {};
  const alvo = { log, props };
  return new Proxy(alvo, {
    get(t, k) {
      if (k in t) return t[k];
      if (k in props) return props[k];
      if (k === 'measureText') return () => ({ width: 10 });
      if (typeof k === 'string' && k.startsWith('create')) return () => ({ addColorStop() {} });
      return (...a) => { log.push([k, ...a]); };
    },
    set(t, k, v) { props[k] = v; return true; },
  });
}

function criarElemento(id) {
  const attrs = {}, ouvintes = {};
  const base = {
    id, innerHTML: '', textContent: '', value: '', style: {}, dataset: {}, children: [], onclick: null, onchange: null,
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute(k, v) { attrs[k] = String(v); }, getAttribute(k) { return k in attrs ? attrs[k] : null; },
    removeAttribute(k) { delete attrs[k]; },
    addEventListener(t, fn) { (ouvintes[t] = ouvintes[t] || []).push(fn); },
    removeEventListener() {},
    dispatch(t, ev) { (ouvintes[t] || []).forEach((fn) => fn(ev || {})); },
    appendChild(c) { base.children.push(c); return c; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, focus() {},
    getContext() { return base._ctx || (base._ctx = criarContexto()); },
    rect: { left: 0, top: 0, width: 700, height: 560 },   /* tamanho "exibido" (os testes mudam) */
    getBoundingClientRect() { return base.rect; },
    _attrs: attrs,
  };
  return base;
}

function carregar(arquivos, opts) {
  opts = opts || {};
  const raiz = opts.raiz || path.join(__dirname, '..');
  const els = {}, docOuvintes = {}, winOuvintes = {};
  const filaTempo = []; let agora = 0, seq = 0;   /* relógio falso: setTimeout só roda em avancar(ms) */
  const telaOuvintes = {};
  const document = {
    getElementById(id) { return els[id] || (els[id] = criarElemento(id)); },
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return criarElemento(''); },
    addEventListener(t, fn) { (docOuvintes[t] = docOuvintes[t] || []).push(fn); },
    removeEventListener() {},
    dispatchEvent(ev) { (docOuvintes[ev.type] || []).slice().forEach((fn) => fn(ev)); return true; },
    activeElement: null, body: criarElemento('body'), documentElement: criarElemento('html'),
  };
  class CustomEvent { constructor(type, init) { this.type = type; this.detail = init && init.detail; } }
  const ctx = {
    console, Math, Date, JSON, Map, Set, Promise, Number, String, Array, Object, isFinite, parseFloat, parseInt, Proxy, Error,
    document, CustomEvent,
    navigator: { geolocation: opts.geolocation || undefined, permissions: opts.permissions || undefined },
    setInterval() { return 1; }, clearInterval() {},
    setTimeout(fn, ms) { const id = ++seq; filaTempo.push({ id, fn, due: agora + (ms || 0) }); return id; },
    clearTimeout(id) { const i = filaTempo.findIndex((t) => t.id === id); if (i >= 0) filaTempo.splice(i, 1); },
    innerWidth: (opts.janela && opts.janela.innerWidth) || 1024, innerHeight: (opts.janela && opts.janela.innerHeight) || 768,
    devicePixelRatio: (opts.janela && opts.janela.devicePixelRatio) || 1,
    screen: { orientation: { addEventListener(t, fn) { (telaOuvintes[t] = telaOuvintes[t] || []).push(fn); } } },
    requestAnimationFrame() { return 0; },
    performance: { now: () => Date.now() },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    localStorage: opts.localStorage, sessionStorage: undefined,
  };
  ctx.window = ctx;
  ctx.addEventListener = (t, fn) => { (winOuvintes[t] = winOuvintes[t] || []).push(fn); };
  ctx.removeEventListener = () => {};
  vm.createContext(ctx);
  arquivos.forEach((f) => vm.runInContext(fs.readFileSync(path.join(raiz, f), 'utf8'), ctx, { filename: f }));
  return {
    ctx, document, els, el: (id) => document.getElementById(id),
    disparaDocumento: (type, detail) => document.dispatchEvent(new CustomEvent(type, { detail })),
    /* avança o relógio falso, executando os setTimeout vencidos em ordem */
    avancar(ms) { const fim = agora + ms; for (;;) { filaTempo.sort((a, b) => a.due - b.due); const t = filaTempo[0]; if (!t || t.due > fim) break; filaTempo.shift(); agora = t.due; t.fn(); } agora = fim; },
    pendentes: () => filaTempo.length,
    disparaTela: (type) => (telaOuvintes[type] || []).forEach((fn) => fn({})),
    /* muda o tamanho da janela e dispara resize (como o navegador) */
    redimensionar(largura, dpr) { if (largura != null) ctx.innerWidth = largura; if (dpr != null) ctx.devicePixelRatio = dpr; (winOuvintes.resize || []).forEach((fn) => fn({})); },
    disparaJanela: (type) => (winOuvintes[type] || []).forEach((fn) => fn({})),
    /* muda a data do relógio da Liturgia (como o campo "Ir para uma data e hora") */
    irPara(valorLocal) { const dt = document.getElementById('dt'); dt.onchange({ target: { value: valorLocal } }); },
    run: (codigo) => vm.runInContext(codigo, ctx),
  };
}
module.exports = { carregar };
