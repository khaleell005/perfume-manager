export interface Product {
  name: string; category: string; description: string; size: number; price: number; cost: number;
  tracked: boolean; quantity: number; threshold: number; available: boolean; archived: boolean;
  createdAt: number; updatedAt: number;
}
export interface SaleItem {
  productId?: string; name: string; qty: number; price: number; tracked?: boolean; note?: string; size?: number;
}
export type PayStatus = 'paid' | 'partial' | 'unpaid';
export interface Refund { id: string; requestId?: string; amount: number; reason: string; returnStock: boolean; status: 'pending' | 'paid' | 'cancelled'; createdAt: number; resolvedAt?: number; method?: string; reference?: string }
export interface Sale {
  invoiceNo: string; items: SaleItem[]; subtotal: number; discount: number; delivery: number; total: number;
  paid: number; method: string; status: PayStatus; customerId?: string; customerName?: string;
  customerPhone?: string; customerEmail?: string; customerAddress?: string; createdAt: number; cancelled?: boolean; refunded?: number; refunds?: Refund[];
}
export interface Customer { name: string; phone: string; email: string; address: string; notes: string }
export interface Expense { title: string; category: string; amount: number; date: string; description: string }
export interface Biz {
  name: string; phone: string; whatsapp: string; email: string; address: string; social: string;
  thanks: string; threshold: number; logo: string;
}
export const CATEGORIES = ['Perfume oils and ingredients', 'Alcohol and mixing supplies', 'Bottles and containers', 'Labels and packaging', 'Transportation and delivery', 'Marketing and advertising', 'Equipment and supplies', 'Miscellaneous'];
