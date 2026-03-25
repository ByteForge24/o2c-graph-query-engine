import { JournalEntry } from './types.ts';

/**
 * Normalize raw journal entry into domain object
 */
export function normalizeJournalEntry(raw: any): JournalEntry {
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
