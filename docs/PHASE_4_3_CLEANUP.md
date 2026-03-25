# Phase 4.3 Cleanup: Ambiguous Pattern Detection

## Objective
Enhance the translation layer to properly detect and handle ambiguous user queries that could match multiple interpretations. Ensure all three translation statuses (`translated`, `ambiguous`, `unsupported`) are actively used.

## Implementation

### Enhancement
Modified `packages/llm/src/translator.ts` to add ambiguous pattern detection before the supported pattern check.

### Key Addition: Ambiguous Patterns Array
```typescript
const ambiguousPatterns: AmbiguousPatternMatch[] = [
  {
    pattern: /show.*payment|payment.*status/i,
    reason: "Could refer to specific payment or all payments"
  },
  {
    pattern: /find.*delivery|where.*is.*delivery/i,
    reason: "Ambiguous: delivery location, status, or timeline?"
  },
  {
    pattern: /trace.*order|track.*order/i,
    reason: "Order tracing not fully supported - did you mean trace billing?"
  },
  {
    pattern: /what.*failed|find.*errors/i,
    reason: "Error analysis requires more context"
  }
];
```

### Translation Flow (Updated)
1. Validate input (required fields, length)
2. Check ambiguous patterns - return `ambiguous` status if matched
3. Check supported patterns - return `translated` with query if matched
4. Return `unsupported` status as default

### Behavior Changes
- Users receive **diagnostic feedback** for ambiguous patterns
- Suggestions guide them toward supported patterns
- Frontend can highlight ambiguous cases to guide user intent

## Design Impact
- **Three-State Responses Always Used**: No longer collapsed to binary translated/unsupported
- **User Guidance**: Ambiguous status + reason enables frontend to suggest alternatives
- **Safe Semantics**: Ambiguous queries never execute (no risk of unintended behavior)

## Status
✅ Complete - Returns all three statuses appropriately, tests passing
