import type { Restaurant, RestaurantTable, MenuCategory, Order } from '@/types'

export const DEV_BYPASS = process.env.NEXT_PUBLIC_DEV_BYPASS === 'true'

export const mockRestaurant: Restaurant = {
  id: 'mock-restaurant-id',
  name: 'Restaurante Demo',
  slug: 'demo',
  logo_url: null,
  address: 'Rua das Flores, 123',
  phone: '(11) 99999-9999',
  status: 'active',
  created_at: new Date().toISOString(),
}

export const mockTables: RestaurantTable[] = [
  { id: 'table-1', restaurant_id: 'mock-restaurant-id', number: '1', qr_code_url: null, status: 'occupied', created_at: new Date().toISOString() },
  { id: 'table-2', restaurant_id: 'mock-restaurant-id', number: '2', qr_code_url: null, status: 'free', created_at: new Date().toISOString() },
  { id: 'table-3', restaurant_id: 'mock-restaurant-id', number: '3', qr_code_url: null, status: 'free', created_at: new Date().toISOString() },
  { id: 'table-4', restaurant_id: 'mock-restaurant-id', number: '4', qr_code_url: null, status: 'occupied', created_at: new Date().toISOString() },
  { id: 'table-5', restaurant_id: 'mock-restaurant-id', number: '5', qr_code_url: null, status: 'reserved', created_at: new Date().toISOString() },
  { id: 'table-6', restaurant_id: 'mock-restaurant-id', number: '6', qr_code_url: null, status: 'free', created_at: new Date().toISOString() },
]

export const mockCategories: MenuCategory[] = [
  {
    id: 'cat-1',
    restaurant_id: 'mock-restaurant-id',
    name: 'Entradas',
    display_order: 0,
    items: [
      { id: 'item-1', restaurant_id: 'mock-restaurant-id', category_id: 'cat-1', name: 'Pão de Alho', description: 'Pão artesanal com manteiga e alho tostado', price: 18.90, image_url: null, available: true },
      { id: 'item-2', restaurant_id: 'mock-restaurant-id', category_id: 'cat-1', name: 'Caldo de Feijão', description: 'Caldo cremoso com bacon e linguiça', price: 22.00, image_url: null, available: true },
    ],
  },
  {
    id: 'cat-2',
    restaurant_id: 'mock-restaurant-id',
    name: 'Pratos Principais',
    display_order: 1,
    items: [
      { id: 'item-3', restaurant_id: 'mock-restaurant-id', category_id: 'cat-2', name: 'Frango Grelhado', description: 'Filé de frango grelhado com legumes', price: 42.90, image_url: null, available: true },
      { id: 'item-4', restaurant_id: 'mock-restaurant-id', category_id: 'cat-2', name: 'Picanha na Brasa', description: '300g de picanha com arroz e farofa', price: 89.90, image_url: null, available: false },
    ],
  },
  {
    id: 'cat-3',
    restaurant_id: 'mock-restaurant-id',
    name: 'Bebidas',
    display_order: 2,
    items: [
      { id: 'item-5', restaurant_id: 'mock-restaurant-id', category_id: 'cat-3', name: 'Refrigerante Lata', description: 'Coca-Cola, Guaraná ou Sprite', price: 8.00, image_url: null, available: true },
      { id: 'item-6', restaurant_id: 'mock-restaurant-id', category_id: 'cat-3', name: 'Suco Natural', description: 'Laranja, Limão ou Maracujá', price: 14.00, image_url: null, available: true },
    ],
  },
]

export const mockOrders: Order[] = [
  {
    id: 'order-aabbcc',
    session_id: 'session-1',
    restaurant_id: 'mock-restaurant-id',
    customer_id: 'mock-customer-id',
    status: 'pending',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      { id: 'oi-1', order_id: 'order-aabbcc', menu_item_id: 'item-1', quantity: 2, unit_price: 18.90, notes: null, menu_item: { id: 'item-1', restaurant_id: 'mock-restaurant-id', category_id: 'cat-1', name: 'Pão de Alho', description: null, price: 18.90, image_url: null, available: true } },
      { id: 'oi-2', order_id: 'order-aabbcc', menu_item_id: 'item-5', quantity: 3, unit_price: 8.00, notes: null, menu_item: { id: 'item-5', restaurant_id: 'mock-restaurant-id', category_id: 'cat-3', name: 'Refrigerante Lata', description: null, price: 8.00, image_url: null, available: true } },
    ],
  },
  {
    id: 'order-ddeeff',
    session_id: 'session-2',
    restaurant_id: 'mock-restaurant-id',
    customer_id: 'mock-customer-id',
    status: 'preparing',
    notes: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    items: [
      { id: 'oi-3', order_id: 'order-ddeeff', menu_item_id: 'item-3', quantity: 1, unit_price: 42.90, notes: null, menu_item: { id: 'item-3', restaurant_id: 'mock-restaurant-id', category_id: 'cat-2', name: 'Frango Grelhado', description: null, price: 42.90, image_url: null, available: true } },
    ],
  },
]
