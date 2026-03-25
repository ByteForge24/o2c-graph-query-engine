/**
 * All Normalizer Functions
 * Transform raw SAP records → clean domain objects
 */

import {
  SalesOrder,
  SalesOrderItem,
  DeliveryHeader,
  DeliveryItem,
  BillingDocument,
  BillingDocumentItem,
  JournalEntry,
  Payment,
} from './types';

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

/**
 * Normalize raw delivery header into domain object
 */
export function normalizeDeliveryHeader(raw: any): DeliveryHeader {
  return {
    id: String(raw.deliveryDocument || ''),
    createdAt: raw.creationDate ? new Date(raw.creationDate) : null,
  };
}

/**
 * Normalize raw delivery item into domain object
 */
export function normalizeDeliveryItem(raw: any): DeliveryItem {
  return {
    id: `${String(raw.deliveryDocument || '')}_${String(
      raw.deliveryDocumentItem || ''
    )}`,
    deliveryId: String(raw.deliveryDocument || ''),
    orderId: String(raw.referenceSdDocument || '') || null,
    quantity: raw.actualDeliveryQuantity
      ? parseFloat(String(raw.actualDeliveryQuantity))
      : null,
  };
}

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
