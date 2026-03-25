/**
 * DB-Backed Graph Builder
 * Constructs O2C flow graph dynamically from Prisma database
 *
 * Loads limited dataset and builds nodes/edges for visualization
 */

import { PrismaClient } from '@prisma/client';
import {
  GRAPH_NODE_TYPES,
  GRAPH_EDGE_TYPES,
  GraphNodeType,
  GraphEdgeType,
  GraphNode,
  GraphEdge,
  Graph,
  GRAPH_RELATIONSHIPS,
} from 'graph';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function createNode(type: GraphNodeType, id: string, data: Record<string, unknown>): GraphNode {
  return {
    id: `${type}:${id}`,
    type,
    label: `${type} ${id}`,
    data,
  };
}

function createEdge(
  sourceType: GraphNodeType,
  sourceId: string,
  targetType: GraphNodeType,
  targetId: string,
  edgeType: GraphEdgeType,
  edgeLabel: string
): GraphEdge {
  return {
    source: `${sourceType}:${sourceId}`,
    target: `${targetType}:${targetId}`,
    type: edgeType,
    label: edgeLabel,
  };
}

// ============================================================================
// MAIN GRAPH BUILDER
// ============================================================================

export async function buildGraphFromDb(prisma: PrismaClient): Promise<Graph> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<string, GraphNode>();
  const nodesByType = new Map<string, Map<string, any>>();

  console.log('[GRAPH] Loading data from database...');

  try {
    // 1. Load SalesOrders (limit 50)
    const salesOrders = await prisma.salesOrder.findMany({
      take: 50,
    });
    console.log(`  [OK] SalesOrder: ${salesOrders.length} records`);

    // 2. Load SalesOrderItems
    const orderIds = new Set(salesOrders.map((o: any) => o.id));
    const salesOrderItems = await prisma.salesOrderItem.findMany({
      where: {
        orderId: { in: Array.from(orderIds) },
      },
    });
    console.log(`  [OK] SalesOrderItem: ${salesOrderItems.length} records`);

    // 3. Load DeliveryItems
    const deliveryItems = await prisma.deliveryItem.findMany({
      where: {
        orderId: { in: Array.from(orderIds) },
      },
    });
    console.log(`  [OK] DeliveryItem: ${deliveryItems.length} records`);

    // 4. Load BillingItems
    const deliveryIdSet = new Set(deliveryItems.map((d: any) => d.deliveryId));
    const billingItems = await prisma.billingItem.findMany({
      where: {
        deliveryId: { in: Array.from(deliveryIdSet) },
      },
    });
    console.log(`  [OK] BillingItem: ${billingItems.length} records`);

    // 5. Load BillingDocuments
    const billingIdSet = new Set(billingItems.map((b: any) => b.billingId));
    const billingDocuments = await prisma.billingDocument.findMany({
      where: {
        id: { in: Array.from(billingIdSet) },
      },
    });
    console.log(`  [OK] BillingDocument: ${billingDocuments.length} records`);

    // 6. Load JournalEntries
    const accountingDocSet = new Set(
      billingDocuments
        .map((b: any) => b.accountingDocument)
        .filter((x: any) => x) as string[]
    );
    const journalEntries = await prisma.journalEntry.findMany({
      where: {
        accountingDocument: { in: Array.from(accountingDocSet) },
      },
    });
    console.log(`  [OK] JournalEntry: ${journalEntries.length} records`);

    // 7. Load Payments
    const payments = await prisma.payment.findMany({
      where: {
        accountingDocument: { in: Array.from(accountingDocSet) },
      },
    });
    console.log(`  [OK] Payment: ${payments.length} records`);

    // ========================================================================
    // BUILD NODE MAP
    // ========================================================================

    console.log('[GRAPH] Building nodes...');

    // SalesOrders
    nodesByType.set(GRAPH_NODE_TYPES.SALES_ORDER, new Map());
    for (const order of salesOrders) {
      const node = createNode(GRAPH_NODE_TYPES.SALES_ORDER, order.id, {
        customerId: order.customerId,
        createdAt: order.createdAt,
      });
      nodes.push(node);
      nodeMap.set(node.id, node);
      nodesByType.get(GRAPH_NODE_TYPES.SALES_ORDER)!.set(order.id, order);
    }

    // SalesOrderItems
    nodesByType.set(GRAPH_NODE_TYPES.SALES_ORDER_ITEM, new Map());
    for (const item of salesOrderItems) {
      const node = createNode(GRAPH_NODE_TYPES.SALES_ORDER_ITEM, item.id, {
        orderId: item.orderId,
        productId: item.productId,
        quantity: item.quantity,
      });
      nodes.push(node);
      nodeMap.set(node.id, node);
      nodesByType.get(GRAPH_NODE_TYPES.SALES_ORDER_ITEM)!.set(item.id, item);
    }

    // DeliveryItems
    nodesByType.set(GRAPH_NODE_TYPES.DELIVERY_ITEM, new Map());
    for (const delivery of deliveryItems) {
      const node = createNode(GRAPH_NODE_TYPES.DELIVERY_ITEM, delivery.id, {
        deliveryId: delivery.deliveryId,
        orderId: delivery.orderId,
      });
      nodes.push(node);
      nodeMap.set(node.id, node);
      nodesByType.get(GRAPH_NODE_TYPES.DELIVERY_ITEM)!.set(delivery.id, delivery);
    }

    // BillingDocuments
    nodesByType.set(GRAPH_NODE_TYPES.BILLING_DOCUMENT, new Map());
    for (const billing of billingDocuments) {
      const node = createNode(GRAPH_NODE_TYPES.BILLING_DOCUMENT, billing.id, {
        accountingDocument: billing.accountingDocument,
      });
      nodes.push(node);
      nodeMap.set(node.id, node);
      nodesByType.get(GRAPH_NODE_TYPES.BILLING_DOCUMENT)!.set(billing.id, billing);
    }

    // BillingDocumentItems
    nodesByType.set(GRAPH_NODE_TYPES.BILLING_DOCUMENT_ITEM, new Map());
    for (const item of billingItems) {
      const node = createNode(GRAPH_NODE_TYPES.BILLING_DOCUMENT_ITEM, item.id, {
        billingId: item.billingId,
        deliveryId: item.deliveryId,
      });
      nodes.push(node);
      nodeMap.set(node.id, node);
      nodesByType.get(GRAPH_NODE_TYPES.BILLING_DOCUMENT_ITEM)!.set(item.id, item);
    }

    // JournalEntries
    nodesByType.set(GRAPH_NODE_TYPES.JOURNAL_ENTRY, new Map());
    for (const entry of journalEntries) {
      const node = createNode(GRAPH_NODE_TYPES.JOURNAL_ENTRY, entry.id, {
        accountingDocument: entry.accountingDocument,
      });
      nodes.push(node);
      nodeMap.set(node.id, node);
      nodesByType.get(GRAPH_NODE_TYPES.JOURNAL_ENTRY)!.set(entry.id, entry);
    }

    // Payments
    nodesByType.set(GRAPH_NODE_TYPES.PAYMENT, new Map());
    for (const payment of payments) {
      const node = createNode(GRAPH_NODE_TYPES.PAYMENT, payment.id, {
        accountingDocument: payment.accountingDocument,
        amount: payment.amount,
      });
      nodes.push(node);
      nodeMap.set(node.id, node);
      nodesByType.get(GRAPH_NODE_TYPES.PAYMENT)!.set(payment.id, payment);
    }

    console.log(`  [OK] ${nodes.length} nodes created`);

    // ========================================================================
    // BUILD EDGES (CONFIG-DRIVEN)
    // ========================================================================

    console.log('[GRAPH] Building edges...');

    for (const rule of GRAPH_RELATIONSHIPS) {
      const sourceNodes = nodesByType.get(rule.sourceType);
      const targetNodes = nodesByType.get(rule.targetType);

      if (!sourceNodes || !targetNodes) {
        continue;
      }

      let edgeCount = 0;

      // Match nodes based on key fields
      for (const [sourceId, sourceData] of sourceNodes) {
        const sourceKeyValue = sourceData[rule.sourceKeyField];
        if (!sourceKeyValue) continue;

        for (const [targetId, targetData] of targetNodes) {
          const targetKeyValue = targetData[rule.targetKeyField];
          if (!targetKeyValue) continue;

          // Match condition
          if (String(sourceKeyValue) === String(targetKeyValue)) {
            const edge = createEdge(
              rule.sourceType,
              sourceId,
              rule.targetType,
              targetId,
              rule.edgeType,
              rule.edgeLabel
            );
            edges.push(edge);
            edgeCount++;
          }
        }
      }

      if (edgeCount > 0) {
        console.log(`  [${rule.edgeType}] ${edgeCount} edges`);
      }
    }

    console.log(`  [OK] ${edges.length} edges created`);

    // ========================================================================
    // BUILD STATS
    // ========================================================================

    const nodeBreakdown: Record<string, number> = {};
    const edgeBreakdown: Record<string, number> = {};

    for (const node of nodes) {
      nodeBreakdown[node.type] = (nodeBreakdown[node.type] || 0) + 1;
    }

    for (const edge of edges) {
      edgeBreakdown[edge.type] = (edgeBreakdown[edge.type] || 0) + 1;
    }

    const stats = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodeBreakdown,
      edgeBreakdown,
    };

    console.log('[GRAPH] Build complete!');
    console.log(`  Nodes: ${stats.totalNodes}`);
    console.log(`  Edges: ${stats.totalEdges}`);

    return {
      nodes,
      edges,
      stats,
    };
  } catch (err) {
    console.error('[ERR] Graph building failed:', err);
    throw err;
  }
}
