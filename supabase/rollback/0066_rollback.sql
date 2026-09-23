-- Rollback da 0066_reviews_only_real_stays.sql — volta a policy de inserção
-- da 0002 e remove o trigger de edição e a função auxiliar.

drop trigger if exists trg_guard_review_changes on reviews;
drop function if exists guard_review_changes();

drop policy if exists "reviews_author_write" on reviews;
create policy "reviews_author_write" on reviews for insert
  with check (author_id = auth.uid());

drop function if exists auth_can_review_booking(uuid, uuid);
