# VEEROX ATI

**Document ID:** 022  
**Document Name:** Frontend Architecture Specification (FAS)  
**Version:** 1.0.0  
**Status:** Baseline

---

# 1. Purpose

This document defines the complete frontend architecture for the Veerox Autonomous Trading Intelligence (ATI) Platform.

It specifies:

- Application Architecture
- Project Structure
- Routing Strategy
- Component Architecture
- State Management
- Data Fetching
- Authentication Flow
- UI Composition
- Performance
- Security
- Testing

This document SHALL be the authoritative frontend implementation specification.

---

# 2. Technology Stack

The frontend SHALL be implemented using the following technologies.

| Category | Technology |
|----------|------------|
| Framework | Next.js 16+ (App Router) |
| Language | TypeScript |
| UI Library | React 19 |
| Styling | Tailwind CSS v4 |
| Component Library | shadcn/ui |
| Icons | Lucide React |
| Data Fetching | TanStack Query |
| Forms | React Hook Form + Zod |
| Charts | Apache ECharts |
| Tables | TanStack Table |
| Authentication | Clerk |
| Animation | Framer Motion |
| Real-Time | WebSocket + Server-Sent Events (SSE) |

---

# 3. Frontend Architecture Principles

The frontend SHALL follow:

- Component-Based Architecture
- Feature-Based Modules
- Server-First Rendering
- Progressive Enhancement
- Type Safety
- Accessibility by Default
- Reusable Design System
- Predictable State Management

Business logic SHALL remain on the backend whenever practical.

---

# 4. Project Structure

```text id="frontend-structure"
apps/web/

├── app/
│
├── components/
│
├── features/
│
├── hooks/
│
├── lib/
│
├── providers/
│
├── services/
│
├── stores/
│
├── styles/
│
├── types/
│
├── utils/
│
└── tests/
```

Feature modules SHALL remain isolated.

---

# 5. App Router Structure

```text id="app-router"
app/

(auth)/

(dashboard)/

(admin)/

(workspace)/

(api)/

(error.tsx)

(not-found.tsx)

(layout.tsx)

(page.tsx)
```

Each route group SHALL define its own layout where appropriate.

---

# 6. Feature Modules

Each feature SHALL contain:

```text id="feature-structure"
feature/

components/

hooks/

services/

schemas/

types/

utils/

tests/
```

Feature modules SHALL NOT depend directly on unrelated features.

---

# 7. Component Architecture

Components SHALL be classified as:

- UI Components
- Shared Components
- Feature Components
- Layout Components
- Page Components

Reusable UI elements SHALL reside exclusively within the shared design system.

---

# 8. Server Components

Server Components SHALL be preferred for:

- Initial Data Loading
- Static Content
- SEO-Critical Pages
- Dashboard Initialization

Server Components SHALL minimize client-side JavaScript.

---

# 9. Client Components

Client Components SHALL be used only where interaction is required.

Examples:

- Forms
- Dialogs
- Charts
- Tables
- Live Trading Panels
- Notifications

The `"use client"` directive SHALL be applied only when necessary.

---

# 10. State Management

State SHALL be categorized into:

## Server State

Managed using:

- TanStack Query

---

## Client State

Managed using:

- React Context
- Zustand (where appropriate)

---

## Form State

Managed using:

- React Hook Form

---

## URL State

Managed through:

- Next.js App Router
- Search Parameters

Global state SHALL remain minimal.

---

# 11. Data Fetching

Preferred order:

1. Server Components
2. Server Actions (where appropriate)
3. TanStack Query
4. Streaming Responses
5. WebSockets / SSE

Data SHALL be cached according to business requirements.

---

# 12. Authentication Flow

Authentication SHALL use Clerk.

Authentication flow:

```text id="auth-flow"
Login
      │
      ▼
Authentication
      │
      ▼
Session Created
      │
      ▼
Workspace Selection
      │
      ▼
Dashboard
```

Protected routes SHALL require authenticated sessions.

---

# End of Part 1

The next chapter defines:

- Dashboard Composition
- Layout System
- Error Boundaries
- Loading Strategy
- Real-Time Updates
- Performance Optimization
- Frontend Security
- Accessibility
- Frontend Testing
- Build & Deployment

These sections complete the frontend implementation architecture for Veerox ATI.