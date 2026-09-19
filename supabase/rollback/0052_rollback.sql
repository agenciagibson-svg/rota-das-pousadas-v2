-- =============================================================================
-- Rollback da 0052 (link_pousada_owner).
-- Remove so a funcao. Nao apaga memberships ja criadas por ela (dado real).
-- =============================================================================
drop function if exists link_pousada_owner(uuid, text);
