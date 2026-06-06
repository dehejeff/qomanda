-- ==============================================================
-- NOVA PRECIFICAÇÃO (jun/2026)
-- Mensalidade maior + comissão flat e baixa (decrescente por plano).
-- platform_fee_percent passa a guardar a taxa EFETIVA do plano (flat),
-- alinhado ao runtime (commission-tiers.ts: base 0,7% − desconto por plano).
-- Rodar no Supabase SQL Editor.
-- ==============================================================

update plans set
  name = 'Starter',
  max_tables = 20,
  monthly_fee = 299.00,
  platform_fee_percent = 0.70,
  platform_fee_fixed = 0,
  commission_plan_discount = 0,
  trial_days = 14,
  display_order = 1
where id = 'starter';

update plans set
  name = 'Growth',
  max_tables = 50,
  monthly_fee = 399.00,
  platform_fee_percent = 0.50,
  platform_fee_fixed = 0,
  commission_plan_discount = 0.20,
  trial_days = 14,
  display_order = 2
where id = 'growth';

update plans set
  name = 'Pro',
  max_tables = null,            -- mesas ilimitadas
  monthly_fee = 599.00,
  platform_fee_percent = 0.30,
  platform_fee_fixed = 0,
  commission_plan_discount = 0.40,
  trial_days = 14,
  display_order = 3
where id = 'pro';

update plans set
  name = 'Enterprise',
  max_tables = null,
  monthly_fee = 0,
  platform_fee_percent = 0,     -- comissão negociável
  platform_fee_fixed = 0,
  commission_plan_discount = 0.70,
  trial_days = 14,
  display_order = 4
where id = 'enterprise';

notify pgrst, 'reload schema';
