#!/usr/bin/env ts-node

/**
 * Graph Contract Smoke Test
 * Validates the frozen graph vocabulary and relationship contract
 * Run with: pnpm graph:contract
 */

import {
  GRAPH_NODE_TYPES,
  GRAPH_EDGE_TYPES,
  GRAPH_RELATIONSHIPS,
} from 'graph';

// ============================================================================
// ASSERTIONS
// ============================================================================

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    console.error(`✗ ${message}`);
    console.error(`  Expected: ${expected}`);
    console.error(`  Actual:   ${actual}`);
    process.exit(1);
  }
}

function assertContains<T>(
  collection: ReadonlyArray<T> | Record<string, T>,
  item: T,
  message: string
): void {
  const items = Array.isArray(collection) ? collection : Object.values(collection);
  if (!items.includes(item)) {
    console.error(`✗ ${message}`);
    console.error(`  Expected to find: ${item}`);
    console.error(`  In: ${JSON.stringify(items)}`);
    process.exit(1);
  }
}

function assertLength(
  collection: ReadonlyArray<unknown>,
  expectedLength: number,
  message: string
): void {
  if (collection.length !== expectedLength) {
    console.error(`✗ ${message}`);
    console.error(`  Expected length: ${expectedLength}`);
    console.error(`  Actual length:   ${collection.length}`);
    process.exit(1);
  }
}

// ============================================================================
// CONTRACT VERIFICATION
// ============================================================================

