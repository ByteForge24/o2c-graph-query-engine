import { BillingDocument } from './types.ts';

/**
 * Normalize raw billing document header into domain object
 */
export function normalizeBillingDocument(raw: any): BillingDocument {
  return {
    id: String(raw.billingDocument || ''),
    accountingDocument: String(raw.accountingDocument || '') || null,
    amount: raw.totalNetAmount
      ? parseFloat(String(raw.totalNetAmount))
      : null,
  };
}
