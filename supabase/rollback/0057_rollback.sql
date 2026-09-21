-- Rollback da 0057_login_attempts_report.sql
revoke all on function list_login_attempts(text, integer) from authenticated;
drop function if exists list_login_attempts(text, integer);
