# Calendarium — Conta na nuvem (Base de Fogo)

Passo a passo para quem está começando. Tudo continua funcionando **sem login**; a conta só adiciona cópia e sincronização do Diário e das festas pessoais.

## 1. O que você precisa fazer no console do Firebase (uma vez)
1. **Authentication → Sign-in method**: deixe ativos só "E-mail/senha" e, se quiser, "Google".
2. **Authentication → Users → Add user**: crie a SUA conta (o site não tem cadastro por design; ninguém mais consegue criar conta).
3. **Authentication → Settings → Authorized domains**: confirme que existe `pedroyaugusto21-byte.github.io`.
4. **Firestore Database → Rules**: apague o que está lá, cole o conteúdo de `firestore.rules` deste zip e clique em **Publicar**. Isso é importante: as regras básicas que você publicou antes não validam o formato dos dados. Se o console apontar erro de sintaxe, me mande a mensagem.
5. (Recomendado) **Authentication → Settings → User actions**: desative "Enable create (sign-up)" para fechar o cadastro também no servidor.

## 2. A apiKey é segredo?
Não. A `apiKey` do `firebase-config.js` só identifica o projeto; quem protege seus dados são o login e o `firestore.rules`. Não coloque aí senhas, chaves de "service account" nem nada de Admin SDK.

## 3. Como funciona
- O aparelho continua sendo a fonte; a nuvem é uma réplica. Sem internet tudo funciona e as alterações ficam numa fila que sobe sozinha quando a rede volta.
- Não há "polling": a sincronização acontece ao entrar, ao salvar, ao voltar a internet e ao voltar para a aba (no máximo a cada 20 s). Há também o botão "Sincronizar agora".
- Conflito: vence a versão com `salvoEm` mais recente. Os registros de horário são somados (união). Festas apagadas viram "lápides" para a exclusão chegar aos outros aparelhos.
- Primeiro login com dados no aparelho: o site pergunta se envia; oferece baixar backup antes. Outra conta nunca é misturada.
- Sair: pergunta se apaga os dados do aparelho (recomendado em aparelho compartilhado).

## 4. Cuidados
- **Relógio do aparelho** precisa estar certo (a sincronização usa datas, com margem de 10 min).
- **Google no GitHub Pages**: tenta popup; se o navegador bloquear, usa redirecionamento. Em alguns navegadores com bloqueio de armazenamento de terceiros o redirecionamento pode falhar — use e-mail/senha nesse caso.
- Por padrão os dados ficam **legíveis pelo Google/Firebase** (criptografia em trânsito e em repouso, mas não de ponta a ponta). A proteção **opcional** de ponta a ponta do Diário está descrita na seção 10; as festas pessoais continuam em claro.
- Plano gratuito (Spark): sobra muito para um diário pessoal.

## 5. Apagar tudo / exportar
- **Exportar**: botão "Baixar backup" no cartão da conta (mesmo formato do Exportar).
- **Importar**: botão "Importar backup" ao lado dele. Valida o arquivo (mesmas regras da sincronização), mostra uma prévia (quantos dias, festas e registros de horário; quantos são novos e quantos já existem) e pergunta como importar: **Mesclar** (em cada dia fica a versão de `salvoEm` mais recente; em empate, a do aparelho; festas só entram se o id é novo; registros de horário são unidos sem duplicar; nada é apagado) ou **Substituir** (o aparelho fica exatamente como o arquivo; o que não está nele é apagado do aparelho e, se você está conectado, também da conta). O que for gravado sobe para a conta como qualquer edição. Só aparece com a conta conectada, como o "Baixar backup".
- **Apagar dados da nuvem**: Firestore Database → Data → apague o documento `usuarios/<seu uid>` e suas subcoleções (ou use a extensão oficial "Delete User Data").
- **Apagar a conta**: Authentication → Users → ⋮ → Delete account.

