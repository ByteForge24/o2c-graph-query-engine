/**
 * Normalization Layer
 * Exports canonical domain types and normalizer functions
 */

// Types
export type {
  SalesOrder,
  SalesOrderItem,
  DeliveryHeader,
  DeliveryItem,
  BillingDocument,
  BillingDocumentItem,
  JournalEntry,
  Payment,
} from './types';

// Normalizers
export {
  normalizeSalesOrder,
  normalizeSalesOrderItem,
  normalizeDeliveryHeader,
  normalizeDeliveryItem,
  normalizeBillingDocument,
  normalizeBillingDocumentItem,
  normalizeJournalEntry,
  normalizePayment,
} from './normalizers';
