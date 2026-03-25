#!/usr/bin/env ts-node

/**
 * SAP O2C Flow Validation Script
 * Traces real Order -> Delivery -> Billing -> Payment flows from dataset
 *
 * Run with: pnpm validate:flows
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// ============================================================================
// NORMALIZED DOMAIN TYPES
// ============================================================================

type SalesOrder = {
  id: string;
  customerId: string | null;
  createdAt: Date | null;
};

type SalesOrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  quantity: number | null;
};

type DeliveryItem = {
  id: string;
  deliveryId: string;
  orderId: string | null;
  quantity: number | null;
};

type BillingDocument = {
  id: string;
  accountingDocument: string | null;
  amount: number | null;
};

type BillingDocumentItem = {
  id: string;
  billingDocumentId: string;
  deliveryDocumentId: string | null;
  quantity: number | null;
};

type JournalEntry = {
  id: string;
  accountingDocument: string;
  amount: number | null;
};

type Payment = {
  id: string;
  accountingDocument: string;
  amount: number | null;
};

// ============================================================================
// RELATIONSHIP DEFINITIONS
// ============================================================================

type Relationship = {
  fromEntity: string;
  toEntity: string;
  fromField: string;
  toField: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-one';
  description: string;
};

const RELATIONSHIPS: Relationship[] = [
  {
    fromEntity: 'billing_document_items',
    toEntity: 'outbound_delivery_items',
    fromField: 'referenceSdDocument',
    toField: 'deliveryDocument',
    type: 'many-to-one',
    description: 'Billing item references delivery document',
  },
  {
    fromEntity: 'outbound_delivery_items',
    toEntity: 'sales_order_items',
    fromField: 'referenceSdDocument',
    toField: 'salesOrder',
    type: 'many-to-one',
    description: 'Delivery item references sales order',
  },
  {
    fromEntity: 'billing_document_headers',
    toEntity: 'journal_entry_items_accounts_receivable',
    fromField: 'accountingDocument',
    toField: 'accountingDocument',
    type: 'one-to-many',
    description: 'Billing linked to journal entries via accounting document',
  },
  {
    fromEntity: 'billing_document_headers',
    toEntity: 'payments_accounts_receivable',
    fromField: 'accountingDocument',
    toField: 'accountingDocument',
    type: 'one-to-many',
    description: 'Billing linked to payments via accounting document',
  },
];

function findRelationship(fromEntity: string, toEntity: string): Relationship | undefined {
  return RELATIONSHIPS.find(
    (rel) =>
      rel.fromEntity.toLowerCase() === fromEntity.toLowerCase() &&
      rel.toEntity.toLowerCase() === toEntity.toLowerCase()
  );
}

function getRelationshipFields(
  fromEntity: string,
  toEntity: string
): { fromField: string; toField: string } | null {
  const rel = findRelationship(fromEntity, toEntity);
  if (!rel) return null;
  return { fromField: rel.fromField, toField: rel.toField };
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface Record {
  [key: string]: any;
}

interface FlowContext {
  orderHeaders: Record[];
  orderItems: Record[];
  deliveryHeaders: Record[];
  deliveryItems: Record[];
  billingHeaders: Record[];
  billingItems: Record[];
  journalEntries: Record[];
  payments: Record[];
}

interface FlowTrace {
  billingDocId: string;
  billingItems: Record[];
  delivery?: {
    header: Record;
    items: Record[];
  };
  order?: {
    header: Record;
    items: Record[];
  };
  accounting?: {
    journalEntries: Record[];
  };
  payment?: Record;
  issues: string[];
  joinKeys: string[];
}

// ============================================================================
// GRAPH TYPES & BUILDER
// ============================================================================

type Node = {
  id: string;
  type: string;
  data: any;
};

type Edge = {
  source: string;
  target: string;
  type: string;
};

interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

/**
 * Create a single node with type prefix in ID
 */
function createNode(type: string, id: string, data: any): Node {
  return {
    id: `${type}:${id}`,
    type,
    data,
  };
}

/**
 * Build graph from normalized domain objects
 */
