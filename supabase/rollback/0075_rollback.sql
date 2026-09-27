-- Rollback da 0075 (Pix direto). Remove políticas, funções, tabelas e o bucket
-- (os arquivos do bucket precisam ser apagados antes pelo painel do Supabase).
drop policy if exists "payment_proofs_upload_own_pending" on storage.objects;
drop policy if exists "payment_proofs_read_own_or_staff" on storage.objects;
drop function if exists get_pousada_alert_emails(uuid);
drop function if exists review_payment_proof(uuid, boolean, text);
drop function if exists submit_payment_proof(uuid, text, text, text, integer);
drop function if exists get_booking_pix_instructions(uuid);
drop function if exists payment_proof_booking_id(text);
drop function if exists save_pousada_pix_settings(uuid, text, text, text, text, boolean);
drop table if exists payment_proofs;
drop type if exists payment_proof_status;
drop table if exists pousada_pix_settings;
delete from storage.buckets where id = 'payment-proofs';
