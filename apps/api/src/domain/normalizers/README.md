# Normalization Layer

Clean domain layer that transforms raw SAP records into consistent, well-typed domain objects.

## Purpose

- **Decouple business logic** from raw SAP field names
- **Enforce type safety** with canonical domain types  
- **Handle null values** safely across all entity types
- **Convert data types** (strings → numbers, dates)
- **Future-proof** the application architecture

## Structure

```
normalizers/
├── types.ts              # Canonical domain type definitions
├── normalizers.ts        # All normalizer functions
├── index.ts              # Public API exports
└── [individual files]    # Modular function definitions (for compiled output)
```

## Types

Canonical domain types that never reference raw SAP field names:

- **SalesOrder** - Order header (id, customerId, createdAt)
- **SalesOrderItem** - Order line item (id, orderId, productId, quantity)
- **DeliveryHeader** - Delivery header (id, createdAt)
- **DeliveryItem** - Delivery line item (id, deliveryId, orderId, quantity)
- **BillingDocument** - Billing header (id, accountingDocument, amount)
- **BillingDocumentItem** - Billing line item (id, billingDocumentId, deliveryDocumentId, quantity)
- **JournalEntry** - Accounting entry (id, accountingDocument, amount)
- **Payment** - Payment record (id, accountingDocument, amount)

## Normalizer Functions

Each normalizer transforms a raw SAP record into a clean domain object:

```typescript
// Raw SAP record with native field names
const raw = {
  salesOrder: "740506",
  soldToParty: "310000108",
  creationDate: "2025-03-31T00:00:00.000Z",
  ...120 other fields
}

// Clean domain object with stable field names
const normalized = normalizeSalesOrder(raw);
// {
//   id: "740506",
//   customerId: "310000108",
//   createdAt: Date(2025-03-31)
// }
```

## Rules

✅ **DO:**
- Use normalizers at data boundaries (loading, API responses)
- Return null safely for missing values
- Convert strings to appropriate types
- Always return consistent object shape

❌ **DON'T:**
- Use raw SAP field names in business logic
- Mix raw + normalized fields in same operation
- Hardcode field lookups outside normalizers
- Modify raw records instead of normalizing

## Usage

### In TypeScript (compiled code)

```typescript
import {
  normalizeSalesOrder,
  normalizeBillingDocument,
  type SalesOrder,
  type BillingDocument,
} from './normalizers';

// Load and normalize
const raw = await loadRaw('sales_order');
const order: SalesOrder = normalizeSalesOrder(raw);
```

### In ts-node scripts

Functions are embedded directly in scripts to avoid module resolution issues:

```typescript
function normalizeSalesOrder(raw: any) {
  return {
    id: String(raw.salesOrder || ''),
    customerId: String(raw.soldToParty || raw.customer || '') || null,
    createdAt: raw.creationDate ? new Date(raw.creationDate) : null,
  };
}
```

## Design

- **Pure functions** - No side effects, deterministic output
- **Defensive parsing** - Handles missing/malformed data gracefully
- **Type-safe** - Full TypeScript support with exported types
- **Modular** - Each entity type has dedicated normalizer
- **Testable** - Can test normalization independently from data loading

## Future

When moving to compiled output:
1. Import normalizers from this module
2. Remove embedded functions from scripts
3. Use shared normalizers across API routes, workers, etc.
4. Add validation layer (zod/yup) on top if needed
