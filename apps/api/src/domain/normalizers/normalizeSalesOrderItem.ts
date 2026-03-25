import { SalesOrderItem } from './types.ts';

/**
 * Normalize raw sales order item into domain object
 */
export function normalizeSalesOrderItem(raw: any): SalesOrderItem {
  return {
    id: `${String(raw.salesOrder || '')}_${String(raw.salesOrderItem || '')}`,
    orderId: String(raw.salesOrder || ''),
    productId: String(raw.material || '') || null,
    quantity: raw.requestedQuantity
      ? parseFloat(String(raw.requestedQuantity))
      : null,
  };
}
