-- ============================================================
-- Modelo da IA escolhido pela tela /admin (em vez de so pela env var).
-- Rodar no Supabase: SQL Editor > New query > colar > Run.
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================

alter table yumiwpp_config add column if not exists modelo text;
alter table yumiwpp_config add column if not exists modelo_analise text;

-- Vazio = usa o fallback de env var (OPENAI_MODEL / OPENAI_MODEL_ANALISE).
-- Nao seta um valor fixo aqui de proposito, pra nao sobrescrever o que
-- ja esta configurado via variavel de ambiente sem o admin escolher.
