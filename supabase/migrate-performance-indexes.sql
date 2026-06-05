-- ============================================================
-- Índices de performance — caminhos quentes (analytics, webhooks, fila de pedidos)
-- Complementa os índices já existentes (order_items.order_id, orders.session_id,
-- payments.session_id, sessions.table_id). Idempotente.
--
-- Obs.: em produção com tabelas grandes, prefira CREATE INDEX CONCURRENTLY
-- (fora de transação) para não travar escritas. Pré-lançamento as tabelas são
-- pequenas e o CREATE INDEX é praticamente instantâneo.
-- ============================================================

-- Analytics/relatórios: faturamento por período (restaurant_id + status='paid' + paid_at)
create index if not exists idx_payments_restaurant_status_paid_at
  on payments (restaurant_id, status, paid_at);

-- Webhooks (Asaas/Mercado Pago): busca a cobrança pelo id externo
create index if not exists idx_payments_asaas_payment_id
  on payments (asaas_payment_id)
  where asaas_payment_id is not null;

-- Analytics + fila de pedidos do dashboard: pedidos por restaurante e período
create index if not exists idx_orders_restaurant_created_at
  on orders (restaurant_id, created_at desc);

-- Sessões abertas/fechando por restaurante (app garçom, overview)
create index if not exists idx_sessions_restaurant_status
  on sessions (restaurant_id, status);

notify pgrst, 'reload schema';
