/**
 * Canonical Domain Types
 * Normalized versions of SAP records - stable contracts for business logic
 */

export type SalesOrder = {
  id: string;
  customerId: string | null;
  createdAt: Date | null;
};

export type SalesOrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  quantity: number | null;
};

export type DeliveryHeader = {
  id: string;
  createdAt: Date | null;
};

export type DeliveryItem = {
  id: string;
  deliveryId: string;
  orderId: string | null;
  quantity: number | null;
};

export type BillingDocument = {
  id: string;
  accountingDocument: string | null;
  amount: number | null;
};

export type BillingDocumentItem = {
  id: string;
  billingDocumentId: string;
  deliveryDocumentId: string | null;
  quantity: number | null;
};

export type JournalEntry = {
  id: string;
  accountingDocument: string;
  amount: number | null;
};

export type Payment = {
  id: string;
  accountingDocument: string;
  amount: number | null;
};
