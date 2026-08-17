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

Escalada pra humano e feita por tool call (`escalar_atendimento`), fixa no codigo
(`lib/yumi/responder.ts`), independente do `system_prompt` que o Editor reescrever
no `/config`. Assim a regra de escalar nao quebra se alguem editar o prompt errado.

## Webhook Z-API (fase 3)

`/api/webhook/zapi?secret=SEU_ZAPI_WEBHOOK_SECRET` — configurar essa URL completa
no painel da Z-API, e ligar tambem o webhook **notifySentByMe**.

**Atencao:** o payload usado (`type: "ReceivedCallback"`, `text.message`, `fromMe`,
`phone`, `messageId`) segue o formato padrao documentado da Z-API, mas **ainda nao foi
validado com um webhook real**. Se o primeiro teste nao gravar mensagem no banco,
adicionar um `console.log(JSON.stringify(body))` no topo do `POST` em
`app/api/webhook/zapi/route.ts` pra ver o payload de verdade e ajustar `extrairTexto`
e os nomes de campo.

## Fases

- [x] 1. Schema Supabase + RLS
- [x] 2. Esqueleto Next.js (login, papeis, tres areas)
- [x] 3. Ponte WhatsApp (`/api/webhook/zapi`, `/api/enviar`, dedupe) — payload nao validado ainda
- [x] 4. Yumi (OpenAI + contexto do banco + escalada por tool call)
- [ ] 5. Inbox ao vivo (Realtime, assumir/devolver)
- [ ] 6. Telas do editor e do admin
- [ ] 7. PWA + deploy no Coolify