function buildGraph(
  salesOrders: SalesOrder[],
  salesOrderItems: SalesOrderItem[],
  deliveryItems: DeliveryItem[],
  billingDocuments: BillingDocument[],
  billingDocumentItems: BillingDocumentItem[],
  journalEntries: JournalEntry[],
  payments: Payment[]
): GraphData {
  const nodeMap = new Map<string, Node>();
  const edges: Edge[] = [];

  // Build all nodes
  console.log('[BUILD] Building nodes...');

  // Sales orders
  for (const order of salesOrders) {
    const node = createNode('SalesOrder', order.id, {
      customerId: order.customerId,
      createdAt: order.createdAt,
    });
    nodeMap.set(node.id, node);
  }

  // Sales order items
  for (const item of salesOrderItems) {
    const node = createNode('SalesOrderItem', item.id, {
      orderId: item.orderId,
      productId: item.productId,
      quantity: item.quantity,
    });
    nodeMap.set(node.id, node);
  }

  // Delivery items
  for (const item of deliveryItems) {
    const node = createNode('DeliveryItem', item.id, {
      deliveryId: item.deliveryId,
      orderId: item.orderId,
      quantity: item.quantity,
    });
    nodeMap.set(node.id, node);
  }

  // Billing documents
  for (const doc of billingDocuments) {
    const node = createNode('BillingDocument', doc.id, {
      accountingDocument: doc.accountingDocument,
      amount: doc.amount,
    });
    nodeMap.set(node.id, node);
  }

  // Billing items
  for (const item of billingDocumentItems) {
    const node = createNode('BillingDocumentItem', item.id, {
      billingDocumentId: item.billingDocumentId,
      deliveryDocumentId: item.deliveryDocumentId,
      quantity: item.quantity,
    });
    nodeMap.set(node.id, node);
  }

  // Journal entries
  for (const entry of journalEntries) {
    const node = createNode('JournalEntry', entry.id, {
      accountingDocument: entry.accountingDocument,
      amount: entry.amount,
    });
    nodeMap.set(node.id, node);
  }

  // Payments
  for (const payment of payments) {
    const node = createNode('Payment', payment.id, {
      accountingDocument: payment.accountingDocument,
      amount: payment.amount,
    });
    nodeMap.set(node.id, node);
  }

  console.log(`  [OK] ${nodeMap.size} nodes created`);

  // Build edges using relationships
  console.log('[EDGE] Building edges...');

  const edgeTypeMap: { [key: string]: string } = {
    'SalesOrder:SalesOrderItem': 'ORDER_TO_ITEM',
    'SalesOrderItem:DeliveryItem': 'ITEM_TO_DELIVERY',
    'DeliveryItem:BillingDocumentItem': 'DELIVERY_TO_BILLING',
    'BillingDocument:JournalEntry': 'BILLING_TO_JOURNAL',
    'BillingDocument:Payment': 'BILLING_TO_PAYMENT',
  };

  // Edge 1: Orders to Items
  const orderMap = new Map<string, SalesOrder>();
  for (const order of salesOrders) {
    orderMap.set(order.id, order);
  }
  for (const item of salesOrderItems) {
    if (orderMap.has(item.orderId)) {
      edges.push({
        source: `SalesOrder:${item.orderId}`,
        target: `SalesOrderItem:${item.id}`,
        type: 'ORDER_TO_ITEM',
      });
    }
  }

  // Edge 2: Order Items to Delivery Items (via referenceSdDocument mappings)
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
          source: `SalesOrderItem:${orderItem.id}`,
          target: `DeliveryItem:${delItem.id}`,
          type: 'ITEM_TO_DELIVERY',
        });
      }
    }
  }

  // Edge 3: Billing Items to Delivery Items
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
          source: `BillingDocumentItem:${billItem.id}`,
          target: `DeliveryItem:${delItem.id}`,
          type: 'DELIVERY_TO_BILLING',
        });
      }
    }
  }

  // Edge 4: Billing Docs to Billing Items
  const billByDocId = new Map<string, BillingDocument>();
  for (const doc of billingDocuments) {
    billByDocId.set(doc.id, doc);
  }
  for (const item of billingDocumentItems) {
    if (billByDocId.has(item.billingDocumentId)) {
      edges.push({
        source: `BillingDocument:${item.billingDocumentId}`,
        target: `BillingDocumentItem:${item.id}`,
        type: 'BILLING_TO_ITEM',
      });
    }
  }

  // Edge 5: Billing to Accounting (Journal Entries)
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
          source: `BillingDocument:${doc.id}`,
          target: `JournalEntry:${entry.id}`,
          type: 'BILLING_TO_JOURNAL',
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
          source: `BillingDocument:${doc.id}`,
          target: `Payment:${payment.id}`,
          type: 'BILLING_TO_PAYMENT',
        });
      }
    }
  }

  console.log(`  [OK] ${edges.length} edges created`);

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

// ============================================================================
// GLOBALS
// ============================================================================

const DATA_DIR = './data/sap-o2c-data';
const RECORD_LIMIT = 5000;

const ENTITIES_TO_LOAD = [
  'sales_order_headers',
  'sales_order_items',
  'outbound_delivery_headers',
  'outbound_delivery_items',
  'billing_document_headers',
  'billing_document_items',
  'journal_entry_items_accounts_receivable',
  'payments_accounts_receivable',
];

// ============================================================================
// NORMALIZER FUNCTIONS
// ============================================================================

/**
 * Normalize raw sales order header into domain object
 */
function normalizeSalesOrder(raw: any) {
  return {
    id: String(raw.salesOrder || ''),
    customerId: String(raw.soldToParty || raw.customer || '') || null,
    createdAt: raw.creationDate ? new Date(raw.creationDate) : null,
  };
}

/**
 * Normalize raw sales order item into domain object
 */
