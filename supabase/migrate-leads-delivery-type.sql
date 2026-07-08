-- Novo tipo de lead: lanchonete com delivery (validação de demanda do modo
-- delivery — cardápio via WhatsApp/Instagram + pedido + pagamento, sem comissão).
alter table leads drop constraint if exists leads_restaurant_type_check;
alter table leads add constraint leads_restaurant_type_check
  check (restaurant_type in ('salao','balcao','salao_balcao','food_hall','delivery'));

notify pgrst, 'reload schema';