## 6. Atualizar o app instalado
O nome/versão do cache do service worker (`VERSAO` em `sw.js`) e a lista `ARQUIVOS` agora são **gerados**: depois de editar qualquer arquivo do site, rode `npm run gerar-sw` (ou `node scripts/gerar-sw.js`, sem dependências) e publique o `sw.js` junto. A versão é um hash do conteúdo, então muda sozinha quando algo muda. `npm run verificar-sw` falha se algum script/CSS/ícone referenciado por `index.html` (ou pelo manifest) faltar no disco ou no cache, ou se o trecho gerado estiver desatualizado. Depois de publicar, abra o site uma vez com internet; o app instalado atualiza na abertura seguinte.

## 7. Testes
Ficam em `tests/` e **não fazem parte do site** (nada em `index.html` nem no cache do service worker os usa).

```
npm install                    # uma vez (instala playwright 1.63.0 e sharp)
npx playwright install chromium   # uma vez, se o Chromium ainda não existir na máquina
npm test                       # etapa 1 + etapa 2
npm run test:etapa1            # ou test:etapa2
node tests/teste-etapa1.js . snap antes.json     # captura de regressão
node tests/teste-etapa1.js comparar antes.json depois.json
```
Sem argumento, os testes usam a raiz do repositório; também aceitam outra pasta: `node tests/teste-etapa2.js <pasta> [modo]`.

**Caracterização (`tests/teste-caracterizacao.js`).** Com o relógio congelado, captura em texto tudo que `ouranos.js`, `astral.js` e o Relatório do `teurgica.js` produzem (APIs de cálculo, SVG/HTML do Mapa Astral, legendas, canvas e Relatório) e compara com a referência `tests/golden/caracterizacao.json.gz`, gerada a partir do código **antes** da separação cálculo/interface. `npm run test:car` compara; para aceitar uma mudança de comportamento *intencional*, regenere com `node tests/teste-caracterizacao.js snap tests/golden/caracterizacao.json.gz`.

**Estado dos testes.** `teste-etapa1.js` e `teste-etapa2.js` estão no repositório. `teste-etapa4.js` (nuvem, com SDK falso e servidor em memória que reproduz as regras) e `teste-regras.js` (testa o `firestore.rules` no emulador: `firebase emulators:exec --only firestore "node teste-regras.js"`) **não estão no repositório**: são citados nesta seção, mas os arquivos não estão no repositório. Quando forem incluídos, devem ir para `tests/` e ganhar um script em `package.json`. Atenção: hoje 5 verificações da etapa 2 já falham no código original (painel "Relatório: Em breve", três sobre o Hinário e "exigir texto ou clima"); é a linha de base conhecida, não algo causado por reorganização.

## 8. Publicação (o que vai e o que não precisa ir)
O site é só o que o `index.html` carrega (scripts, CSS, manifest, ícones) mais `sw.js`. `tests/`, `package.json`, `package-lock.json`, `node_modules/` e `LEIAME-nuvem.md` **não são necessários no deploy**. `node_modules/` está no `.gitignore`. No GitHub Pages publicando direto da branch, `tests/` e `package.json` ficam acessíveis em links públicos, mas inofensivos (não contêm segredos, o cache do app não os baixa). Se quiser deixá-los de fora, a alternativa é publicar por GitHub Actions copiando só os arquivos do site para a pasta publicada; isso exige trocar a fonte do Pages para "GitHub Actions" nas configurações, por isso não foi ativado automaticamente. `.nojekyll` não foi adicionado: não é preciso para excluir pastas e mudaria o modo de build do Pages.

## 9. Organização do código (cálculo × interface)
Scripts clássicos, sem módulos nem build; a ordem em `index.html` importa. Cada arquivo de cálculo publica **um único global novo** (um namespace) e não toca no DOM; o de interface o lê no início. Os globais antigos (`Ouranos`, `AstralClock`, `AstralCalc`, `AstralPanel`, `AstralStars`, `AstralPoints`, `Teurgica`, `TeurgicaData`) continuam iguais.

