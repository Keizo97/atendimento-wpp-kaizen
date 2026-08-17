# CHANGELOG — Yumi Atendimento WhatsApp

## [2026-08-17] — Sessao 1: fases 1 e 2

### Decisoes
- Supabase: **projeto novo**, separado do Kaizen-menu.
- Reservas: **so link de auto-reserva**. Sem tool de reserva e sem `/api/reservas` no escopo.
- System prompt vem do arquivo `Prompt para yumi.txt` (raiz), enviado ao banco por script.
- Next.js 16 usa `proxy.ts` no lugar de `middleware.ts` (convencao nova do framework).
- Papel checado em duas camadas: RLS no Supabase + `exigirPapel()` no layout de cada area.
  O `proxy.ts` cuida so de sessao/login, porque consulta ao banco dentro dele deixa tudo lento.

### Criado
- Projeto Next.js 16 + TypeScript + Tailwind 4 + ESLint.
- `supabase/migrations/0001_init.sql` — tipos, 7 tabelas `yumiwpp_*`, indices, triggers,
  funcoes de papel, policies RLS, publicacao Realtime. Idempotente.
- `.env.example` — todas as variaveis (Supabase, Z-API, Anthropic, links, app).
- `lib/supabase/server.ts`, `client.ts`, `admin.ts` — tres clientes Supabase.
- `lib/auth.ts` — `getPerfil()`, `exigirPapel()`, `rotaInicial()`.
- `proxy.ts` — renova sessao e barra rota sem login.
- `app/login/` — page, LoginForm (client) e actions (`entrar`, `sair`).
- `app/atendimento/`, `app/config/`, `app/admin/` — layout com guarda de papel + pagina placeholder.
- `components/Shell.tsx` — cabecalho com navegacao filtrada por papel e botao sair.
- `tools/seed-config.mjs` — le `Prompt para yumi.txt` e grava em `yumiwpp_config`.
- `README.md` — passo a passo de setup.

### Alterado
- `app/layout.tsx` — pt-BR, metadata e tema escuro.
- `app/globals.css` — base escura, sem as variaveis do template padrao.
- `app/page.tsx` — redireciona pela rota inicial do papel.

### Verificado
- `npm run build` passa (Next 16.3.1, Turbopack). Rotas `/`, `/login`, `/atendimento`,
  `/config`, `/admin` compilam como dinamicas; proxy detectado.

### Pendente
- Preencher `Prompt para yumi.txt` e rodar `npm run seed`.
- Chaves: `ZAPI_*`, `OPENAI_API_KEY`, `LINK_RESERVA`, `LINK_FILA`, dominio.
- Fases 5 a 7.

## [2026-08-17] — Sessao 2: login + fases 3 e 4

### Corrigido
- Migration reordenada (tabelas antes das funcoes `language sql`) — bug travava
  a criacao de `yumiwpp_meu_role`.
- Bug de login: `.env.local` tinha a chave publishable colada no lugar da
  `NEXT_PUBLIC_SUPABASE_URL`. Corrigido pelo Keizo.
- Usuario criado no Supabase Auth antes do trigger `yumiwpp_on_auth_user_created`
  existir ficou sem `yumiwpp_profiles` -> login voltava pra tela de login sem erro.
  Corrigido com insert manual do profile.

### Decisao
- Cerebro da Yumi trocado de **Anthropic/Claude** (definido no briefing original)
  para **OpenAI**, a pedido do Keizo. `.env.example` atualizado: `ANTHROPIC_*` saiu,
  entrou `OPENAI_API_KEY` e `OPENAI_MODEL`.
- Escalada pra humano implementada como **tool call** (`escalar_atendimento`) fixo
  no codigo, nao por palavra-chave no texto nem dependente do `system_prompt`
  editavel — assim continua funcionando mesmo se o Editor reescrever o prompt.
- Payload do webhook Z-API seguido pelo formato padrao documentado
  (`ReceivedCallback`, `text.message`, `fromMe`, `phone`, `messageId`), **sem
  confirmacao com um webhook real ainda**. Ver aviso no README.

### Criado
- `lib/whatsapp/zapi.ts` — `enviarMensagem()`, mesmo padrao do Kaizen-reservas
  (`POST /instances/{instance}/token/{token}/send-text`, header `Client-Token`).
- `lib/whatsapp/clientes.ts` — `upsertCliente()` e `conversaAberta()`.
- `lib/yumi/valores.ts` — formata `yumiwpp_valores` pro contexto da IA.
- `lib/yumi/responder.ts` — chama OpenAI (Chat Completions + tool `escalar_atendimento`).
- `app/api/webhook/zapi/route.ts` — entrada: valida `?secret=`, distingue mensagem
  do cliente vs eco/takeover (`fromMe`), dedupe por `zapi_message_id` (unique index
  + fallback no erro `23505`), roda a Yumi quando `modo=bot`.
- `app/api/enviar/route.ts` — saida manual do gerente, autenticada por sessao.

### Alterado
- `npm uninstall @anthropic-ai/sdk` / `npm install openai`.
- `.env.example` — bloco Anthropic trocado por OpenAI.

### Verificado
- `npm run build` passa, rotas `/api/enviar` e `/api/webhook/zapi` aparecem como
  dinamicas.