function normalizeSalesOrderItem(raw: any) {
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
function normalizeDeliveryHeader(raw: any) {
  return {
    id: String(raw.deliveryDocument || ''),
    createdAt: raw.creationDate ? new Date(raw.creationDate) : null,
  };
}

/**
 * Normalize raw delivery item into domain object
 */
function normalizeDeliveryItem(raw: any) {
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
function normalizeBillingDocument(raw: any) {
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
function normalizeBillingDocumentItem(raw: any) {
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
function normalizeJournalEntry(raw: any) {
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
function normalizePayment(raw: any) {
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Recursively find all JSONL files for given entity names
 */
async function getJsonlFilesForEntities(
  entityNames: string[]
): Promise<Map<string, string[]>> {
  const entityMap = new Map<string, string[]>();

  for (const entityName of entityNames) {
    entityMap.set(entityName, []);
  }

  async function traverse(dirPath: string) {
    const entries = await fs.promises.readdir(dirPath, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Check if this directory matches one of our entities
        const matchedEntity = entityNames.find(
          (e) => entry.name === e
        );
        if (matchedEntity) {
          // Find all .jsonl files in this directory
          const subEntries = await fs.promises.readdir(fullPath, {
            withFileTypes: true,
          });
          for (const subEntry of subEntries) {
            if (subEntry.isFile() && subEntry.name.endsWith('.jsonl')) {
              const fullSubPath = path.join(fullPath, subEntry.name);
              entityMap.get(matchedEntity)!.push(fullSubPath);
            }
          }
        } else {
          // Recurse into subdirectories
          await traverse(fullPath);
        }
      }
    }
  }

  await traverse(DATA_DIR);
  return entityMap;
}

/**
 * Load records from JSONL file (limited to N records)
 */
async function loadRecords(
  filePath: string,
  limit: number = RECORD_LIMIT
): Promise<Record[]> {
  const records: Record[] = [];

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream });

    rl.on('line', (line: string) => {
      if (records.length >= limit) {
        rl.close();
        return;
      }

      if (!line.trim()) return;

      try {
        const record = JSON.parse(line);
        records.push(record);
      } catch {
        // Skip invalid lines
      }
    });

    rl.on('close', () => resolve(records));
    rl.on('error', reject);
  });
}

/**
 * Load records from JSONL file with filter function
 */
async function loadRecordsWithFilter(
  filePath: string,
  filterFn: (record: Record) => boolean,
  limit: number = Infinity
): Promise<Record[]> {
  const records: Record[] = [];

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream });

    rl.on('line', (line: string) => {
      if (records.length >= limit) {
        rl.close();
        return;
      }

      if (!line.trim()) return;

      try {
        const record = JSON.parse(line);
        if (filterFn(record)) {
          records.push(record);
        }
      } catch {
        // Skip invalid lines
      }
    });

    rl.on('close', () => resolve(records));
    rl.on('error', reject);
  });
}

/**
 * Find related records using relationship configuration
 * Maps from one entity to another using defined join fields
 */
function findRelatedRecords(
  sourceRecords: Record[],
  fromEntity: string,
  toEntity: string,
  targetRecords: Record[]
): Record[] {
  const fields = getRelationshipFields(fromEntity, toEntity);
  if (!fields) {
    console.warn(
      `[WARN] No relationship defined from ${fromEntity} to ${toEntity}`
    );
    return [];
  }

  const { fromField, toField } = fields;
  const sourceValues = new Set<string>();

  // Extract values to match
  for (const record of sourceRecords) {
    const key = Object.keys(record).find(
      (k) => k.toLowerCase() === fromField.toLowerCase()
    );
    if (key && record[key]) {
      sourceValues.add(String(record[key]));
    }
  }

  // Filter target records matching those values
  const results: Record[] = [];
  for (const record of targetRecords) {
    const key = Object.keys(record).find(
      (k) => k.toLowerCase() === toField.toLowerCase()
    );
    if (key && sourceValues.has(String(record[key]))) {
      results.push(record);
    }
  }

  return results;
}

/**
 * Detect join key by inspecting first record
 */
function detectJoinKey(records: Record[], keyPatterns: string[]): string | null {
  if (records.length === 0) return null;

  const firstRecord = records[0];
  for (const pattern of keyPatterns) {
    if (pattern in firstRecord) {
      return pattern;
    }
  }

  return null;
}

/**
 * Print fields in first record
 */
function printFields(entity: string, records: Record[]) {
  if (records.length === 0) {
    console.log(`  ${entity}: (no data)`);
    return;
  }

  const fields = Object.keys(records[0]);
  console.log(`  ${entity}: ${JSON.stringify(fields)}`);
}

/**
 * Display normalized samples from raw records
 */
