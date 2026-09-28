-- Rollback da 0080 (plano de ação / tráfego pago).
drop function if exists get_growth_status(uuid);
drop function if exists growth_profiles(uuid);
drop function if exists request_growth_help(uuid);
drop function if exists add_growth_activity(uuid, text, text);
drop function if exists save_growth_opportunity(uuid, text, numeric, numeric, date, date, date, text);
drop function if exists growth_stage_label(text);
drop table if exists growth_activities;
drop table if exists growth_opportunities;
drop function if exists auth_can_manage_growth();
