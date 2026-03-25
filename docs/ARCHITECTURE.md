# Architecture & Design Decisions

## System Overview

```
┌─────────────────┐
│   Frontend      │
│  (Next.js/React)│
└────────┬────────┘
         │ HTTP/JSON
         ↓
┌─────────────────┐
│   API Server    │
│  (Express.js)   │
└────────┬────────┘
         │
    ┌────┴────────────────────┐
    ↓                          ↓
┌──────────────┐      ┌─────────────────┐
│ Graph Query  │      │   NL Translator │
│  Execution   │      │   (Placeholder) │
└──────────────┘      └─────────────────┘
    ↓                          │
┌──────────────┐               │
│  Graph Data  │←──────────────┘
│ (In-Memory   │
│  or DB-Based)│
└──────────────┘
    ↓
┌──────────────┐
│  Prisma DB   │
│  (Postgres)  │
└──────────────┘
```

## Core Design Principles

### 1. Determinism
- **Definition**: Same query + same data = always same result
- **Implementation**: Pure functions, no randomness, evidence-based results
- **Benefit**: Reproducible, testable, auditable
- **Trade-off**: Cannot use true randomness; no probabilistic algorithms

### 2. Separation of Concerns
- **LLM is Translator, Not Source of Truth**
  - Translator converts NL → query shape
  - Validator checks shape correctness
  - Executor runs deterministic logic
  - Each layer independent and replaceable
- **Benefits**:
  - Easy to switch LLM providers
  - Testable without LLM
  - Clear responsibility boundaries

### 3. Type Safety
- **Goal**: Catch errors at compile time, not runtime
- **Implementation**: Strict TypeScript across all packages
- **Frozen Vocabulary**: Node/edge types cannot be extended at runtime
- **Shared Types**: Frontend/backend use same contracts

