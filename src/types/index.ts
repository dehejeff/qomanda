export type RestaurantStatus = 'active' | 'inactive'

export interface Customer {
  id: string
  first_name: string
  last_name: string
  whatsapp: string
  document_type: 'cpf' | 'passport' | null
  cpf: string | null
  passport: string | null
  created_at: string
}

export type LoyaltyBenefitType = 'free_drink' | 'free_item' | 'discount_pct' | 'custom'

export interface LoyaltyRule {
  id: string
  restaurant_id: string
  visit_count: number
  benefit_type: LoyaltyBenefitType
  benefit_value: string
  active: boolean
  created_at: string
}

export interface SessionParticipant {
  id: string
  session_id: string
  customer_id: string
  joined_at: string
  customer?: Customer
}

export interface CustomerVisit {
  id: string
  customer_id: string
  restaurant_id: string
  session_id: string
  created_at: string
}
export type TableStatus = 'free' | 'occupied' | 'reserved'
export type SessionStatus = 'open' | 'closing' | 'closed'
export type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
export type PaymentMethod = 'credit' | 'debit' | 'pix'
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded'

export interface Restaurant {
  id: string
  name: string
  slug: string
  logo_url: string | null
  address: string | null
  phone: string | null
  status: RestaurantStatus
  created_at: string
}

export interface RestaurantTable {
  id: string
  restaurant_id: string
  number: string
  qr_code_url: string | null
  status: TableStatus
  created_at: string
}

export interface Session {
  id: string
  table_id: string
  restaurant_id: string
  status: SessionStatus
  started_at: string
  closed_at: string | null
  restaurant?: Restaurant
  table?: RestaurantTable
}

export interface MenuCategory {
  id: string
  restaurant_id: string
  name: string
  display_order: number
  items?: MenuItem[]
}

export interface MenuItem {
  id: string
  restaurant_id: string
  category_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  available: boolean
  category?: MenuCategory
}

export interface Order {
  id: string
  session_id: string
  restaurant_id: string
  customer_id: string | null
  status: OrderStatus
  notes: string | null
  created_at: string
  updated_at: string
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  menu_item_id: string
  quantity: number
  unit_price: number
  notes: string | null
  menu_item?: MenuItem
}

export interface Payment {
  id: string
  session_id: string
  restaurant_id: string
  stripe_payment_intent_id: string | null
  amount: number
  method: PaymentMethod
  status: PaymentStatus
  confirmation_code: string | null
  created_at: string
  paid_at: string | null
}

export interface CartItem {
  menu_item: MenuItem
  quantity: number
  notes?: string
}
