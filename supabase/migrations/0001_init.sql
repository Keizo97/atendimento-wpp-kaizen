-- ============================================================
-- Yumi WhatsApp — schema inicial
-- Rodar no Supabase: Dashboard > SQL Editor > New query > colar > Run
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================

-- ------------------------------------------------------------
-- 1. TIPOS
-- ------------------------------------------------------------
do $$ begin
  create type yumiwpp_role as enum ('gerente', 'editor', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type yumiwpp_modo as enum ('bot', 'humano');
exception when duplicate_object then null; end $$;

do $$ begin
  create type yumiwpp_autor as enum ('cliente', 'yumi', 'gerente');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- 2. TABELAS
-- ------------------------------------------------------------

-- Usuarios do painel (espelha auth.users)
create table if not exists yumiwpp_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null default '',
  role        yumiwpp_role not null default 'gerente',
  created_at  timestamptz not null default now()
);

-- CRM basico dos clientes do WhatsApp
create table if not exists yumiwpp_clientes (
  telefone         text primary key,
  nome             text,
  primeiro_contato timestamptz not null default now(),
  ultimo_contato   timestamptz not null default now(),
  total_mensagens  integer not null default 0,
  tags             text[] not null default '{}',
  observacoes      text
);

-- Uma conversa por cliente (uma aberta por vez)
create table if not exists yumiwpp_conversas (
  id           uuid primary key default gen_random_uuid(),
  telefone     text not null references yumiwpp_clientes(telefone) on delete cascade,
  modo         yumiwpp_modo not null default 'bot',
  assumido_por uuid references yumiwpp_profiles(id) on delete set null,
  status       text not null default 'aberta' check (status in ('aberta', 'fechada')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- So pode existir UMA conversa aberta por telefone
create unique index if not exists yumiwpp_conversas_uma_aberta
  on yumiwpp_conversas (telefone) where status = 'aberta';

create index if not exists yumiwpp_conversas_updated_idx
  on yumiwpp_conversas (updated_at desc);

-- Historico completo. Tambem e a fonte de contexto da IA.
create table if not exists yumiwpp_mensagens (
  id              uuid primary key default gen_random_uuid(),
  conversa_id     uuid not null references yumiwpp_conversas(id) on delete cascade,
  telefone        text not null,
  autor           yumiwpp_autor not null,
  texto           text not null,
  zapi_message_id text,
  created_at      timestamptz not null default now()
);

create index if not exists yumiwpp_mensagens_conversa_idx
  on yumiwpp_mensagens (conversa_id, created_at desc);

-- Dedupe do webhook: mesmo messageId nunca entra duas vezes
create unique index if not exists yumiwpp_mensagens_zapi_id_uniq
  on yumiwpp_mensagens (zapi_message_id) where zapi_message_id is not null;

-- Config da Yumi (linha unica, editada pelo Editor)
create table if not exists yumiwpp_config (
  id             smallint primary key default 1 check (id = 1),
  system_prompt  text not null default '',
  knowledge_base text not null default '',
  updated_by     uuid references yumiwpp_profiles(id) on delete set null,
  updated_at     timestamptz not null default now()
);

-- Tabela de precos (editada pelo Editor pela UI)
create table if not exists yumiwpp_valores (
  id        uuid primary key default gen_random_uuid(),
  item      text not null,
  categoria text,
  preco     numeric(10,2),
  condicao  text,
  ativo     boolean not null default true,
  ordem     integer not null default 0
);

create index if not exists yumiwpp_valores_ativo_idx
  on yumiwpp_valores (ativo, categoria, ordem);

-- Config NAO secreta de integracoes (secrets ficam em env vars do Coolify)
create table if not exists yumiwpp_integracoes (
  chave      text primary key,
  valor      text,
  descricao  text,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. FUNCOES AUXILIARES (depois das tabelas: funcoes "language sql"
--    validam a existencia das tabelas na hora da criacao)
-- ------------------------------------------------------------

-- Atualiza updated_at automaticamente
create or replace function yumiwpp_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Le o papel do usuario logado.
-- SECURITY DEFINER evita recursao infinita nas policies de yumiwpp_profiles.
create or replace function yumiwpp_meu_role()
returns yumiwpp_role
language sql
stable
security definer
set search_path = public
as $$
  select role from yumiwpp_profiles where id = auth.uid();
$$;

-- Atalhos de permissao
create or replace function yumiwpp_pode_atender()
returns boolean language sql stable security definer set search_path = public as $$
  select yumiwpp_meu_role() in ('gerente', 'admin');
$$;

create or replace function yumiwpp_pode_editar()
returns boolean language sql stable security definer set search_path = public as $$
  select yumiwpp_meu_role() in ('editor', 'admin');
$$;

create or replace function yumiwpp_e_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select yumiwpp_meu_role() = 'admin';
$$;

-- ------------------------------------------------------------
-- 4. TRIGGERS
-- ------------------------------------------------------------

drop trigger if exists yumiwpp_conversas_updated on yumiwpp_conversas;
create trigger yumiwpp_conversas_updated
  before update on yumiwpp_conversas
  for each row execute function yumiwpp_set_updated_at();

drop trigger if exists yumiwpp_config_updated on yumiwpp_config;
create trigger yumiwpp_config_updated
  before update on yumiwpp_config
  for each row execute function yumiwpp_set_updated_at();

drop trigger if exists yumiwpp_integracoes_updated on yumiwpp_integracoes;
create trigger yumiwpp_integracoes_updated
  before update on yumiwpp_integracoes
  for each row execute function yumiwpp_set_updated_at();

-- Cria o profile automaticamente quando um usuario e criado no Auth.
-- O papel padrao e 'gerente'; o admin muda depois na tela /admin.
create or replace function yumiwpp_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into yumiwpp_profiles (id, nome, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::yumiwpp_role, 'gerente')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists yumiwpp_on_auth_user_created on auth.users;
create trigger yumiwpp_on_auth_user_created
  after insert on auth.users
  for each row execute function yumiwpp_handle_new_user();

-- ------------------------------------------------------------
-- 5. RLS (Row Level Security)
-- O backend usa a service role key, que ignora RLS de proposito.
-- Estas policies protegem o acesso vindo do navegador.
-- ------------------------------------------------------------

alter table yumiwpp_profiles    enable row level security;
alter table yumiwpp_clientes    enable row level security;
alter table yumiwpp_conversas   enable row level security;
alter table yumiwpp_mensagens   enable row level security;
alter table yumiwpp_config      enable row level security;
alter table yumiwpp_valores     enable row level security;
alter table yumiwpp_integracoes enable row level security;

-- PROFILES: cada um le o proprio; admin le e mexe em todos
drop policy if exists "profiles ler proprio" on yumiwpp_profiles;
create policy "profiles ler proprio" on yumiwpp_profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "profiles admin total" on yumiwpp_profiles;
create policy "profiles admin total" on yumiwpp_profiles
  for all to authenticated using (yumiwpp_e_admin()) with check (yumiwpp_e_admin());

-- CLIENTES / CONVERSAS / MENSAGENS: gerente e admin
drop policy if exists "clientes atendimento" on yumiwpp_clientes;
create policy "clientes atendimento" on yumiwpp_clientes
  for all to authenticated using (yumiwpp_pode_atender()) with check (yumiwpp_pode_atender());

drop policy if exists "conversas atendimento" on yumiwpp_conversas;
create policy "conversas atendimento" on yumiwpp_conversas
  for all to authenticated using (yumiwpp_pode_atender()) with check (yumiwpp_pode_atender());

drop policy if exists "mensagens atendimento" on yumiwpp_mensagens;
create policy "mensagens atendimento" on yumiwpp_mensagens
  for all to authenticated using (yumiwpp_pode_atender()) with check (yumiwpp_pode_atender());

-- CONFIG / VALORES: qualquer logado le, so editor e admin escrevem
drop policy if exists "config ler" on yumiwpp_config;
create policy "config ler" on yumiwpp_config
  for select to authenticated using (true);

drop policy if exists "config escrever" on yumiwpp_config;
create policy "config escrever" on yumiwpp_config
  for all to authenticated using (yumiwpp_pode_editar()) with check (yumiwpp_pode_editar());

drop policy if exists "valores ler" on yumiwpp_valores;
create policy "valores ler" on yumiwpp_valores
  for select to authenticated using (true);

drop policy if exists "valores escrever" on yumiwpp_valores;
create policy "valores escrever" on yumiwpp_valores
  for all to authenticated using (yumiwpp_pode_editar()) with check (yumiwpp_pode_editar());

-- INTEGRACOES: so admin
drop policy if exists "integracoes admin" on yumiwpp_integracoes;
create policy "integracoes admin" on yumiwpp_integracoes
  for all to authenticated using (yumiwpp_e_admin()) with check (yumiwpp_e_admin());

-- ------------------------------------------------------------
-- 6. REALTIME (tela de atendimento ao vivo)
-- ------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table yumiwpp_mensagens;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table yumiwpp_conversas;
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- 7. LINHA UNICA DE CONFIG
-- ------------------------------------------------------------
insert into yumiwpp_config (id) values (1) on conflict (id) do nothing;