| Cálculo / dados (sem DOM) | Interface |
|---|---|
| `ouranos-calc.js` → `OuranosCalc` (efemérides, projeção, Mapa Astral em SVG) | `ouranos.js` (estado, canvas, legenda, controles, API `Ouranos`) |
| `astral-calc.js` → `AstralCore` (dignidades, aspectos, modelo do momento); `astral-vista.js` → `AstralVista` (HTML/SVG em texto, sem DOM) | `astral.js` (relógio, painel, eventos, boot; guard de `Ouranos`) |
| `teurgica-dados.js` → `TeurgicaBase` + `TeurgicaData`; `teurgica-relatorio-calc.js` → `TeurgicaRelCalc` | `teurgica.js` (Hinário, Diário, montagem do Relatório) |

Ordem: `ouranos-data` → … → `ouranos-calc` → `ouranos` → … → `teurgica-dados` → `teurgica-relatorio-calc` → `teurgica` → `app` → `astral-calc` → `astral-vista` → `astral`. Ao incluir um arquivo novo no `index.html`, rode `npm run gerar-sw`. Uma única diferença de comportamento por construção: `TeurgicaData`, `OuranosCalc`, `AstralCore` e afins passam a existir mesmo se o arquivo de interface correspondente faltar (antes nada existia nesse caso).

## 10. Proteção opcional de ponta a ponta do Diário (cofre)

**O que é.** Na aba Teúrgica → Conta (logado) aparece "Proteger o Diário…". Com o cofre ligado, `diario` e `diario_log` sobem **cifrados** (AES-256-GCM, formato v1) e só a sua frase os abre. O armazenamento local **não muda** (continua texto puro, como o modo sem login), e as festas pessoais não são cifradas.

**Desenho** (`cripto.js`, só WebCrypto, sem dependências): frase → PBKDF2-SHA-256 (600.000 iterações, gravadas no cofre) → chave que embrulha uma **chave mestra aleatória**; uma **chave de recuperação** (160 bits) embrulha a mesma chave mestra. IV aleatório de 96 bits por gravação, com guarda contra repetição; AAD = `calendarium|v1|uid|coleção|id|salvoEm|kid` (o texto do dia A não vale no dia B). Trocar a frase só reembrulha a chave mestra (nada é recifrado). Cofre: `usuarios/<uid>/cofre/principal`. Em claro ficam só `data`/id, `salvoEm`, `atualizadoEm` e os campos técnicos (`v`, `alg`, `kid`, `iv`, `ct`); texto, clima, `photagogia`, `criadoEm` e, nos registros, `data`, `salvoEm`, `hora`, `horas` e `acao` vão dentro de `ct`. Visível ao Google: quais dias têm entrada e a hora do último salvamento. Os ids de log antigos carregam o carimbo (não são trocados, senão outros aparelhos duplicariam os registros); logs novos têm id aleatório.

**Perda da frase.** Sem a frase **e** sem a chave de recuperação, a cópia da nuvem é irrecuperável. O que estiver em algum aparelho continua lá; "Esqueci a frase → Não tenho a chave" apaga a cópia da nuvem e a recria a partir de um aparelho que ainda tenha o Diário. A tela de ativação avisa isso antes de qualquer coisa.

**Migração.** Sincroniza → backup obrigatório → grava o cofre (`migrando`) → cifra e regrava cada dia/registro → **relê e confere** tudo → só então `ativo`. Se parar no meio, o estado misto é legítimo e "Continuar a proteção" retoma. Cópias antigas em claro podem sobreviver um tempo em backups/recuperação pontual do Google, se estiverem ligados.

**Vários aparelhos.** Cada aparelho pede a frase uma vez ("Lembrar neste aparelho" guarda a chave como CryptoKey **não extraível** num IndexedDB próprio; sair da conta sempre tranca). Trancado, o Diário local funciona, a fila de diario/diario_log espera e o cursor de leitura não avança por cima de documentos cifrados ainda ilegíveis. Se não for possível ler o estado do cofre, **nada** de diario/diario_log sobe (nunca em claro). Um documento em claro que apareça depois de o cofre ligar (app antigo em cache) é recifrado por qualquer aparelho destrancado.

