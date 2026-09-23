-- Rollback da 0065_guard_pousada_owner_changes.sql — remove o trigger e a
-- função; o dono volta a poder alterar qualquer coluna da própria pousada.

drop trigger if exists trg_guard_pousada_owner_changes on pousadas;
drop function if exists guard_pousada_owner_changes();
