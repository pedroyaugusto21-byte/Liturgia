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
- Os dados ficam **legíveis pelo Google/Firebase** (criptografia padrão em trânsito e em repouso, mas não de ponta a ponta). Criptografia ponta a ponta é uma melhoria possível, **não implementada**.
- Plano gratuito (Spark): sobra muito para um diário pessoal.

## 5. Apagar tudo / exportar
- **Exportar**: botão "Baixar backup" no cartão da conta (mesmo formato do Exportar).
- **Apagar dados da nuvem**: Firestore Database → Data → apague o documento `usuarios/<seu uid>` e suas subcoleções (ou use a extensão oficial "Delete User Data").
- **Apagar a conta**: Authentication → Users → ⋮ → Delete account.

## 6. Atualizar o app instalado
O service worker mudou para `calendarium-v2`. Depois de publicar, abra o site uma vez com internet; o app instalado atualiza na abertura seguinte.

## 7. Testes
`node teste-etapa4.js <pasta> [modo]` (precisa de Playwright). Usa um SDK falso e um servidor em memória que reproduz as regras. `teste-regras.js` testa o `firestore.rules` de verdade com o emulador: `firebase emulators:exec --only firestore "node teste-regras.js"` (não rodei aqui, sem acesso ao emulador).
