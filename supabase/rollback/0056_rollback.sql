-- Rollback da 0056_platform_billing.sql
revoke all on function record_subscription_invoice(text, text, numeric, text, date, date, timestamptz)
  from service_role;
drop function if exists record_subscription_invoice(text, text, numeric, text, date, date, timestamptz);

revoke all on function sync_subscription_status(text, text, date) from service_role;
drop function if exists sync_subscription_status(text, text, date);

revoke all on function create_pending_subscription(uuid, uuid, text) from authenticated;
drop function if exists create_pending_subscription(uuid, uuid, text);

drop policy if exists "invoices_read" on invoices;
drop policy if exists "subscriptions_read" on subscriptions;
drop policy if exists "plans_read" on plans;

drop table if exists invoices;
drop table if exists subscriptions;
drop table if exists plans;
