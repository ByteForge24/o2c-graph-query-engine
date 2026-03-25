# Phase 4.3: Natural Language Translation Contract

## Objective
Establish a deterministic, placeholder-based translation layer that converts natural language queries (NL) into structured query objects. This phase introduces the core `NlQueryTranslationResult` type and a whitelist-based regex matching translator.

## Implementation

### New Files
- `packages/llm/src/translator.ts` - Core translation logic

### Key Contracts

```typescript
type NlQueryTranslationStatus = 'translated' | 'ambiguous' | 'unsupported';

interface NlQueryTranslationResult {
  status: NlQueryTranslationStatus;
  query?: GraphQueryRequest;
  reason?: string;
  intent?: string;
}
```

### Translation Engine Features
- **Deterministic Execution**: Same NL input always produces the same output
- **Whitelist-Based Patterns**: Only 4 supported NL patterns translate successfully
- **Three-State Response**: Indicates whether translation was successful, ambiguous, or unsupported
- **Safe Failure Mode**: Invalid patterns never attempt execution

### Supported Patterns
1. "show payment" - Display all payments in the graph
2. "find delivery" - Locate delivery nodes with full chain context
3. "trace billing" - Show billing document flow
4. "missing payment" - Detect unmatched payment events

### Design Rationale
- **No Machine Learning**: Uses deterministic regex matching to guarantee reproducibility
- **Explicit Vocabulary**: Every supported phrase is hardcoded, enabling clear scope definition
- **Extensibility**: New patterns added as simple regex entries + query builders

## Status
✅ Complete - All patterns working, three translation statuses properly returned
