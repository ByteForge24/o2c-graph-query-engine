/**
 * Graph Builder
 * Converts normalized domain objects → graph (nodes + edges)
 *
 * Pure in-memory graph construction with no database dependencies.
 *
 * Note: This module is designed for use in compiled TypeScript code.
 * For ts-node scripts, the buildGraph function is embedded directly
 * in the script file to avoid module resolution issues.
 */

import {
  Node,
  Edge,
  GRAPH_NODE_TYPES,
  GRAPH_RELATIONSHIPS,
  GraphNodeType,
  GraphData,
} from 'graph';
import {
  SalesOrder,
  SalesOrderItem,
  DeliveryItem,
  BillingDocument,
  BillingDocumentItem,
  JournalEntry,
  Payment,
} from '../domain/normalizers';

/**
 * Create a single node with type prefix in ID
 * Example: createNode(GRAPH_NODE_TYPES.SALES_ORDER, '740506', {...})
 * Results in: { id: 'SalesOrder:740506', type: 'SalesOrder', data: {...} }
 */
export function createNode(type: GraphNodeType, id: string, data: any): Node {
  return {
    id: `${type}:${id}`,
    type,
    data,
  };
}

/**
 * Build graph from normalized domain objects
 *
 * Takes normalized data arrays and constructs a graph with nodes and edges.
 * Uses in-memory maps for edge creation based on matching IDs.
 */
