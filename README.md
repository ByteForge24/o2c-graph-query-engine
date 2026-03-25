# O2C Graph Query Engine

A deterministic order-to-cash (O2C) flow analysis engine with natural-language query translation. This project implements a structured graph traversal system for tracing business document flows and detecting missing process steps.

## Architecture Overview

### Core Principles

- **Deterministic Execution**: All queries produce reproducible results based on database state
- **Separated Concerns**: Translation (LLM) is separate from execution and validation
- **Type-Safe**: Full TypeScript support across all packages
- **Monorepo Structure**: Shared packages for graph contracts, API logic, and database schemas

### Project Structure

```
graph-app/
├── apps/
│   ├── api/         # Express.js backend API server
│   └── web/         # Next.js React frontend application
├── packages/
│   ├── graph/       # Core graph query contracts and execution
│   ├── llm/         # Natural language translation layer
│   └── db/          # Database schema and Prisma setup
└── docs/            # Documentation and phase descriptions
```

## Features

### Phase 1-2: Graph Infrastructure
- Frozen vocabulary of O2C node and edge types
- Canonical relationship rules for forward and backward traversal
- In-memory graph building for testing

### Phase 3: Deterministic Query Engine
- Structured query request/response contracts
- Graph traversal with depth limits and directional control
- Query validation and execution layer
- Support for core intents: `trace_forward`, `trace_backward`, `find_related`, `detect_missing_flow`

### Phase 4: Database Integration
- Prisma-based database schema with O2C entities
- DB-backed graph builder for production use
- Data ingestion scripts

### Phase 5-6: API Layer
- RESTful endpoints for structured graph queries
- Health checks and graph inspection
- Error handling and logging

### Phase 7-8: Natural Language Translation
- Deterministic NL-to-query translator with whitelist patterns
- Translation contract types: `translated`, `ambiguous`, `unsupported`
- Placeholder translator (no external LLM yet)

### Phase 9: Integrated NL Query Endpoint
- POST `/query/nl` endpoint combining translation + execution
- Translation metadata in responses
- Safe failure modes

### Phase 10: Frontend Query Panel
- Structured JSON query mode with presets
- Natural language query mode with examples
- Real-time response display with full JSON debug output

### Phase 11: Frontend Guardrails
- Supported scope guidance panel
- Color-coded translation status feedback
- Actionable hints for ambiguous/unsupported queries
- Visual status badges

### Phase 12: Frontend Type Safety
- Typed API response envelopes
- Reused shared types from `graph` and `llm` packages
- No loose `any` types in response handling

## Supported NL Patterns (Phase 4.3+)

The placeholder translator recognizes these deterministic patterns:

| Input | Intent | Example |
|-------|--------|---------|
| Payment for order | `trace_forward` | "show payment for order 740506" |
| Delivery for order | `trace_forward` | "find delivery for order 740506" |
| Billing back to order | `trace_backward` | "trace billing 90504274 back to order" |
| Missing payment | `detect_missing_flow` | "is payment missing for billing 90504274" |

## Development

### Prerequisites
- Node.js 18+
- pnpm
- Prisma CLI

### Setup
```bash
pnpm install
pnpm --filter graph build
pnpm --filter api build
pnpm --filter web build
```

### Running

**API Server** (runs on http://localhost:4000):
```bash
cd apps/api
pnpm dev
```

**Frontend** (runs on http://localhost:3000):
```bash
cd apps/web
pnpm dev
```

### Testing
```bash
pnpm test
```

### Database

Initialize Prisma database:
```bash
cd packages/db
pnpm db:push
```

Ingest example data:
```bash
cd apps/api
pnpm ingest
```

## API Endpoints

### Health & Info
- `GET /health` - Server health check
- `GET /graph` - Retrieve built graph structure
- `GET /test-db` - Quick database connectivity test

### Queries
- `POST /query` - Execute structured deterministic query
  ```json
  {
    "intent": "trace_forward",
    "startNode": { "type": "SalesOrder", "id": "740506" },
    "targetNodeType": "Payment",
    "direction": "outbound",
    "maxDepth": 6
  }
  ```

- `POST /query/nl` - Execute natural language query
  ```json
  { "input": "show payment for order 740506" }
  ```

## Response Contracts

### Structured Query Response
```typescript
{
  success: boolean
  data?: GraphQueryResult
  timestamp: string
  error?: string
}
```

### NL Query Response
```typescript
{
  success: boolean
  translation?: NlQueryTranslationResult
  data?: GraphQueryResult
  timestamp: string
  error?: string
}
```

## Type Definitions

All core type definitions are exported from shared packages:

**From `graph` package**:
- `GraphQueryRequest` - Deterministic query specification
- `GraphQueryResult` - Execution result with evidence
- `GraphNode`, `GraphEdge` - Graph structure types

**From `llm` package**:
- `NlQueryTranslationResult` - Translation output
- `NlQueryTranslationStatus` - Status values

## Implementation Timeline

### Phases 1-2: Foundation (Graph Vocabulary & Schema)
- Define frozen vocabulary for O2C node/edge types
- Establish relationship rules between entities
- Type-safe graph representation

### Phases 3-4: Query Engine (Deterministic Execution)
- Implement query request/response contracts
- Build graph traversal with depth control
- Support all core query intents
- Query validation layer

### Phases 5-6: Persistence (Database Integration)
- Prisma schema for O2C entities
- In-memory vs DB-backed graph builders
- Data ingestion from business systems

### Phases 7-9: NL Translation & API
- Translation contract and placeholder translator
- NL query endpoint combining translation + execution
- Structured query API endpoint

### Phases 10-12: Frontend & UX
- Query panel with structured/NL mode switching
- NL guardrails and colored feedback
- Type-safe frontend response handling

## Future Enhancements

### Phase 5 (Planning)
- Real LLM integration (Gemini, Groq, or other)
- User authentication and session management
- Query history and saved query templates
- Advanced filtering and aggregation
- Custom analysis operators

### Phase 6 (Planning)
- WebSocket support for streaming results
- Pub/Sub for real-time graph updates
- Advanced caching strategies
- Performance optimization for large graphs

## License

TBD

## Contact

For questions, please file an issue in the repository.
