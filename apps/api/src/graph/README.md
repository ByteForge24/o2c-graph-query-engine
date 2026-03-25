# Graph Builder Module

Converts normalized domain objects → graph (nodes + edges) for O2C flow visualization and analysis.

## Purpose

- **Real graph structure** from normalized data
- **Node + Edge representation** with meaningful types
- **Pure in-memory** construction (no DB queries)
- **Type-safe** with Node type prefix IDs
- **Extensible** for additional entity types

## Architecture

**Input:** Normalized domain objects (arrays)

**Process:**
1. Create nodes for each entity with `type:id` naming
2. Build lookup maps by matching entity IDs
3. Create edges from relationship pairs
4. Return nodes + edges arrays

**Output:** `{ nodes: Node[], edges: Edge[] }`

## Types

### Node Structure
```typescript
type Node = {
  id: string;        // Format: "SalesOrder:740506"
  type: string;      // "SalesOrder", "DeliveryItem", etc.
  data: any;         // Entity-specific attributes
};
```

### Edge Structure
```typescript
type Edge = {
  source: string;    // Format: "SalesOrder:740506"
  target: string;    // Format: "SalesOrderItem:740506_10"
  type: string;      // "ORDER_TO_ITEM", "DELIVERY_TO_PAYMENT", etc.
};
```

## Valid Entity Types

- **SalesOrder** - Order header
- **SalesOrderItem** - Order line item
- **DeliveryItem** - Delivery line
- **BillingDocument** - Billing header
- **BillingDocumentItem** - Billing line
- **JournalEntry** - Accounting entry
- **Payment** - Payment record

## Edge Types

| Edge Type | Source | Target | Meaning |
|-----------|--------|--------|---------|
| ORDER_TO_ITEM | SalesOrder | SalesOrderItem | Order contains item |
| ITEM_TO_DELIVERY | SalesOrderItem | DeliveryItem | Item delivered |
| DELIVERY_TO_BILLING | DeliveryItem | BillingDocumentItem | Delivery billed |
| BILLING_TO_ITEM | BillingDocument | BillingDocumentItem | Billing contains item |
| BILLING_TO_JOURNAL | BillingDocument | JournalEntry | Billing → accounting |
| BILLING_TO_PAYMENT | BillingDocument | Payment | Billing → payment |

## Usage (Compiled Code)

```typescript
import { buildGraph } from '@/graph/buildGraph';
import {
  normalizeSalesOrder,
  normalizeBillingDocument,
  // ... other normalizers
} from '@/domain/normalizers';

const normalizedOrders = rawOrders.map(normalizeSalesOrder);
const normalizedItems = rawItems.map(normalizeSalesOrderItem);
// ... normalize all entities

const graph = buildGraph(
  normalizedOrders,
  normalizedItems,
  deliveryItems,
  billingDocuments,
  billingDocumentItems,
  journalEntries,
  payments
);

console.log(`Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);
```

## Real Graph Example

From test run with normalized data:

```
📊 Graph Summary:
  Total nodes: 314
  Total edges: 155

📍 Sample Nodes:
  SalesOrder:740506 (type: SalesOrder)
  SalesOrder:740507 (type: SalesOrder)
  ... (100 sales orders)
  SalesOrderItem:740506_10 (type: SalesOrderItem)  
  SalesOrderItem:740506_20 (type: SalesOrderItem)
  ... (79 order items)
  DeliveryItem:80738076_000010 (type: DeliveryItem)
  ... (58 delivery items)
  BillingDocument:90504248 (type: BillingDocument)
  ... (20 billing headers)
  BillingDocumentItem:90504298_10 (type: BillingDocumentItem)
  ... (20 billing items)
  JournalEntry:9400000220_1 (type: JournalEntry)
  ... (20 journal entries)
  Payment:9400000220_1 (type: Payment)
  ... (17 payments)

🔗 Sample Edges:
  SalesOrder:740506 → SalesOrderItem:740506_10 [ORDER_TO_ITEM]
  SalesOrder:740506 → SalesOrderItem:740506_20 [ORDER_TO_ITEM]
  SalesOrder:740506 → SalesOrderItem:740506_30 [ORDER_TO_ITEM]
  ... (more ORDER_TO_ITEM edges)
  SalesOrderItem:740506_10 → DeliveryItem:80738076_000010 [ITEM_TO_DELIVERY]
  ... (DELIVERY_TO_BILLING, BILLING_TO_JOURNAL, BILLING_TO_PAYMENT edges)
```

**Complete O2C Flow:**
```
SalesOrder → SalesOrderItem → DeliveryItem → BillingDocumentItem → BillingDocument → Payment
                                                                                    → JournalEntry
```

## Design Principles

✅ **No Raw SAP Fields** - Only normalized data used

✅ **Type-Prefixed IDs** - Enables unique global identifiers

✅ **Meaningful Edge Types** - Business semantics in relationships

✅ **Pure Functions** - Deterministic graph construction

✅ **In-Memory** - No I/O or database dependencies

✅ **Extensible** - Add new entity types via normalizers + buildGraph

## Implementation Notes

- Nodes use composite IDs (`type:id`) for global uniqueness
- Edges created via lookup maps matching normalized field values
- No implicit relationships - only explicit matches from data
- Handles null values gracefully (no dangling references)

## Files

- **buildGraph.ts** - Main module with `buildGraph()` export
- **/domain/normalizers** - Input data normalization
- **validateFlows.ts** - Test/demo script showing usage

## Next Steps

- **Traversal** - Query graph for paths (Order → Payment)
- **Visualization** - Render to SVG/D3.js
- **Validation** - Check data integrity (detect missing nodes)
- **Analytics** - Count flows, measure cycle time
- **For-each entity export** - Generate node/edge files for tools
