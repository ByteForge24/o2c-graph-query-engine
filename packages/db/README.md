# Database Package

## Setup

1. Install dependencies:
   ```
   pnpm install
   ```

2. Update `.env` with your PostgreSQL connection string

3. Generate Prisma client:
   ```
   pnpm generate
   ```

4. Run migrations:
   ```
   pnpm migrate
   ```

## Commands

- `pnpm generate` - Generate Prisma client
- `pnpm migrate` - Run migrations in development
- `pnpm migrate:prod` - Run migrations in production
- `pnpm studio` - Open Prisma Studio UI
