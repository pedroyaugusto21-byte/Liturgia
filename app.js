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

  setTimeout(() => {
    earth.classList.add('fade'); sunOrbit.classList.add('fade'); moonOrbit.classList.add('fade');
    orbitPaths.forEach((p) => p.classList.add('fade')); pointer.classList.add('show');
  }, 5600);
  rings.forEach((r, i) => { setTimeout(() => r.classList.add('show'), 6900 + i * 830); });
  setTimeout(() => { title.classList.add('show'); }, 7200);
  setTimeout(() => {
    introEl.classList.add('fade-out');
    setTimeout(() => { introEl.style.display = 'none'; }, 1000);
  }, 14000);

  const choice = document.getElementById('choice');
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
