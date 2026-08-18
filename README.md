# Yumi — Atendimento WhatsApp Kaizen

App único em Next.js (front + API) que atende os clientes do Kaizen Japanese
Food no WhatsApp. A Yumi (IA) responde sozinha; quando precisa, chama um
humano e um gerente assume pela tela web.

Este documento é o guia de deploy em produção. Leia na ordem — cada passo
depende do anterior.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind 4)
- Supabase (Auth, Postgres, Realtime)
- Z-API (ponte com o WhatsApp)
- OpenAI (cérebro da Yumi — Chat Completions + function calling)
- Deploy: Dockerfile pronto (testado no Render; alvo final é Coolify)

## Papéis (login)

| Papel     | Acessa                                    |
|-----------|--------------------------------------------|
| `gerente` | `/atendimento`                              |
| `editor`  | `/config`                                   |
| `admin`   | `/atendimento`, `/config`, `/admin`         |

Proteção em duas camadas: RLS no Supabase (quem pode ler/escrever no banco) +
checagem de papel no layout de cada área do site. Nenhuma das duas sozinha
seria suficiente.

---

## Deploy em produção — passo a passo

### 1. Criar o projeto no Supabase

1. https://supabase.com/dashboard → **New project**.
2. Anote a senha do banco que você definir ali (não é a mesma coisa que as
   chaves de API do passo 3).
3. Espere o projeto terminar de provisionar (1-2 minutos).

### 2. Rodar os 3 arquivos SQL, **nessa ordem exata**

Menu **SQL Editor** → **New query** → cola o conteúdo do arquivo → **Run**.
Repete pros três, um de cada vez, na ordem abaixo (a ordem importa, o 2 e o 3
dependem do que o 1 cria):

1. `supabase/migrations/0001_init.sql` — cria as 7 tabelas principais
   (`yumiwpp_profiles`, `clientes`, `conversas`, `mensagens`, `config`,
   `valores`, `integracoes`), os tipos, os índices, as políticas de RLS, o
   trigger que cria o perfil automático ao criar um usuário, e liga o
   Realtime nas tabelas de conversa/mensagem.
2. `supabase/migrations/0002_realtime_select.sql` — corrige uma policy que
   trava o Realtime em silêncio (ver seção **Realtime** abaixo pra entender
   o porquê, mas só rodar já resolve).
3. `supabase/migrations/0003_atendentes.sql` — cria a tabela
   `yumiwpp_atendentes` (lista de quem recebe aviso no WhatsApp quando a
   Yumi chama um humano).

Se algum der erro de "already exists" é porque já rodou antes — sem problema,
os três são seguros de rodar de novo (idempotentes).

### 3. Pegar as chaves do Supabase

Dashboard → **Project Settings → API**:

| Campo no Supabase | Variável de ambiente |
|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` |

A `service_role` é secreta — ela ignora toda a proteção do banco. Nunca vai
pro navegador, só é usada nas rotas de API do servidor. Não cola ela em
lugar nenhum além da variável de ambiente do host de deploy.

### 4. Variáveis de ambiente

Todas as variáveis, com o que cada uma faz. Configura essas exatas chaves no
painel do host de deploy (Render, Coolify, o que for usar) — não existe
`.env` dentro do repositório em produção, tudo é variável de ambiente do
serviço.

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Z-API (WhatsApp)
ZAPI_INSTANCE=
ZAPI_TOKEN=
ZAPI_CLIENT_TOKEN=
ZAPI_WEBHOOK_SECRET=

# OpenAI (cerebro da Yumi)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
YUMI_CONTEXT_MESSAGES=20

# Links do restaurante
NEXT_PUBLIC_LINK_RESERVA=
NEXT_PUBLIC_LINK_FILA=

# App
NEXT_PUBLIC_APP_URL=https://SEU_DOMINIO_FINAL
```

Detalhe de cada uma:

- **`ZAPI_INSTANCE` / `ZAPI_TOKEN` / `ZAPI_CLIENT_TOKEN`** — painel da Z-API,
  aba da instância conectada.
