#!/usr/bin/env ts-node

/**
 * Diagnostic script to find actual join keys between entities
 * Shows sample values from each entity to understand relationships
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// @ts-ignore - Node.js globals
const DATA_DIR = './data/sap-o2c-data';

async function loadSampleRecords(filePath: string, limit: number = 3): Promise<any[]> {
  const records: any[] = [];

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
        records.push(JSON.parse(line));
      } catch {
        // Skip
      }
    });

    rl.on('close', () => resolve(records));
    rl.on('error', reject);
  });
}

async function getUniqueValues(filePath: string, fieldPattern: string, limit: number = 20): Promise<Set<string>> {
  const values = new Set<string>();

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream });

    rl.on('line', (line: string) => {
      if (values.size >= limit) {
        rl.close();
        return;
      }
      if (!line.trim()) return;
      try {
        const record = JSON.parse(line);
        const key = Object.keys(record).find(k => k.toLowerCase().includes(fieldPattern.toLowerCase()));
        if (key && record[key]) {
          values.add(String(record[key]));
        }
      } catch {
        // Skip
      }
    });

    rl.on('close', () => resolve(values));
    rl.on('error', reject);
  });
}

async function main() {
  console.log('🔍 JOIN KEY DIAGNOSTIC\n');

  // Find files
  const findFiles = async (entity: string): Promise<string | null> => {
    const full = path.join(DATA_DIR, entity);
    try {
      const entries = await fs.promises.readdir(full, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          return path.join(full, entry.name);
        }
      }
    } catch {
      // Directory doesn't exist
    }
    return null;
  };

  const billingItemsFile = await findFiles('billing_document_items');
  const deliveryItemsFile = await findFiles('outbound_delivery_items');
  const orderItemsFile = await findFiles('sales_order_items');

  if (!billingItemsFile || !deliveryItemsFile || !orderItemsFile) {
    console.log('❌ Missing required data files');
    process.exit(1);
  }

  // Load samples
  console.log('📥 Loading samples...\n');

  const billingSamples = await loadSampleRecords(billingItemsFile, 2);
  const deliverySamples = await loadSampleRecords(deliveryItemsFile, 2);
  const orderSamples = await loadSampleRecords(orderItemsFile, 2);

  console.log('📋 BILLING ITEMS (sample):');
  billingSamples.forEach((r, i) => {
    console.log(`  Record ${i + 1}:`);
    Object.entries(r).forEach(([k, v]) => {
      if (k.toLowerCase().includes('document') || k.toLowerCase().includes('reference') || k.toLowerCase().includes('material')) {
        console.log(`    ${k}: ${v}`);
      }
    });
  });

  console.log('\n📋 DELIVERY ITEMS (sample):');
  deliverySamples.forEach((r, i) => {
    console.log(`  Record ${i + 1}:`);
    Object.entries(r).forEach(([k, v]) => {
      if (k.toLowerCase().includes('document') || k.toLowerCase().includes('reference') || k.toLowerCase().includes('material')) {
        console.log(`    ${k}: ${v}`);
      }
    });
  });

  console.log('\n📋 ORDER ITEMS (sample):');
  orderSamples.forEach((r, i) => {
    console.log(`  Record ${i + 1}:`);
    Object.entries(r).forEach(([k, v]) => {
      if (k.toLowerCase().includes('order') || k.toLowerCase().includes('material')) {
        console.log(`    ${k}: ${v}`);
      }
    });
  });

  // Get unique values
  console.log('\n\n🔎 UNIQUE VALUES (first 10 each):\n');

  const billRefDocs = await getUniqueValues(billingItemsFile, 'reference', 10);
  console.log(`Billing items - referenceSdDocument values:`);
  billRefDocs.forEach(v => console.log(`  ${v}`));

  const deliveryDocs = await getUniqueValues(deliveryItemsFile, 'deliveryDocument', 10);
  console.log(`\nDelivery items - deliveryDocument values:`);
  deliveryDocs.forEach(v => console.log(`  ${v}`));

  const deliveryRefs = await getUniqueValues(deliveryItemsFile, 'reference', 10);
  console.log(`\nDelivery items - referenceSdDocument values:`);
  deliveryRefs.forEach(v => console.log(`  ${v}`));

  const orderIds = await getUniqueValues(orderItemsFile, 'salesorder', 10);
  console.log(`\nOrder items - salesOrder values:`);
  orderIds.forEach(v => console.log(`  ${v}`));

  // Check intersections
  console.log('\n\n🔗 JOIN ANALYSIS:\n');

  const billRefArray = Array.from(billRefDocs);
  const deliveryDocArray = Array.from(deliveryDocs);
  const deliveryRefArray = Array.from(deliveryRefs);
  const orderIdArray = Array.from(orderIds);

  const billToDeliveryDocs = billRefArray.filter(b => deliveryDocArray.includes(b));
  const billToDeliveryRefs = billRefArray.filter(b => deliveryRefArray.includes(b));
  const billToOrders = billRefArray.filter(b => orderIdArray.includes(b));
  const deliveryRefToOrders = deliveryRefArray.filter(d => orderIdArray.includes(d));

  console.log(`✓ Billing.referenceSdDoc → Delivery.deliveryDocument: ${billToDeliveryDocs.length} matches`);
  if (billToDeliveryDocs.length > 0) console.log(`  Examples: ${billToDeliveryDocs.slice(0, 3).join(', ')}`);

  console.log(`✓ Billing.referenceSdDoc → Delivery.referenceSdDoc: ${billToDeliveryRefs.length} matches`);
  if (billToDeliveryRefs.length > 0) console.log(`  Examples: ${billToDeliveryRefs.slice(0, 3).join(', ')}`);

  console.log(`✓ Billing.referenceSdDoc → Order.salesOrder: ${billToOrders.length} matches`);
  if (billToOrders.length > 0) console.log(`  Examples: ${billToOrders.slice(0, 3).join(', ')}`);

  console.log(`✓ Delivery.referenceSdDoc → Order.salesOrder: ${deliveryRefToOrders.length} matches`);
  if (deliveryRefToOrders.length > 0) console.log(`  Examples: ${deliveryRefToOrders.slice(0, 3).join(', ')}`);

  console.log('\n✓ Diagnostic complete');
}

main().catch(e => {
  console.error('Error:', e);
  // @ts-ignore
  process.exit(1);
});