### Pendente
- Validar payload real da Z-API (Eduardo vai ligar o webhook no painel).
- Fases 6 e 7.

## [2026-08-17] — Sessao 4: deploy Render + fases 6 e 7

### Corrigido
- `.env.local`: `ANTHROPIC_MODEL` (resquicio, nunca lido pelo codigo) trocado
  por `OPENAI_MODEL=gpt-5-mini`. `ZAPI_WEBHOOK_SECRET` estava vazio — sem ele
  o webhook rejeitava tudo com 401 sempre. Gerado e preenchido.
- Tool da Yumi renomeada de `escalar_atendimento` pra `escalar_humano`, com
  parametros `motivo`/`prioridade`/`resumo`, pra bater exatamente com o que
  "Prompt para yumi.txt" (o prompt real, ja escrito) instrui. Nomes
  diferentes = a IA nunca aciona a funcao.
- `{{LINK_RESERVA}}` e `{{LINK_FILA}}` no prompt agora sao substituidos pelos
  valores reais em runtime (`lib/yumi/responder.ts`) — antes ficavam
  literais na mensagem.
- Prompt real carregado no banco via `npm run seed`.

### Deploy de teste
- App publicado no Render: https://atendimento-wpp-kaizen.onrender.com
  (repo: github.com/Keizo97/atendimento-wpp-kaizen).
- Webhook validado: 401 sem `?secret=`, 200 com secret correto.
- Falta: Eduardo configurar a URL do webhook no painel Z-API
  (`/api/webhook/zapi?secret=...` + notifySentByMe) pra testar de ponta a ponta.

### Criado (fase 6)
- `/config` — editor de `system_prompt`/`knowledge_base` e CRUD de
  `yumiwpp_valores` (`app/config/actions.ts`, `components/config/`).
- `/admin` — criar usuario (senha temporaria gerada, sem depender de e-mail),
  mudar papel, painel read-only de quais variaveis de integracao estao
  configuradas (`app/admin/actions.ts`, `components/admin/`).

### Criado (fase 7)
- `app/manifest.ts` + `public/icon.svg` — PWA instalavel (sem service worker
  de proposito, app nao precisa funcionar offline).
- `Dockerfile` multi-stage (`output: 'standalone'` no `next.config.ts`) +
  `.dockerignore` (importante: sem ele o `.env.local` vazaria pra dentro da
  imagem via `COPY . .`).
- Secao de deploy no Coolify no README.

### Verificado
- Testado no navegador contra o Supabase de teste: `/config` carrega o
  prompt real, `/admin` lista usuarios reais com papel e mostra integracoes
  configuradas.
- `npm run build` gera `.next/standalone/server.js` corretamente.
- `npm run build` limpo em todos os pontos da sessao.

## [2026-08-17] — Sessao 3: fase 5 (atendimento ao vivo)

### Atencao — Supabase de teste vs producao
Durante a sessao, dados de teste (cliente falso, conversa, mensagens, um
usuario admin descartavel) foram inseridos por engano achando que o projeto
Supabase "Kaizen" (main) era producao do Kaizen-menu. Keizo confirmou que
esse projeto e o BANCO DE TESTE dele — a producao de verdade vem depois.
Nada foi apagado do schema do Kaizen-menu (`categories`, `items`, `menus`
etc.), so foi confirmado visualmente. Registrando aqui pra próxima sessao
não reabrir essa duvida.

### Criado
- `components/atendimento/Inbox.tsx` — lista de conversas abertas, Realtime,
  seleciona conversa.
- `components/atendimento/ConversaChat.tsx` — chat da conversa selecionada,
  botao assumir/devolver, formulario de envio (chama `/api/enviar`).
- `components/atendimento/types.ts` — `ConversaRow`, `Mensagem`, `MensagemRealtime`.
- `app/atendimento/page.tsx` — Server Component, busca conversas abertas
  (join com `yumiwpp_clientes`) e injeta no `Inbox`.
- `supabase/migrations/0002_realtime_select.sql`.

### Corrigido (bug real, achado testando no navegador)
RLS com `security definer` function que consulta outra tabela quebra o
Realtime em silencio (evento nunca chega, sem erro). Ver secao "Realtime
(Supabase)" no README pra detalhe tecnico e o tradeoff de seguranca aceito.

### Alterado
- `lib/supabase/client.ts` — client do navegador virou singleton (evita
  socket duplicado por componente).
- Toda subscription de Realtime centralizada no `Inbox`; `ConversaChat`
  recebe tudo por prop.

### Verificado
- Testado de ponta a ponta no navegador (login, lista de conversas, chat,
  envio, assumir/devolver, Realtime) contra o Supabase de teste real, com
  usuario admin descartavel criado e removido ao final.
- `npm run build` limpo.

### Nota de debugging (nao e bug do app)
Boa parte do tempo desta sessao foi gasto perseguindo Realtime que parecia
nao entregar eventos DENTRO do componente React, mas funcionava via script
puro no console com o mesmo client. Causa provavel: a aba do navegador de
teste do Claude Code nunca fica com `document.hidden = false` (nao esta
sendo composta/exibida de verdade), o que pode fazer o Chrome atrasar
entrega de mensagens de WebSocket. Nao e um bug de codigo — teste voce
mesmo no seu navegador de verdade pra confirmar que esta tudo ok.
