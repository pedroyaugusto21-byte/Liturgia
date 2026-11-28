/* ======================================================================
   ATUALIZAÇÃO DO APP — registro do service worker + aviso "Há uma atualização disponível. Recarregar"
   Script clássico, sem dependências. Único global: window.Atualizacao (só leitura/diagnóstico).

   Fluxo
     1. Registra sw.js (só em https ou localhost; abrindo o arquivo do disco, ignora — como antes).
     2. Uma versão nova instalada fica EM ESPERA (o sw.js não chama mais skipWaiting() sozinho).
        Detectamos isso por registration.waiting (já estava esperando ao abrir a página) e por
        updatefound → statechange 'installed' (chegou com a página aberta). Só conta como atualização se a
        página já tinha um controlador: na primeira instalação não há versão antiga, então não há aviso.
     3. O aviso aparece (discreto, no rodapé). "Recarregar" envia {type:'SKIP_WAITING'} ao worker em espera;
        quando o controllerchange chega, a página recarrega. Se esta janela não pediu a troca (outra janela
        aceitou), NÃO recarrega sozinha: só mostra o aviso de novo, para não perder o que se digita aqui.
     4. Diário com alterações não salvas (Teurgica.temAlteracoesNaoSalvas): antes de pedir a troca, o aviso
        muda para uma confirmação ("Voltar e salvar" / "Recarregar mesmo assim"). Nada é gravado nem apagado
        por este arquivo; o formato dos dados do usuário não muda.
     5. Não deixa o app preso numa versão antiga: o aviso volta a cada abertura enquanto houver versão em espera,
        e o app pergunta ao servidor por versão nova quando volta ao primeiro plano (no máx. a cada 15 min) e a
        cada 60 min com a janela visível.

   Acessibilidade
     · região role="status" (aria-live="polite") sempre presente no DOM, que lê a mensagem quando ela muda;
     · a barra visível é o primeiro elemento do <body>, então o Tab chega nela primeiro; não rouba o foco;
     · Esc dispensa ("Agora não"); ao dispensar, o foco volta a onde estava;
     · não aparece durante a intro (espera o evento 'calendarium:intro-fim' de app.js);
     · sem animação para quem pede menos movimento (ver atualizacao.css).
   ====================================================================== */
