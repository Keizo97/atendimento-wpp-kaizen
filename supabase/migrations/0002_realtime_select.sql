-- ============================================================
-- Fix: Realtime (postgres_changes) nao avalia RLS que dependem de
-- subquery/join. A policy "for all" de yumiwpp_conversas/yumiwpp_mensagens
-- usa yumiwpp_pode_atender(), que consulta yumiwpp_profiles por baixo —
-- isso faz o Realtime falhar em silencio: a escrita funciona normal via
-- REST, mas o evento nunca chega no navegador (nada de erro, so nao chega).
--
-- Fix recomendado pela propria Supabase pra esse caso: policy de SELECT
-- separada, sem lookup em outra tabela, so nas tabelas que usam Realtime.
--
-- Efeito colateral: qualquer usuario logado (inclusive "editor") passa a
-- conseguir LER conversas/mensagens via API direta, mesmo sem acesso a
-- tela /atendimento (que continua bloqueada pelo layout). Escrita continua
-- restrita a gerente/admin pela policy "for all" que ja existia.
-- Rodar no Supabase: SQL Editor > New query > colar > Run.
-- ============================================================

-- Garante que o RLS volta ligado (foi desligado so pra diagnostico manual)
alter table yumiwpp_conversas enable row level security;
alter table yumiwpp_mensagens enable row level security;

drop policy if exists "conversas realtime select" on yumiwpp_conversas;
create policy "conversas realtime select" on yumiwpp_conversas
  for select to authenticated using (true);

drop policy if exists "mensagens realtime select" on yumiwpp_mensagens;
create policy "mensagens realtime select" on yumiwpp_mensagens
  for select to authenticated using (true);
