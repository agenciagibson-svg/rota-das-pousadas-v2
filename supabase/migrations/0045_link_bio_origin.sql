-- =============================================================================
-- Origem "link da bio" para reservas.
--
-- Isolada em migration própria pelo mesmo motivo da 0012: o Postgres não
-- permite usar um valor de enum na mesma transação em que ele é criado. A 0046
-- já usa `link_bio` nas consultas do relatório, então precisa vir depois desta.
--
-- Sem este valor não há como separar a reserva que veio do Instagram das que
-- vieram do catálogo da Rota — e é justamente essa separação que faz a pousada
-- enxergar o retorno do link e renovar a assinatura.
-- =============================================================================

alter type booking_origin add value if not exists 'link_bio';