### 4. Evidence-Based Results
- **Every Query Result Includes**:
  - Visited nodes (which we traversed)
  - Traversed edges (which connections we followed)
  - Paths (complete routes from start to match)
  - Matches (what we found)
  - Missing flows (what should have been there but wasn't)
- **Benefit**: Users can see exactly why a result was computed

### 5. Composition Over Inheritance
- **Small, Focused Functions**: Each does one thing well
- **Clear Contracts**: Types define integration points
- **Easy Extension**: Add capabilities without modifying existing code

## Key Components

### Graph Vocabulary (`packages/graph/src/vocabulary.ts`)
- **Purpose**: Canonical, frozen O2C entity types
- **Immutable**: Cannot be extended at runtime
- **Consumed By**: All builders, queries, and formatters
- **Example**:
  ```typescript
  const GRAPH_NODE_TYPES = {
    SALES_ORDER: 'SalesOrder',
    PAYMENT: 'Payment',
    // ... all other O2C types
  } as const
  ```

### Query Contracts (`packages/graph/src/query.ts`)
- **Purpose**: Define request/response shapes for queries
- **Request**: `GraphQueryRequest` specifies traversal intent
- **Response**: `GraphQueryResult` includes matches + evidence
- **Intents**: trace_forward, trace_backward, find_related, detect_missing_flow

### Graph Builders
- **In-Memory** (`packages/graph/src/indexing.ts`): For testing
- **DB-Backed** (`apps/api/src/graph/buildGraphFromDb.ts`): For production
- **Contract**: Both produce same graph structure from different sources

### Translator (`packages/llm/src/translator.ts`)
- **Current**: Deterministic pattern matching (Phase 4.3)
- **Future**: Can be replaced with real LLM
- **Contract**: NL input → NlQueryTranslationResult (status + optional query)
- **Fail Modes**: Returns 'unsupported' or 'ambiguous' safely

### API Handlers
- **Structured** (`apps/api/src/controllers/query.ts`): Direct query execution
- **NL** (`apps/api/src/controllers/nlQuery.ts`): Translation + execution
- **Both**: Use same execution engine, different input paths

## Data Flow Examples

### Example 1: Structured Query
```
Frontend
  ↓ (JSON)
{ intent: 'trace_forward', startNode: { type: 'SalesOrder', id: '740506' }, ... }
  ↓ POST /query
API: validateGraphQueryRequest()
  ↓ (valid request)
API: buildGraphFromDb()
  ↓ (graph)
Graph: executeGraphQuery()
  ↓ (result with paths/matches/evidence)
Response: { success: true, data: GraphQueryResult }
  ↓
Frontend: Display paths and matches
```

### Example 2: NL Query
```
Frontend
  ↓ (text)
"show payment for order 740506"
  ↓ POST /query/nl
API: translateNaturalLanguageToQuery()
  ↓ (translation result)
If status !== 'translated':
  → Return { success: false, translation: {...} }
  
If status === 'translated':
  ↓
API: buildGraphFromDb()
  ↓ (graph)
Graph: executeGraphQuery()
  ↓ (result)
Response: { success: true, translation: {...}, data: {...} }
  ↓
Frontend: Display translation status + results
```

## Error Handling Strategy

### Levels
1. **Type Errors** (compile-time): Caught by TypeScript
2. **Validation Errors** (runtime): Checked before execution
3. **Execution Errors** (runtime): Graph issues (missing nodes, etc.)
4. **Translation Errors** (safe): Unsupported/ambiguous input

### Response Patterns
```typescript
// Type error response (compile time)
// → Never reaches runtime

// Validation error response (runtime)
{ ok: false, error: 'startNode not found' }

// Execution error response
{ ok: false, error: 'traversal failed: disconnected graph' }

// Success response
{ ok: true, matches: [...], paths: [...], evidence: {...} }

// NL unsupported response
{ success: false, translation: { status: 'unsupported', reason: '...' } }
```

## Scalability Considerations

### Current Approach (Phase 4.x)
- Single in-process graph
- Suitable for: Medium-sized O2C flows (thousands of documents)
- Limitation: All data loaded into memory for each query

### Future Optimization (Phase 5+)
- Distributed graph querying
- Caching layer (Redis)
- Streaming result delivery (WebSocket)
- Query parallel execution

## Testing Philosophy

### Test Levels
1. **Unit**: Individual functions (vocabulary, validators)
2. **Integration**: Graph building and querying workflows
3. **E2E**: Full API endpoints

### Key Test Scenarios
- Valid queries execute correctly
- Invalid queries fail safely
- Missing nodes are detected
- Missing flows are identified
- Depth limits work
- Both traversal directions work
- Evidence collection is complete

## Extensibility Points

### Adding New Query Intent
1. Add to `QueryIntent` type
2. Implement in `executeGraphQuery()`
3. Add validation logic
4. Add E2E tests

### Adding New NL Pattern (Phase 4.3+)
1. Add regex pattern to `SUPPORTED_PATTERNS`
2. Define extraction logic
3. Map to `GraphQueryRequest` shape
4. Test with frontend

### Replacing Translator
1. Implement `NlQueryTranslationResult` contract
2. Swap implementation in `apps/api/src/controllers/nlQuery.ts`
3. No other changes needed

### Adding New Node Type
**⚠️ Breaking Change**: Frozen vocabulary prevents easy addition
- Must update: `vocabulary.ts`, database schema, all builders
- Must update: Any code that assumes fixed set of types

## Performance Trade-Offs

### Current Design Choices
| Choice | Benefit | Cost |
|--------|---------|------|
| Eager graph building | Easy querying | High memory |
| In-memory traversal | Fast queries | Single machine |
| Full evidence collection | Debuggable results | Extra computation |
| Deterministic-only | Reproducible | No ML models |
| Whitelist translator | Safe translations | Limited NL coverage |

### Scaling Options
1. **Larger machines**: More memory for bigger graphs
2. **Lazy loading**: Load subgraphs on demand
3. **Distributed**: Multiple graph instances with sharding
4. **Caching**: Cache common query results
5. **Streaming**: Return results progressively