function printNormalizedSamples(ctx: FlowContext) {
  console.log('\n[FLOW] Normalized Domain Objects (Sample):\n');

  // Sales Orders
  if (ctx.orderHeaders.length > 0) {
    console.log('Sales Orders (normalized from raw):');
    const sample = normalizeSalesOrder(ctx.orderHeaders[0]);
    console.log(`  Raw:        ${JSON.stringify(ctx.orderHeaders[0]).substring(0, 100)}...`);
    console.log(`  Normalized: ${JSON.stringify(sample)}`);
  }

  // Sales Order Items
  if (ctx.orderItems.length > 0) {
    console.log('\nSales Order Items (normalized from raw):');
    const sample = normalizeSalesOrderItem(ctx.orderItems[0]);
    console.log(`  Raw:        ${JSON.stringify(ctx.orderItems[0]).substring(0, 100)}...`);
    console.log(`  Normalized: ${JSON.stringify(sample)}`);
  }

  // Delivery Headers
  if (ctx.deliveryHeaders.length > 0) {
    console.log('\nDelivery Headers (normalized from raw):');
    const sample = normalizeDeliveryHeader(ctx.deliveryHeaders[0]);
    console.log(`  Raw:        ${JSON.stringify(ctx.deliveryHeaders[0]).substring(0, 100)}...`);
    console.log(`  Normalized: ${JSON.stringify(sample)}`);
  }

  // Delivery Items
  if (ctx.deliveryItems.length > 0) {
    console.log('\nDelivery Items (normalized from raw):');
    const sample = normalizeDeliveryItem(ctx.deliveryItems[0]);
    console.log(`  Raw:        ${JSON.stringify(ctx.deliveryItems[0]).substring(0, 100)}...`);
    console.log(`  Normalized: ${JSON.stringify(sample)}`);
  }

  // Billing Documents
  if (ctx.billingHeaders.length > 0) {
    console.log('\nBilling Documents (normalized from raw):');
    const sample = normalizeBillingDocument(ctx.billingHeaders[0]);
    console.log(`  Raw:        ${JSON.stringify(ctx.billingHeaders[0]).substring(0, 100)}...`);
    console.log(`  Normalized: ${JSON.stringify(sample)}`);
  }

  // Billing Items
  if (ctx.billingItems.length > 0) {
    console.log('\nBilling Document Items (normalized from raw):');
    const sample = normalizeBillingDocumentItem(ctx.billingItems[0]);
    console.log(`  Raw:        ${JSON.stringify(ctx.billingItems[0]).substring(0, 100)}...`);
    console.log(`  Normalized: ${JSON.stringify(sample)}`);
  }

  // Journal Entries
  if (ctx.journalEntries.length > 0) {
    console.log('\nJournal Entries (normalized from raw):');
    const sample = normalizeJournalEntry(ctx.journalEntries[0]);
    console.log(`  Raw:        ${JSON.stringify(ctx.journalEntries[0]).substring(0, 100)}...`);
    console.log(`  Normalized: ${JSON.stringify(sample)}`);
  }

  // Payments
  if (ctx.payments.length > 0) {
    console.log('\nPayments (normalized from raw):');
    const sample = normalizePayment(ctx.payments[0]);
    console.log(`  Raw:        ${JSON.stringify(ctx.payments[0]).substring(0, 100)}...`);
    console.log(`  Normalized: ${JSON.stringify(sample)}`);
  }

  console.log('');
}

/**
 * Build indexes for quick lookups
 */
function buildIndexes(ctx: FlowContext) {
  const indexes = {
    orderItemsByOrderId: new Map<string, Record[]>(),
    orderHeaderByOrderId: new Map<string, Record>(),
    deliveryItemsByDeliveryDoc: new Map<string, Record[]>(),
    deliveryHeaderByDeliveryDoc: new Map<string, Record>(),
    billingItemsByBillingDoc: new Map<string, Record[]>(),
    billingHeaderByBillingDoc: new Map<string, Record>(),
    journalByAccountingDoc: new Map<string, Record[]>(),
    paymentByAccountingDoc: new Map<string, Record>(),
    // New: For backward tracing - find delivery items matching referenceSdDocument
    deliveryItemsByReferenceSdDocument: new Map<string, Record[]>(),
  };

  // Index order items and headers
  for (const item of ctx.orderItems) {
    const orderKey = Object.keys(item).find(
      (k) => k.toLowerCase() === 'salesorder'
    );
    if (orderKey) {
      const orderId = item[orderKey];
      if (!indexes.orderItemsByOrderId.has(orderId)) {
        indexes.orderItemsByOrderId.set(orderId, []);
      }
      indexes.orderItemsByOrderId.get(orderId)!.push(item);
    }
  }

  for (const header of ctx.orderHeaders) {
    const orderKey = Object.keys(header).find(
      (k) => k.toLowerCase() === 'salesorder'
    );
    if (orderKey) {
      const orderId = header[orderKey];
      indexes.orderHeaderByOrderId.set(orderId, header);
    }
  }

  // Index delivery items and headers
  for (const item of ctx.deliveryItems) {
    const delKey = Object.keys(item).find(
      (k) => k.toLowerCase() === 'deliverydocument'
    );
    if (delKey) {
      const delDoc = item[delKey];
      if (!indexes.deliveryItemsByDeliveryDoc.has(delDoc)) {
        indexes.deliveryItemsByDeliveryDoc.set(delDoc, []);
      }
      indexes.deliveryItemsByDeliveryDoc.get(delDoc)!.push(item);
    }

    // NEW: Index by referenceSdDocument for backward tracing
    const refKey = Object.keys(item).find(
      (k) => k.toLowerCase() === 'referencesddocument'
    );
    if (refKey && item[refKey]) {
      const refDoc = item[refKey];
      if (!indexes.deliveryItemsByReferenceSdDocument.has(refDoc)) {
        indexes.deliveryItemsByReferenceSdDocument.set(refDoc, []);
      }
      indexes.deliveryItemsByReferenceSdDocument.get(refDoc)!.push(item);
    }
  }

  for (const header of ctx.deliveryHeaders) {
    const delKey = Object.keys(header).find(
      (k) => k.toLowerCase() === 'deliverydocument'
    );
    if (delKey) {
      const delDoc = header[delKey];
      indexes.deliveryHeaderByDeliveryDoc.set(delDoc, header);
    }
  }

  // Index billing items and headers
  for (const item of ctx.billingItems) {
    const billKey = Object.keys(item).find(
      (k) => k.toLowerCase() === 'billingdocument'
    );
    if (billKey) {
      const billDoc = item[billKey];
      if (!indexes.billingItemsByBillingDoc.has(billDoc)) {
        indexes.billingItemsByBillingDoc.set(billDoc, []);
      }
      indexes.billingItemsByBillingDoc.get(billDoc)!.push(item);
    }
  }

  for (const header of ctx.billingHeaders) {
    const billKey = Object.keys(header).find(
      (k) => k.toLowerCase() === 'billingdocument'
    );
    if (billKey) {
      const billDoc = header[billKey];
      indexes.billingHeaderByBillingDoc.set(billDoc, header);
    }
  }

  // Index journal entries and payments
  for (const entry of ctx.journalEntries) {
    const acctKey = Object.keys(entry).find(
      (k) => k.toLowerCase().includes('accounting')
    );
    if (acctKey) {
      const acctDoc = entry[acctKey];
      if (!indexes.journalByAccountingDoc.has(acctDoc)) {
        indexes.journalByAccountingDoc.set(acctDoc, []);
      }
      indexes.journalByAccountingDoc.get(acctDoc)!.push(entry);
    }
  }

  for (const payment of ctx.payments) {
    const acctKey = Object.keys(payment).find(
      (k) => k.toLowerCase().includes('accounting')
    );
    if (acctKey) {
      const acctDoc = payment[acctKey];
      indexes.paymentByAccountingDoc.set(acctDoc, payment);
    }
  }

  return indexes;
}

