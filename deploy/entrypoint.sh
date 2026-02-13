#!/bin/sh
set -e
cd /app/backend
# Ensure data directory exists (mounted volume)
mkdir -p data
# Run Prisma migrations to create/update database
echo "Initializing database..."
echo "DATABASE_URL: ${DATABASE_URL:-not set}"
if command -v npx >/dev/null 2>&1; then
  # Ensure DATABASE_URL is set for prisma commands
  export DATABASE_URL="${DATABASE_URL:-file:/app/backend/data/dev.db}"
  if npx prisma db push --accept-data-loss; then
    echo "Database initialized successfully"
  else
    echo "Warning: Database initialization failed, but continuing..."
  fi
else
  echo "Warning: npx not found, skipping database initialization"
fi
# Start backend server (backend will auto-create default admin if needed)
echo "Starting backend server..."
PORT=8000 node dist/index.js &
# Start frontend server
cd /app/frontend
echo "Starting frontend server..."
PORT=3000 exec node server.js