- **`ZAPI_WEBHOOK_SECRET`** — você inventa. Gera assim:
  ```bash
  openssl rand -hex 16
  ```
  **Não pode ficar vazio** — se ficar, o webhook rejeita toda mensagem que
  chegar (401), a Yumi nunca vê nada. Guarda esse valor, você usa ele de
  novo no passo 8.
- **`OPENAI_API_KEY`** — https://platform.openai.com/api-keys
- **`OPENAI_MODEL`** — `gpt-5-mini` é o padrão usado até aqui (bom custo x
  qualidade). Pode trocar por outro modelo da OpenAI se quiser.
- **`NEXT_PUBLIC_LINK_RESERVA` / `NEXT_PUBLIC_LINK_FILA`** — os links reais
  do Tagme (ou o que for usado). Eles substituem `{{LINK_RESERVA}}` e
  `{{LINK_FILA}}` que aparecem no texto do prompt da Yumi.
- **`NEXT_PUBLIC_APP_URL`** — o domínio final depois de configurado
  (passo 9). Antes disso pode deixar a URL temporária do host (Render, etc).

### 5. Deploy do código

O `Dockerfile` da raiz já faz build multi-stage otimizado — não precisa
mexer nele. Aponta o serviço (Coolify, Render, etc) pro repositório
`github.com/Keizo97/atendimento-wpp-kaizen`, branch `master`, build via
Dockerfile, porta **3000**. Cola as variáveis do passo 4.

Local, se quiser testar o Dockerfile antes (precisa Docker instalado):

```bash
docker build -t yumiwpp .
```

```bash
docker run -p 3000:3000 --env-file .env.local yumiwpp
```

### 6. Criar o primeiro usuário admin

Dashboard do Supabase → **Authentication → Users → Add user**:
- Marca **Auto Confirm User** (senão a pessoa precisa confirmar por e-mail).
- Preenche e-mail e senha.

Todo usuário novo entra automaticamente como `gerente` (trigger do banco).
Pra virar admin, roda no **SQL Editor**:

```sql
update yumiwpp_profiles set role = 'admin'
where id = (select id from auth.users where email = 'SEU_EMAIL_AQUI');
```

Repete a query (trocando o e-mail e o papel) pros outros usuários que
precisar — `admin`, `editor` ou `gerente`.

Depois do primeiro admin criado, os próximos usuários podem ser criados
direto pela tela **`/admin` → Usuários** do próprio app (gera senha
temporária na hora, sem precisar mexer no Supabase de novo).

### 7. Subir o prompt e a base de conhecimento da Yumi

Os textos já estão prontos no repositório:
- `Prompt para yumi.txt` — persona, regras de escrita, quando escalar pra
  humano, fluxo de reserva.
- `Base de conhecimento yumi.txt` — endereço, horários, cardápio, preços,
  políticas do restaurante.

Pra mandar os dois pro banco:

```bash
npm install
```

```bash
npm run seed
```

(Precisa do `.env.local` preenchido localmente com as chaves do Supabase de
produção pra esse comando funcionar — mesmo conteúdo do passo 3/4, só que
num arquivo local em vez do painel do host.)

Depois disso, qualquer ajuste fino pode ser feito direto pela tela
**`/config`** do app (não precisa editar arquivo nem rodar comando de novo).

### 8. Configurar o webhook na Z-API

Painel Z-API → **Webhooks**:

- **Ao receber (message received):**
  `https://SEU_DOMINIO/api/webhook/zapi?secret=SEU_ZAPI_WEBHOOK_SECRET`
- Liga também o **notifySentByMe** na mesma URL — é o que detecta quando
  alguém digita direto no celular conectado (assume a conversa
  automaticamente nesse caso).

Troca `SEU_DOMINIO` pela URL real do deploy e `SEU_ZAPI_WEBHOOK_SECRET` pelo
valor que você gerou no passo 4.

### 9. Cadastrar quem recebe aviso de atendimento humano

