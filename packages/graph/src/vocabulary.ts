/**
 * Canonical Graph Vocabulary (FROZEN)
 * Single source of truth for node types, edge types, and relationships.
 * Exported by index.ts for external use.
 */

/**
 * Canonical node types for O2C flow graph.
 * Source of truth: domain layer (apps/api/src/domain/normalizers/types.ts)
 */
export const GRAPH_NODE_TYPES = {
  SALES_ORDER: 'SalesOrder',
  SALES_ORDER_ITEM: 'SalesOrderItem',
  DELIVERY_ITEM: 'DeliveryItem',
  BILLING_DOCUMENT: 'BillingDocument',
  BILLING_DOCUMENT_ITEM: 'BillingDocumentItem',
  JOURNAL_ENTRY: 'JournalEntry',
  PAYMENT: 'Payment',
} as const;

export type GraphNodeType = (typeof GRAPH_NODE_TYPES)[keyof typeof GRAPH_NODE_TYPES];

/**
 * Canonical edge types for O2C flow graph.
 * Direction: Forward traversal from Order → Payment
 */
export const GRAPH_EDGE_TYPES = {
  ORDER_TO_ITEM: 'ORDER_TO_ITEM',
  ITEM_TO_DELIVERY: 'ITEM_TO_DELIVERY',
  DELIVERY_TO_BILLING_ITEM: 'DELIVERY_TO_BILLING_ITEM',
  BILLING_ITEM_TO_DOCUMENT: 'BILLING_ITEM_TO_DOCUMENT',
  BILLING_TO_JOURNAL: 'BILLING_TO_JOURNAL',
  BILLING_TO_PAYMENT: 'BILLING_TO_PAYMENT',
} as const;

export type GraphEdgeType = (typeof GRAPH_EDGE_TYPES)[keyof typeof GRAPH_EDGE_TYPES];
