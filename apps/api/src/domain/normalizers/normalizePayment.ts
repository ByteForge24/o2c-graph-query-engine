import { Payment } from './types.ts';

/**
 * Normalize raw payment record into domain object
 */
export function normalizePayment(raw: any): Payment {
  return {
    id: `${String(raw.accountingDocument || '')}_${String(
      raw.accountingDocumentItem || ''
    )}`,
    accountingDocument: String(raw.accountingDocument || ''),
    amount: raw.amountInCompanyCodeCurrency
      ? parseFloat(String(raw.amountInCompanyCodeCurrency))
      : null,
  };
}