Tela **`/admin` → Atendentes** (precisa estar logado como admin): cadastra
nome + número de WhatsApp de quem deve ser avisado quando a Yumi escalar uma
conversa pra humano. Pode ser número de pessoa (com DDI+DDD, ex:
`5519999999999`) ou ID de grupo do Z-API.

### 10. Domínio final e SSL

No Coolify: configura o domínio no serviço, o SSL é automático (Let's
Encrypt). Depois de no ar:
- Atualiza `NEXT_PUBLIC_APP_URL` pro domínio final.
- Atualiza a URL do webhook no painel Z-API (passo 8) pro domínio novo.

### 11. Teste de ponta a ponta

1. Manda uma mensagem de teste no WhatsApp do restaurante.
2. Confere se apareceu em `/atendimento` (como `gerente` ou `admin`).
3. Confere se a Yumi respondeu.
4. Manda algo que force escalada (ex: "quero falar com uma pessoa") e
   confere se chegou aviso no WhatsApp de quem foi cadastrado no passo 9, e
   se a conversa aparece marcada **"Precisa de atendimento"** na tela.
5. Clica **Assumir atendimento**, responde, clica **Finalizar atendimento**
   e confere se a Yumi volta a responder sozinha.

---

## Como o sistema funciona por dentro

### Fluxo de mensagem

1. Cliente manda mensagem → Z-API dispara o webhook →
   `app/api/webhook/zapi/route.ts`.
2. Grava a mensagem, atualiza o cliente (CRM básico).
3. Se a conversa está em modo `bot`: monta o contexto (system prompt +
   base de conhecimento + últimas `YUMI_CONTEXT_MESSAGES` mensagens) e chama
   a OpenAI (`lib/yumi/responder.ts`).
4. A IA responde normal, **ou** chama a tool `escalar_humano` — nesse caso o
   sistema marca a conversa como `humano` (sem ninguém ainda designado),
   avisa os atendentes cadastrados no WhatsApp, e manda uma mensagem padrão
   pro cliente avisando que alguém vai assumir.
5. Enquanto a conversa está em modo `humano`, a Yumi não responde mais nada
   — só grava o que chega, até um gerente clicar **Finalizar atendimento**
   (isso devolve pra `bot`).

### Estados de uma conversa (tela `/atendimento`)

- **Yumi** — modo `bot`, respondendo sozinha.
- **Precisa de atendimento** — modo `humano`, mas ninguém assumiu ainda
  (`assumido_por` vazio). Aparece destacado em âmbar e sempre no topo da
  lista.
- **Em atendimento por Fulano** — modo `humano`, `assumido_por` preenchido.

O botão no topo do chat muda de acordo: "Assumir conversa" (bot → humano,
uso manual sem escalada) / "Assumir atendimento" (pegar uma que já está
esperando) / "Finalizar atendimento" (devolve pra Yumi).

### Realtime + polling

A tela de atendimento usa Supabase Realtime (WebSocket) pra atualizar sem
F5. Como rede de segurança — caso o Realtime falhe por algum motivo de rede
específico do navegador de quem está usando — também existe polling: a lista
de conversas busca de novo a cada 5s, as mensagens da conversa aberta a cada
2.5s. Isso significa que mesmo se o Realtime não estiver funcionando em
algum ambiente específico, o atraso máximo pra ver mensagem nova é de poucos
segundos, nunca "preciso dar F5".

**Pegadinha de RLS descoberta em teste:** o Supabase Realtime não avalia
policies de RLS que dependem de subquery em outra tabela (ex: checar o papel
do usuário via `yumiwpp_profiles`). Se isso acontecer, a escrita no banco
funciona normal via API, mas o evento de Realtime nunca chega no navegador —
**sem erro nenhum**, falha em silêncio. Por isso a migration `0002` existe:
ela dá uma policy de `SELECT` separada e simples (`using (true)`, sem
lookup) só nas duas tabelas que usam Realtime. Efeito colateral aceito:
qualquer usuário logado consegue *ler* essas duas tabelas via API direta —
mas a tela continua bloqueada por papel, e a escrita continua restrita.

