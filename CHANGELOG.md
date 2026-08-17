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
- Chaves: `ZAPI_*`, `ANTHROPIC_API_KEY`, `LINK_RESERVA`, `LINK_FILA`, dominio.
- Fases 3 a 7.
