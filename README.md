# Yumi — Atendimento WhatsApp Kaizen

App unico em Next.js 16 (front + API) que atende os clientes do Kaizen no WhatsApp.
A Yumi (Claude) responde sozinha; quando precisa, um humano assume pela tela web.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind 4)
- Supabase Cloud (Auth, Postgres, Realtime)
- Z-API (ponte WhatsApp)
- Anthropic (cerebro da Yumi)
- Deploy no Coolify

## Papeis

| Papel     | Ve                                        |
|-----------|-------------------------------------------|
| `gerente` | `/atendimento`                            |
| `editor`  | `/config`                                 |
| `admin`   | `/atendimento`, `/config`, `/admin`       |

Protecao em duas camadas: RLS no Supabase + checagem de papel no layout de cada area.

## Como rodar (primeira vez)

### 1. Criar o projeto no Supabase

1. https://supabase.com/dashboard > New project
2. Anote a senha do banco.
3. Menu **SQL Editor** > New query > cole o conteudo de `supabase/migrations/0001_init.sql` > **Run**.

### 2. Pegar as chaves

Dashboard > **Project Settings > API**:
- `Project URL` -> `NEXT_PUBLIC_SUPABASE_URL`
- `anon public` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` -> `SUPABASE_SERVICE_ROLE_KEY` (secreta, nunca no front)

### 3. Configurar o ambiente

```bash
cp .env.example .env.local
```

Preencha pelo menos as tres chaves do Supabase. O resto pode ficar vazio por enquanto.

### 4. Instalar e rodar

```bash
npm install
```

```bash
npm run dev
```

Abre em http://localhost:3000

### 5. Criar os usuarios

Dashboard > **Authentication > Users > Add user** (marque *Auto Confirm User*).
O `profile` e criado sozinho com papel `gerente`.

Para mudar o papel, rode no SQL Editor:

```sql
update yumiwpp_profiles set role = 'admin'  where id = (select id from auth.users where email = 'seu@email.com');
update yumiwpp_profiles set role = 'editor' where id = (select id from auth.users where email = 'editor@email.com');
```

### 6. Mandar o system prompt da Yumi pro banco

Cole o texto no arquivo `Prompt para yumi.txt` (raiz do projeto) e rode:

```bash
npm run seed
```

## Estrutura

```
app/
  login/          # tela de login (server action)
  atendimento/    # inbox do gerente        (gerente, admin)
  config/         # editor de prompt/KB     (editor, admin)
  admin/          # integracoes e usuarios  (admin)
components/
  Shell.tsx       # cabecalho com navegacao por papel
lib/
  auth.ts         # getPerfil / exigirPapel
  supabase/
    server.ts     # cliente server (respeita RLS)
    client.ts     # cliente browser (Realtime)
    admin.ts      # service role (ignora RLS, so em API)
proxy.ts          # ex-middleware: renova sessao e barra quem nao esta logado
supabase/
  migrations/     # SQL para rodar no dashboard
tools/
  seed-config.mjs # manda o Prompt para yumi.txt pro banco
