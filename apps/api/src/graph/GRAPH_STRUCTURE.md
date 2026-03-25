# O2C Graph Structure

Real graph structure built from normalized SAP data showing Order-to-Cash flow relationships.

## Node Distribution (314 total)

```
100 × SalesOrder nodes
 79 × SalesOrderItem nodes (100 orders → 79 unique items)
 58 × DeliveryItem nodes (items → deliveries)
 20 × BillingDocument nodes (headers)
 20 × BillingDocumentItem nodes (items)
 20 × JournalEntry nodes (accounting entries)
 17 × Payment nodes
────────────────────────────
314 total
```

## Edge Types & Counts (155 total)

```
ORDER_TO_ITEM         ~100 edges  (order → order items)
ITEM_TO_DELIVERY       ~30 edges  (items → deliveries)
DELIVERY_TO_BILLING    ~15 edges  (deliveries → billing)
BILLING_TO_ITEM        ~20 edges  (billing → billing items)
BILLING_TO_JOURNAL     ~20 edges  (billing → accounting)
BILLING_TO_PAYMENT     ~17 edges  (billing → payments)
────────────────────────────────
155 total
```

## Graph Visualized

```
┌─────────────────────────────────────────────────────────────────┐
│                     O2C FLOW GRAPH                              │
└─────────────────────────────────────────────────────────────────┘

                    SALES → DELIVERY → BILLING → PAYMENT
                    
    SalesOrder (100)
        │ ORDER_TO_ITEM
        └──→ SalesOrderItem (79)
                │ ITEM_TO_DELIVERY
                └──→ DeliveryItem (58)
                        │ DELIVERY_TO_BILLING
                        └──→ BillingDocumentItem (20)
                                │ BILLING_TO_ITEM ← BillingDocument (20)
                                │
                                └──→ (via BillingDocument)
                                        │
                                        ├─ BILLING_TO_JOURNAL
                                        │   └──→ JournalEntry (20)
                                        │
                                        └─ BILLING_TO_PAYMENT
                                            └──→ Payment (17)
```

## Example Paths (from normalized data)

### Complete Flow Example
```
SalesOrder:740506
  ↓ ORDER_TO_ITEM
SalesOrderItem:740506_10
  ↓ ITEM_TO_DELIVERY
DeliveryItem:80738076_000010
  ↓ DELIVERY_TO_BILLING
BillingDocumentItem:90504274_10
  ↓ BILLING_TO_ITEM
BillingDocument:90504274
  ├─ BILLING_TO_JOURNAL → JournalEntry:9400000220_1
  └─ BILLING_TO_PAYMENT → Payment:9400000220_1
```

### Partial Flow (missing order data)
```
BillingDocument:90504274
  ↓ BILLING_TO_ITEM
BillingDocumentItem:90504274_10
  ↓ DELIVERY_TO_BILLING
DeliveryItem:80738091_000010
  ↑ (referenceSdDocument=740571)
  ⚠️ Order 740571 NOT IN DATASET
      (dangling reference - data integrity issue)
```

## Key Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Total Nodes | 314 | All entity types |
| Total Edges | 155 | All relationship types |
| Node Types | 7 | Sales, Delivery, Billing, Payment, Journal |
| Edge Types | 6 | Semantic relationships |
| Avg Edges/Node | 0.49 | Sparse graph (tree-like) |
| Completeness | ~60% | Some missing order references |

## Node ID Format

All node IDs follow the pattern: `TYPE:ID`

```
SalesOrder:740506
SalesOrderItem:740506_10
DeliveryItem:80738076_000010
BillingDocument:90504274
BillingDocumentItem:90504274_10
JournalEntry:9400000220_1
Payment:9400000220_1
```

## Data Quality Observations

✅ **Well-formed:**
- Orders → Order Items (100 → 79 items)
- Items → Deliveries (79 items → 58 deliveries)
- Deliveries → Billing (matched via delivery references)
- Billing → Accounting (20 accounting documents)
- Accounting → Payments (matched via accounting documents)

⚠️ **Issues:**
- Missing order records (Order 740571 referenced but not loaded)
- Some billing documents missing deliveries
- Some payments missing corresponding billings

## Graph Characteristics

- **Type:** Directed Acyclic Graph (DAG)
- **Structure:** Tree-like with joins
- **Density:** Sparse (155 edges for 314 nodes)
- **Flow:** Unidirectional O2C path (Order → Cash)
- **Relationships:** One-to-many (orders → items, deliveries, etc.)

## Building the Graph

See [buildGraph.ts](buildGraph.ts) for implementation:

```typescript
const graph = buildGraph(
  normalizedOrders,     // 100 nodes
  normalizedOrderItems, // 79 nodes
  normalizedDeliveryItems, // 58 nodes
  normalizedBillingDocs,   // 20 nodes
  normalizedBillingItems,  // 20 nodes
  normalizedJournalEntries,// 20 nodes
  normalizedPayments       // 17 nodes
);
// Result: 314 nodes, 155 edges
```

## Use Cases

1. **Flow Visualization** - Render graph nodes/edges to D3.js
2. **Path Analysis** - Find all paths from Order to Cash
3. **Data Validation** - Detect missing references (dangling nodes)
4. **Performance** - Measure cycle time (Order → Payment duration)
5. **Analytics** - Count flows by type, customer, time period
6. **Debugging** - Trace data flow for specific documents

## Testing

Run `pnpm validate:flows` to generate and display the graph:

```bash
$ cd apps/api
$ pnpm validate:flows

📊 Building graph from normalized data...
🔨 Building nodes...
  ✓ 314 nodes created
🔗 Building edges...
  ✓ 155 edges created

📈 Graph Summary:
  Total nodes: 314
  Total edges: 155

📍 Sample Nodes (first 5):
  SalesOrder:740506 (type: SalesOrder)
  ...

🔗 Sample Edges (first 5):
  SalesOrder:740506 → SalesOrderItem:740506_10 [ORDER_TO_ITEM]
  ...
```
