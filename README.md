# Veerox Autonomous Trading Intelligence (ATI)

**Veerox ATI** is an enterprise AI-powered autonomous trading platform. 
The objective of Veerox ATI is to build a world-class enterprise trading platform capable of managing multiple organizations and workspaces, connecting securely to MetaTrader 5, collecting and analyzing live trading and market data, using AI to recommend trading strategies and Expert Advisors, performing deterministic risk analysis, and executing approved trades through MT5.

## Repository Structure

This repository uses a monorepo architecture managed by **pnpm workspaces** and **Turborepo**.

```text
veerox-ati/
├── apps/               # Frontend applications
│   ├── web/            # Main web application (Next.js)
│   └── admin/          # Administration portal (Next.js)
├── services/           # Backend microservices (NestJS)
│   ├── identity-service/
│   ├── organization-service/
│   └── workspace-service/
├── packages/           # Shared libraries and configurations
│   ├── config/         # Shared TypeScript/ESLint/Prettier config
│   ├── contracts/      # API/Service contracts
│   ├── events/         # Domain event schemas
│   ├── sdk/            # Shared SDKs
│   ├── shared/         # Shared utilities and types
│   └── ui/             # Shared UI components
├── agents/             # External agent components
│   └── veerox-agent/   # MT5 Agent implementation
├── infrastructure/     # Infrastructure as Code (IaC) and deployments
├── docs/               # Project documentation
├── scripts/            # Build and maintenance scripts
└── tools/              # Internal developer tools
```

## Technology Overview

- **Frontend:** Next.js 16+, React 19, TypeScript, Tailwind CSS v4
- **Backend:** NestJS, TypeScript, Prisma, PostgreSQL, Redis, RabbitMQ
- **Monorepo Tools:** pnpm, Turborepo
- **Architecture:** Clean Architecture, Domain-Driven Design (DDD), CQRS, Event-Driven

## Development Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0

## Common Commands

The repository provides a single root mechanism to manage all packages and services.

### Install Dependencies
```bash
pnpm install
```

### Start Development
```bash
pnpm run dev
```

### Build all packages/apps/services
```bash
pnpm run build
```

### Run Tests
```bash
pnpm run test
```

### Run Lint & Type Checks
```bash
pnpm run lint
pnpm run typecheck
```

## Documentation

For architectural guidelines, coding standards, and detailed project context, refer to:
- [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)
- [DEVELOPMENT_ROADMAP.md](./DEVELOPMENT_ROADMAP.md)
- [CLAUDE_RULES.md](./CLAUDE_RULES.md)
