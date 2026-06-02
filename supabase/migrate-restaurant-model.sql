-- Modelo operacional do restaurante (preset no cadastro)
alter table restaurants
  add column if not exists restaurant_model text
    check (restaurant_model is null or restaurant_model in (
      'salao', 'balcao', 'salao_balcao', 'rodizio', 'buffet_peso', 'food_hall'
    )),
  add column if not exists onboarding_completed_at timestamptz;

comment on column restaurants.restaurant_model is 'Preset operacional escolhido no cadastro (salao, balcao, salao_balcao, …)';
comment on column restaurants.onboarding_completed_at is 'Quando o checklist inicial (gateway + cardápio) foi concluído';

notify pgrst, 'reload schema';
