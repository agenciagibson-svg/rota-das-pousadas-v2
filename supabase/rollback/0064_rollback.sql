-- Rollback da 0064_set_plan_preapproval_id.sql — remove a RPC (nenhuma coluna
-- nova). O app volta a gravar direto em `plans`, o que a RLS não permite.

drop function if exists set_plan_preapproval_id(uuid, text);
