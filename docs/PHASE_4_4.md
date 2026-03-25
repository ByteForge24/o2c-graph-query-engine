# Phase 4.4: Backend Natural Language Query Endpoint

## Objective
Implement the backend API endpoint that accepts natural language queries, translates them, validates the translation, executes the resulting graph query, and returns combined results with translation metadata.

## Implementation

### New Files
- `apps/api/src/controllers/nlQuery.ts` - NL query request handler

### API Endpoint
- **Route**: `POST /query/nl`
- **Content-Type**: `application/json`
- **Request Body**: `{ input: string }`
- **Response**: Combined translation + execution results

### NL Query Execution Flow (6 Steps)

1. **Validate Input**: Ensure input string is non-empty (min 3 chars)
2. **Translate**: Call `translateNaturalLanguageToQuery()` from `llm` package
3. **Check Translation Status**: 
   - If `ambiguous` or `unsupported` → Return safe response with metadata
   - If `translated` → Proceed to execution
4. **Build Graph**: Initialize graph with database data
5. **Execute Query**: Run the translated `GraphQueryRequest` on the graph
6. **Format Response**: Combine translation result + execution data

### Response Structure
```typescript
interface NlQueryResponse {
  success: boolean;
  translation: NlQueryTranslationResult;
  data?: GraphQueryResult;
  timestamp: string;
  error?: string;
}
```

### Key Design Decisions
- **Safe Failure**: Only executes queries with `translated` status
- **Translation Transparency**: Always includes translation metadata in response
- **Reuses Execution Engine**: Leverages existing graph traversal logic
- **No Translation Caching**: Fresh translation for every request (deterministic anyway)

### Integration Points
- Depends on: `llm` package (translation), `graph` package (execution)
- Exports: Route registration to `routes/index.ts`

## Status
✅ Complete - Backend accepting NL queries, executing only safe translations, returning proper responses
