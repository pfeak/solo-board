# solo-board

A lightweight, self-hosted solo whiteboard built on Excalidraw, designed for personal diagram and knowledge organization.

## Quick Start

### Prerequisites

- Node.js 18+
- `pnpm` (recommended) or `npm`

### 1. Clone repository

```bash
git clone https://github.com/pfeak/solo-board.git
cd solo-board
```

### 2. Backend: install & run

```bash
cd backend
pnpm install          # or: npm install
cp .env.example .env  # adjust values if needed
pnpm prisma:migrate   # or: npx prisma migrate dev
pnpm dev              # start Fastify API on http://localhost:8000
```

### 3. Frontend: install & run

Open a new terminal:

```bash
cd frontend
pnpm install          # or: npm install
pnpm dev              # start Next.js app on http://localhost:3000
```

Make sure the backend is running at `http://localhost:8000` (default). The frontend uses this URL via `NEXT_PUBLIC_API_URL` (can be overridden in a `.env.local` file).

## Solo-Board Project Structure (AI-Assisted Notes)

- backend/: Node.js + TypeScript + Fastify + Prisma + SQLite backend API service
  - Reference: ai-specs/projects/solo-board/logic/project.md
  - Entry Point: backend/src/index.ts
  - Configuration: backend/src/config.ts, backend/.env.example
  - Data Models: backend/prisma/schema.prisma (folders/files/admins)

- frontend/: Frontend application using Next.js App Router, React, Tailwind, and @excalidraw/excalidraw
  - Reference: ai-specs/projects/solo-board/ui/prd/ui_prd_common.md and pages/* PRD
  - Routes:
    - "/"               : File browser (placeholder)
    - "/login"          : Admin login
    - "/change-password": Password change for first-time login
    - "/profile"        : Profile management
    - "/editor/[id]"    : Board editor
  - Adapter Layer:
    - frontend/lib/api.ts                : Unified API calls wrapper
    - frontend/lib/excalidraw/adapter.ts : Excalidraw adapter (sole integration point with Excalidraw)
    - frontend/components/editor/ExcalidrawWrapper.tsx : Excalidraw wrapper component
