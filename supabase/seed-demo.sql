-- ============================================================
-- Qomanda — Dados de teste: Tasca do Porto
-- ============================================================
-- INSTRUÇÕES:
--   1. Crie o usuário admin em: Supabase → Authentication → Users → Invite
--   2. Copie o UUID do usuário criado
--   3. Substitua '00000000-0000-0000-0000-000000000001' pelo UUID real
--   4. Execute no SQL Editor do Supabase
-- ============================================================

-- IDs fixos para referência cruzada
-- Restaurante: 'a1b2c3d4-e5f6-7890-abcd-ef1234560001'
-- Categorias e itens com IDs sequenciais

-- ── 1. RESTAURANTE ─────────────────────────────────────────
INSERT INTO restaurants (
  id, owner_id, name, slug, address, phone, status,
  whatsapp_nfe_enabled
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234560001',
  '00000000-0000-0000-0000-000000000001', -- ⚠️  SUBSTITUIR pelo UUID do usuário admin
  'Tasca do Porto',
  'tasca-do-porto',
  'Rua Augusta, 2345 — Consolação, São Paulo – SP, 01310-100',
  '(11) 3456-7890',
  'active',
  false
);

-- ── 2. MESAS ───────────────────────────────────────────────
INSERT INTO tables (id, restaurant_id, number, status) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', '1',  'free'),
  ('b1000000-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', '2',  'free'),
  ('b1000000-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', '3',  'free'),
  ('b1000000-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', '4',  'free'),
  ('b1000000-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', '5',  'free'),
  ('b1000000-0000-0000-0000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', '6',  'free'),
  ('b1000000-0000-0000-0000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', '7',  'free'),
  ('b1000000-0000-0000-0000-000000000008', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', '8',  'free'),
  ('b1000000-0000-0000-0000-000000000009', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', '9',  'free'),
  ('b1000000-0000-0000-0000-000000000010', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', '10', 'free'),
  ('b1000000-0000-0000-0000-000000000011', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'B1', 'free'),
  ('b1000000-0000-0000-0000-000000000012', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'B2', 'free');

-- ── 3. CATEGORIAS DO CARDÁPIO ───────────────────────────────
INSERT INTO menu_categories (id, restaurant_id, name, display_order) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'Entradas',         0),
  ('c1000000-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'Pratos Principais', 1),
  ('c1000000-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'Frutos do Mar',    2),
  ('c1000000-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'Bebidas',          3),
  ('c1000000-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'Sobremesas',       4);

-- ── 4. ITENS DO CARDÁPIO ────────────────────────────────────

-- Entradas
INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, available, contains_alcohol) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000001',
   'Pão de Alho Artesanal', 'Pão rústico com manteiga de ervas, alho tostado e azeite virgem extra.', 28.90, true, false),

  ('d1000000-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000001',
   'Burrata com Tomates', 'Burrata cremosa italiana, tomates confitados, pesto de manjericão e flor de sal.', 52.00, true, false),

  ('d1000000-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000001',
   'Croquete de Bacalhau', 'Croquetes crocantes recheados com bacalhau desfiado e cream cheese. (6 unidades)', 38.00, true, false),

  ('d1000000-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000001',
   'Tábua de Frios Portuguesa', 'Presunto de Parma, queijo Serra da Estrela, linguiça defumada, azeitonas e pão artesanal.', 68.00, true, false);

-- Pratos Principais
INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, available, contains_alcohol) VALUES
  ('d2000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000002',
   'Picanha na Brasa', '400g de picanha angus grelhada ao ponto, arroz biro-biro, farofa crocante e vinagrete.', 98.00, true, false),

  ('d2000000-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000002',
   'Frango ao Vinho do Porto', 'Coxa e sobrecoxa marinadas em vinho do Porto, batatas rústicas e alho confitado.', 72.00, true, false),

  ('d2000000-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000002',
   'Risoto de Funghi', 'Risoto cremoso com mix de funghi, parmesão envelhecido e trufa negra. (Vegetariano)', 64.00, true, false),

  ('d2000000-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000002',
   'Costela na Churrasqueira', '500g de costela bovina assada lentamente, mandioca frita e molho chimichurri.', 89.00, true, false),

  ('d2000000-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000002',
   'Bacalhau à Brás', 'Bacalhau desfiado, ovos mexidos, batata palha, azeitonas e salsa. Clássico português.', 82.00, true, false);

-- Frutos do Mar
INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, available, contains_alcohol) VALUES
  ('d3000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000003',
   'Camarão ao Alho e Óleo', '300g de camarão rosa salteado com azeite, alho, limão siciliano e pimenta calabresa.', 78.00, true, false),

  ('d3000000-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000003',
   'Polvo Grelhado', 'Tentáculos de polvo grelhados com azeite de ervas, batata cozida e paprika defumada.', 94.00, true, false),

  ('d3000000-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000003',
   'Moqueca de Peixe', 'Filé de robalo em moqueca capixaba com leite de coco, pimentões e dendê. Acompanha arroz e pirão.', 86.00, true, false);

-- Bebidas
INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, available, contains_alcohol) VALUES
  ('d4000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000004',
   'Água Mineral', 'Sem gás ou com gás — 500ml.', 8.00, true, false),

  ('d4000000-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000004',
   'Refrigerante Lata', 'Coca-Cola, Guaraná Antarctica ou Sprite — 350ml.', 10.00, true, false),

  ('d4000000-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000004',
   'Suco Natural', 'Laranja, maracujá, abacaxi ou limão — 400ml.', 16.00, true, false),

  ('d4000000-0000-0000-0000-000000000004', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000004',
   'Chope Artesanal', 'Chope gelado IPA ou Pilsen — 300ml. Produção local.', 18.00, true, true),

  ('d4000000-0000-0000-0000-000000000005', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000004',
   'Caipirinha', 'Cachaça artesanal, limão, açúcar e muito gelo. Clássica ou de frutas.', 24.00, true, true),

  ('d4000000-0000-0000-0000-000000000006', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000004',
   'Vinho da Casa', 'Taça de vinho tinto ou branco da seleção do sommelier — 150ml.', 28.00, true, true),

  ('d4000000-0000-0000-0000-000000000007', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000004',
   'Cerveja Importada', 'Heineken, Stella Artois ou Corona — long neck 355ml.', 16.00, true, true);

-- Sobremesas
INSERT INTO menu_items (id, restaurant_id, category_id, name, description, price, available, contains_alcohol) VALUES
  ('d5000000-0000-0000-0000-000000000001', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000005',
   'Pudim de Leite Condensado', 'Pudim caseiro com calda de caramelo e creme de leite. Receita da avó.', 22.00, true, false),

  ('d5000000-0000-0000-0000-000000000002', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000005',
   'Petit Gâteau', 'Bolinho de chocolate belga com recheio quente e gelato de baunilha bourbon.', 34.00, true, false),

  ('d5000000-0000-0000-0000-000000000003', 'a1b2c3d4-e5f6-7890-abcd-ef1234560001', 'c1000000-0000-0000-0000-000000000005',
   'Pastel de Nata', 'Dois pastéis de nata portugueses quentinhos com canela e açúcar de confeiteiro.', 18.00, true, false);

-- ── 5. REGRAS DE FIDELIDADE ────────────────────────────────
INSERT INTO loyalty_rules (restaurant_id, visit_count, benefit_type, benefit_value, active) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234560001', 3,  'free_drink',   'Água ou refrigerante grátis',              true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234560001', 5,  'free_item',    'Entrada de até R$30 grátis',               true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234560001', 10, 'discount_pct', '10% de desconto em toda a conta',          true),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234560001', 20, 'free_drink',   'Garrafa de vinho da casa por conta da casa', true);

-- ── RESUMO ─────────────────────────────────────────────────
-- Restaurante:  Tasca do Porto (slug: tasca-do-porto)
-- Mesas:        10 numeradas (1-10) + 2 de bar (B1, B2)
-- Cardápio:     5 categorias, 22 itens
--   Entradas (4) · Pratos Principais (5) · Frutos do Mar (3)
--   Bebidas (7, sendo 4 alcoólicas) · Sobremesas (3)
-- Fidelidade:   4 regras (3, 5, 10 e 20 visitas)
--
-- URL de teste: http://localhost:3000/tasca-do-porto?mesa=1
-- ============================================================