```

## Yumi (fase 4)

Cerebro: **OpenAI** (Chat Completions + function calling), nao Anthropic.
`OPENAI_API_KEY` e `OPENAI_MODEL` no `.env.local`.

Escalada pra humano e feita por tool call (`escalar_humano`, com `motivo`/
`prioridade`/`resumo`), fixa no codigo (`lib/yumi/responder.ts`). O nome e os
parametros da tool tem que bater com o que o `Prompt para yumi.txt` instrui —
se editar um lado, edita o outro.

`{{LINK_RESERVA}}` e `{{LINK_FILA}}` no prompt (editavel em `/config`) sao
trocados pelos valores reais de `NEXT_PUBLIC_LINK_RESERVA`/`NEXT_PUBLIC_LINK_FILA`
em runtime, dentro de `gerarResposta()`.

## Webhook Z-API (fase 3)

`/api/webhook/zapi?secret=SEU_ZAPI_WEBHOOK_SECRET` — configurar essa URL completa
no painel da Z-API, e ligar tambem o webhook **notifySentByMe**.

**Atencao:** o payload usado (`type: "ReceivedCallback"`, `text.message`, `fromMe`,
`phone`, `messageId`) segue o formato padrao documentado da Z-API, mas **ainda nao foi
validado com um webhook real**. Se o primeiro teste nao gravar mensagem no banco,
adicionar um `console.log(JSON.stringify(body))` no topo do `POST` em
`app/api/webhook/zapi/route.ts` pra ver o payload de verdade e ajustar `extrairTexto`
e os nomes de campo.

## Realtime (Supabase)

Duas coisas que travaram a tela de atendimento em teste, corrigidas:

1. **RLS bloqueava o Realtime em silêncio.** As policies de `yumiwpp_conversas`/
   `yumiwpp_mensagens` chamavam uma função que consulta `yumiwpp_profiles`
   (subquery). O Realtime não avalia esse tipo de policy — a escrita via REST
   funcionava normal, mas o evento nunca chegava no navegador, sem erro nenhum.
   Fix em `supabase/migrations/0002_realtime_select.sql`: policy de SELECT
   separada (`using (true)`) só nessas duas tabelas, sem lookup em outra tabela.
   Efeito colateral aceito: qualquer usuário logado consegue *ler* essas duas
   tabelas via API direta (a tela `/atendimento` continua bloqueada por papel).

2. **Toda subscription de Realtime mora no `Inbox`, não no `ConversaChat`.**
   Um único client Supabase (singleton em `lib/supabase/client.ts`) e duas
   channels no `Inbox` (conversas + mensagens, sem filtro). O `ConversaChat`
   recebe tudo por prop e não abre canal próprio. Isso é mais simples e evita
   múltiplas conexões WebSocket concorrentes.

## PWA (fase 7)

`app/manifest.ts` gera o `manifest.webmanifest`. Ícone em `public/icon.svg`
(placeholder simples "Y" — trocar por um de verdade quando tiver a arte final,
só sobrescrever o arquivo). Sem service worker de proposito: o app não precisa
funcionar offline, só ficar instalável. No celular, "Adicionar à tela de início"
pelo menu do navegador já funciona.

## Deploy no Coolify (fase 7)

App já testado no Render; isso aqui é pro deploy final.

1. Coolify > **New Resource > Application** > aponta pro repo
   `github.com/Keizo97/atendimento-wpp-kaizen`.
2. **Build Pack:** Dockerfile (usa o `Dockerfile` da raiz, já pronto — build
   multi-stage, imagem final só com o necessário pra rodar).
3. **Porta:** 3000.
4. **Variáveis de ambiente:** copia tudo do `.env.local`, trocando
   `NEXT_PUBLIC_APP_URL` pelo domínio final (ex: `https://chat.kaizenjapanese.com.br`)
   e `ZAPI_WEBHOOK_SECRET` por um valor novo se quiser trocar do que tá no Render.
5. Configura o domínio no Coolify — SSL é automático (Let's Encrypt).
6. Depois de no ar, troca a URL do webhook no painel Z-API pra apontar pro
   domínio novo (mesmo formato: `https://SEU_DOMINIO/api/webhook/zapi?secret=...`).

Local, pra testar o Dockerfile antes de mandar pro Coolify (precisa Docker
instalado):

```bash
docker build -t yumiwpp .
```

```bash
docker run -p 3000:3000 --env-file .env.local yumiwpp
```

## Fases

- [x] 1. Schema Supabase + RLS
- [x] 2. Esqueleto Next.js (login, papeis, tres areas)
- [x] 3. Ponte WhatsApp (`/api/webhook/zapi`, `/api/enviar`, dedupe) — payload nao validado ainda
- [x] 4. Yumi (OpenAI + contexto do banco + escalada por tool call)
- [x] 5. Inbox ao vivo (Realtime, assumir/devolver)
- [x] 6. Telas do editor e do admin
- [x] 7. PWA + deploy no Coolify (Dockerfile pronto, deploy em si e' manual no painel)
