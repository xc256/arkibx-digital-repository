#!/usr/bin/env bash
set -euo pipefail
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/backups"
mkdir -p "$BACKUP_DIR"
docker exec bioarchive_postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_DIR/database_$DATE.sql"
tar -czf "$BACKUP_DIR/uploads_$DATE.tar.gz" -C "$(cd "$(dirname "$0")/.." && pwd)" uploads
find "$BACKUP_DIR" -type f -mtime +30 -delete
echo "Backup completed: $BACKUP_DIR"