### Dedupe de mensagem (evita eco duplicado)

Toda mensagem que o sistema manda (Yumi ou gerente) grava o `messageId` que
a Z-API devolve. Como o webhook `notifySentByMe` também dispara pra
mensagens que o próprio sistema mandou, o código confere se aquele
`messageId` já existe no banco antes de processar — se já existe, é eco do
que o próprio sistema mandou, ignora. Se não existe e veio como
`fromMe: true`, foi digitado direto no celular → takeover automático.

### Tool `escalar_humano`

O nome da função e os parâmetros (`motivo`, `prioridade`, `resumo`) estão
fixos em `lib/yumi/responder.ts` **e** descritos em `Prompt para yumi.txt`.
Os dois lados têm que bater — se editar o prompt e mudar o nome da tool ou
os campos, tem que mudar o código também (e vice-versa).

`{{LINK_RESERVA}}` e `{{LINK_FILA}}` que aparecem no texto do prompt são
substituídos pelos valores reais de `NEXT_PUBLIC_LINK_RESERVA`/
`NEXT_PUBLIC_LINK_FILA` em tempo de execução — não precisa editar o prompt
se o link mudar, só a variável de ambiente.

---

## Estrutura do projeto

```
app/
  login/              # tela de login
  atendimento/        # inbox do gerente               (gerente, admin)
  config/             # editor de prompt/KB/valores     (editor, admin)
  admin/              # usuarios, atendentes, integracoes (admin)
  api/
    webhook/zapi/      # entrada do WhatsApp (publica, valida ?secret=)
    enviar/            # saida manual do gerente (autenticada por sessao)
  manifest.ts          # gera o manifest.webmanifest (PWA)
components/
  Shell.tsx            # cabecalho com navegacao por papel
  atendimento/          # Inbox, ConversaChat, tipos
  config/                # PromptForm, ValoresManager
  admin/                 # Usuarios, Atendentes
lib/
  auth.ts               # getPerfil / exigirPapel
  supabase/
    server.ts            # cliente server (respeita RLS)
    client.ts             # cliente browser (singleton, Realtime)
    admin.ts               # service role (ignora RLS, so em rotas de API)
  whatsapp/
    zapi.ts                # enviarMensagem() via Z-API
    clientes.ts             # upsertCliente / conversaAberta
    notificar.ts             # avisa os atendentes no WhatsApp
  yumi/
    responder.ts             # chama a OpenAI, tool escalar_humano
    valores.ts                 # formata yumiwpp_valores pro contexto
proxy.ts                # (era middleware.ts) renova sessao, barra sem login
supabase/
  migrations/            # os 3 SQL, rodar em ordem
tools/
  seed-config.mjs         # manda os dois .txt pro banco
Dockerfile               # build multi-stage, pronto pro Coolify
Prompt para yumi.txt      # system prompt da Yumi (editavel por /config tambem)
Base de conhecimento yumi.txt  # base de conhecimento (idem)
```

## Rodando localmente (desenvolvimento)

```bash
cp .env.example .env.local
```

Preenche pelo menos as três chaves do Supabase (pode ser um projeto de teste
separado do de produção).

```bash
npm install
```

```bash
npm run dev
```

Abre em http://localhost:3000. Sem Z-API configurada, dá pra testar tudo
inserindo linha direto no Supabase (SQL Editor) e usando a tela
`/atendimento` normalmente — só a ponte real com WhatsApp que não funciona
sem as chaves da Z-API.

## Progressive Web App

`app/manifest.ts` gera o manifest. Ícone em `public/icon.svg` (placeholder
simples "Y" — troca por um de verdade quando tiver a arte final, só
sobrescreve o arquivo, o resto continua funcionando). Sem service worker de
propósito: o app não precisa funcionar offline, só ficar instalável. No
celular, "Adicionar à tela de início" pelo menu do navegador já funciona.
