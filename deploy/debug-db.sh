#!/bin/sh
# Debug script to check database status in container

CONTAINER_NAME="solo-board"

echo "=== Checking container status ==="
docker ps | grep $CONTAINER_NAME || echo "Container not running"

echo ""
echo "=== Checking database file ==="
docker exec $CONTAINER_NAME ls -lh /app/backend/data/ 2>/dev/null || echo "Cannot access data directory"

echo ""
echo "=== Checking database file exists ==="
docker exec $CONTAINER_NAME test -f /app/backend/data/dev.db && echo "Database file exists" || echo "Database file NOT found"

echo ""
echo "=== Checking environment variables ==="
docker exec $CONTAINER_NAME env | grep -E "DATABASE_URL|DEFAULT_ADMIN" || echo "Environment variables not found"

echo ""
echo "=== Checking backend logs (last 50 lines) ==="
docker logs $CONTAINER_NAME --tail 50 2>&1 | grep -E "Database|admin|Admin|DATABASE|error|Error|ERROR" || echo "No relevant logs found"

echo ""
echo "=== Attempting to query database ==="
docker exec $CONTAINER_NAME sh -c "cd /app/backend && npx prisma db execute --stdin <<< 'SELECT COUNT(*) as admin_count FROM admins;'" 2>&1 || echo "Cannot query database"
