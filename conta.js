/* ======================================================================
   CONTA — interface de login e sincronização (aba Teúrgica)
   window.ContaNuvem = { montar(wrap) }   (chamado por teurgica.js ao construir a aba)
   Fala só com window.CalendariumNuvem; se ele não existir, mostra "Login indisponível".
   Sem timers. Textos sempre via textContent.
   ====================================================================== */
(function () {
  'use strict';

  const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };
  const pad = (n) => String(n).padStart(2, '0');
  const N = () => window.CalendariumNuvem || null;
  const hhmm = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : pad(d.getHours()) + ':' + pad(d.getMinutes()); };
  const plural = (n, a, b) => n + ' ' + (n === 1 ? a : b);

  let montada = false, el = {}, aberto = false, ultimoTexto = '', ultimaDecisao = '', fluxoSair = false, fluxoImportar = false, planoImportar = null, ocupadoImportar = false;

  const HTML =
    '<h2 class="ou-sr" id="teuContaH">Conta e sincronização</h2>' +
    '<div class="teu-conta-barra">' +
      '<button type="button" class="teu-btn teu-btn-disc" id="teuContaBtn" aria-expanded="false" aria-controls="teuContaPainel">Conta</button>' +
      '<p class="teu-conta-estado" id="teuContaEstado" role="status" aria-live="polite" aria-atomic="true"></p>' +
    '</div>' +
    '<div class="teu-conta-painel" id="teuContaPainel" hidden>' +
      '<p class="teu-conta-txt" id="teuContaIndisp" hidden></p>' +
      '<form class="teu-conta-form" id="teuContaForm" novalidate hidden>' +
        '<p class="teu-conta-txt">Entre para guardar o diário na sua conta e usá-lo em outros aparelhos. Sem entrar, tudo continua salvo só neste aparelho.</p>' +
        '<div class="teu-conta-campo"><label for="teuContaEmail">E-mail</label><input type="email" id="teuContaEmail" autocomplete="username" inputmode="email" autocapitalize="off" spellcheck="false"></div>' +
        '<div class="teu-conta-campo"><label for="teuContaSenha">Senha</label><input type="password" id="teuContaSenha" autocomplete="current-password"></div>' +
        '<div class="teu-conta-acoes">' +
          '<button type="submit" class="teu-btn teu-btn-ok" id="teuContaEntrar">Entrar</button>' +
          '<button type="button" class="teu-btn" id="teuContaGoogle">Entrar com Google</button>' +
          '<button type="button" class="teu-btn teu-btn-disc" id="teuContaEsqueci">Esqueci a senha</button>' +
        '</div>' +
      '</form>' +
      '<div class="teu-conta-decisao" id="teuContaDecisao" role="group" aria-labelledby="teuContaDecH" hidden>' +
        '<h3 class="teu-conta-dec-h" id="teuContaDecH" tabindex="-1"></h3>' +
        '<p class="teu-conta-txt" id="teuContaDecTxt"></p>' +
        '<div class="teu-conta-acoes" id="teuContaDecAcoes"></div>' +
      '</div>' +
      '<div class="teu-conta-logado" id="teuContaLogado" hidden>' +
        '<p class="teu-conta-txt" id="teuContaInfo"></p>' +
        '<div class="teu-conta-acoes" id="teuContaAcoes">' +
          '<button type="button" class="teu-btn teu-btn-ok" id="teuContaSync">Sincronizar agora</button>' +
          '<button type="button" class="teu-btn teu-btn-disc" id="teuContaBackup">Baixar backup</button>' +
          '<button type="button" class="teu-btn teu-btn-disc" id="teuContaImportar">Importar backup</button>' +
          '<input type="file" id="teuContaArquivo" accept="application/json,.json" hidden>' +
          '<button type="button" class="teu-btn teu-btn-disc" id="teuContaSair">Sair</button>' +
        '</div>' +
        '<div class="teu-conta-decisao" id="teuContaImpBloco" role="group" aria-labelledby="teuContaImpH" hidden>' +
          '<h3 class="teu-conta-dec-h" id="teuContaImpH" tabindex="-1">Importar backup</h3>' +
          '<p class="teu-conta-txt" id="teuContaImpArq"></p>' +
          '<ul class="teu-conta-lista" id="teuContaImpLista"></ul>' +
          '<fieldset class="teu-conta-modo" id="teuContaImpModo">' +
            '<legend>Como importar</legend>' +
            '<label class="teu-conta-radio"><input type="radio" name="teuContaModo" value="mesclar" checked> <span><strong>Mesclar</strong> — junta o backup ao que já está aqui. Em cada dia, fica a versão salva mais recentemente.</span></label>' +
            '<label class="teu-conta-radio"><input type="radio" name="teuContaModo" value="substituir"> <span><strong>Substituir</strong> — deixa este aparelho exatamente como o backup.</span></label>' +
          '</fieldset>' +
          '<p class="teu-conta-txt" id="teuContaImpAviso"></p>' +
          '<div class="teu-conta-acoes" id="teuContaImpAcoes"></div>' +
        '</div>' +
        '<div class="teu-cofre" id="teuCofre" hidden></div>' +
        '<div class="teu-conta-decisao" id="teuContaSairBloco" role="group" aria-labelledby="teuContaSairH" hidden>' +
          '<h3 class="teu-conta-dec-h" id="teuContaSairH" tabindex="-1"></h3>' +
          '<p class="teu-conta-txt" id="teuContaSairTxt"></p>' +
          '<div class="teu-conta-acoes" id="teuContaSairAcoes"></div>' +
        '</div>' +
      '</div>' +
      '<p class="teu-conta-msg" id="teuContaMsg" role="status" aria-live="polite" aria-atomic="true"></p>' +
      '<p class="teu-conta-msg teu-erro" id="teuContaErro" role="alert"></p>' +
    '</div>';

  function botao(rotulo, cls, fn) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'teu-btn' + (cls ? ' ' + cls : ''); b.textContent = rotulo;
    b.addEventListener('click', fn);
    return b;
  }
  function msg(t) { el.msg.textContent = t || ''; el.erro.textContent = ''; }
  function erro(t) { el.erro.textContent = t || ''; if (t) el.msg.textContent = ''; }
  const limparMsgs = () => { el.msg.textContent = ''; el.erro.textContent = ''; };

  /* ---------- backup (mesmo arquivo da "Exportar cópia" do Diário; "Importar backup" lê este mesmo formato) ---------- */
  async function baixarBackup(quieto) {          /* quieto: chamado pela tela do cofre, que mostra a própria mensagem */
    quieto = quieto === true;                    /* os botões passam o evento de clique: só um true explícito silencia */
    const S = window.CalendariumStore;
    if (!S) { if (!quieto) erro('Armazenamento indisponível neste navegador.'); return false; }
    try {
      const dados = await S.exportAll();
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const d = new Date(), a = document.createElement('a');
      a.href = url; a.download = 'calendarium-copia-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => safe(() => URL.revokeObjectURL(url)), 4000);
      if (!quieto) msg('Backup baixado.');
      return true;
    } catch (e) { if (!quieto) erro('Não foi possível baixar o backup.'); return false; }
  }

  /* ---------- importar backup (lógica em importar.js; aqui só a tela) ---------- */
  const I = () => window.CalendariumImportar || null;
  const modoEscolhido = () => { const r = el.impModo.querySelector('input[name="teuContaModo"]:checked'); return r && r.value === 'substituir' ? 'substituir' : 'mesclar'; };

  function linhasResumo(r) {
    const L = [];
    const d = r.diario, f = r.festas, g = r.logs;
    L.push(plural(d.total, 'dia de diário', 'dias de diário') + ' no backup: ' + d.novos + ' novo(s), ' + d.atualizam + ' mais recente(s) que o daqui, ' + d.mantidos + ' já aqui (igual ou mais novo)');
    L.push(plural(f.total, 'festa pessoal', 'festas pessoais') + ' no backup: ' + f.novos + ' nova(s), ' + f.mantidos + ' já aqui');
    L.push(plural(g.total, 'registro de horário', 'registros de horário') + ' no backup: ' + g.novos + ' novo(s), ' + g.mantidos + ' já aqui');
    const ign = r.invalidos.diario + r.invalidos.festas + r.invalidos.diario_log, rep = r.repetidos.diario + r.repetidos.festas + r.repetidos.diario_log;
    if (ign) L.push(plural(ign, 'registro fora do formato será ignorado', 'registros fora do formato serão ignorados'));
    if (rep) L.push(plural(rep, 'repetição dentro do backup será descartada', 'repetições dentro do backup serão descartadas'));
    return L;
  }
  function avisoModo(r, modo) {
    if (modo === 'mesclar') return 'Nada do que já está aqui será apagado.';
    const a = r.diario.apagariam, b = r.festas.apagariam, c = r.logs.apagariam;
    const partes = [];
    if (a) partes.push(plural(a, 'dia de diário', 'dias de diário'));
    if (b) partes.push(plural(b, 'festa pessoal', 'festas pessoais'));
    if (c) partes.push(plural(c, 'registro de horário', 'registros de horário'));
    const sai = partes.length ? 'Serão apagados deste aparelho: ' + partes.join(', ') + ' (não estão no backup). ' : 'Nada será apagado, pois tudo o que está aqui também está no backup. ';
    const nuvem = (N() && N().estado().fase === 'logado') ? 'Como você está conectado, o que for apagado aqui também sairá da sua conta. ' : '';
    return sai + nuvem + 'Isso não pode ser desfeito: baixe um backup do que está aqui antes, se quiser guardá-lo.';
  }
  function atualizarAvisoImportar() {
    if (!planoImportar) return;
    const modo = modoEscolhido();
    el.impAviso.textContent = avisoModo(planoImportar.resumo, modo);
    if (el.impOk) el.impOk.textContent = modo === 'substituir' ? 'Substituir tudo' : 'Mesclar';
  }
  function mostrarImportar(analise, nomeArquivo) {
    planoImportar = analise;
    fluxoImportar = true;
    el.impArq.textContent = 'Arquivo: ' + nomeArquivo + (analise.exportadoEm ? ' (exportado em ' + analise.exportadoEm.slice(0, 10).split('-').reverse().join('/') + ')' : '') + '.';
    el.impLista.textContent = '';
    linhasResumo(analise.resumo).forEach((t) => { const li = document.createElement('li'); li.textContent = t; el.impLista.appendChild(li); });
    const radios = el.impModo.querySelectorAll('input[name="teuContaModo"]');
    radios.forEach((r) => { r.checked = r.value === 'mesclar'; });
    el.impAcoes.textContent = '';
    el.impOk = botao('Mesclar', 'teu-btn-ok', confirmarImportar);
    el.impAcoes.append(el.impOk, botao('Baixar backup do que está aqui', 'teu-btn-disc', baixarBackup), botao('Cancelar', '', cancelarImportar));
    atualizarAvisoImportar();
    el.impBloco.hidden = false; el.acoes.hidden = true;
    safe(() => el.impH.focus());
  }
  function fecharImportar(focarBotao) {
    fluxoImportar = false; planoImportar = null; ocupadoImportar = false;
    el.impBloco.hidden = true; el.acoes.hidden = false;
    if (focarBotao) safe(() => el.importar.focus());
  }
  function cancelarImportar() { limparMsgs(); fecharImportar(true); msg('Importação cancelada. Nada foi alterado.'); }

  async function aoEscolherArquivo() {
    const f = el.arquivo.files && el.arquivo.files[0];
    el.arquivo.value = '';
    limparMsgs();
    if (!f) return;
    const M = I();
    if (!M) { erro('A importação não está disponível nesta versão do site.'); return; }
    if (f.size > M.MAX_BYTES) { erro('Arquivo grande demais (máximo 5 MB).'); return; }
    el.importar.disabled = true;
    try {
      const texto = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('leitura')); r.readAsText(f); });
      const a = await M.analisar(texto);
      if (!a.ok) { erro(a.erro || 'Não foi possível ler o backup.'); return; }
      mostrarImportar(a, f.name);
    } catch (e) { erro('Não foi possível ler o arquivo.'); }
    finally { el.importar.disabled = false; }
  }
  async function confirmarImportar() {
    if (ocupadoImportar || !planoImportar) return;
    const M = I(), n = N(), s = n ? n.estado() : null;
    if (s && s.sincronizando) { erro('A sincronização está em andamento. Espere terminar e tente de novo.'); return; }
    const modo = modoEscolhido();
    ocupadoImportar = true; limparMsgs();
    el.impAcoes.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const r = await M.aplicar(planoImportar.plano, modo);
    ocupadoImportar = false;
    el.impAcoes.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    if (!r.ok) { erro(r.erro || 'Não foi possível importar o backup.'); return; }
    fecharImportar(true);
    const p = [];
    p.push(plural(r.diario.gravados, 'dia gravado', 'dias gravados'));
    p.push(plural(r.festas.gravados, 'festa gravada', 'festas gravadas'));
    p.push(plural(r.logs.gravados, 'registro de horário gravado', 'registros de horário gravados'));
    let t = 'Backup importado (' + (modo === 'substituir' ? 'substituir' : 'mesclar') + '): ' + p.join(', ') + '.';
    if (modo === 'mesclar' && r.diario.mantidos) t += ' ' + plural(r.diario.mantidos, 'dia ficou como estava (versão daqui igual ou mais nova)', 'dias ficaram como estavam (versão daqui igual ou mais nova)') + '.';
    if (modo === 'substituir') { const a = r.diario.apagados + r.festas.apagados + r.logs.apagados; if (a) t += ' ' + plural(a, 'item apagado', 'itens apagados') + ' deste aparelho.'; }
    msg(t);
  }

  /* ---------- texto de estado (sempre em palavras, nunca só cor) ---------- */
  function textoEstado(s) {
    if (!s || s.fase === 'sem-config' || s.fase === 'indisponivel') return 'Login indisponível (dados só neste aparelho)';
    if (s.fase === 'carregando') return 'Carregando o login…';
    if (s.fase === 'deslogado') return 'Sem login (dados só neste aparelho)';
    const quem = 'Conectado como ' + (s.usuario && s.usuario.email ? s.usuario.email : 'sua conta');
    if (s.decisao) return quem + ' — aguardando a sua resposta';
    if (s.sincronizando) return quem + ' — sincronizando…';
    if (s.erro && !s.offline) return quem + ' — erro de sincronização (use "Sincronizar agora" para tentar de novo)';
    if (s.pendencias > 0) return quem + ' — ' + (s.offline ? 'offline, ' : '') + 'pendências: ' + s.pendencias;
    if (s.offline) return quem + ' — offline';
    return quem + (s.ultimoSync ? ' — sincronizado às ' + hhmm(s.ultimoSync) : '');
  }

  function descreverLocais(l) {
    const p = [];
    if (l.diario) p.push(plural(l.diario, 'dia de diário', 'dias de diário'));
    if (l.festas) p.push(plural(l.festas, 'festa pessoal', 'festas pessoais'));
    if (!p.length && l.diario_log) p.push(plural(l.diario_log, 'registro de horário', 'registros de horário'));
    return p.join(' e ');
  }

  /* ---------- decisões de primeiro login / troca de conta ---------- */
  async function responder(escolha, rotuloOk) {
    limparMsgs();
    el.decAcoes.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const r = await N().decidir(escolha);
    el.decAcoes.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    if (r && r.saiu) { msg('Você saiu da conta. Os dados deste aparelho foram mantidos.'); return; }
    if (!r || r.ok === false) { erro((r && r.erro) || 'Não foi possível concluir.'); return; }
    msg(rotuloOk + (typeof r.enviados === 'number' ? ' ' + r.enviados + ' enviado(s), ' + (r.recebidos || 0) + ' recebido(s).' : ''));
  }
  function montarDecisao(d) {
    const chave = d.tipo + '|' + d.locais.total;
    if (chave === ultimaDecisao) return;
    ultimaDecisao = chave;
    el.decAcoes.textContent = '';
    const resumo = descreverLocais(d.locais) || 'dados';
    if (d.tipo === 'migracao') {
      el.decH.textContent = 'Enviar os dados deste aparelho para a conta?';
      el.decTxt.textContent = 'Este aparelho tem ' + resumo + '. Se você enviar, eles serão mesclados ao que já está na conta (vence o salvamento mais recente de cada dia). Se não enviar, ficam só aqui, e o que já está na conta chega a este aparelho.';
      el.decAcoes.append(
        botao('Enviar para a conta', 'teu-btn-ok', () => responder('enviar', 'Sincronizado.')),
        botao('Não enviar', '', () => responder('nao-enviar', 'Sincronizado.')),
        botao('Baixar backup primeiro', 'teu-btn-disc', baixarBackup));
    } else {
      el.decH.textContent = 'Este aparelho tem dados de outra conta';
      el.decTxt.textContent = 'Há ' + resumo + ' guardados aqui que pertencem a uma conta diferente da que você acabou de abrir. Para não misturar contas, é preciso apagá-los deste aparelho antes de continuar (eles continuam na outra conta). Recomendamos baixar um backup primeiro.';
      el.decAcoes.append(
        botao('Baixar backup', 'teu-btn-disc', baixarBackup),
        botao('Apagar daqui e continuar', 'teu-btn-ok', () => responder('apagar-local', 'Dados da conta carregados.')),
        botao('Cancelar e sair da conta', '', () => responder('cancelar', '')));
    }
    abrirPainel(true);
    safe(() => el.decH.focus());
  }

  /* ---------- sair ---------- */
  function mostrarSair(tipo, dados) {
    el.sairAcoes.textContent = '';
    fluxoSair = true;
    el.sairBloco.hidden = false; el.acoes.hidden = true;
    if (tipo === 'perguntar') {
      el.sairH.textContent = 'Apagar os dados deste aparelho ao sair?';
      el.sairTxt.textContent = 'Recomendado em aparelho compartilhado. Seu diário continua guardado na conta; é só entrar de novo para tê-lo de volta.';
      el.sairAcoes.append(
        botao('Sair e apagar daqui', 'teu-btn-ok', () => sairAgora(true, false)),
        botao('Sair e manter aqui', '', () => sairAgora(false, false)),
        botao('Cancelar', 'teu-btn-disc', fecharSair));
    } else {
      el.sairH.textContent = plural(dados.pendentes, 'alteração ainda não subiu', 'alterações ainda não subiram') + ' para a conta';
      el.sairTxt.textContent = dados.apagar
        ? 'Se você sair e apagar agora, ' + (dados.pendentes === 1 ? 'ela será perdida' : 'elas serão perdidas') + '. Baixe um backup antes, ou cancele e tente sincronizar de novo quando houver internet.'
        : 'Se você sair agora, ' + (dados.pendentes === 1 ? 'ela continua' : 'elas continuam') + ' guardada(s) neste aparelho e sobe(m) na próxima vez que você entrar.';
      el.sairAcoes.append(
        botao('Baixar backup', 'teu-btn-disc', baixarBackup),
        botao('Sair mesmo assim', 'teu-btn-ok', () => sairAgora(dados.apagar, true)),
        botao('Cancelar', '', fecharSair));
    }
    safe(() => el.sairH.focus());
  }
  function fecharSair() {
    fluxoSair = false;
    el.sairBloco.hidden = true; el.acoes.hidden = false;
    safe(() => el.sair.focus());
  }
  async function sairAgora(apagar, forcar) {
    limparMsgs();
    el.sairAcoes.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const r = await N().sair({ apagar, forcar });
    el.sairAcoes.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    if (r && r.ok) { fluxoSair = false; msg(r.apagou ? 'Você saiu e os dados deste aparelho foram apagados.' : 'Você saiu da conta. Os dados continuam neste aparelho.'); atualizar(); safe(() => el.email.focus()); return; }
    if (r && r.pendentes) { mostrarSair('pendencias', { pendentes: r.pendentes, apagar }); return; }
    erro((r && r.erro) || 'Não foi possível sair.');
  }

  /* ---------- painel ---------- */
  function abrirPainel(abrir) {
    aberto = abrir;
    el.painel.hidden = !abrir;
    el.btn.setAttribute('aria-expanded', abrir ? 'true' : 'false');
  }

  function atualizar() {
    if (!montada) return;
    const n = N(), s = n ? n.estado() : null;
    const t = textoEstado(s);
    if (t !== ultimoTexto) { ultimoTexto = t; el.estado.textContent = t; }
    const indisp = !s || s.fase === 'sem-config' || s.fase === 'indisponivel';
    const carregando = !!s && s.fase === 'carregando';
    const logado = !!s && s.fase === 'logado';
    el.indisp.hidden = !(indisp || carregando);
    if (indisp) el.indisp.textContent = !s || s.fase === 'sem-config'
      ? 'O login não está configurado nesta versão do site. O diário continua funcionando só neste aparelho.'
      : (s.erro || 'Não foi possível carregar o login agora. O diário continua funcionando só neste aparelho; tente de novo quando estiver online.');
    else if (carregando) el.indisp.textContent = 'Carregando o login…';
    el.form.hidden = !(s && s.fase === 'deslogado');
    el.decisao.hidden = !(logado && s.decisao);
    el.logado.hidden = !(logado && !s.decisao);
    if (logado && s.decisao) montarDecisao(s.decisao); else ultimaDecisao = '';
    if (logado && !s.decisao) {
      const p = [];
      if (s.ultimoSync) p.push('Última sincronização às ' + hhmm(s.ultimoSync) + '.');
      if (s.pendencias) p.push(plural(s.pendencias, 'alteração aguarda', 'alterações aguardam') + ' para subir' + (s.offline ? ' (sem conexão)' : '') + '.');
      if (s.erro) p.push(s.erro);
      el.info.textContent = 'Conectado como ' + (s.usuario.email || 'sua conta') + '. ' + p.join(' ');
      el.sync.disabled = s.sincronizando;
      el.importar.disabled = s.sincronizando;
    } else { fluxoSair = false; el.sairBloco.hidden = true; fluxoImportar = false; planoImportar = null; el.impBloco.hidden = true; el.acoes.hidden = false; }
  }

  /* ---------- ações ---------- */
  async function aoEntrar(e) {
    e.preventDefault();
    limparMsgs();
    const n = N(); if (!n) return;
    el.entrar.disabled = true;
    const r = await n.entrarEmail(el.email.value, el.senha.value);
    el.entrar.disabled = false;
    if (!r.ok) { erro(r.erro); return; }
    el.senha.value = '';
    msg('Conectado.');
  }
  async function aoGoogle() {
    limparMsgs();
    const n = N(); if (!n) return;
    el.google.disabled = true;
    const r = await n.entrarGoogle();
    el.google.disabled = false;
    if (!r.ok) erro(r.erro); else if (r.redirecionando) msg('Abrindo o login do Google…'); else msg('Conectado.');
  }
  async function aoEsqueci() {
    limparMsgs();
    const n = N(); if (!n) return;
    const r = await n.recuperarSenha(el.email.value);
    if (!r.ok) { erro(r.erro); safe(() => el.email.focus()); } else msg(r.aviso);
  }
  async function aoSincronizar() {
    limparMsgs();
    const n = N(); if (!n) return;
    el.sync.disabled = true;
    const r = await n.sincronizar();
    el.sync.disabled = false;
    if (r.ok) msg('Sincronizado: ' + r.enviados + ' enviado(s), ' + r.recebidos + ' recebido(s).'); else erro(r.erro || 'Não foi possível sincronizar.');
  }

  function montar(wrap) {
    if (montada || !wrap) return;
    const ref = wrap.querySelector('.teu-tabs');
    if (!ref) return;
    const sec = document.createElement('section');
    sec.className = 'teu-conta'; sec.setAttribute('aria-labelledby', 'teuContaH');
    sec.innerHTML = HTML;
    ref.insertAdjacentElement('beforebegin', sec);
    const q = (id) => document.getElementById(id);
    el = { btn: q('teuContaBtn'), estado: q('teuContaEstado'), painel: q('teuContaPainel'), indisp: q('teuContaIndisp'), form: q('teuContaForm'),
      email: q('teuContaEmail'), senha: q('teuContaSenha'), entrar: q('teuContaEntrar'), google: q('teuContaGoogle'), esqueci: q('teuContaEsqueci'),
      decisao: q('teuContaDecisao'), decH: q('teuContaDecH'), decTxt: q('teuContaDecTxt'), decAcoes: q('teuContaDecAcoes'),
      logado: q('teuContaLogado'), info: q('teuContaInfo'), acoes: q('teuContaAcoes'), sync: q('teuContaSync'), backup: q('teuContaBackup'), sair: q('teuContaSair'),
      importar: q('teuContaImportar'), arquivo: q('teuContaArquivo'), impBloco: q('teuContaImpBloco'), impH: q('teuContaImpH'), impArq: q('teuContaImpArq'), impLista: q('teuContaImpLista'), impModo: q('teuContaImpModo'), impAviso: q('teuContaImpAviso'), impAcoes: q('teuContaImpAcoes'),
      sairBloco: q('teuContaSairBloco'), sairH: q('teuContaSairH'), sairTxt: q('teuContaSairTxt'), sairAcoes: q('teuContaSairAcoes'),
      msg: q('teuContaMsg'), erro: q('teuContaErro') };
    montada = true;
    if (window.CofreUI && typeof window.CofreUI.montar === 'function') safe(() => window.CofreUI.montar(q('teuCofre')));
    el.btn.addEventListener('click', () => {
      abrirPainel(!aberto);
      if (aberto) { const alvo = !el.form.hidden ? el.email : !el.decisao.hidden ? el.decH : !el.logado.hidden ? el.sync : null; if (alvo) safe(() => alvo.focus()); }
    });
    el.painel.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !aberto) return;
      if (fluxoSair) { e.preventDefault(); fecharSair(); return; }
      if (fluxoImportar) { e.preventDefault(); if (!ocupadoImportar) cancelarImportar(); return; }
      if (!el.decisao.hidden) return;           /* pergunta pendente: só se fecha respondendo */
      e.preventDefault(); abrirPainel(false); safe(() => el.btn.focus());
    });
    el.form.addEventListener('submit', aoEntrar);
    el.google.addEventListener('click', aoGoogle);
    el.esqueci.addEventListener('click', aoEsqueci);
    el.sync.addEventListener('click', aoSincronizar);
    el.backup.addEventListener('click', baixarBackup);
    el.importar.addEventListener('click', () => { limparMsgs(); el.arquivo.click(); });
    el.arquivo.addEventListener('change', aoEscolherArquivo);
    el.impModo.addEventListener('change', atualizarAvisoImportar);
    el.sair.addEventListener('click', () => mostrarSair('perguntar'));
    const n = N();
    if (n && typeof n.onEstado === 'function') n.onEstado(atualizar);
    atualizar();
  }

  window.ContaNuvem = { montar, baixarBackup };
})();
