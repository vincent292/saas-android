export type Restaurant = {
  id: string;
  name: string;
  slug: string;
  role: "superadmin" | "restaurant_admin" | "cashier" | "waiter";
  canManage: boolean;
};
export type Profile = { id: string; email?: string | null; full_name: string };
export type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category_id: string;
};
export type Table = {
  id: string;
  name: string;
  code: string;
  status: string;
  capacity: number;
};
export type Variant = {
  id: string;
  product_id: string;
  name: string;
  price_delta: number;
};
export type Option = Variant & { option_group_id: string };
export type Group = {
  id: string;
  product_id: string;
  name: string;
  min_choices: number;
  max_choices: number;
  is_required: boolean;
};
export type Payment = "cash" | "qr" | "bank_transfer" | "card" | "other";
export type Order = {
  id: string;
  table_id: string | null;
  order_number: string;
  order_type: string;
  status:
    | "pending"
    | "accepted"
    | "preparing"
    | "ready"
    | "delivered"
    | "cancelled";
  payment_status: string;
  payment_method: Payment;
  payment_receipt_url: string | null;
  payment_receipt_reference: string | null;
  customer_name: string;
  total: number;
  notes: string;
  created_at: string;
  eta_adjustment_minutes: number;
  order_items: {
    id: string;
    product_name: string;
    quantity: number;
    subtotal: number;
    prep_minutes: number;
    notes: string;
  }[];
};
export type Rider = {
  id: string;
  full_name: string;
  phone: string;
  plate_number: string;
  status: string;
  membership_valid_until: string;
};
export type DeliveryAssignment = {
  order_id: string;
  restaurant_rider_id: string | null;
  delivery_name: string | null;
  delivery_phone: string | null;
  status: string;
  pickup_confirmation_code: string | null;
  pickup_code_verified_at: string | null;
  assigned_at: string | null;
};
export type CashSession = {
  id: string;
  opening_amount: number;
  opened_at: string;
};
export type Movement = {
  id: string;
  type: string;
  payment_method: string;
  amount: number;
  description: string;
  created_at: string;
};
export type Snapshot = {
  restaurant: Restaurant;
  orders: Order[];
  tables: Table[];
  settings: {
    currency: string;
    qr_payment_url: string | null;
    table_orders_enabled: boolean;
  };
  cashOpen: boolean;
  cashSession: CashSession | null;
  movements: Movement[];
  waiterShift: { active: boolean; openedAt: string | null } | null;
  products: Product[];
  categories: { id: string; name: string }[];
  variants: Variant[];
  groups: Group[];
  options: Option[];
  riders?: Rider[];
  deliveryAssignments?: DeliveryAssignment[];
};
export type CartLine = {
  key: string;
  productId: string;
  variantId?: string;
  optionIds: string[];
  name: string;
  price: number;
  quantity: number;
  notes: string;
};
export type Receipt = {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number;
};
