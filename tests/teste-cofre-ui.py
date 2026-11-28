"""Teste de tela do cofre no Chromium (Playwright, Python). Uso: python3 tests/teste-cofre-ui.py
Serve o site localmente, troca o SDK do Firebase pelo FALSO (tests/_sdk-falso.js) e percorre a ativação do cofre
pela interface em tela de celular. Salva capturas em /tmp/cofre-ui-*.png."""
import http.server, socketserver, threading, os, sys, json, functools
from playwright.sync_api import sync_playwright

RAIZ = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
Handler = functools.partial(Q, directory=RAIZ)
srv = socketserver.TCPServer(('127.0.0.1', 0), Handler); PORTA = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()

SDK = open(os.path.join(RAIZ, 'tests', '_sdk-falso.js'), encoding='utf8').read() + """
;(function(){ const A = window.SdkFalso; const srv = A.criarServidor(); const dev = { cb: null, appCheckOk: true, ordem: [] };
  /* o servidor falso e o login sobrevivem a recarregar a página (sessionStorage), como um servidor de verdade */
  class PMap extends Map { set(k, v) { super.set(k, v); this._s(); return this; } delete(k) { const r = super.delete(k); this._s(); return r; } _s() { try { sessionStorage.__DOCS = JSON.stringify([...this]); } catch (e) {} } }
  srv.docs = new PMap(JSON.parse(sessionStorage.__DOCS || '[]'));
  let u = JSON.parse(sessionStorage.__USER || 'null');
  Object.defineProperty(dev, 'user', { get() { return u; }, set(v) { u = v; sessionStorage.__USER = JSON.stringify(v); } });
  window.__SRV = srv; window.__DEV = dev;
  window.FIREBASE_SDK_TESTE = { app: { initializeApp: () => ({}) }, auth: A.authFalso(dev), firestore: A.firestoreFalso(srv, dev), appCheck: null }; })();
"""
ok = falhas = 0
def t(nome, cond, extra=''):
    global ok, falhas
    if cond: ok += 1; print('  ok  ' + nome)
    else: falhas += 1; print('  FALHOU  ' + nome + ' ' + str(extra))

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, service_workers='block', accept_downloads=True)
    ctx.add_init_script(SDK)
    pg = ctx.new_page(); erros = []
    pg.on('pageerror', lambda e: erros.append(str(e))); pg.on('console', lambda m: erros.append(m.text) if m.type == 'error' else None)
    pg.goto('http://127.0.0.1:%d/index.html' % PORTA)
    pg.click('#chooseTeurgica'); pg.wait_for_selector('#teuContaBtn')
    pg.evaluate("""async () => { const S = window.CalendariumStore;
      for (const d of ['2026-03-01','2026-03-02','2026-03-03']) { await S.put('diario', { data: d, id: 'i'+d, texto: 'segredo do dia ' + d + ' ação', clima: { amanhecer: ['sol'], entardecer: [], noite: [] }, photagogia: false, criadoEm: d+'T09:00:00.000Z', salvoEm: d+'T10:00:00.000Z' });
        await S.add('diario_log', { data: d, salvoEm: d+'T10:00:00.000Z', hora: '10:00:00', horas: 10, acao: 'criou' }); } }""")
    pg.click('#teuContaBtn'); pg.fill('#teuContaEmail', 'ana@x.com'); pg.fill('#teuContaSenha', 'senha'); pg.click('#teuContaEntrar')
    pg.get_by_role('button', name='Enviar para a conta').click()
    pg.wait_for_selector('#teuCofre:not([hidden])')
    pg.screenshot(path='/tmp/cofre-ui-1-inicio.png')
    t('opção "Proteger o Diário…" aparece logado', pg.get_by_role('button', name='Proteger o Diário…').is_visible())
    pg.get_by_role('button', name='Proteger o Diário…').click()
    cont = pg.get_by_role('button', name='Continuar', exact=True)
    t('explicação em pt-BR com aviso de perda', 'ninguém — nem eu, nem o Google' in pg.inner_text('#teuCofre'))
    t('Continuar começa desabilitado', cont.is_disabled())
    pg.screenshot(path='/tmp/cofre-ui-2-explicacao.png', full_page=False)
    pg.get_by_label('Entendi que, sem a frase').check(); t('só uma caixa não basta', cont.is_disabled())
    pg.get_by_label('Vou guardar a chave de recuperação').check(); cont.click()
    pg.get_by_label('Frase do Diário', exact=True).fill('curta'); pg.get_by_label('Repita a frase').fill('curta'); cont.click()
    t('frase curta é recusada', '12 caracteres' in pg.inner_text('#teuCofre'))
    pg.get_by_label('Frase do Diário', exact=True).fill('minha frase longa do diário'); pg.get_by_label('Repita a frase').fill('outra coisa bem diferente'); cont.click()
    t('frases diferentes são recusadas', 'não são iguais' in pg.inner_text('#teuCofre'))
    pg.get_by_label('Repita a frase').fill('minha frase longa do diário'); cont.click()
    pg.wait_for_selector('code')
    chave = pg.inner_text('code').strip().replace('\n',''); t('chave de recuperação em 8 grupos', len(chave.split('-')) == 8, chave)
    pg.screenshot(path='/tmp/cofre-ui-3-chave.png')
    cont.click(); t('chave errada não avança', 'Não confere' in pg.inner_text('#teuCofre'))
    pg.get_by_label('Para confirmar, digite os dois últimos grupos da chave').fill(''.join(chave.split('-')[-2:]).lower()); cont.click()
    pg.wait_for_selector('text=Backup antes de proteger')
    go = pg.get_by_role('button', name='Proteger agora'); t('Proteger agora desabilitado até baixar o backup', go.is_disabled())
    with pg.expect_download() as d: pg.get_by_role('button', name='Baixar backup agora').click()
    t('backup baixado', d.value.suggested_filename.startswith('calendarium-copia-'))
    pg.get_by_label('Baixei o backup').check(); pg.screenshot(path='/tmp/cofre-ui-4-backup.png'); go.click()
    pg.wait_for_selector('text=Diário protegido', timeout=30000)
    pg.screenshot(path='/tmp/cofre-ui-5-pronto.png')
    pg.get_by_role('button', name='Concluir').click()
    texto = pg.evaluate("JSON.stringify([...window.__SRV.docs].filter(([k]) => /\\/(diario|diario_log)\\//.test(k)))")
    cofre = pg.evaluate("window.__SRV.docs.get('usuarios/u-ana/cofre/principal')")
    t('nuvem só tem texto cifrado', 'segredo' not in texto and '"ct"' in texto)
    t('cofre ativo e sem a frase na nuvem', cofre['estado'] == 'ativo' and 'minha frase' not in json.dumps(cofre))
    t('Diário local continua legível', pg.evaluate("window.CalendariumStore.get('diario','2026-03-02').then(v => v.texto)") == 'segredo do dia 2026-03-02 ação')
    t('estado destrancado na tela', 'Ligada e destrancada' in pg.inner_text('#teuCofre'))
    pg.screenshot(path='/tmp/cofre-ui-6-ligado.png')
    # trancar e destrancar pela interface; chave guardada no aparelho
    pg.get_by_role('button', name='Trancar agora').click(); pg.wait_for_selector('text=trancada neste aparelho')
    pg.get_by_role('button', name='Destrancar…').click()
    pg.get_by_label('Frase do Diário').fill('frase errada de propósito'); pg.get_by_role('button', name='Destrancar', exact=True).click()
    pg.wait_for_selector('text=Frase incorreta'); pg.screenshot(path='/tmp/cofre-ui-7-errada.png')
    pg.get_by_label('Lembrar neste aparelho').check()
    pg.get_by_label('Frase do Diário').fill('minha frase longa do diário'); pg.get_by_role('button', name='Destrancar', exact=True).click()
    pg.wait_for_selector('text=Ligada e destrancada')
    t('destrancou com a frase certa', True)
    # recarregar: com "lembrar", a chave (CryptoKey não extraível no IndexedDB) destranca sozinha
    pg.reload(); pg.click('#chooseTeurgica'); pg.wait_for_selector('#teuContaBtn'); pg.click('#teuContaBtn')
    pg.wait_for_selector('#teuCofre:not([hidden])', timeout=15000)
    pg.wait_for_selector('text=Ligada e destrancada', timeout=15000)
    t('"Lembrar neste aparelho" destranca após recarregar', True)
    pg.get_by_role('button', name='Desativar a proteção…').click(); pg.screenshot(path='/tmp/cofre-ui-8-desativar.png')
    t('desativar exige o backup', pg.get_by_role('button', name='Desativar a proteção', exact=True).is_disabled())
    t('sem erros de JavaScript na página', not [e for e in erros if 'favicon' not in e and 'manifest' not in e.lower() and 'ERR_NAME_NOT_RESOLVED' not in e], erros[:3])
    b.close()
print('\n%d ok, %d falha(s)' % (ok, falhas)); srv.shutdown(); sys.exit(1 if falhas else 0)