async function verifyGraphContract(): Promise<void> {
  console.log('\n📊 Verifying Graph Contract...\n');

  // ========================================================================
  // 1. Node Types
  // ========================================================================
  console.log('Checking Node Types...');

  const nodeTypeValues = Object.values(GRAPH_NODE_TYPES);
  assertLength(nodeTypeValues, 7, 'GRAPH_NODE_TYPES should have 7 entries');

  assertContains(
    nodeTypeValues,
    'SalesOrder',
    'Node types should contain SalesOrder'
  );
  assertContains(
    nodeTypeValues,
    'SalesOrderItem',
    'Node types should contain SalesOrderItem'
  );
  assertContains(
    nodeTypeValues,
    'DeliveryItem',
    'Node types should contain DeliveryItem'
  );
  assertContains(
    nodeTypeValues,
    'BillingDocument',
    'Node types should contain BillingDocument'
  );
  assertContains(
    nodeTypeValues,
    'BillingDocumentItem',
    'Node types should contain BillingDocumentItem'
  );
  assertContains(
    nodeTypeValues,
    'JournalEntry',
    'Node types should contain JournalEntry'
  );
  assertContains(nodeTypeValues, 'Payment', 'Node types should contain Payment');

  console.log('✓ Node types match frozen vocabulary\n');

  // ========================================================================
  // 2. Edge Types
  // ========================================================================
  console.log('Checking Edge Types...');

  const edgeTypeValues = Object.values(GRAPH_EDGE_TYPES);
  assertLength(edgeTypeValues, 6, 'GRAPH_EDGE_TYPES should have 6 entries');

  assertContains(
    edgeTypeValues,
    'ORDER_TO_ITEM',
    'Edge types should contain ORDER_TO_ITEM'
  );
  assertContains(
    edgeTypeValues,
    'ITEM_TO_DELIVERY',
    'Edge types should contain ITEM_TO_DELIVERY'
  );
  assertContains(
    edgeTypeValues,
    'DELIVERY_TO_BILLING_ITEM',
    'Edge types should contain DELIVERY_TO_BILLING_ITEM'
  );
  assertContains(
    edgeTypeValues,
    'BILLING_ITEM_TO_DOCUMENT',
    'Edge types should contain BILLING_ITEM_TO_DOCUMENT'
  );
  assertContains(
    edgeTypeValues,
    'BILLING_TO_JOURNAL',
    'Edge types should contain BILLING_TO_JOURNAL'
  );
  assertContains(
    edgeTypeValues,
    'BILLING_TO_PAYMENT',
    'Edge types should contain BILLING_TO_PAYMENT'
  );

  console.log('✓ Edge types match frozen vocabulary\n');

  // ========================================================================
  // 3. Relationship Rules
  // ========================================================================
  console.log('Checking Relationship Rules...');

  assertLength(
    GRAPH_RELATIONSHIPS,
    6,
    'GRAPH_RELATIONSHIPS should have exactly 6 rules'
  );

  // Rule 1: SalesOrder -> SalesOrderItem
  assertEqual(
    GRAPH_RELATIONSHIPS[0].sourceType,
    'SalesOrder',
    'Rule 1: sourceType should be SalesOrder'
  );
  assertEqual(
    GRAPH_RELATIONSHIPS[0].targetType,
    'SalesOrderItem',
    'Rule 1: targetType should be SalesOrderItem'
  );
  assertEqual(
    GRAPH_RELATIONSHIPS[0].edgeType,
    'ORDER_TO_ITEM',
    'Rule 1: edgeType should be ORDER_TO_ITEM'
  );

  // Rule 2: SalesOrderItem -> DeliveryItem
  assertEqual(
    GRAPH_RELATIONSHIPS[1].sourceType,
    'SalesOrderItem',
    'Rule 2: sourceType should be SalesOrderItem'
  );
  assertEqual(
    GRAPH_RELATIONSHIPS[1].targetType,
    'DeliveryItem',
    'Rule 2: targetType should be DeliveryItem'
  );
  assertEqual(
    GRAPH_RELATIONSHIPS[1].edgeType,
    'ITEM_TO_DELIVERY',
    'Rule 2: edgeType should be ITEM_TO_DELIVERY'
  );

  // Rule 3: DeliveryItem -> BillingDocumentItem
  assertEqual(
    GRAPH_RELATIONSHIPS[2].sourceType,
    'DeliveryItem',
    'Rule 3: sourceType should be DeliveryItem'
  );
  assertEqual(
    GRAPH_RELATIONSHIPS[2].targetType,
    'BillingDocumentItem',
    'Rule 3: targetType should be BillingDocumentItem'
  );
  assertEqual(
    GRAPH_RELATIONSHIPS[2].edgeType,
    'DELIVERY_TO_BILLING_ITEM',
    'Rule 3: edgeType should be DELIVERY_TO_BILLING_ITEM'
  );

  // Rule 4: BillingDocumentItem -> BillingDocument
  assertEqual(
    GRAPH_RELATIONSHIPS[3].sourceType,
    'BillingDocumentItem',
    'Rule 4: sourceType should be BillingDocumentItem'
  );
  assertEqual(
    GRAPH_RELATIONSHIPS[3].targetType,
    'BillingDocument',
    'Rule 4: targetType should be BillingDocument'
  );
  assertEqual(
    GRAPH_RELATIONSHIPS[3].edgeType,
    'BILLING_ITEM_TO_DOCUMENT',
    'Rule 4: edgeType should be BILLING_ITEM_TO_DOCUMENT'
  );

  // Rule 5: BillingDocument -> JournalEntry
  assertEqual(
    GRAPH_RELATIONSHIPS[4].sourceType,
    'BillingDocument',
    'Rule 5: sourceType should be BillingDocument'
  );
  assertEqual(
    GRAPH_RELATIONSHIPS[4].targetType,
    'JournalEntry',
    'Rule 5: targetType should be JournalEntry'
  );
  assertEqual(
    GRAPH_RELATIONSHIPS[4].edgeType,
    'BILLING_TO_JOURNAL',
    'Rule 5: edgeType should be BILLING_TO_JOURNAL'
  );

  // Rule 6: BillingDocument -> Payment
  assertEqual(
    GRAPH_RELATIONSHIPS[5].sourceType,
    'BillingDocument',
    'Rule 6: sourceType should be BillingDocument'
  );
  assertEqual(
    GRAPH_RELATIONSHIPS[5].targetType,
    'Payment',
    'Rule 6: targetType should be Payment'
  );
  assertEqual(
    GRAPH_RELATIONSHIPS[5].edgeType,
    'BILLING_TO_PAYMENT',
    'Rule 6: edgeType should be BILLING_TO_PAYMENT'
  );

  console.log('✓ Relationship rules match canonical config in correct order\n');

  // ========================================================================
  // 4. O2C Traversal Chain
  // ========================================================================
  console.log('Checking O2C Traversal Chain...');

  // Linear chain: Rule 1 → Rule 2 → Rule 3 → Rule 4 → Rule 5
  const chainRule0Target = GRAPH_RELATIONSHIPS[0].targetType;
  const chainRule1Source = GRAPH_RELATIONSHIPS[1].sourceType;
  assertEqual(
    chainRule0Target,
    chainRule1Source,
    'Chain link 1→2: Rule 1 target should equal Rule 2 source'
  );

  const chainRule1Target = GRAPH_RELATIONSHIPS[1].targetType;
  const chainRule2Source = GRAPH_RELATIONSHIPS[2].sourceType;
  assertEqual(
    chainRule1Target,
    chainRule2Source,
    'Chain link 2→3: Rule 2 target should equal Rule 3 source'
  );

  const chainRule2Target = GRAPH_RELATIONSHIPS[2].targetType;
  const chainRule3Source = GRAPH_RELATIONSHIPS[3].sourceType;
  assertEqual(
    chainRule2Target,
    chainRule3Source,
    'Chain link 3→4: Rule 3 target should equal Rule 4 source'
  );

  const chainRule3Target = GRAPH_RELATIONSHIPS[3].targetType;
  const chainRule4Source = GRAPH_RELATIONSHIPS[4].sourceType;
  assertEqual(
    chainRule3Target,
    chainRule4Source,
    'Chain link 4→5: Rule 4 target should equal Rule 5 source'
  );

  // Rule 5 and 6 both fan out from BillingDocument (parallel outputs)
  const fanSourceRule5 = GRAPH_RELATIONSHIPS[4].sourceType;
  const fanSourceRule6 = GRAPH_RELATIONSHIPS[5].sourceType;
  assertEqual(
    fanSourceRule5,
    fanSourceRule6,
    'Fanout: Both Rule 5 and Rule 6 should originate from BillingDocument'
  );

  console.log('✓ O2C traversal chain is continuous and correct\n');

  // ========================================================================
  // SUCCESS
  // ========================================================================
  console.log('═══════════════════════════════════════════════════════════');
  console.log('✓ All graph contract invariants verified!');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\nProtected invariants:');
  console.log('  • Canonical node types (7 types)');
  console.log('  • Canonical edge types (6 types)');
  console.log('  • Relationship order (forward O2C traversal)');
  console.log('  • Relationship connections (sourceType → targetType)');
  console.log('  • Relationship vocabulary (edgeType)');
  console.log('  • O2C chain continuity\n');
}

verifyGraphContract().catch((error) => {
  console.error('\n✗ Fatal error:', error);
  process.exit(1);
});
