-- ============================================================
-- Lista de atendentes que recebem aviso no WhatsApp quando a Yumi escala
-- pra humano. Numero pode ser telefone de pessoa ou ID de grupo do Z-API.
-- Rodar no Supabase: SQL Editor > New query > colar > Run.
-- ============================================================

create table if not exists yumiwpp_atendentes (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  numero     text not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

alter table yumiwpp_atendentes enable row level security;

-- So admin ve e mexe (fica dentro de /admin, que ja e admin-only,
-- mas a policy protege tambem quem tentar acessar via API direto).
drop policy if exists "atendentes admin" on yumiwpp_atendentes;
create policy "atendentes admin" on yumiwpp_atendentes
  for all to authenticated using (yumiwpp_e_admin()) with check (yumiwpp_e_admin());
