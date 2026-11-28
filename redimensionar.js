/* ======================================================================
   CALENDARIUM — redimensionamento (etapa C)
   window.CalendariumResize = { aoRedimensionar(fn) → função que cancela, ESPERA_MS }

   Um único ouvinte de resize / orientationchange / screen.orientation "change", com debounce:
   rajadas de eventos (arrastar a borda da janela, girar o aparelho) viram UMA chamada, ESPERA_MS depois do último
   evento (o iOS costuma informar o tamanho antigo logo após girar, por isso a espera). Cada aba assina a sua função
   e decide sozinha se precisa redesenhar. Uma assinatura que lança erro não impede as outras.
   ====================================================================== */
(function () {
  'use strict';
  const ESPERA_MS = 200;
  const assinantes = [];
  let relogio = null;
  function disparar() {
    relogio = null;
    assinantes.slice().forEach((fn) => {
      try { fn(); } catch (e) { if (window.console && console.error) console.error('CalendariumResize:', e); }
    });
  }
  function agendar() {
    if (relogio !== null) clearTimeout(relogio);
    relogio = setTimeout(disparar, ESPERA_MS);
  }
  window.addEventListener('resize', agendar);
  window.addEventListener('orientationchange', agendar);
  try { if (window.screen && screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', agendar); } catch (e) { /* ignora */ }
  window.CalendariumResize = {
    ESPERA_MS,
    aoRedimensionar(fn) {
      if (typeof fn !== 'function') return function () {};
      if (assinantes.indexOf(fn) < 0) assinantes.push(fn);
      return function () { const i = assinantes.indexOf(fn); if (i >= 0) assinantes.splice(i, 1); };
    },
  };
})();
