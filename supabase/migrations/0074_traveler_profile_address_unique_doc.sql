-- =============================================================================
-- 0074 — Cadastro do viajante: endereço em campos (preenchido pelo CEP) e
-- documento único por conta.
--
-- (A) rua/número/complemento/bairro separados, para o formulário buscar o
--     endereço pelo CEP e o hóspede só completar o número. `address` continua
--     existindo com a linha montada ("Rua X, 123 - Apto 4 - Bairro") — é ela
--     que `ensure_traveler_guest` (0073) copia para a ficha da pousada.
-- (B) Um CPF/passaporte = uma conta. Impede o mesmo documento em duas contas
--     (cadastro duplicado ou uso do CPF de outra pessoa). Compara pelo hash
--     (o valor cifrado muda a cada gravação).
-- =============================================================================

alter table traveler_profiles
  add column if not exists street         text,
  add column if not exists address_number text,
  add column if not exists complement     text,
  add column if not exists district       text;

-- Se já houver o mesmo documento em mais de uma conta (testes do pré-piloto),
-- fica com quem cadastrou primeiro; as outras contas perdem só o documento e
-- vão precisar informá-lo de novo (a reserva pede o cadastro completo).
update traveler_profiles t
   set document_type = null, document_number = null,
       document_number_hash = null, document_last4 = null, updated_at = now()
 where t.document_number_hash is not null
   and exists (
     select 1 from traveler_profiles o
      where o.document_number_hash = t.document_number_hash
        and (o.created_at, o.user_id) < (t.created_at, t.user_id)
   );

create unique index if not exists uq_traveler_profiles_document_hash
  on traveler_profiles (document_number_hash)
  where document_number_hash is not null;
