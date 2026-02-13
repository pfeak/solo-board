# -----------------------------------------------------------------------------
# Stage 1: Backend dependencies and build
# -----------------------------------------------------------------------------
FROM node:22-alpine AS backend-deps
WORKDIR /app/backend
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY backend/package.json backend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM backend-deps AS backend-build
COPY backend/ ./
RUN pnpm prisma generate && pnpm run build

# -----------------------------------------------------------------------------
# Stage 2: Frontend dependencies and build (standalone output)
# -----------------------------------------------------------------------------
FROM node:22-alpine AS frontend-deps
WORKDIR /app/frontend
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM frontend-deps AS frontend-build
COPY frontend/ ./
# Backend URL for server-side rewrites (same container)
ENV NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
RUN pnpm run build

# -----------------------------------------------------------------------------
# Stage 3: Runtime image (minimal)
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache dumb-init

# Backend: dist, prisma schema, generated client and deps
COPY --from=backend-build /app/backend/dist ./backend/dist
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY --from=backend-build /app/backend/prisma ./backend/prisma
COPY --from=backend-build /app/backend/package.json ./backend/package.json

# Frontend: standalone server + static assets
COPY --from=frontend-build /app/frontend/.next/standalone ./frontend
COPY --from=frontend-build /app/frontend/.next/static ./frontend/.next/static

# Entrypoint: db push, then run backend and frontend
COPY deploy/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--", "/entrypoint.sh"]
