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

## Deployment

This monorepo is designed for split deployment: the API on Render and the web frontend on Vercel, with PostgreSQL on Render or Neon.

### Production Architecture

```
┌─────────────────────┐
│   Vercel (Web)      │
│   Next.js Frontend  │
│  (apps/web)         │
└──────────┬──────────┘
           │ NEXT_PUBLIC_API_URL
           │
┌──────────▼──────────┐
│   Render (API)      │
│  Express.js Server  │
│   (apps/api)        │
└──────────┬──────────┘
           │
┌──────────▼──────────────────┐
│  Render Postgres / Neon     │
│  (Managed PostgreSQL)       │
└─────────────────────────────┘
```

### Prerequisites

- **Render Account** (render.com) - for API deployment
- **Vercel Account** (vercel.com) - for web deployment
- **PostgreSQL Database** - Render Postgres or Neon (neon.tech)
- **GitHub** - repository linked to both services for CI/CD

### Deploy API on Render

1. **Prepare Database**:
   - Create a PostgreSQL database on Render or Neon
   - Copy the connection string (DATABASE_URL)

2. **Connect Repository to Render**:
   - Log in to Render
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select this repository

3. **Configure API Service**:
   - **Name**: `o2c-graph-api` (or your choice)
   - **Runtime**: Node
   - **Build Command**: (automatically populated from `render.yaml`)
     ```
     pnpm install --frozen-lockfile && pnpm --filter db generate && pnpm --filter graph build && pnpm --filter llm build && pnpm --filter api build
     ```
   - **Start Command**: (automatically populated from `render.yaml`)
     ```
     pnpm --filter api start
     ```
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `PORT`: `4000`
     - `DATABASE_URL`: (paste your Postgres connection string)
     - `LLM_API_KEY`: (if using real LLM service)
     - `LLM_MODEL`: `gpt-4` (or your chosen model)

4. **Run Migrations**:
   - After first deployment, manually run in Render shell:
     ```
     pnpm --filter db migrate:prod
     ```
   - Or add pre-deploy script to `render.yaml` if Render supports it

5. **Ingest Data** (Optional):
   - Connect to Render shell and run:
     ```
     pnpm --filter api ingest
     ```
   - This populates the database with example O2C data

6. **Verify Deployment**:
   - Check health: `GET {your-render-url}/health`
   - Verify graph: `GET {your-render-url}/graph`
   - Save your API URL (e.g., `https://o2c-graph-api.onrender.com`)

### Deploy Web on Vercel

1. **Connect Repository to Vercel**:
   - Log in to Vercel
   - Click "Add New..." → "Project"
   - Import your GitHub repository
   - Select this repository

2. **Configure Web App**:
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: `./apps/web`
   - **Build Command**: `pnpm --filter web build`
   - **Install Command**: `pnpm install --frozen-lockfile`

3. **Set Environment Variables**:
   - `NEXT_PUBLIC_API_URL`: Your Render API URL (e.g., `https://o2c-graph-api.onrender.com`)

4. **Deploy**:
   - Click "Deploy"
   - Vercel will build and deploy your Next.js app
   - Save your web URL (e.g., `https://o2c-graph-app.vercel.app`)

### Environment Variables

#### API Server (`apps/api`)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | Yes | `postgresql://user:pwd@host:5432/graph_db` | PostgreSQL connection string |
| `NODE_ENV` | Yes | `production` | Set to `production` in Render |
| `PORT` | No | `4000` | Default: 4000 |
| `LLM_API_KEY` | No | `sk-...` | Only if using real LLM service |
| `LLM_MODEL` | No | `gpt-4` | Only if using real LLM service |

#### Web Frontend (`apps/web`)

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `NEXT_PUBLIC_API_URL` | Yes | `https://o2c-graph-api.onrender.com` | Must be public; accessible from browser |

### Database Setup

1. **Create PostgreSQL Database**:
   - **Render Postgres**: Use Render dashboard to create a PostgreSQL instance
   - **Neon**: Use Neon dashboard to create a project and database
   - Copy the connection string (DATABASE_URL)

2. **Run Migrations**:
   ```bash
   # Local development
   pnpm --filter db migrate:prod
   
   # Or via Render shell after deployment
   pnpm --filter db migrate:prod
   ```

3. **Ingest Example Data** (Optional):
   ```bash
   # Local development
   pnpm --filter api ingest
   
   # Or via Render shell
   pnpm --filter api ingest
   ```

### Post-Deploy Checklist

After deploying both API and web app, verify everything works:

- **API Health**
  - [ ] `GET {api-url}/health` returns `{ "status": "ok" }`
  - [ ] Response time < 200ms

- **Graph Inspection**
  - [ ] `GET {api-url}/graph` returns graph statistics
  - [ ] Response includes `data.totalNodes` and `data.totalEdges`

- **Query Execution**
  - [ ] `POST {api-url}/query` accepts structured query
  - [ ] `POST {api-url}/query/nl` accepts natural language query

- **Frontend Connectivity**
  - [ ] Web app loads at `{web-url}`
  - [ ] Query panel submits queries successfully
  - [ ] Graph panel displays graph data
  - [ ] Results render without errors

- **Database Integrity**
  - [ ] Database contains data after ingestion
  - [ ] Health endpoint shows connection: `{ "status": "ok" }`

### Rolling Back

If you need to roll back a deployment:

- **Render**: Navigate to "Deploys" tab, click previous successful deploy, click "Redeploy"
- **Vercel**: Navigate to "Deployments" tab, click previous successful deploy, click "Redeploy"

### Monitoring

- **Render**: Check "Logs" tab for API errors
- **Vercel**: Check "Analytics" and "Functions" tabs for frontend issues
- **Database**: Check query logs in Render Postgres or Neon console

## License

TBD

## Contact

For questions, please file an issue in the repository.