(function () {
  'use strict';

  var TXT = {
    aviso: 'Há uma atualização disponível.',
    outraJanela: 'O Calendarium foi atualizado em outra janela.',
    confirmar: 'Há texto no Diário que ainda não foi salvo. Recarregar agora vai descartá-lo.',
    aplicando: 'Aplicando a atualização…',
    falha: 'Não foi possível aplicar a atualização agora. Feche todas as janelas do Calendarium e abra de novo.',
    recarregar: 'Recarregar',
    agoraNao: 'Agora não',
    voltar: 'Voltar e salvar',
    mesmoAssim: 'Recarregar mesmo assim',
    tentar: 'Tentar de novo',
    fechar: 'Fechar',
    grupo: 'Atualização do aplicativo'
  };
  var ESPERA_FALHA_MS = 6000;       /* sem controllerchange depois do SKIP_WAITING → mostra a falha */
  var CHECA_VISIVEL_MS = 15 * 60000;
  var CHECA_PERIODICA_MS = 60 * 60000;

  var estado = 'oculto';            /* oculto | aviso | outraJanela | confirmar | aplicando | falha */
  var pendente = null;              /* 'aviso' | 'outraJanela' esperando a intro acabar */
  var reg = null;
  var tinhaControle = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
  var euPedi = false;               /* esta janela enviou SKIP_WAITING */
  var recarregando = false;
  var dispensado = false;
  var ativadoOutraJanela = false;
  var ultimoFoco = null;
  var timerFalha = null;
  var ultimaChecagem = Date.now();
  var barra, txt, ok, nao, voz;

  /* ---------- utilidades ---------- */
  function introAtiva() {
    var i = document.getElementById('intro');
    return !!i && i.style.display !== 'none';
  }
  function naoSalvo() {
    try { return !!(window.Teurgica && typeof window.Teurgica.temAlteracoesNaoSalvas === 'function' && window.Teurgica.temAlteracoesNaoSalvas()); }
    catch (e) { return false; }
  }
  function recarregar() {
    if (recarregando) return;
    recarregando = true;
    window.location.reload();
  }

  /* ---------- DOM ---------- */
  function montar() {
    if (barra) return;
    voz = document.createElement('div');
    voz.id = 'atualizacaoVoz';
    voz.className = 'atualizacao-voz';
    voz.setAttribute('role', 'status');
    voz.setAttribute('aria-live', 'polite');
    voz.setAttribute('aria-atomic', 'true');

    barra = document.createElement('div');
    barra.id = 'atualizacao';
    barra.className = 'atualizacao';
    barra.setAttribute('role', 'group');
    barra.setAttribute('aria-label', TXT.grupo);
    barra.hidden = true;
    barra.innerHTML =
      '<p class="atualizacao-txt" id="atualizacaoTxt" aria-hidden="true"></p>' +
      '<div class="atualizacao-acoes">' +
        '<button type="button" class="atualizacao-btn atualizacao-btn-ok" id="atualizacaoOk"></button>' +
        '<button type="button" class="atualizacao-btn" id="atualizacaoNao"></button>' +
      '</div>';
    txt = barra.querySelector('#atualizacaoTxt');
    ok = barra.querySelector('#atualizacaoOk');
    nao = barra.querySelector('#atualizacaoNao');

    ok.addEventListener('click', function () { acaoPrincipal(); });
    nao.addEventListener('click', function () { acaoSecundaria(); });
    barra.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && estado !== 'aplicando') { e.preventDefault(); dispensar(); }
    });
    barra.addEventListener('focusin', function (e) {
      if (!barra.contains(e.relatedTarget) && e.relatedTarget && e.relatedTarget !== document.body) ultimoFoco = e.relatedTarget;
    });

    /* a região viva entra no DOM vazia e antes do aviso: leitores de tela só anunciam mudanças em regiões já existentes */
    document.body.insertBefore(barra, document.body.firstChild);
    document.body.insertBefore(voz, document.body.firstChild);
  }

  function pintar() {
    var msg, rOk, rNao, bloqueia = false;
    switch (estado) {
      case 'confirmar': msg = TXT.confirmar; rOk = TXT.voltar; rNao = TXT.mesmoAssim; break;
      case 'aplicando': msg = TXT.aplicando; rOk = TXT.recarregar; rNao = TXT.agoraNao; bloqueia = true; break;
      case 'falha': msg = TXT.falha; rOk = TXT.tentar; rNao = TXT.fechar; break;
      case 'outraJanela': msg = TXT.outraJanela; rOk = TXT.recarregar; rNao = TXT.agoraNao; break;
      default: msg = TXT.aviso; rOk = TXT.recarregar; rNao = TXT.agoraNao;
    }
    txt.textContent = msg;
    ok.textContent = rOk;
    nao.textContent = rNao;
    ok.disabled = bloqueia;
    nao.disabled = bloqueia;
    barra.setAttribute('aria-label', msg);
    barra.hidden = false;
    voz.textContent = msg;
  }

  function definir(novo, moverFoco) {
    estado = novo;
    montar();
    pintar();
    if (moverFoco && !ok.disabled) { try { ok.focus({ preventScroll: true }); } catch (e) { /* ignora */ } }
  }

  /* pede para mostrar; se a intro ainda roda, guarda e espera o 'calendarium:intro-fim' */
  function pedir(modo) {
    if (recarregando || estado === 'aplicando' || estado === 'confirmar') return;   /* não atropela uma ação em curso */
    pendente = modo;
    if (introAtiva()) return;
    pendente = null;
    dispensado = false;
    definir(modo === 'outraJanela' ? 'outraJanela' : 'aviso', false);
  }

  function dispensar() {
    if (!barra || estado === 'oculto') return;
    var tinhaFoco = barra.contains(document.activeElement);
    estado = 'oculto';
    dispensado = true;
    barra.hidden = true;
    voz.textContent = '';
    if (tinhaFoco && ultimoFoco && document.contains(ultimoFoco)) { try { ultimoFoco.focus({ preventScroll: true }); } catch (e) { /* ignora */ } }
  }

  /* ---------- ações ---------- */
  function acaoPrincipal() {
    if (estado === 'confirmar') { voltarParaSalvar(); return; }
    aceitar();
  }
  function acaoSecundaria() {
    if (estado === 'confirmar') { aplicar(); return; }
    dispensar();
  }
  function aceitar() {
    if (naoSalvo()) { definir('confirmar', true); return; }
    aplicar();
  }
  /* "Voltar e salvar": mantém o aviso e leva o foco ao botão Salvar do Diário (ou ao texto) */
  function voltarParaSalvar() {
    definir(ativadoOutraJanela ? 'outraJanela' : 'aviso', false);
    var alvo = document.getElementById('teuSalvar') || document.getElementById('teuTexto');
    if (alvo) { try { alvo.focus({ preventScroll: false }); } catch (e) { /* ignora */ } }
  }
  function aplicar() {
    definir('aplicando', false);
    var espera = reg && reg.waiting;
    if (ativadoOutraJanela || !espera) { recarregar(); return; }   /* nada em espera: a versão nova já é a ativa */
    euPedi = true;
    clearTimeout(timerFalha);
    timerFalha = setTimeout(function () { if (euPedi && !recarregando) { euPedi = false; definir('falha', true); } }, ESPERA_FALHA_MS);
    try { espera.postMessage({ type: 'SKIP_WAITING' }); }
    catch (e) { clearTimeout(timerFalha); euPedi = false; definir('falha', true); }
  }

  /* ---------- service worker ---------- */
  function acompanhar(w) {
    if (!w) return;
    w.addEventListener('statechange', function () {
      if (w.state === 'installed' && navigator.serviceWorker.controller) pedir('aviso');
    });
  }
  function iniciar(registro) {
    reg = registro;
    if (reg.waiting && navigator.serviceWorker.controller) pedir('aviso');
    if (reg.installing) acompanhar(reg.installing);
    reg.addEventListener('updatefound', function () { acompanhar(reg.installing); });
  }
  function checarAtualizacao() {
    ultimaChecagem = Date.now();
    if (reg && typeof reg.update === 'function') { try { reg.update().catch(function () {}); } catch (e) { /* ignora */ } }
  }

  function registrar() {
    var sw = navigator.serviceWorker;
    if (!sw) return;
    sw.addEventListener('controllerchange', function () {
      if (!tinhaControle) { tinhaControle = true; return; }        /* primeira instalação: o worker só assumiu a página */
      if (euPedi) { clearTimeout(timerFalha); recarregar(); return; }
      ativadoOutraJanela = true;                                    /* outra janela aceitou: avisa, não recarrega sozinha */
      pedir('outraJanela');
    });
    try { sw.register('sw.js').then(iniciar).catch(function () {}); } catch (e) { /* ignora */ }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible' && Date.now() - ultimaChecagem > CHECA_VISIVEL_MS) checarAtualizacao();
    });
    setInterval(function () { if (document.visibilityState === 'visible') checarAtualizacao(); }, CHECA_PERIODICA_MS);
  }

  document.addEventListener('calendarium:intro-fim', function () { if (pendente) pedir(pendente); });

  /* PWA: só registra em https (ou localhost); abrindo o arquivo direto do disco, ignora. */
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    if (document.readyState === 'complete') registrar();
    else window.addEventListener('load', registrar);
  }

  window.Atualizacao = {
    estado: function () { return estado; },
    dispensado: function () { return dispensado; },
    verificar: checarAtualizacao
  };
})();
