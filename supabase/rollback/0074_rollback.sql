-- Rollback da 0074.
drop index if exists uq_traveler_profiles_document_hash;
alter table traveler_profiles
  drop column if exists street,
  drop column if exists address_number,
  drop column if exists complement,
  drop column if exists district;
