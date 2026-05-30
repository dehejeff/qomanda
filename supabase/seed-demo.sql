-- ============================================================
-- Qomanda — Dados de teste: Tasca do Porto
-- ============================================================
-- ÚNICO PASSO:
--   1. Crie o usuário admin em:
--      Supabase → Authentication → Users → Add User
--      (use o email que vai acessar o painel)
--
--   2. Substitua o email abaixo pelo email que você cadastrou
--
--   3. Execute no SQL Editor do Supabase
-- ============================================================

DO $$
DECLARE
  v_owner_id  uuid;
  v_rest_id   uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234560001';

BEGIN

  -- ── Busca o UUID do usuário pelo email ──────────────────
  SELECT id INTO v_owner_id
  FROM auth.users
  WHERE email = 'SEU_EMAIL@AQUI.COM';   -- ← TROQUE ESTE EMAIL

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION
      'Usuário não encontrado. Crie o usuário em Authentication → Users primeiro.';
  END IF;

  -- ── 1. RESTAURANTE ────────────────────────────────────
  INSERT INTO restaurants (
    id, owner_id, name, slug, address, phone, status, whatsapp_nfe_enabled
  ) VALUES (
    v_rest_id,
    v_owner_id,
    'Tasca do Porto',
    'tasca-do-porto',
    'Rua Augusta, 2345 — Consolação, São Paulo – SP, 01310-100',
    '(11) 3456-7890',
    'active',
    false
  )
  ON CONFLICT (slug) DO NOTHING;

  -- ── 2. MESAS ──────────────────────────────────────────
  INSERT INTO tables (restaurant_id, number, status) VALUES
    (v_rest_id, '1',  'free'),
    (v_rest_id, '2',  'free'),
    (v_rest_id, '3',  'free'),
    (v_rest_id, '4',  'free'),
    (v_rest_id, '5',  'free'),
    (v_rest_id, '6',  'free'),
    (v_rest_id, '7',  'free'),
    (v_rest_id, '8',  'free'),
    (v_rest_id, '9',  'free'),
    (v_rest_id, '10', 'free'),
    (v_rest_id, 'B1', 'free'),
    (v_rest_id, 'B2', 'free')
  ON CONFLICT (restaurant_id, number) DO NOTHING;

  -- ── 3. CATEGORIAS ─────────────────────────────────────
  INSERT INTO menu_categories (id, restaurant_id, name, display_order) VALUES
    ('c1000001-0000-0000-0000-000000000001', v_rest_id, 'Entradas',          0),
    ('c1000001-0000-0000-0000-000000000002', v_rest_id, 'Pratos Principais', 1),
    ('c1000001-0000-0000-0000-000000000003', v_rest_id, 'Frutos do Mar',     2),
    ('c1000001-0000-0000-0000-000000000004', v_rest_id, 'Bebidas',           3),
    ('c1000001-0000-0000-0000-000000000005', v_rest_id, 'Sobremesas',        4)
  ON CONFLICT DO NOTHING;

  -- ── 4. ITENS DO CARDÁPIO ───────────────────────────────

  -- Entradas
  INSERT INTO menu_items (restaurant_id, category_id, name, description, price, available, contains_alcohol) VALUES
    (v_rest_id, 'c1000001-0000-0000-0000-000000000001',
     'Pão de Alho Artesanal',
     'Pão rústico com manteiga de ervas, alho tostado e azeite virgem extra.',
     28.90, true, false),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000001',
     'Burrata com Tomates',
     'Burrata cremosa italiana, tomates confitados, pesto de manjericão e flor de sal.',
     52.00, true, false),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000001',
     'Croquete de Bacalhau',
     'Croquetes crocantes recheados com bacalhau desfiado e cream cheese. (6 unidades)',
     38.00, true, false),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000001',
     'Tábua de Frios Portuguesa',
     'Presunto de Parma, queijo Serra da Estrela, linguiça defumada, azeitonas e pão artesanal.',
     68.00, true, false);

  -- Pratos Principais
  INSERT INTO menu_items (restaurant_id, category_id, name, description, price, available, contains_alcohol) VALUES
    (v_rest_id, 'c1000001-0000-0000-0000-000000000002',
     'Picanha na Brasa',
     '400g de picanha angus grelhada, arroz biro-biro, farofa crocante e vinagrete.',
     98.00, true, false),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000002',
     'Frango ao Vinho do Porto',
     'Coxa e sobrecoxa marinadas em vinho do Porto, batatas rústicas e alho confitado.',
     72.00, true, false),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000002',
     'Risoto de Funghi',
     'Risoto cremoso com mix de funghi, parmesão envelhecido e trufa negra. (Vegetariano)',
     64.00, true, false),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000002',
     'Costela na Churrasqueira',
     '500g de costela bovina assada lentamente, mandioca frita e molho chimichurri.',
     89.00, true, false),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000002',
     'Bacalhau à Brás',
     'Bacalhau desfiado, ovos mexidos, batata palha, azeitonas e salsa. Clássico português.',
     82.00, true, false);

  -- Frutos do Mar
  INSERT INTO menu_items (restaurant_id, category_id, name, description, price, available, contains_alcohol) VALUES
    (v_rest_id, 'c1000001-0000-0000-0000-000000000003',
     'Camarão ao Alho e Óleo',
     '300g de camarão rosa salteado com azeite, alho, limão siciliano e pimenta calabresa.',
     78.00, true, false),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000003',
     'Polvo Grelhado',
     'Tentáculos de polvo grelhados com azeite de ervas, batata cozida e paprika defumada.',
     94.00, true, false),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000003',
     'Moqueca de Peixe',
     'Filé de robalo em moqueca capixaba com leite de coco, pimentões e dendê. Acompanha arroz e pirão.',
     86.00, true, false);

  -- Bebidas (sem álcool)
  INSERT INTO menu_items (restaurant_id, category_id, name, description, price, available, contains_alcohol) VALUES
    (v_rest_id, 'c1000001-0000-0000-0000-000000000004',
     'Água Mineral',
     'Sem gás ou com gás — 500ml.',
     8.00, true, false),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000004',
     'Refrigerante Lata',
     'Coca-Cola, Guaraná Antarctica ou Sprite — 350ml.',
     10.00, true, false),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000004',
     'Suco Natural',
     'Laranja, maracujá, abacaxi ou limão — 400ml.',
     16.00, true, false);

  -- Bebidas (com álcool)
  INSERT INTO menu_items (restaurant_id, category_id, name, description, price, available, contains_alcohol) VALUES
    (v_rest_id, 'c1000001-0000-0000-0000-000000000004',
     'Chope Artesanal',
     'Chope gelado IPA ou Pilsen — 300ml. Produção local.',
     18.00, true, true),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000004',
     'Caipirinha',
     'Cachaça artesanal, limão, açúcar e muito gelo. Clássica ou de frutas.',
     24.00, true, true),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000004',
     'Vinho da Casa',
     'Taça de vinho tinto ou branco da seleção do sommelier — 150ml.',
     28.00, true, true),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000004',
     'Cerveja Importada',
     'Heineken, Stella Artois ou Corona — long neck 355ml.',
     16.00, true, true);

  -- Sobremesas
  INSERT INTO menu_items (restaurant_id, category_id, name, description, price, available, contains_alcohol) VALUES
    (v_rest_id, 'c1000001-0000-0000-0000-000000000005',
     'Pudim de Leite Condensado',
     'Pudim caseiro com calda de caramelo e creme de leite. Receita da avó.',
     22.00, true, false),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000005',
     'Petit Gâteau',
     'Bolinho de chocolate belga com recheio quente e gelato de baunilha bourbon.',
     34.00, true, false),

    (v_rest_id, 'c1000001-0000-0000-0000-000000000005',
     'Pastel de Nata',
     'Dois pastéis de nata portugueses quentinhos com canela e açúcar de confeiteiro.',
     18.00, true, false);

  -- ── 5. FIDELIDADE ─────────────────────────────────────
  INSERT INTO loyalty_rules (restaurant_id, visit_count, benefit_type, benefit_value, active) VALUES
    (v_rest_id,  3, 'free_drink',   'Água ou refrigerante grátis',                  true),
    (v_rest_id,  5, 'free_item',    'Entrada de até R$30 grátis',                   true),
    (v_rest_id, 10, 'discount_pct', '10% de desconto em toda a conta',              true),
    (v_rest_id, 20, 'free_drink',   'Garrafa de vinho da casa por conta da casa',   true);

  RAISE NOTICE '✓ Tasca do Porto criada com sucesso!';
  RAISE NOTICE '  Owner: %', v_owner_id;
  RAISE NOTICE '  URL de teste: http://localhost:3000/tasca-do-porto?mesa=1';

END;
$$;
