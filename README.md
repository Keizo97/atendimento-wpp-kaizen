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

## Fases

- [x] 1. Schema Supabase + RLS
- [x] 2. Esqueleto Next.js (login, papeis, tres areas)
- [ ] 3. Ponte WhatsApp (`/api/webhook/zapi`, `/api/enviar`, dedupe)
- [ ] 4. Yumi (Claude + contexto do banco)
- [ ] 5. Inbox ao vivo (Realtime, assumir/devolver)
- [ ] 6. Telas do editor e do admin
- [ ] 7. PWA + deploy no Coolify