/**
 * Trace a single billing flow backward
 * Config-driven traversal: Billing -> Delivery -> Order -> Accounting -> Payment
 */
function traceBillingFlow(
  billingDocId: string,
  indexes: ReturnType<typeof buildIndexes>,
  ctx: FlowContext
): FlowTrace {
  const trace: FlowTrace = {
    billingDocId,
    billingItems: [],
    issues: [],
    joinKeys: [],
  };

  // Step 1: Find billing items
  const billingItems = indexes.billingItemsByBillingDoc.get(billingDocId) || [];
  trace.billingItems = billingItems;

  if (billingItems.length === 0) {
    trace.issues.push('[ERR] No billing items found');
    return trace;
  }

  // Step 2: Find billing header
  const billingHeader = indexes.billingHeaderByBillingDoc.get(billingDocId);
  if (!billingHeader) {
    trace.issues.push(`[ERR] Billing header not found for ${billingDocId}`);
    return trace;
  }

  // Step 3: Trace to deliveries using relationship config
  const rel_billing_delivery = findRelationship(
    'billing_document_items',
    'outbound_delivery_items'
  );
  if (!rel_billing_delivery) {
    trace.issues.push(
      '[ERR] No relationship defined from billing items to delivery items'
    );
  } else {
    trace.joinKeys.push(
      `${rel_billing_delivery.fromEntity}.${rel_billing_delivery.fromField} -> ${rel_billing_delivery.toEntity}.${rel_billing_delivery.toField}`
    );

    // Find delivery items using the relationship
    const deliveryItemsForBilling = findRelatedRecords(
      billingItems,
      'billing_document_items',
      'outbound_delivery_items',
      ctx.deliveryItems
    );

    if (deliveryItemsForBilling.length === 0) {
      // Extract actual value for debugging
      const refKey = Object.keys(billingItems[0]).find(
        (k) => k.toLowerCase() === rel_billing_delivery.fromField.toLowerCase()
      );
      const refValue = refKey ? billingItems[0][refKey] : 'unknown';
      trace.issues.push(
        `[ERR] No delivery items found for ${rel_billing_delivery.toField}=${refValue}`
      );
    } else {
      // Get deliveryDocument from first delivery item
      const firstDelItem = deliveryItemsForBilling[0];
      const delDocKey = Object.keys(firstDelItem).find((k) =>
        k.toLowerCase() === 'deliverydocument'
      );
      if (delDocKey && firstDelItem[delDocKey]) {
        const delDoc = firstDelItem[delDocKey];

        // Get delivery header
        const deliveryHeader = indexes.deliveryHeaderByDeliveryDoc.get(delDoc);
        if (deliveryHeader) {
          trace.delivery = {
            header: deliveryHeader,
            items: deliveryItemsForBilling,
          };
          trace.joinKeys.push(
            `${rel_billing_delivery.toEntity}.deliveryDocument (matched)`
          );

          // Step 4: Trace from delivery to orders using relationship config
          const rel_delivery_order = findRelationship(
            'outbound_delivery_items',
            'sales_order_items'
          );
          if (!rel_delivery_order) {
            trace.issues.push(
              '[ERR] No relationship defined from delivery items to order items'
            );
          } else {
            trace.joinKeys.push(
              `${rel_delivery_order.fromEntity}.${rel_delivery_order.fromField} -> ${rel_delivery_order.toEntity}.${rel_delivery_order.toField}`
            );

            // Find order items using the relationship
            const orderItemsForDelivery = findRelatedRecords(
              deliveryItemsForBilling,
              'outbound_delivery_items',
              'sales_order_items',
              ctx.orderItems
            );

            if (orderItemsForDelivery.length === 0) {
              const refKey = Object.keys(deliveryItemsForBilling[0]).find(
                (k) =>
                  k.toLowerCase() ===
                  rel_delivery_order.fromField.toLowerCase()
              );
              const refValue = refKey
                ? deliveryItemsForBilling[0][refKey]
                : 'unknown';
              trace.issues.push(
                `[ERR] No order items found for ${rel_delivery_order.toField}=${refValue}`
              );
            } else {
              // Get order header
              const orderKey = Object.keys(orderItemsForDelivery[0]).find((k) =>
                k.toLowerCase() === 'salesorder'
              );
              if (orderKey && orderItemsForDelivery[0][orderKey]) {
                const orderId = orderItemsForDelivery[0][orderKey];
                const orderHeader = indexes.orderHeaderByOrderId.get(orderId);
                if (orderHeader) {
                  trace.order = {
                    header: orderHeader,
                    items: orderItemsForDelivery,
                  };
                } else {
                  trace.issues.push(`[ERR] Order header not found for ${orderId}`);
                }
              } else {
                trace.issues.push('[ERR] No salesOrder in order items');
              }
            }
          }
        } else {
          trace.issues.push(`[ERR] Delivery header not found for ${delDoc}`);
        }
      } else {
        trace.issues.push('[ERR] No deliveryDocument in delivery items');
      }
    }
  }

  // Step 5: Trace to accounting and payments using relationship config
  const acctKey = Object.keys(billingHeader).find((k) =>
    k.toLowerCase().includes('accounting')
  );
  if (acctKey && billingHeader[acctKey]) {
    const acctDoc = billingHeader[acctKey];
    trace.joinKeys.push(
      `billing_document_headers.${acctKey} -> journal/payment.${acctKey}`
    );

    const journalEntries =
      indexes.journalByAccountingDoc.get(acctDoc) || [];
    if (journalEntries.length > 0) {
      trace.accounting = { journalEntries };

      // Find payment
      const payment = indexes.paymentByAccountingDoc.get(acctDoc);
      if (payment) {
        trace.payment = payment;
      } else {
        trace.issues.push(`[ERR] Payment not found for ${acctDoc}`);
      }
    } else {
      trace.issues.push(`[ERR] Journal entries not found for ${acctDoc}`);
    }
  } else {
    trace.issues.push('[ERR] Accounting document reference not found in billing');
  }

  return trace;
}

