-- Rollback da 0107 (guia de boas-vindas). Apaga o histórico de envios e o ajuste.
-- Antes de rodar, volte o app para uma versão anterior ao PR da 0107: a versão
-- nova lê `platform_settings` (sem a tabela, o envio automático fica desligado
-- e o botão manual mostra erro).
drop table if exists public.pousada_welcome_guide_sends;
drop table if exists public.platform_settings;
