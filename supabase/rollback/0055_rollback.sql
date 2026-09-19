-- Rollback da 0055_platform_expenses.sql
drop policy if exists "platform_expenses_write" on platform_expenses;
drop policy if exists "platform_expenses_read" on platform_expenses;
drop function if exists auth_can_manage_platform_finance();
drop table if exists platform_expenses;
