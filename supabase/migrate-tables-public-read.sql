-- ============================================================
-- Cliente (role anon) precisa ler o NÚMERO da mesa no checkout e recibos.
-- Hoje 'tables' só tem policy owner_all → cliente recebe table=null no join
-- (sessions.select('*, table:tables(number)')) e a tela mostra "Mesa ." vazio.
--
-- CUIDADO: check_in_token é o segredo anti-fraude do QR. NÃO pode vazar p/ anon.
-- Postgres não revoga uma coluna isolada se há SELECT de tabela inteira:
-- então troca-se o grant de tabela por grant de colunas (sem check_in_token).
-- O dono (role authenticated) é intocado e continua lendo o token p/ gerar o QR.
-- ============================================================

-- anon: remove select amplo e concede apenas colunas não sensíveis
revoke select on public.tables from anon;
grant select (id, restaurant_id, number, status, qr_code_url, created_at)
  on public.tables to anon;

-- Permite ao cliente (anon) ler linhas de mesas (número/status são públicos —
-- já ficam impressos fisicamente na mesa). check_in_token segue protegido pelo grant acima.
drop policy if exists "public_read_safe" on public.tables;
create policy "public_read_safe" on public.tables
  for select to anon using (true);

notify pgrst, 'reload schema';
