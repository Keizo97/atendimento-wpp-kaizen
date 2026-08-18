-- ============================================================
-- Dashboard: custo de IA, escaladas e analises diarias.
-- Rodar no Supabase: SQL Editor > New query > colar > Run.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PRECO DOS MODELOS (editavel em /admin)
-- O custo de cada chamada e calculado NA HORA e gravado junto,
-- entao mudar o preco aqui nao reescreve o historico ja gravado.
-- ------------------------------------------------------------
create table if not exists yumiwpp_precos_modelo (
  modelo         text primary key,
  usd_entrada_1m numeric(10,4) not null default 0,
  usd_saida_1m   numeric(10,4) not null default 0,
  updated_at     timestamptz not null default now()
);

-- Linha inicial com preco ZERO de proposito: enquanto ninguem preencher
-- o valor real em /admin, o dashboard avisa que o custo nao esta configurado
-- em vez de mostrar um numero errado com cara de certo.
insert into yumiwpp_precos_modelo (modelo)
values ('gpt-5-mini')
on conflict (modelo) do nothing;

-- ------------------------------------------------------------
-- 2. USO DE IA (uma linha por chamada da OpenAI)
-- ------------------------------------------------------------
create table if not exists yumiwpp_uso_ia (
  id              uuid primary key default gen_random_uuid(),
  conversa_id     uuid references yumiwpp_conversas(id) on delete set null,
  telefone        text,
  origem          text not null default 'atendimento'
                    check (origem in ('atendimento', 'analise')),
  modelo          text not null,
  tokens_entrada  integer not null default 0,
  tokens_saida    integer not null default 0,
  custo_usd       numeric(12,6) not null default 0,
  created_at      timestamptz not null default now()
);

create index if not exists yumiwpp_uso_ia_created_idx
  on yumiwpp_uso_ia (created_at desc);

create index if not exists yumiwpp_uso_ia_conversa_idx
  on yumiwpp_uso_ia (conversa_id);

-- ------------------------------------------------------------
-- 3. ESCALADAS (uma linha por vez que a Yumi chamou humano)
-- Os timestamps de assumido/finalizado sao preenchidos por trigger,
-- porque a tela de atendimento altera yumiwpp_conversas direto.
-- ------------------------------------------------------------
create table if not exists yumiwpp_escaladas (
  id            uuid primary key default gen_random_uuid(),
  conversa_id   uuid not null references yumiwpp_conversas(id) on delete cascade,
  telefone      text not null,
  motivo        text not null,
  prioridade    text not null default 'normal',
  resumo        text,
  created_at    timestamptz not null default now(),
  assumido_em   timestamptz,
  assumido_por  uuid references yumiwpp_profiles(id) on delete set null,
  finalizado_em timestamptz
);

create index if not exists yumiwpp_escaladas_created_idx
  on yumiwpp_escaladas (created_at desc);

-- Pega a escalada aberta mais recente da conversa e carimba o horario.
create or replace function yumiwpp_sincroniza_escalada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Alguem assumiu (assumido_por saiu de vazio pra preenchido)
  if new.assumido_por is not null and old.assumido_por is distinct from new.assumido_por then
    update yumiwpp_escaladas
    set assumido_em = coalesce(assumido_em, now()),
        assumido_por = new.assumido_por
    where id = (
      select id from yumiwpp_escaladas
      where conversa_id = new.id and finalizado_em is null
      order by created_at desc limit 1
    );
  end if;

  -- Voltou pra Yumi (modo humano -> bot) = atendimento finalizado
  if old.modo = 'humano' and new.modo = 'bot' then
    update yumiwpp_escaladas
    set finalizado_em = now()
    where id = (
      select id from yumiwpp_escaladas
      where conversa_id = new.id and finalizado_em is null
      order by created_at desc limit 1
    );
  end if;

  return new;
end;
$$;

drop trigger if exists yumiwpp_conversas_escalada on yumiwpp_conversas;
create trigger yumiwpp_conversas_escalada
  after update on yumiwpp_conversas
  for each row execute function yumiwpp_sincroniza_escalada();

-- ------------------------------------------------------------
-- 4. ANALISES (o que o motor das 8h gera)
-- ------------------------------------------------------------
create table if not exists yumiwpp_analises (
  id              uuid primary key default gen_random_uuid(),
  data_referencia date not null,
  periodo_dias    integer not null default 1,
  resumo          text,
  dados           jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

-- Uma analise por dia+periodo. Rodar de novo sobrescreve (upsert).
create unique index if not exists yumiwpp_analises_dia_uniq
  on yumiwpp_analises (data_referencia, periodo_dias);

-- ------------------------------------------------------------
-- 5. RLS
-- ------------------------------------------------------------
alter table yumiwpp_precos_modelo enable row level security;
alter table yumiwpp_uso_ia        enable row level security;
alter table yumiwpp_escaladas     enable row level security;
alter table yumiwpp_analises      enable row level security;

-- Custo e analise: dado sensivel de negocio, so admin.
drop policy if exists "precos admin" on yumiwpp_precos_modelo;
create policy "precos admin" on yumiwpp_precos_modelo
  for all to authenticated using (yumiwpp_e_admin()) with check (yumiwpp_e_admin());

drop policy if exists "uso ia admin" on yumiwpp_uso_ia;
create policy "uso ia admin" on yumiwpp_uso_ia
  for all to authenticated using (yumiwpp_e_admin()) with check (yumiwpp_e_admin());

drop policy if exists "analises admin" on yumiwpp_analises;
create policy "analises admin" on yumiwpp_analises
  for all to authenticated using (yumiwpp_e_admin()) with check (yumiwpp_e_admin());

-- Escalada o gerente tambem le: e util ver na tela por que caiu pra humano.
drop policy if exists "escaladas atendimento" on yumiwpp_escaladas;
create policy "escaladas atendimento" on yumiwpp_escaladas
  for select to authenticated using (yumiwpp_pode_atender());

drop policy if exists "escaladas admin" on yumiwpp_escaladas;
create policy "escaladas admin" on yumiwpp_escaladas
  for all to authenticated using (yumiwpp_e_admin()) with check (yumiwpp_e_admin());
