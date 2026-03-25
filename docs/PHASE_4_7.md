# Phase 4.7: Frontend Response Type Safety

## Objective
Eliminate all loose `any` types in frontend response handling by defining explicit response envelopes and implementing proper TypeScript union type narrowing. Ensure compile-time safety for API response handling.

## Implementation

### New Type Contracts
In `apps/web/lib/api.ts`:

```typescript
interface StructuredQueryApiResponse {
  success: boolean;
  data?: GraphQueryResult;
  timestamp: string;
  error?: string;
}

interface NlQueryApiResponse {
  success: boolean;
  translation?: NlQueryTranslationResult;
  data?: GraphQueryResult;
  timestamp: string;
  error?: string;
}

type QueryApiResponse = StructuredQueryApiResponse | NlQueryApiResponse;
```

### Type Annotations
- **runQuery()**: Returns `Promise<StructuredQueryApiResponse>`
- **runNlQuery()**: Returns `Promise<NlQueryApiResponse>`
- **Response State**: Changed from `any` to `QueryApiResponse | null`

### Union Type Narrowing
In `ChatPanel.tsx`:
```typescript
if ('translation' in response && response.translation && ...) {
  // Type narrower ensures we're in NlQueryApiResponse branch
  // Can safely access response.translation properties
}
```

### Dependencies Added
- Added `llm: workspace:*` to `apps/web/package.json`
- Imports `NlQueryTranslationResult` from `llm` package

### Reused Types
- `GraphQueryResult` from `graph` package
- `NlQueryTranslationResult` from `llm` package
- Creates clear Type hierarchy across packages

### Type Safety Improvements
- **No Runtime Errors**: TypeScript catches property access on wrong union variant
- **IDE Support**: Full autocomplete for response properties
- **Self-Documenting**: Response types clearly show what each query mode returns
- **Strict Mode**: Passes TypeScript strict mode checking without errors

## Status
✅ Complete - All response handling type-safe, builds passing with strict TypeScript, ESLint checks passing
