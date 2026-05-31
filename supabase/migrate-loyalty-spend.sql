-- ============================================================
-- MIGRAÇÃO: Regras de fidelidade por valor gasto (além de visitas)
--
-- Adiciona rule_type ('visits' | 'spend') e min_spend.
-- Regras 'visits' usam visit_count; regras 'spend' usam min_spend (R$).
-- ============================================================

alter table loyalty_rules
  add column if not exists rule_type text not null default 'visits'
    check (rule_type in ('visits','spend'));

alter table loyalty_rules
  add column if not exists min_spend numeric(10,2);

-- visit_count passa a ser opcional (regras 'spend' não usam)
alter table loyalty_rules alter column visit_count drop not null;
alter table loyalty_rules drop constraint if exists loyalty_rules_visit_count_check;
