-- Rollback da 0068_list_membership_names.sql — remove a RPC (a tela volta a
-- mostrar "Sem nome" para os outros membros).

drop function if exists list_membership_names(uuid);