/**
 * Format and print flow trace
 */
function printFlowTrace(trace: FlowTrace) {
  console.log('\n' + '-'.repeat(60));
  console.log(`Billing: ${trace.billingDocId}`);
  console.log(`BillingItems: ${trace.billingItems.length}`);

  if (trace.delivery) {
    const delDoc = Object.keys(trace.delivery.header).find(
      (k) => k.toLowerCase() === 'deliverydocument'
    );
    const delDocValue = delDoc ? trace.delivery.header[delDoc] : 'N/A';
    const status = Object.keys(trace.delivery.header).find((k) =>
      k.toLowerCase().includes('status')
    );
    const statusValue = status ? trace.delivery.header[status] : 'N/A';

    console.log(`\nDelivery:`);
    console.log(`  deliveryDocument: ${delDocValue}`);
    console.log(`  items: ${trace.delivery.items.length}`);
    console.log(`  status: ${statusValue}`);
  } else {
    console.log('\n[ERR] Delivery: MISSING');
  }

  if (trace.order) {
    const orderDoc = Object.keys(trace.order.header).find(
      (k) => k.toLowerCase() === 'salesorder'
    );
    const orderDocValue = orderDoc ? trace.order.header[orderDoc] : 'N/A';
    const status = Object.keys(trace.order.header).find((k) =>
      k.toLowerCase().includes('status')
    );
    const statusValue = status ? trace.order.header[status] : 'N/A';

    console.log(`\nOrder:`);
    console.log(`  salesOrder: ${orderDocValue}`);
    console.log(`  items: ${trace.order.items.length}`);
    console.log(`  status: ${statusValue}`);
  } else {
    console.log('\n[ERR] Order: MISSING');
  }

  if (trace.accounting) {
    console.log(`\nAccounting:`);
    console.log(`  journalEntries: ${trace.accounting.journalEntries.length}`);
  } else {
    console.log('\n[ERR] Accounting: MISSING');
  }

  if (trace.payment) {
    const payId = Object.keys(trace.payment).find((k) =>
      k.toLowerCase().includes('payment')
    );
    const payIdValue = payId ? trace.payment[payId] : 'N/A';
    const amount = Object.keys(trace.payment).find((k) =>
      k.toLowerCase().includes('amount')
    );
    const amountValue = amount ? trace.payment[amount] : 'N/A';

    console.log(`\nPayment:`);
    console.log(`  paymentId: ${payIdValue}`);
    console.log(`  amount: ${amountValue}`);
  } else {
    console.log('\n[ERR] Payment: MISSING');
  }

  if (trace.joinKeys.length > 0) {
    console.log('\nJoin Keys Used:');
    const uniqueKeys = [...new Set(trace.joinKeys)];
    for (const key of uniqueKeys) {
      console.log(`  -> ${key}`);
    }
  }

  if (trace.issues.length > 0) {
    console.log('\nIssues:');
    for (const issue of trace.issues) {
      console.log(`  ${issue}`);
    }
  }

  console.log('-'.repeat(60));
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('[CHECK] SAP O2C Flow Validation\n');

  // Step 1: Find files
  console.log('[DIR] Discovering data files...');
  const entityMap = await getJsonlFilesForEntities(ENTITIES_TO_LOAD);

  // Step 2: Load data (dependency-driven strategy)
  console.log('\n[GRAPH] Loading data (dependency-driven strategy)...\n');

  const ctx: FlowContext = {
    orderHeaders: [],
    orderItems: [],
    deliveryHeaders: [],
    deliveryItems: [],
    billingHeaders: [],
    billingItems: [],
    journalEntries: [],
    payments: [],
  };

  const loadCounts = {
    billingHeaders: 0,
    billingItems: 0,
    deliveryItems: 0,
    orderItems: 0,
    journalEntries: 0,
    payments: 0,
  };

  try {
    // STEP 1: Load ALL data to ensure we have complete relationships
    console.log('  [LOAD] Loading all sales_order_items...');
    const orderItemsFiles = entityMap.get('sales_order_items') || [];
    if (orderItemsFiles.length > 0) {
      ctx.orderItems = await loadRecords(orderItemsFiles[0], 2000);
      loadCounts.orderItems = ctx.orderItems.length;
      console.log(`  sales_order_items: [OK] ${ctx.orderItems.length} records`);
    }

    console.log('  [LOAD] Loading all outbound_delivery_items...');
    const deliveryItemsFiles = entityMap.get('outbound_delivery_items') || [];
    if (deliveryItemsFiles.length > 0) {
      ctx.deliveryItems = await loadRecords(deliveryItemsFiles[0], 2000);
      loadCounts.deliveryItems = ctx.deliveryItems.length;
      console.log(`  outbound_delivery_items: [OK] ${ctx.deliveryItems.length} records`);
    }

    console.log('  [LOAD] Loading all outbound_delivery_headers...');
    const deliveryHeadersFiles = entityMap.get('outbound_delivery_headers') || [];
    if (deliveryHeadersFiles.length > 0) {
      ctx.deliveryHeaders = await loadRecords(deliveryHeadersFiles[0], 2000);
      console.log(`  outbound_delivery_headers: [OK] ${ctx.deliveryHeaders.length} records`);
    }

    console.log('  [LOAD] Loading all sales_order_headers...');
    const orderHeadersFiles = entityMap.get('sales_order_headers') || [];
    if (orderHeadersFiles.length > 0) {
      ctx.orderHeaders = await loadRecords(orderHeadersFiles[0], 2000);
      console.log(`  sales_order_headers: [OK] ${ctx.orderHeaders.length} records`);
    }

    // STEP 2: Load billing headers (first 20)
    console.log('  [LOAD] Loading billing_document_headers...');
    const billingHeadersFiles = entityMap.get('billing_document_headers') || [];
    if (billingHeadersFiles.length > 0) {
      ctx.billingHeaders = await loadRecords(billingHeadersFiles[0], 20);
      loadCounts.billingHeaders = ctx.billingHeaders.length;
      console.log(`  billing_document_headers: [OK] ${ctx.billingHeaders.length} records`);
    }

    if (ctx.billingHeaders.length === 0) {
      console.log('\n[ERR] No billing headers found. Cannot continue.');
      process.exit(0);
    }

    // Extract billing document IDs and accounting document IDs
    const billingDocIds = new Set<string>();
    const acctDocIds = new Set<string>();
    for (const header of ctx.billingHeaders) {
      const billKey = Object.keys(header).find(
        (k) => k.toLowerCase() === 'billingdocument'
      );
      const acctKey = Object.keys(header).find(
        (k) => k.toLowerCase() === 'accountingdocument'
      );
      if (billKey) billingDocIds.add(header[billKey]);
      if (acctKey) acctDocIds.add(header[acctKey]);
    }

    // STEP 3: Load billing items matching those billing documents
    console.log('  [LOAD] Loading billing_document_items (filtered)...');
    const billingItemsFiles = entityMap.get('billing_document_items') || [];
    if (billingItemsFiles.length > 0) {
      ctx.billingItems = await loadRecordsWithFilter(
        billingItemsFiles[0],
        (record: Record) => {
          const billKey = Object.keys(record).find(
            (k) => k.toLowerCase() === 'billingdocument'
          );
          return !!(billKey && billingDocIds.has(record[billKey]));
        }
      );
      loadCounts.billingItems = ctx.billingItems.length;
      console.log(
        `  billing_document_items: [OK] ${ctx.billingItems.length} records (filtered)`
      );
    }

    // STEP 4: Load journals and payments
    console.log('  [LOAD] Loading journal_entry_items (filtered)...');
    const journalFiles = entityMap.get(
      'journal_entry_items_accounts_receivable'
    ) || [];
    if (journalFiles.length > 0) {
      ctx.journalEntries = await loadRecordsWithFilter(
        journalFiles[0],
        (record: Record) => {
          const acctKey = Object.keys(record).find(
            (k) => k.toLowerCase() === 'accountingdocument'
          );
          return !!(acctKey && acctDocIds.has(record[acctKey]));
        }
      );
      loadCounts.journalEntries = ctx.journalEntries.length;
      console.log(
        `  journal_entry_items: [OK] ${ctx.journalEntries.length} records (filtered)`
      );
    }

    console.log('  [LOAD] Loading payments (filtered)...');
    const paymentFiles = entityMap.get('payments_accounts_receivable') || [];
    if (paymentFiles.length > 0) {
      ctx.payments = await loadRecordsWithFilter(
        paymentFiles[0],
        (record: Record) => {
          const acctKey = Object.keys(record).find(
            (k) => k.toLowerCase() === 'accountingdocument'
          );
          return !!(acctKey && acctDocIds.has(record[acctKey]));
        }
      );
      loadCounts.payments = ctx.payments.length;
      console.log(`  payments: [OK] ${ctx.payments.length} records (filtered)`);
    }

    console.log(`\n[GRAPH] Load Summary:`);
    console.log(`  Billing headers: ${loadCounts.billingHeaders}`);
    console.log(`  Billing items: ${loadCounts.billingItems}`);
    console.log(`  Order headers: ${ctx.orderHeaders.length}`);
    console.log(`  Order items: ${loadCounts.orderItems}`);
    console.log(`  Delivery headers: ${ctx.deliveryHeaders.length}`);
    console.log(`  Delivery items: ${loadCounts.deliveryItems}`);
    console.log(`  Journal entries: ${loadCounts.journalEntries}`);
    console.log(`  Payments: ${loadCounts.payments}`);
  } catch (error) {
    console.error(
      '[ERR] Error loading data:',
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }

  // Step 3: Field discovery
  console.log('\n[SCAN] Field Discovery:\n');
  for (const [entity] of entityMap) {
    if (entity === 'sales_order_headers')
      printFields('sales_order_headers', ctx.orderHeaders);
    else if (entity === 'sales_order_items')
      printFields('sales_order_items', ctx.orderItems);
    else if (entity === 'outbound_delivery_headers')
      printFields('outbound_delivery_headers', ctx.deliveryHeaders);
    else if (entity === 'outbound_delivery_items')
      printFields('outbound_delivery_items', ctx.deliveryItems);
    else if (entity === 'billing_document_headers')
      printFields('billing_document_headers', ctx.billingHeaders);
    else if (entity === 'billing_document_items')
      printFields('billing_document_items', ctx.billingItems);
    else if (entity === 'journal_entry_items_accounts_receivable')
      printFields('journal_entry_items_accounts_receivable', ctx.journalEntries);
    else if (entity === 'payments_accounts_receivable')
      printFields('payments_accounts_receivable', ctx.payments);
  }

  // Step 4: Show normalized domain objects
  printNormalizedSamples(ctx);

  // Step 5: Build indexes
  console.log('\n[INDEX] Building indexes...');
  const indexes = buildIndexes(ctx);
  console.log('[OK] Indexes built\n');

  // Step 6: Get first 5 billing documents (backward tracing strategy)
  const uniqueBillingDocs = new Set<string>();
  for (const header of ctx.billingHeaders) {
    const billKey = Object.keys(header).find(
      (k) => k.toLowerCase() === 'billingdocument'
    );
    if (billKey && uniqueBillingDocs.size < 5) {
      uniqueBillingDocs.add(header[billKey]);
    }
  }

  if (uniqueBillingDocs.size === 0) {
    console.log('[ERR] No billing documents found in dataset');
    process.exit(0);
  }

  // Step 7: Trace flows backward from billing
  console.log(
    `[FLOW] Tracing flows backward from ${uniqueBillingDocs.size} sample billing documents...\n`
  );

  for (const billingDocId of uniqueBillingDocs) {
    const trace = traceBillingFlow(billingDocId, indexes, ctx);
    printFlowTrace(trace);
  }

  // Step 8: Build graph from normalized data
  console.log('\n[GRAPH] Building graph from normalized data...');

  // Normalize all raw data
  const normalizedOrders: SalesOrder[] = ctx.orderHeaders.map(normalizeSalesOrder);
  const normalizedOrderItems: SalesOrderItem[] = ctx.orderItems.map(
    normalizeSalesOrderItem
  );
  const normalizedDeliveryItems: DeliveryItem[] = ctx.deliveryItems.map(
    normalizeDeliveryItem
  );
  const normalizedBillingDocs: BillingDocument[] = ctx.billingHeaders.map(
    normalizeBillingDocument
  );
  const normalizedBillingItems: BillingDocumentItem[] = ctx.billingItems.map(
    normalizeBillingDocumentItem
  );
  const normalizedJournalEntries: JournalEntry[] = ctx.journalEntries.map(
    normalizeJournalEntry
  );
  const normalizedPayments: Payment[] = ctx.payments.map(normalizePayment);

  // Build graph
  const graph = buildGraph(
    normalizedOrders,
    normalizedOrderItems,
    normalizedDeliveryItems,
    normalizedBillingDocs,
    normalizedBillingItems,
    normalizedJournalEntries,
    normalizedPayments
  );

  console.log(`\n[STATS] Graph Summary:`);
  console.log(`  Total nodes: ${graph.nodes.length}`);
  console.log(`  Total edges: ${graph.edges.length}`);

  // Show sample nodes
  console.log(`\n[NODE] Sample Nodes (first 5):`);
  graph.nodes.slice(0, 5).forEach((node) => {
    console.log(`  ${node.id} (type: ${node.type})`);
  });

  // Show sample edges
  console.log(`\n[EDGE] Sample Edges (first 5):`);
  graph.edges.slice(0, 5).forEach((edge) => {
    console.log(`  ${edge.source} -> ${edge.target} [${edge.type}]`);
  });

  console.log('\n[OK] Flow validation complete!');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  // @ts-ignore - process is global in Node.js
  process.exit(1);
});
