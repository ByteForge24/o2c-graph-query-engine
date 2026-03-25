import { SalesOrder } from './types.ts';

/**
 * Normalize raw sales order header into domain object
 */
export function normalizeSalesOrder(raw: any): SalesOrder {
  return {
    id: String(raw.salesOrder || ''),
    customerId: String(raw.soldToParty || raw.customer || '') || null,
    createdAt: raw.creationDate ? new Date(raw.creationDate) : null,
  };
}
