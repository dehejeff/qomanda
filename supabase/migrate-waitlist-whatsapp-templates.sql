-- Templates customizáveis de WhatsApp para fila e reserva de mesas.
-- Placeholders: {saudacao} {nome} {restaurante} {mesa} {mesas} {secao} {prazo} {pessoas}
-- NULL = usa o texto padrão do app.

alter table restaurants
  add column if not exists waitlist_ready_whatsapp_template text,
  add column if not exists waitlist_reserve_whatsapp_template text;

comment on column restaurants.waitlist_ready_whatsapp_template is
  'Mensagem WhatsApp quando a mesa é chamada na fila. Placeholders: {saudacao},{nome},{restaurante},{mesa},{mesas},{secao},{prazo},{pessoas}';
comment on column restaurants.waitlist_reserve_whatsapp_template is
  'Mensagem WhatsApp de confirmação ao reservar mesas. Placeholders: {saudacao},{nome},{restaurante},{mesa},{mesas},{secao},{prazo},{pessoas}';

notify pgrst, 'reload schema';
