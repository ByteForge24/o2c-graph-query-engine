#!/usr/bin/env ts-node

/**
 * O2C Data Ingestion Pipeline
 * Loads normalized domain data into Prisma database
 *
 * Flow:
 * - Load JSONL files in dependency order
 * - Normalize raw records to domain objects
 * - Insert respecting schema relations
 * - Batch inserts for performance
 *
 * Run with: pnpm ingest
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { PrismaClient } from '@prisma/client';

// ============================================================================
// NORMALIZERS (from packages/db/src/domain/normalizers)
// ============================================================================

interface SalesOrderNormalized {
  id: string;
  customerId?: string;
  createdAt?: Date;
}

interface SalesOrderItemNormalized {
  id: string;
  orderId: string;
  productId?: string;
  quantity?: number;
}

interface DeliveryItemNormalized {
  id: string;
  deliveryId: string;
  orderId: string;
}

interface BillingDocumentNormalized {
  id: string;
  accountingDocument?: string;
}

interface BillingItemNormalized {
  id: string;
  billingId: string;
  deliveryId: string;
}

interface JournalEntryNormalized {
  id: string;
  accountingDocument: string;
}

interface PaymentNormalized {
  id: string;
  accountingDocument: string;
  amount?: number;
}

interface BusinessPartnerNormalized {
  id: string;
  name?: string;
}

// Normalizer functions
function normalizeSalesOrder(raw: any): SalesOrderNormalized | null {
  const id = raw.salesOrderNumber || raw.orderNumber;
  if (!id) return null;

  return {
    id: String(id),
    customerId: raw.billToParty ? String(raw.billToParty) : undefined,
    createdAt: raw.creationDate ? new Date(raw.creationDate) : undefined,
  };
}

function normalizeSalesOrderItem(raw: any): SalesOrderItemNormalized | null {
  const id = raw.lineItem || raw.itemNumber;
  const orderId = raw.salesOrderNumber || raw.orderNumber;
  if (!id || !orderId) return null;

  return {
    id: String(id),
    orderId: String(orderId),
    productId: raw.material ? String(raw.material) : undefined,
    quantity: raw.requestedQuantity ? Number(raw.requestedQuantity) : undefined,
  };
}

function normalizeDeliveryItem(raw: any): DeliveryItemNormalized | null {
  const id = raw.lineItem || raw.itemNumber;
  const deliveryId = raw.deliveryNumber;
  const orderId = raw.referenceSdDocument;
  if (!id || !deliveryId || !orderId) return null;

  return {
    id: String(id),
    deliveryId: String(deliveryId),
    orderId: String(orderId),
  };
}

function normalizeBillingDocument(raw: any): BillingDocumentNormalized | null {
  const id = raw.billingNumber;
  if (!id) return null;

  return {
    id: String(id),
    accountingDocument: raw.accountingDocument ? String(raw.accountingDocument) : undefined,
  };
}

function normalizeBillingItem(raw: any): BillingItemNormalized | null {
  const id = raw.lineItem || raw.itemNumber;
  const billingId = raw.billingNumber;
  const deliveryId = raw.referenceSdDocument;
  if (!id || !billingId) return null;

  return {
    id: String(id),
    billingId: String(billingId),
    deliveryId: deliveryId ? String(deliveryId) : '',
  };
}

function normalizeJournalEntry(raw: any): JournalEntryNormalized | null {
  const id = raw.jountrySequenceNumber || raw.sequenceNumber;
  const accountingDocument = raw.accountingDocument;
  if (!id || !accountingDocument) return null;

  return {
    id: String(id),
    accountingDocument: String(accountingDocument),
  };
}

function normalizePayment(raw: any): PaymentNormalized | null {
  const id = raw.paymentNumber || raw.referenceNumber;
  const accountingDocument = raw.accountingDocument;
  if (!id || !accountingDocument) return null;

  return {
    id: String(id),
    accountingDocument: String(accountingDocument),
    amount: raw.paymentAmount ? Number(raw.paymentAmount) : undefined,
  };
}

function normalizeBusinessPartner(raw: any): BusinessPartnerNormalized | null {
  const id = raw.businessPartnerNumber || raw.partnerId;
  if (!id) return null;

  return {
    id: String(id),
    name: raw.businessPartnerName || raw.partnerName || raw.name || undefined,
  };
}

// ============================================================================
// GLOBALS & CONFIG
// ============================================================================

const DATA_DIR = './data/sap-o2c-data';
const CHUNK_SIZE = 500;
const prisma = new PrismaClient();

interface DataStore {
  billingDocumentHeaders: BillingDocumentNormalized[];
  billingDocumentItems: BillingItemNormalized[];
  outboundDeliveryItems: DeliveryItemNormalized[];
  salesOrderItems: SalesOrderItemNormalized[];
  salesOrders: SalesOrderNormalized[];
  journalEntries: JournalEntryNormalized[];
  payments: PaymentNormalized[];
  businessPartners: BusinessPartnerNormalized[];
}

interface InsertStats {
  businessPartners: number;
  salesOrders: number;
  salesOrderItems: number;
  deliveryItems: number;
  billingDocuments: number;
  billingItems: number;
  journalEntries: number;
  payments: number;
  errors: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseJsonLine(line: string): Record<string, any> | null {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function readJsonlFile(filePath: string): Promise<Record<string, any>[]> {
  const records: Record<string, any>[] = [];

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream });

    rl.on('line', (line: string) => {
      if (!line.trim()) return;
      const record = parseJsonLine(line);
      if (record) {
        records.push(record);
      }
    });

    rl.on('close', () => resolve(records));
    rl.on('error', reject);
  });
}

async function findFileByPattern(pattern: string): Promise<string | null> {
  try {
    const entries = await fs.promises.readdir(DATA_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const dirPath = path.join(DATA_DIR, entry.name);
      const files = await fs.promises.readdir(dirPath);

      for (const file of files) {
        if (file.includes(pattern) && file.endsWith('.jsonl')) {
          return path.join(dirPath, file);
        }
      }
    }
  } catch (err) {
    console.error(`Error finding file with pattern ${pattern}:`, err);
  }

  return null;
}

async function chunkArray<T>(array: T[], size: number): Promise<T[][]> {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

// ============================================================================
// LOADING STAGE
// ============================================================================

async function loadDataDependencyDriven(): Promise<DataStore> {
  console.log('[LOAD] Starting dependency-driven data loading...\n');

  const data: DataStore = {
    billingDocumentHeaders: [],
    billingDocumentItems: [],
    outboundDeliveryItems: [],
    salesOrderItems: [],
    salesOrders: [],
    journalEntries: [],
    payments: [],
    businessPartners: [],
  };

  try {
    // 1. Load billing document headers
    console.log('[LOAD] 1. Loading billing_document_headers...');
    const billingHeaderFile = await findFileByPattern('billing_document_headers');
    if (billingHeaderFile) {
      const records = await readJsonlFile(billingHeaderFile);
      data.billingDocumentHeaders = records
        .map(normalizeBillingDocument)
        .filter((r) => r !== null) as BillingDocumentNormalized[];
      console.log(`      [OK] ${data.billingDocumentHeaders.length} billing documents\n`);
    }

    // 2. Load billing document items (filter by billing IDs)
    console.log('[LOAD] 2. Loading billing_document_items (filtered)...');
    const billingIdSet = new Set(data.billingDocumentHeaders.map((b) => b.id));
    const billingItemFile = await findFileByPattern('billing_document_items');
    if (billingItemFile) {
      const records = await readJsonlFile(billingItemFile);
      const allBillingItems = records
        .map(normalizeBillingItem)
        .filter((r) => r !== null) as BillingItemNormalized[];
      data.billingDocumentItems = allBillingItems.filter((item) =>
        billingIdSet.has(item.billingId)
      );
      console.log(`      [OK] ${data.billingDocumentItems.length} billing items\n`);
    }

    // 3. Load outbound delivery items (filter by delivery IDs)
    console.log('[LOAD] 3. Loading outbound_delivery_items (filtered)...');
    const deliveryIdSet = new Set(
      data.billingDocumentItems.map((b) => b.deliveryId).filter((x) => x)
    );
    const deliveryFile = await findFileByPattern('outbound_delivery_items');
    if (deliveryFile) {
      const records = await readJsonlFile(deliveryFile);
      const allDeliveryItems = records
        .map(normalizeDeliveryItem)
        .filter((r) => r !== null) as DeliveryItemNormalized[];
      data.outboundDeliveryItems = allDeliveryItems.filter(
        (item) =>
          deliveryIdSet.has(item.deliveryId) || item.deliveryId === '' || !item.deliveryId
      );
      console.log(`      [OK] ${data.outboundDeliveryItems.length} delivery items\n`);
    }

    // 4. Load sales order items (filter by sales order IDs)
    console.log('[LOAD] 4. Loading sales_order_items (filtered)...');
    const orderIdSet = new Set(
      data.outboundDeliveryItems.map((d) => d.orderId).filter((x) => x)
    );
    const orderItemFile = await findFileByPattern('sales_order_items');
    if (orderItemFile) {
      const records = await readJsonlFile(orderItemFile);
      const allOrderItems = records
        .map(normalizeSalesOrderItem)
        .filter((r) => r !== null) as SalesOrderItemNormalized[];
      data.salesOrderItems = allOrderItems.filter((item) => orderIdSet.has(item.orderId));
      console.log(`      [OK] ${data.salesOrderItems.length} order items\n`);
    }

    // 5. Load sales orders (filter by order IDs)
    console.log('[LOAD] 5. Loading sales_orders (filtered)...');
    const allOrderIdSet = new Set(data.salesOrderItems.map((s) => s.orderId));
    const orderFile = await findFileByPattern('sales_order_headers');
    if (orderFile) {
      const records = await readJsonlFile(orderFile);
      const allOrders = records
        .map(normalizeSalesOrder)
        .filter((r) => r !== null) as SalesOrderNormalized[];
      data.salesOrders = allOrders.filter((order) => allOrderIdSet.has(order.id));
      console.log(`      [OK] ${data.salesOrders.length} sales orders\n`);
    }

    // 6. Load journal entries
    console.log('[LOAD] 6. Loading journal_entries...');
    const journalFile = await findFileByPattern('billing_account_entries');
    if (journalFile) {
      const records = await readJsonlFile(journalFile);
      data.journalEntries = records
        .map(normalizeJournalEntry)
        .filter((r) => r !== null) as JournalEntryNormalized[];
      console.log(`      [OK] ${data.journalEntries.length} journal entries\n`);
    }

    // 7. Load payments
    console.log('[LOAD] 7. Loading payments...');
    const paymentFile = await findFileByPattern('payment_detail');
    if (paymentFile) {
      const records = await readJsonlFile(paymentFile);
      data.payments = records
        .map(normalizePayment)
        .filter((r) => r !== null) as PaymentNormalized[];
      console.log(`      [OK] ${data.payments.length} payments\n`);
    }

    // 8. Load business partners
    console.log('[LOAD] 8. Loading business partners...');
    const partnerFile = await findFileByPattern('business_partner');
    if (partnerFile) {
      const records = await readJsonlFile(partnerFile);
      data.businessPartners = records
        .map(normalizeBusinessPartner)
        .filter((r) => r !== null) as BusinessPartnerNormalized[];
      console.log(`      [OK] ${data.businessPartners.length} business partners\n`);
    }
  } catch (err) {
    console.error('[ERR] Error during data loading:', err);
    throw err;
  }

  return data;
}

// ============================================================================
// INSERTION STAGE
// ============================================================================

async function insertData(data: DataStore): Promise<InsertStats> {
  console.log('[INSERT] Starting database ingestion...\n');

  const stats: InsertStats = {
    businessPartners: 0,
    salesOrders: 0,
    salesOrderItems: 0,
    deliveryItems: 0,
    billingDocuments: 0,
    billingItems: 0,
    journalEntries: 0,
    payments: 0,
    errors: [],
  };

  try {
    // 1. Insert BusinessPartners
    console.log('[INSERT] 1. BusinessPartners...');
    if (data.businessPartners.length > 0) {
      const chunks = await chunkArray(data.businessPartners, CHUNK_SIZE);
      for (const chunk of chunks) {
        try {
          const result = await prisma.businessPartner.createMany({
            data: chunk,
            skipDuplicates: true,
          });
          stats.businessPartners += result.count;
        } catch (err) {
          stats.errors.push(`BusinessPartner batch error: ${err}`);
        }
      }
    }
    console.log(`        [OK] Inserted ${stats.businessPartners}\n`);

    // 2. Insert SalesOrders
    console.log('[INSERT] 2. SalesOrders...');
    if (data.salesOrders.length > 0) {
      const chunks = await chunkArray(data.salesOrders, CHUNK_SIZE);
      for (const chunk of chunks) {
        try {
          const result = await prisma.salesOrder.createMany({
            data: chunk,
            skipDuplicates: true,
          });
          stats.salesOrders += result.count;
        } catch (err) {
          stats.errors.push(`SalesOrder batch error: ${err}`);
        }
      }
    }
    console.log(`        [OK] Inserted ${stats.salesOrders}\n`);

    // 3. Insert SalesOrderItems
    console.log('[INSERT] 3. SalesOrderItems...');
    if (data.salesOrderItems.length > 0) {
      const chunks = await chunkArray(data.salesOrderItems, CHUNK_SIZE);
      for (const chunk of chunks) {
        try {
          const result = await prisma.salesOrderItem.createMany({
            data: chunk,
            skipDuplicates: true,
          });
          stats.salesOrderItems += result.count;
        } catch (err) {
          stats.errors.push(`SalesOrderItem batch error: ${err}`);
        }
      }
    }
    console.log(`        [OK] Inserted ${stats.salesOrderItems}\n`);

    // 4. Insert DeliveryItems
    console.log('[INSERT] 4. DeliveryItems...');
    if (data.outboundDeliveryItems.length > 0) {
      const chunks = await chunkArray(data.outboundDeliveryItems, CHUNK_SIZE);
      for (const chunk of chunks) {
        try {
          const result = await prisma.deliveryItem.createMany({
            data: chunk,
            skipDuplicates: true,
          });
          stats.deliveryItems += result.count;
        } catch (err) {
          stats.errors.push(`DeliveryItem batch error: ${err}`);
        }
      }
    }
    console.log(`        [OK] Inserted ${stats.deliveryItems}\n`);

    // 5. Insert BillingDocuments
    console.log('[INSERT] 5. BillingDocuments...');
    if (data.billingDocumentHeaders.length > 0) {
      const chunks = await chunkArray(data.billingDocumentHeaders, CHUNK_SIZE);
      for (const chunk of chunks) {
        try {
          const result = await prisma.billingDocument.createMany({
            data: chunk,
            skipDuplicates: true,
          });
          stats.billingDocuments += result.count;
        } catch (err) {
          stats.errors.push(`BillingDocument batch error: ${err}`);
        }
      }
    }
    console.log(`        [OK] Inserted ${stats.billingDocuments}\n`);

    // 6. Insert BillingItems
    console.log('[INSERT] 6. BillingItems...');
    if (data.billingDocumentItems.length > 0) {
      const chunks = await chunkArray(data.billingDocumentItems, CHUNK_SIZE);
      for (const chunk of chunks) {
        try {
          const result = await prisma.billingItem.createMany({
            data: chunk,
            skipDuplicates: true,
          });
          stats.billingItems += result.count;
        } catch (err) {
          stats.errors.push(`BillingItem batch error: ${err}`);
        }
      }
    }
    console.log(`        [OK] Inserted ${stats.billingItems}\n`);

    // 7. Insert JournalEntries
    console.log('[INSERT] 7. JournalEntries...');
    if (data.journalEntries.length > 0) {
      const chunks = await chunkArray(data.journalEntries, CHUNK_SIZE);
      for (const chunk of chunks) {
        try {
          const result = await prisma.journalEntry.createMany({
            data: chunk,
            skipDuplicates: true,
          });
          stats.journalEntries += result.count;
        } catch (err) {
          stats.errors.push(`JournalEntry batch error: ${err}`);
        }
      }
    }
    console.log(`        [OK] Inserted ${stats.journalEntries}\n`);

    // 8. Insert Payments
    console.log('[INSERT] 8. Payments...');
    if (data.payments.length > 0) {
      const chunks = await chunkArray(data.payments, CHUNK_SIZE);
      for (const chunk of chunks) {
        try {
          const result = await prisma.payment.createMany({
            data: chunk,
            skipDuplicates: true,
          });
          stats.payments += result.count;
        } catch (err) {
          stats.errors.push(`Payment batch error: ${err}`);
        }
      }
    }
    console.log(`        [OK] Inserted ${stats.payments}\n`);
  } catch (err) {
    console.error('[ERR] Error during insertion:', err);
    throw err;
  }

  return stats;
}

// ============================================================================
// MAIN PIPELINE
// ============================================================================

async function main() {
  console.log('\n========================================');
  console.log('[INGEST] O2C Data Ingestion Pipeline');
  console.log('========================================\n');

  try {
    // Load data
    const data = await loadDataDependencyDriven();

    // Insert into database
    const stats = await insertData(data);

    // Summary
    console.log('\n========================================');
    console.log('[SUMMARY] Ingestion Complete');
    console.log('========================================\n');
    console.log('Inserted Records:');
    console.log(`  Business Partners:    ${stats.businessPartners}`);
    console.log(`  Sales Orders:         ${stats.salesOrders}`);
    console.log(`  Order Items:          ${stats.salesOrderItems}`);
    console.log(`  Delivery Items:       ${stats.deliveryItems}`);
    console.log(`  Billing Documents:    ${stats.billingDocuments}`);
    console.log(`  Billing Items:        ${stats.billingItems}`);
    console.log(`  Journal Entries:      ${stats.journalEntries}`);
    console.log(`  Payments:             ${stats.payments}`);

    if (stats.errors.length > 0) {
      console.log(`\nErrors Encountered: ${stats.errors.length}`);
      stats.errors.forEach((err) => console.log(`  - ${err}`));
    }

    console.log('\n[OK] Ingestion pipeline completed!\n');
  } catch (err) {
    console.error('[ERR] Pipeline failed:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