**Regras.** `firestore.rules` aceita o formato em claro e o cifrado lado a lado. O servidor deixa de ver o tamanho do texto: os limites de 10.000 caracteres e de 12 itens de clima valem só no app (após decifrar); as regras impõem um teto de 90.000 caracteres no texto cifrado (o pior caso calculado é 86.180). **Publique as regras novas ANTES do app novo.** Não há "trava" (exigir cifrado com o cofre ativo) porque `get()`/`exists()` nas regras têm limite de chamadas por requisição e quebrariam os lotes de escrita.

**Limites honestos.** Não protege o aparelho (o Diário local fica em claro), não impede quem tiver a sua conta de apagar ou corromper dados (a defesa é a cópia local e o backup), e o backup baixado fica em texto puro.

## 11. App Check (opcional)

1. Crie uma chave **reCAPTCHA v3** (gratuita) para o domínio do site (nunca coloque `localhost` numa chave de produção) e registre o app web em Firebase → Segurança → App Check. A chave **secreta** fica só no console.
2. Cole a chave **pública** em `firebase-config.js` (`FIREBASE_APPCHECK_CHAVE`; `FIREBASE_APPCHECK_PROVEDOR` = `'v3'` ou `'enterprise'`). Deixando `null`, nada muda.
3. Publique com a imposição **desligada** e acompanhe as métricas por alguns dias; depois ligue a imposição no **Firestore** e, por fim, na **Authentication**.
4. Em desenvolvimento use o provedor de depuração do Firebase (o token de depuração nunca vai para o repositório).

Se o App Check falhar (bloqueador de anúncios, reCAPTCHA fora do ar, imposição sem token válido), o app **continua 100% local**: a sincronização mostra uma mensagem clara, não insiste a cada gravação (só tenta de novo por conta própria depois de 5 minutos; "Sincronizar agora" sempre tenta) e o Diário não é afetado.

## 12. Checklist do console (conferir à mão)

| Item | Onde | Esperado / como verificar |
|---|---|---|
| Cadastro fechado | Authentication → Settings → User actions | "Enable create (sign-up)" desligado; criar conta com e-mail novo deve ser recusado. |
| Usuários | Authentication → Users | Só a(s) sua(s) conta(s). |
| Provedores | Authentication → Sign-in method | Só E-mail/senha e Google; **Anônimo desligado**. |
| Domínios autorizados | Authentication → Settings → Authorized domains | Só o domínio do site e o `...firebaseapp.com` do projeto; remova `localhost` se não usa. |
| Regras publicadas | Firestore → Rules | Data de publicação recente e texto igual ao `firestore.rules`; no Rules Playground, leitura anônima e de outro uid negadas. |
| Storage | Storage → Rules | Não configurado ou com regras que negam tudo (o `firebase-config.js` tem `storageBucket`). |
| Chave de API | Google Cloud → APIs e serviços → Credenciais | Restrita aos referenciadores do seu domínio e às APIs necessárias. |
| App Check | Segurança → App Check | App registrado; métricas verificadas antes da imposição; imposição ligada no Firestore e na Authentication. |
| Backups do Firestore | Firestore → Backups / recuperação pontual | Saber se estão ligados (cópias antigas em claro do Diário podem sobreviver ali). |

## 13. Testes do cofre

- `node tests/teste-cripto.js` — vetores conhecidos, formato v1 congelado (`tests/golden/`), senha errada, documento corrompido (cada alteração), AAD, cofre corrompido/fora da faixa, **IV repetido** (detecção, gerador travado), limites de tamanho.
- `node tests/teste-nuvem-cripto.js` — dois aparelhos + Firestore falso que imita as regras: ativar, trancar/destrancar, conflito por `salvoEm`, corrompido, auto-cura, troca de frase, recuperação, migração interrompida e retomada, desativar, recomeçar, cofre ilegível, módulo ausente, modo local, SDK indisponível, App Check.
- `python3 tests/teste-cofre-ui.py` — a tela no Chromium (Playwright), em tela de celular, incluindo "lembrar neste aparelho" após recarregar.
- `npm run test:regras` — **precisa do emulador do Firestore** (Java + firebase-tools): `npx firebase emulators:exec --only firestore "node tests/teste-regras-cripto.js"`. Não roda sem ele.