export function buildGraph(
  salesOrders: SalesOrder[],
  salesOrderItems: SalesOrderItem[],
  deliveryItems: DeliveryItem[],
  billingDocuments: BillingDocument[],
  billingDocumentItems: BillingDocumentItem[],
  journalEntries: JournalEntry[],
  payments: Payment[]
): GraphData {
  // Derive canonical relationship rules in forward O2C traversal order
  const [
    orderToItemRule,
    itemToDeliveryRule,
    deliveryToBillingItemRule,
    billingItemToDocumentRule,
    billingToJournalRule,
    billingToPaymentRule,
  ] = GRAPH_RELATIONSHIPS;

  const nodeMap = new Map<string, Node>();
  const edges: Edge[] = [];

  // Build all nodes
  // Sales orders
  for (const order of salesOrders) {
    const node = createNode(GRAPH_NODE_TYPES.SALES_ORDER, order.id, {
      customerId: order.customerId,
      createdAt: order.createdAt,
    });
    nodeMap.set(node.id, node);
  }

  // Sales order items
  for (const item of salesOrderItems) {
    const node = createNode(GRAPH_NODE_TYPES.SALES_ORDER_ITEM, item.id, {
      orderId: item.orderId,
      productId: item.productId,
      quantity: item.quantity,
    });
    nodeMap.set(node.id, node);
  }

  // Delivery items
  for (const item of deliveryItems) {
    const node = createNode(GRAPH_NODE_TYPES.DELIVERY_ITEM, item.id, {
      deliveryId: item.deliveryId,
      orderId: item.orderId,
      quantity: item.quantity,
    });
    nodeMap.set(node.id, node);
  }

  // Billing documents
  for (const doc of billingDocuments) {
    const node = createNode(GRAPH_NODE_TYPES.BILLING_DOCUMENT, doc.id, {
      accountingDocument: doc.accountingDocument,
      amount: doc.amount,
    });
    nodeMap.set(node.id, node);
  }

  // Billing items
  for (const item of billingDocumentItems) {
    const node = createNode(GRAPH_NODE_TYPES.BILLING_DOCUMENT_ITEM, item.id, {
      billingDocumentId: item.billingDocumentId,
      deliveryDocumentId: item.deliveryDocumentId,
      quantity: item.quantity,
    });
    nodeMap.set(node.id, node);
  }

  // Journal entries
  for (const entry of journalEntries) {
    const node = createNode(GRAPH_NODE_TYPES.JOURNAL_ENTRY, entry.id, {
      accountingDocument: entry.accountingDocument,
      amount: entry.amount,
    });
    nodeMap.set(node.id, node);
  }

  // Payments
  for (const payment of payments) {
    const node = createNode(GRAPH_NODE_TYPES.PAYMENT, payment.id, {
      accountingDocument: payment.accountingDocument,
      amount: payment.amount,
    });
    nodeMap.set(node.id, node);
  }

  // Build edges using normalized data relationships
  // Edge 1: Orders to Items
  const orderMap = new Map<string, SalesOrder>();
  for (const order of salesOrders) {
    orderMap.set(order.id, order);
  }
  for (const item of salesOrderItems) {
    if (orderMap.has(item.orderId)) {
      edges.push({
        source: `${GRAPH_NODE_TYPES.SALES_ORDER}:${item.orderId}`,
        target: `${GRAPH_NODE_TYPES.SALES_ORDER_ITEM}:${item.id}`,
        type: orderToItemRule.edgeType,
      });
    }
  }

  // Edge 2: Order Items to Delivery Items
  const itemByOrderId = new Map<string, SalesOrderItem[]>();
  for (const item of salesOrderItems) {
    if (!itemByOrderId.has(item.orderId)) {
      itemByOrderId.set(item.orderId, []);
    }
    itemByOrderId.get(item.orderId)!.push(item);
  }
  for (const delItem of deliveryItems) {
    const orderItems = itemByOrderId.get(delItem.orderId || '');
    if (orderItems) {
      for (const orderItem of orderItems) {
        edges.push({
          source: `${GRAPH_NODE_TYPES.SALES_ORDER_ITEM}:${orderItem.id}`,
          target: `${GRAPH_NODE_TYPES.DELIVERY_ITEM}:${delItem.id}`,
          type: itemToDeliveryRule.edgeType,
        });
      }
    }
  }

  // Edge 3: Delivery Items to Billing Items
  const delItemByDeliveryId = new Map<string, DeliveryItem[]>();
  for (const item of deliveryItems) {
    if (!delItemByDeliveryId.has(item.deliveryId)) {
      delItemByDeliveryId.set(item.deliveryId, []);
    }
    delItemByDeliveryId.get(item.deliveryId)!.push(item);
  }
  for (const billItem of billingDocumentItems) {
    const delItems = delItemByDeliveryId.get(billItem.deliveryDocumentId || '');
    if (delItems) {
      for (const delItem of delItems) {
        edges.push({
          source: `${GRAPH_NODE_TYPES.DELIVERY_ITEM}:${delItem.id}`,
          target: `${GRAPH_NODE_TYPES.BILLING_DOCUMENT_ITEM}:${billItem.id}`,
          type: deliveryToBillingItemRule.edgeType,
        });
      }
    }
  }

  // Edge 4: Billing Items to Billing Docs
  const billByDocId = new Map<string, BillingDocument>();
  for (const doc of billingDocuments) {
    billByDocId.set(doc.id, doc);
  }
  for (const item of billingDocumentItems) {
    if (billByDocId.has(item.billingDocumentId)) {
      edges.push({
        source: `${GRAPH_NODE_TYPES.BILLING_DOCUMENT_ITEM}:${item.id}`,
        target: `${GRAPH_NODE_TYPES.BILLING_DOCUMENT}:${item.billingDocumentId}`,
        type: billingItemToDocumentRule.edgeType,
      });
    }
  }

  // Edge 5: Billing to Journal Entries
  const journalByAcctDoc = new Map<string, JournalEntry[]>();
  for (const entry of journalEntries) {
    if (!journalByAcctDoc.has(entry.accountingDocument)) {
      journalByAcctDoc.set(entry.accountingDocument, []);
    }
    journalByAcctDoc.get(entry.accountingDocument)!.push(entry);
  }
  for (const doc of billingDocuments) {
    if (doc.accountingDocument) {
      const entries = journalByAcctDoc.get(doc.accountingDocument) || [];
      for (const entry of entries) {
        edges.push({
          source: `${GRAPH_NODE_TYPES.BILLING_DOCUMENT}:${doc.id}`,
          target: `${GRAPH_NODE_TYPES.JOURNAL_ENTRY}:${entry.id}`,
          type: billingToJournalRule.edgeType,
        });
      }
    }
  }

  // Edge 6: Billing to Payments
  const paymentByAcctDoc = new Map<string, Payment>();
  for (const payment of payments) {
    paymentByAcctDoc.set(payment.accountingDocument, payment);
  }
  for (const doc of billingDocuments) {
    if (doc.accountingDocument) {
      const payment = paymentByAcctDoc.get(doc.accountingDocument);
      if (payment) {
        edges.push({
          source: `${GRAPH_NODE_TYPES.BILLING_DOCUMENT}:${doc.id}`,
          target: `${GRAPH_NODE_TYPES.PAYMENT}:${payment.id}`,
          type: billingToPaymentRule.edgeType,
        });
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}
