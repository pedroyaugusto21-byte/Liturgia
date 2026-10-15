/* ======================================================================
   INTRO → ESCOLHA → NAVEGAÇÃO ENTRE ABAS
   ====================================================================== */
(function () {
  const introEl = document.getElementById('intro');
  const earth = document.getElementById('introEarth');
  const sunOrbit = document.getElementById('introOrbitGroup');
  const moonOrbit = document.getElementById('introMoonGroup');
  const orbitPaths = document.querySelectorAll('.intro-orbit-path');
  const pointer = document.getElementById('introPointer');
  const rings = document.querySelectorAll('.intro-ring');
  const title = document.querySelector('.intro-title');

  const choice = document.getElementById('choice');
  const skipBtn = document.getElementById('introSkip');
  const STORE_KEY = 'calendarium.intro.visto';

  /* storage sempre protegido: indisponível/bloqueado = comportamento normal, sem erro */
  function lerSessao() { try { return window.sessionStorage.getItem(STORE_KEY) === '1'; } catch (e) { return false; } }
  function gravarSessao() { try { window.sessionStorage.setItem(STORE_KEY, '1'); } catch (e) { /* ignora */ } }
  const mqReduzido = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)')) || null;
  const movimentoReduzido = () => !!(mqReduzido && mqReduzido.matches);

  let introAtiva = true;
  const timers = [];
  const agendar = (fn, ms) => { timers.push(setTimeout(fn, ms)); };

  /* encerra a intro (concluída ou pulada); o menu volta a ser alcançável por teclado */
  function encerrarIntro(opts) {
    if (!introAtiva) return;
    introAtiva = false;
    timers.forEach(clearTimeout);
    gravarSessao();
    const imediato = !!(opts && opts.imediato);
    const tinhaFoco = introEl.contains(document.activeElement);
    if (imediato) { introEl.style.display = 'none'; }
    else {
      introEl.classList.add('fade-out');
      setTimeout(() => { introEl.style.display = 'none'; }, 1000);
    }
    choice.removeAttribute('inert');
    /* só leva o foco ao menu se a pessoa ainda está na tela de escolha */
    if ((tinhaFoco || document.activeElement === document.body) && choice.style.display !== 'none' && !choice.classList.contains('hide')) {
      const first = document.getElementById('chooseSun');
      if (first && first.focus) first.focus({ preventScroll: true });
    }
  }

  if (lerSessao() || movimentoReduzido()) {
    /* sem repetir na mesma sessão / sem animação para quem pediu menos movimento */
    introAtiva = false;
    introEl.style.display = 'none';
  } else {
    choice.setAttribute('inert', '');
    skipBtn.addEventListener('click', () => encerrarIntro());
    document.addEventListener('keydown', (e) => { if (introAtiva && (e.key === 'Escape' || e.key === 'Esc')) { e.preventDefault(); encerrarIntro(); } });
    if (mqReduzido && mqReduzido.addEventListener) mqReduzido.addEventListener('change', () => { if (movimentoReduzido()) encerrarIntro({ imediato: true }); });
    try { skipBtn.focus({ preventScroll: true }); } catch (e) { /* ignora */ }
    agendar(() => {
      earth.classList.add('fade'); sunOrbit.classList.add('fade'); moonOrbit.classList.add('fade');
      orbitPaths.forEach((p) => p.classList.add('fade')); pointer.classList.add('show');
    }, 5600);
    rings.forEach((r, i) => { agendar(() => r.classList.add('show'), 6900 + i * 830); });
    agendar(() => { title.classList.add('show'); }, 7200);
    agendar(() => encerrarIntro(), 14000);
  }

  const VIEW_IDS = { sun: 'liturgyView', moon: 'lunarView', uranus: 'ouranosView', lyra: 'mysteriesView' };
  const LYRE_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5.2h10"/><path d="M7 5.2Q4.4 9.6 8 15"/><path d="M17 5.2Q19.6 9.6 16 15"/><path d="M8 15a4 2.9 0 0 0 8 0"/><path d="M8.8 6.2v10.54"/><path d="M10.4 6.2v11.46"/><path d="M12 6.2v11.7"/><path d="M13.6 6.2v11.46"/><path d="M15.2 6.2v10.54"/></svg>';
  const VIEWS = [
    { id: 'sun', sym: '☉\uFE0E', cls: 'sun-target', label: 'Calendário Litúrgico', svg: false },
    { id: 'moon', sym: '☽\uFE0E', cls: 'moon-target', label: 'Calendário Lunar', svg: false },
    { id: 'uranus', sym: '♅', cls: 'uranus-target', label: 'Calendário de Urano', svg: false },
    { id: 'lyra', sym: null, cls: 'lyra-target', label: 'Mistérios e Festas', svg: true },
  ];
  const navCluster = document.getElementById('navCluster');
  const menuBtn = document.getElementById('menuBtn');
  const lunarView = document.getElementById('lunarView');
  let currentView = null;

  /* após trocar de aba, o foco vai ao título dela (o botão clicado foi recriado e o foco se perderia) */
  function focarTitulo(viewId) {
    const h = document.querySelector('#' + viewId + ' h1');
    if (!h) return;
    h.setAttribute('tabindex', '-1');
    try { h.focus({ preventScroll: true }); } catch (e) { /* ignora */ }
  }

  function buildNav(v) {
    navCluster.innerHTML = '';
    VIEWS.filter((vw) => vw.id !== v).forEach((vw) => {
      const b = document.createElement('button');
      b.className = 'nav-btn ' + vw.cls;
      b.setAttribute('aria-label', vw.label);
      b.title = vw.label;
      if (vw.svg) b.innerHTML = LYRE_SVG; else b.textContent = vw.sym;
      b.onclick = () => showView(vw.id);
      navCluster.appendChild(b);
    });
  }

  function showView(v) {
    encerrarIntro({ imediato: true });
    currentView = v;
    for (const k in VIEW_IDS) document.getElementById(VIEW_IDS[k]).style.display = (k === v ? 'block' : 'none');
    if (v === 'sun') window.liturgyRender();
    if (v === 'moon') window.lunarRender();
    if (v === 'lyra') window.mystRender();
    if (v === 'uranus') Ouranos.activate(); else Ouranos.deactivate();
    window.scrollTo(0, 0);
    lunarView.scrollTop = 0;
    navCluster.style.display = 'flex';
    menuBtn.style.display = 'flex';
    buildNav(v);
    focarTitulo(VIEW_IDS[v]);
    if (!choice.classList.contains('hide')) {
      choice.classList.add('hide');
      setTimeout(() => { choice.style.display = 'none'; }, 800);
    }
  }

  function showMenu() {
    for (const k in VIEW_IDS) document.getElementById(VIEW_IDS[k]).style.display = 'none';
    Ouranos.deactivate();
    navCluster.style.display = 'none';
    menuBtn.style.display = 'none';
    currentView = null;
    choice.style.display = 'flex';
    choice.classList.remove('hide');
    window.scrollTo(0, 0);
    const primeiro = document.getElementById('chooseSun');
    if (primeiro) primeiro.focus({ preventScroll: true });
  }

  document.getElementById('chooseSun').onclick = () => showView('sun');
  document.getElementById('chooseMoon').onclick = () => showView('moon');
  document.getElementById('chooseUranus').onclick = () => showView('uranus');
  document.getElementById('chooseLyra').onclick = () => showView('lyra');
  document.getElementById('btnMysteries').onclick = () => showView('lyra');
  menuBtn.onclick = showMenu;

  window.Calendarium = {
    show: showView, menu: showMenu,
    get view() { return currentView; },
    info: () => Ouranos.info(),
  };
})();
