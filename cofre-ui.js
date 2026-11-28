/* ======================================================================
   COFRE (interface) — proteção opcional do Diário com criptografia de ponta a ponta
   window.CofreUI = { montar(host) }   (chamado por conta.js dentro do painel "Conta", só quando logado)
   Fala só com window.CalendariumNuvem (prepararCofre, ativarCofre, abrirCofre, ...). Sem timers.
   Textos sempre via textContent. Se a criptografia do navegador não existir, a opção nem aparece.
   Fluxos: ativar (explicação → frase → chave de recuperação → backup → progresso),
           destrancar, trocar a frase, "esqueci a frase" (chave de recuperação ou recomeçar), desativar.
   ====================================================================== */
(function () {
  'use strict';

  const N = () => window.CalendariumNuvem || null;
  const safe = (fn, fb) => { try { return fn(); } catch (e) { return fb; } };

  let host = null, sig = '', fluxo = null, D = {}, progEl = null, painelEl = null;

  /* ---------- pequenos helpers de DOM ---------- */
  function h(tag, cls, texto) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }
  function botao(rotulo, cls, fn) {
    const b = h('button', 'teu-btn' + (cls ? ' ' + cls : ''), rotulo);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  let seq = 0;
  function campo(rotulo, tipo, auto) {
    const id = 'teuCofreC' + (++seq);
    const w = h('div', 'teu-conta-campo'), l = h('label', '', rotulo), i = document.createElement('input');
    l.htmlFor = id; i.id = id; i.type = tipo || 'text';
    i.autocomplete = auto || 'off'; i.setAttribute('autocapitalize', 'off'); i.spellcheck = false;
    w.appendChild(l); w.appendChild(i);
    return { w, i };
  }
  function caixa(rotulo, marcada) {
    const l = h('label', 'teu-conta-radio'), i = document.createElement('input'), s = h('span', '', rotulo);
    i.type = 'checkbox'; i.checked = !!marcada;
    l.appendChild(i); l.appendChild(s);
    return { l, i };
  }

  /* painel padrão: título, parágrafos, campos/caixas, ações e áreas de mensagem */
  function painel(titulo, paragrafos) {
    const p = h('div', 'teu-conta-decisao'); p.setAttribute('role', 'group');
    const t = h('h3', 'teu-conta-dec-h', titulo); t.tabIndex = -1; t.id = 'teuCofreT' + (++seq);
    p.setAttribute('aria-labelledby', t.id); p.appendChild(t);
    (paragrafos || []).forEach((x) => {
      const q = h('p', 'teu-conta-txt');
      if (x && x.forte) { const s = h('strong', '', x.forte); q.appendChild(s); } else q.textContent = x;
      p.appendChild(q);
    });
    const ms = h('p', 'teu-conta-msg'); ms.setAttribute('role', 'status'); ms.setAttribute('aria-live', 'polite');
    const er = h('p', 'teu-conta-msg teu-erro'); er.setAttribute('role', 'alert');
    const ac = h('div', 'teu-conta-acoes');
    return {
      el: p, titulo: t, acoes: ac, ms, er,
      add(...xs) { xs.forEach((x) => p.appendChild(x.w || x.l || x)); return this; },
      fim() { p.appendChild(ms); p.appendChild(er); p.appendChild(ac); return this; },
      msg(x) { ms.textContent = x || ''; er.textContent = ''; },
      erro(x) { er.textContent = x || ''; if (x) ms.textContent = ''; },
      ocupado(sim) { ac.querySelectorAll('button').forEach((b) => { b.disabled = !!sim; }); },
    };
  }
  function exigir(botaoEl, caixas) {           /* botão só habilita com todas as caixas marcadas */
    const atualizar = () => { botaoEl.disabled = !caixas.every((c) => c.i.checked); };
    caixas.forEach((c) => c.i.addEventListener('change', atualizar));
    atualizar();
  }
  const frasePronta = (f) => (typeof f === 'string' ? f.normalize('NFKC').trim() : '');

  /* ---------- backup (mesmo arquivo da "Baixar backup" da conta) ---------- */
  async function baixarBackup(p) {
    const C = window.ContaNuvem;
    let feito = false;
    if (C && typeof C.baixarBackup === 'function') feito = await C.baixarBackup(true);
    p.msg(feito ? 'Backup baixado. Guarde o arquivo em lugar seguro: ele fica em texto puro.' : '');
    if (!feito) p.erro('Não foi possível baixar o backup agora.');
    return feito;
  }

  /* ---------- fluxos ---------- */
  function abrir(nome, extra) { fluxo = Object.assign({ nome }, extra || {}); render(true); }
  function fechar(msgFinal) {
    fluxo = null; D = {};
    const n = N(); if (n && n.cancelarCofre) n.cancelarCofre();
    render(true);
    if (msgFinal && painelEl) { const m = painelEl.querySelector('.teu-cofre-ms'); if (m) m.textContent = msgFinal; }
  }
  const cancelar = () => fechar('');

  function telaExplica() {
    const p = painel('Proteger o Diário com criptografia de ponta a ponta', [
      'Hoje a cópia do seu Diário na nuvem pode ser lida pelo Google. Com esta proteção, o texto, o clima e os registros de horário são embaralhados neste aparelho, antes de subir, e só a sua frase consegue abri-los.',
      { forte: 'Atenção, isto não tem volta fácil: se você esquecer a frase e perder a chave de recuperação, ninguém — nem eu, nem o Google — consegue recuperar a cópia da nuvem. O que estiver guardado em algum aparelho seu continua lá.' },
      'O que continua visível para o Google: quais dias têm entrada e a hora do último salvamento de cada dia. O Diário neste aparelho continua sem proteção extra, arquivos de backup baixados ficam em texto puro, e as festas pessoais não são cifradas.',
      'A proteção é opcional e pode ser desligada depois. O modo sem login não muda em nada.',
    ]);
    const c1 = caixa('Entendi que, sem a frase e sem a chave de recuperação, a cópia na nuvem se perde.');
    const c2 = caixa('Vou guardar a chave de recuperação em lugar seguro, fora deste aparelho.');
    p.add(c1, c2).fim();
    const ok = botao('Continuar', 'teu-btn-ok', () => { fluxo.passo = 'frase'; render(true); });
    p.acoes.appendChild(ok); p.acoes.appendChild(botao('Cancelar', 'teu-btn-disc', cancelar));
    exigir(ok, [c1, c2]);
    return p;
  }

  function telaFrase() {
    const rec = fluxo.nome === 'recomecar';
    const p = painel(rec ? 'Nova frase para recomeçar o cofre' : 'Escolha a frase do Diário', [
      'Esta frase é só do Diário e é diferente da senha da conta. O "Esqueci a senha" do e-mail não a recupera. Use pelo menos 12 caracteres; quatro ou cinco palavras ao acaso funcionam bem.',
    ]);
    const f1 = campo('Frase do Diário', 'password', 'new-password'), f2 = campo('Repita a frase', 'password', 'new-password');
    const ver = caixa('Mostrar a frase');
    ver.i.addEventListener('change', () => { f1.i.type = f2.i.type = ver.i.checked ? 'text' : 'password'; });
    p.add(f1, f2, ver).fim();
    const ir = botao('Continuar', 'teu-btn-ok', async () => {
      p.msg('');
      const a = frasePronta(f1.i.value);
      if (a.length < 12) { p.erro('A frase precisa ter pelo menos 12 caracteres.'); return; }
      if (a !== frasePronta(f2.i.value)) { p.erro('As duas frases não são iguais.'); return; }
      p.ocupado(true); p.msg('Preparando a proteção…');
      const r = await N().prepararCofre(a);
      p.ocupado(false);
      if (!r.ok) { p.erro(r.erro || 'Não foi possível preparar a proteção.'); return; }
      f1.i.value = f2.i.value = '';
      D.recuperacao = r.recuperacao || null;
      fluxo.passo = D.recuperacao ? 'recuperacao' : 'backup'; render(true);
    });
    p.acoes.appendChild(ir); p.acoes.appendChild(botao('Cancelar', 'teu-btn-disc', cancelar));
    return p;
  }

  function telaRecuperacao() {
    const p = painel('Guarde a chave de recuperação', [
      'Esta é a única forma de abrir o Diário se você esquecer a frase. Ela aparece só agora. Anote em papel ou guarde num gerenciador de senhas, fora deste aparelho.',
    ]);
    const cod = h('p', 'teu-conta-txt'), c = h('code'); c.style.cssText = 'font-size:18px;letter-spacing:.08em;user-select:all';
    c.setAttribute('aria-label', 'Chave de recuperação: ' + (D.recuperacao || '').split('-').join(', '));
    (D.recuperacao || '').split('-').forEach((g, i) => {                      /* quebra de linha só entre grupos */
      if (i) c.appendChild(document.createTextNode('-'));
      const sp = h('span', '', g); sp.style.whiteSpace = 'nowrap'; c.appendChild(sp);
    });
    cod.appendChild(c);
    const conf = campo('Para confirmar, digite os dois últimos grupos da chave', 'text', 'off');
    p.add(cod, conf).fim();
    p.acoes.appendChild(botao('Copiar', 'teu-btn-disc', async () => {
      try { await navigator.clipboard.writeText(D.recuperacao); p.msg('Chave copiada. Cole-a num lugar seguro e limpe a área de transferência.'); }
      catch (e) { p.erro('Não foi possível copiar. Anote a chave à mão.'); }
    }));
    p.acoes.appendChild(botao('Baixar arquivo', 'teu-btn-disc', () => {
      const txt = 'Calendarium — chave de recuperação do Diário\n\n' + D.recuperacao + '\n\nGuarde este arquivo fora do aparelho. Quem tiver esta chave e a sua conta consegue abrir o Diário na nuvem.\n';
      const url = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
      const a = document.createElement('a'); a.href = url; a.download = 'calendarium-chave-de-recuperacao.txt';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => safe(() => URL.revokeObjectURL(url)), 4000);
      p.msg('Arquivo baixado.');
    }));
    p.acoes.appendChild(botao('Continuar', 'teu-btn-ok', () => {
      const ult = (D.recuperacao || '').split('-').slice(-2).join('');
      const dig = conf.i.value.toUpperCase().replace(/[\s-]/g, '');
      if (dig !== ult) { p.erro('Não confere com os dois últimos grupos da chave. Confira o que você guardou.'); return; }
      fluxo.passo = 'backup'; render(true);
    }));
    p.acoes.appendChild(botao('Cancelar', 'teu-btn-disc', cancelar));
    return p;
  }

  function telaBackup() {
    const rec = fluxo.nome === 'recomecar';
    const p = painel('Backup antes de proteger', [
      rec ? 'A cópia da nuvem será apagada e recriada a partir deste aparelho. Baixe agora uma cópia do que está aqui.'
        : 'Vamos regravar o seu Diário na nuvem em formato cifrado. Por segurança, baixe agora uma cópia do que está neste aparelho.',
      'O arquivo fica em texto puro: guarde com cuidado e apague quando não precisar mais.',
    ]);
    const ok = caixa('Baixei o backup e guardei o arquivo.');
    p.add(ok).fim();
    p.acoes.appendChild(botao('Baixar backup agora', 'teu-btn-disc', () => baixarBackup(p)));
    const go = botao(rec ? 'Recomeçar e proteger' : 'Proteger agora', 'teu-btn-ok', () => { fluxo.passo = 'progresso'; render(true); });
    p.acoes.appendChild(go); p.acoes.appendChild(botao('Cancelar', 'teu-btn-disc', cancelar));
    exigir(go, [ok]);
    return p;
  }

  function telaProgresso() {
    const rec = fluxo.nome === 'recomecar';
    const p = painel('Protegendo o Diário…', ['Não feche esta tela até terminar. Se algo falhar, nada em texto legível é apagado e você pode continuar depois.']);
    progEl = h('p', 'teu-conta-txt'); progEl.setAttribute('role', 'status'); progEl.setAttribute('aria-live', 'polite');
    p.add(progEl).fim(); p.ocupado(true);
    atualizarProgresso();
    N().ativarCofre(rec ? { recomecar: true } : {}).then((r) => {
      if (!fluxo || fluxo.passo !== 'progresso') return;
      if (r.ok) { D.protegidos = r.protegidos; fluxo.passo = 'pronto'; render(true); return; }
      p.erro(r.erro || 'Não foi possível concluir.');
      p.acoes.textContent = '';
      p.acoes.appendChild(botao('Tentar de novo', 'teu-btn-ok', () => { fluxo.passo = 'progresso'; render(true); }));
      p.acoes.appendChild(botao('Fechar', 'teu-btn-disc', () => { fluxo = null; render(true); }));
      p.titulo.focus();
    });
    return p;
  }
  function atualizarProgresso() {
    if (!progEl || !progEl.isConnected) return;
    const s = N() && N().estado(), pr = s && s.cofre && s.cofre.progresso;
    progEl.textContent = !pr ? 'Preparando…' : pr.etapa === 'cifrando' ? 'Cifrando e enviando… ' + pr.feitos + ' de ' + pr.total
      : pr.etapa === 'verificando' ? 'Conferindo que tudo foi gravado corretamente…' : 'Preparando…';
  }

  function telaPronto() {
    const p = painel('Diário protegido', [
      (D.protegidos || 0) + ' itens foram cifrados e conferidos. A cópia na nuvem agora só abre com a sua frase. Em outros aparelhos, entre na conta e digite a frase para destrancar.',
      'Cópias antigas em texto legível podem permanecer por algum tempo em backups do Google, se você os tiver ligado.',
    ]).fim();
    p.acoes.appendChild(botao('Concluir', 'teu-btn-ok', () => fechar('Proteção ligada.')));
    return p;
  }

  function telaDestrancar() {
    const p = painel('Destrancar o Diário', ['Digite a frase do Diário para ler e enviar a cópia protegida da nuvem neste aparelho.']);
    const f = campo('Frase do Diário', 'password', 'current-password');
    const lem = caixa('Lembrar neste aparelho (a chave fica guardada aqui, sem a frase)', N() && N().estado().cofre.lembrar);
    lem.i.addEventListener('change', () => N().lembrarNeste(lem.i.checked));
    p.add(f, lem).fim();
    const go = async () => {
      p.msg(''); p.ocupado(true); p.msg('Verificando a frase…');
      const r = await N().abrirCofre(f.i.value);
      p.ocupado(false);
      if (!r.ok) { p.erro(r.erro); safe(() => f.i.focus()); return; }
      f.i.value = ''; fechar('Destrancado.');
    };
    f.i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
    p.acoes.appendChild(botao('Destrancar', 'teu-btn-ok', go)); p.acoes.appendChild(botao('Cancelar', 'teu-btn-disc', cancelar));
    return p;
  }

  function telaTrocar() {
    const p = painel('Trocar a frase do Diário', ['A nova frase passa a abrir o cofre. Nada do Diário precisa ser regravado, e a chave de recuperação continua valendo.']);
    const a = campo('Frase atual', 'password', 'current-password'), n1 = campo('Nova frase', 'password', 'new-password'), n2 = campo('Repita a nova frase', 'password', 'new-password');
    p.add(a, n1, n2).fim();
    p.acoes.appendChild(botao('Trocar a frase', 'teu-btn-ok', async () => {
      p.msg('');
      const nova = frasePronta(n1.i.value);
      if (nova.length < 12) { p.erro('A nova frase precisa ter pelo menos 12 caracteres.'); return; }
      if (nova !== frasePronta(n2.i.value)) { p.erro('As duas frases novas não são iguais.'); return; }
      p.ocupado(true); p.msg('Trocando…');
      const r = await N().trocarFrase(a.i.value, nova);
      p.ocupado(false);
      if (!r.ok) { p.erro(r.erro); return; }
      a.i.value = n1.i.value = n2.i.value = ''; fechar('Frase trocada. A frase antiga não vale mais.');
    }));
    p.acoes.appendChild(botao('Cancelar', 'teu-btn-disc', cancelar));
    return p;
  }

  function telaEsqueci() {
    const p = painel('Esqueci a frase', ['Se você guardou a chave de recuperação, ela abre o Diário e permite definir uma nova frase.']);
    const k = campo('Chave de recuperação', 'text', 'off'), n1 = campo('Nova frase', 'password', 'new-password'), n2 = campo('Repita a nova frase', 'password', 'new-password');
    p.add(k, n1, n2).fim();
    p.acoes.appendChild(botao('Destrancar com a chave', 'teu-btn-ok', async () => {
      p.msg('');
      const nova = frasePronta(n1.i.value);
      if (nova.length < 12) { p.erro('A nova frase precisa ter pelo menos 12 caracteres.'); return; }
      if (nova !== frasePronta(n2.i.value)) { p.erro('As duas frases novas não são iguais.'); return; }
      p.ocupado(true); p.msg('Verificando a chave…');
      const r = await N().abrirComRecuperacao(k.i.value, nova);
      p.ocupado(false);
      if (!r.ok) { p.erro(r.erro); return; }
      k.i.value = n1.i.value = n2.i.value = ''; fechar('Destrancado com a chave. A nova frase já vale.');
    }));
    p.acoes.appendChild(botao('Não tenho a chave…', 'teu-btn-disc', () => abrir('recomecar', { passo: 'aviso' })));
    p.acoes.appendChild(botao('Cancelar', 'teu-btn-disc', cancelar));
    return p;
  }

  function telaRecomecarAviso() {
    const p = painel('Recomeçar o cofre', [
      { forte: 'Sem a frase e sem a chave de recuperação, a cópia protegida da nuvem não pode ser recuperada.' },
      'Você pode recomeçar: a cópia da nuvem é apagada e este aparelho a recria, protegida por uma frase nova. Isso só funciona se ESTE aparelho ainda tiver o seu Diário; o que existir apenas na nuvem se perde.',
    ]);
    const conf = campo('Para confirmar, digite RECOMEÇAR', 'text', 'off');
    p.add(conf).fim();
    p.acoes.appendChild(botao('Continuar', 'teu-btn-ok', () => {
      if (conf.i.value.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') !== 'RECOMECAR') { p.erro('Digite RECOMEÇAR para confirmar.'); return; }
      fluxo.passo = 'frase'; render(true);
    }));
    p.acoes.appendChild(botao('Cancelar', 'teu-btn-disc', cancelar));
    return p;
  }

  function telaDesativar() {
    const p = painel('Desativar a proteção', [
      { forte: 'Desativar decifra o Diário e o guarda de novo em texto legível na nuvem; o Google poderá lê-lo.' },
      'Baixe um backup antes. Você pode ligar a proteção de novo quando quiser.',
    ]);
    const ok = caixa('Baixei o backup e quero desativar a proteção.');
    p.add(ok).fim();
    p.acoes.appendChild(botao('Baixar backup agora', 'teu-btn-disc', () => baixarBackup(p)));
    const go = botao('Desativar a proteção', 'teu-btn-ok', async () => {
      p.ocupado(true); p.msg('Decifrando e conferindo…');
      const r = await N().desativarCofre();
      p.ocupado(false); go.disabled = !ok.i.checked;
      if (!r.ok) { p.erro(r.erro); return; }
      fechar('Proteção desligada. ' + r.desfeitos + ' itens voltaram ao formato legível na nuvem.');
    });
    p.acoes.appendChild(go); p.acoes.appendChild(botao('Cancelar', 'teu-btn-disc', cancelar));
    exigir(go, [ok]);
    return p;
  }

  /* ---------- tela inicial (sem fluxo aberto) ---------- */
  function telaInicio(s) {
    const c = s.cofre, w = h('div', 'teu-cofre-inicio');
    const t = h('h3', 'teu-conta-dec-h', 'Proteção do Diário (criptografia de ponta a ponta)'); w.appendChild(t);
    const tx = h('p', 'teu-conta-txt'); w.appendChild(tx);
    const ac = h('div', 'teu-conta-acoes'); w.appendChild(ac);
    const ms = h('p', 'teu-conta-msg teu-cofre-ms'); ms.setAttribute('role', 'status'); ms.setAttribute('aria-live', 'polite'); w.appendChild(ms);
    const sem = !c.disponivel;
    if (c.fase === 'desconhecido') tx.textContent = 'Verificando a proteção… (precisa de conexão).';
    else if (c.fase === 'nenhum') {
      if (sem) return null;                                         /* sem WebCrypto a opção nem aparece */
      tx.textContent = 'Desligada. Hoje a cópia do Diário na nuvem pode ser lida pelo Google. Você pode proteger o texto, o clima e os horários com uma frase só sua.';
      ac.appendChild(botao('Proteger o Diário…', 'teu-btn-ok', () => abrir('ativar', { passo: 'explica' })));
    } else if (sem) tx.textContent = 'O Diário na nuvem está protegido, mas este navegador não oferece a criptografia necessária (é preciso abrir o site por HTTPS). O Diário daqui continua funcionando.';
    else if (c.fase === 'trancado') {
      tx.textContent = (c.estado === 'migrando' ? 'Proteção iniciada, mas incompleta, e trancada neste aparelho. ' : 'Ligada e trancada neste aparelho. ')
        + 'O Diário daqui continua funcionando, mas não sincroniza até você destrancar.';
      ac.appendChild(botao('Destrancar…', 'teu-btn-ok', () => abrir('destrancar')));
      ac.appendChild(botao('Esqueci a frase…', 'teu-btn-disc', () => abrir('esqueci')));
    } else {
      const p = [c.estado === 'migrando' ? 'Proteção incompleta: ainda há dias sem proteger.' : 'Ligada e destrancada.'];
      if (c.adiados > 0) p.push(c.adiados + ' alteração(ões) esperam para subir.');
      if (c.ilegiveis > 0) p.push(c.ilegiveis + ' documento(s) da nuvem não puderam ser lidos (dado corrompido ou de outra chave); nada foi alterado.');
      tx.textContent = p.join(' ');
      if (c.estado === 'migrando') ac.appendChild(botao('Continuar a proteção', 'teu-btn-ok', () => abrir('ativar', { passo: 'progresso' })));
      ac.appendChild(botao('Trancar agora', 'teu-btn-disc', async () => { await N().trancar(); }));
      ac.appendChild(botao('Trocar a frase…', 'teu-btn-disc', () => abrir('trocar')));
      ac.appendChild(botao('Desativar a proteção…', 'teu-btn-disc', () => abrir('desativar')));
      const lem = caixa('Lembrar neste aparelho', c.lembrar);
      lem.i.addEventListener('change', () => N().lembrarNeste(lem.i.checked));
      w.insertBefore(lem.l, ms);
    }
    return w;
  }

  /* ---------- render ---------- */
  function assinatura(s) {
    const c = s && s.cofre ? s.cofre : {};
    if (fluxo) return 'fluxo|' + fluxo.nome + ':' + (fluxo.passo || '');      /* com um fluxo aberto, mudanças de estado NÃO o reiniciam (ex.: a migração já em curso) */
    return [!!s, s && s.fase, !!(s && s.decisao), c.fase, c.estado, c.disponivel, c.lembrar, c.adiados, c.ilegiveis, fluxo ? fluxo.nome + ':' + (fluxo.passo || '') : '-'].join('|');
  }
  function render(forcar) {
    if (!host) return;
    const n = N(), s = n ? n.estado() : null;
    const visivel = !!s && s.fase === 'logado' && !s.decisao && !!s.cofre;
    const novo = visivel ? assinatura(s) : 'oculto';
    if (!forcar && novo === sig) { atualizarProgresso(); return; }
    sig = novo; host.textContent = ''; progEl = null; painelEl = null;
    if (!visivel) { host.hidden = true; if (fluxo) { fluxo = null; D = {}; } return; }
    let el;
    if (fluxo) {
      const passo = fluxo.passo;
      el = fluxo.nome === 'ativar' || fluxo.nome === 'recomecar'
        ? (passo === 'explica' ? telaExplica() : passo === 'aviso' ? telaRecomecarAviso() : passo === 'frase' ? telaFrase() : passo === 'recuperacao' ? telaRecuperacao()
          : passo === 'backup' ? telaBackup() : passo === 'progresso' ? telaProgresso() : passo === 'pronto' ? telaPronto() : null)
        : fluxo.nome === 'destrancar' ? telaDestrancar() : fluxo.nome === 'trocar' ? telaTrocar() : fluxo.nome === 'esqueci' ? telaEsqueci() : fluxo.nome === 'desativar' ? telaDesativar() : null;
      if (el) { painelEl = el.el || el; host.appendChild(painelEl); host.hidden = false; safe(() => (el.titulo || painelEl.querySelector('h3')).focus()); return; }
      fluxo = null;
    }
    el = telaInicio(s);
    if (!el) { host.hidden = true; return; }
    painelEl = el; host.appendChild(el); host.hidden = false;
  }

  function montar(h0) {
    if (!h0 || host) return;
    host = h0;
    const n = N();
    if (n && typeof n.onEstado === 'function') n.onEstado(() => render(false));
    host.addEventListener('keydown', (e) => { if (e.key === 'Escape' && fluxo && fluxo.passo !== 'progresso') { e.preventDefault(); e.stopPropagation(); cancelar(); } });
    render(true);
  }

  window.CofreUI = { montar };
})();
