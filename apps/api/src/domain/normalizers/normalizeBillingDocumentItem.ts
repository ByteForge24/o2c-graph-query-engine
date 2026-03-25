import { BillingDocumentItem } from './types.ts';

/**
 * Normalize raw billing document item into domain object
 */
export function normalizeBillingDocumentItem(raw: any): BillingDocumentItem {
  return {
    id: `${String(raw.billingDocument || '')}_${String(
      raw.billingDocumentItem || ''
    )}`,
    billingDocumentId: String(raw.billingDocument || ''),
    deliveryDocumentId: String(raw.referenceSdDocument || '') || null,
    quantity: raw.billedQuantity
      ? parseFloat(String(raw.billedQuantity))
      : null,
  };
}
