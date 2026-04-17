#!/bin/bash
set -euo pipefail

# AUDIT-FIX F-Infra-06: Honour custom compose project name. If the stack was started
# with `docker compose -p myproj ... up`, set COMPOSE_PROJECT_NAME=myproj before
# invoking this script. Default = "cucthi" matches the on-disk project folder name.
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-cucthi}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
BACKUP_ENCRYPTION_KEY="${BACKUP_ENCRYPTION_KEY:-}"
S3_BACKUP_BUCKET="${S3_BACKUP_BUCKET:-}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[$(date)] Starting database backup (project=${COMPOSE_PROJECT_NAME})..."

docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --clean | gzip > "$BACKUP_FILE"

if [ ! -f "$BACKUP_FILE" ] || [ ! -s "$BACKUP_FILE" ]; then
  echo "[$(date)] ERROR: Backup failed or file is empty"
  exit 1
fi

sha256sum "$BACKUP_FILE" > "${BACKUP_FILE}.sha256"

if [ -n "$BACKUP_ENCRYPTION_KEY" ]; then
  echo "[$(date)] Encrypting backup..."
  openssl enc -aes-256-cbc -salt -pbkdf2 -in "$BACKUP_FILE" -out "${BACKUP_FILE}.enc" -pass "pass:${BACKUP_ENCRYPTION_KEY}"
  rm "$BACKUP_FILE"
  BACKUP_FILE="${BACKUP_FILE}.enc"
  sha256sum "$BACKUP_FILE" > "${BACKUP_FILE}.sha256"
fi

SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[$(date)] Backup completed: ${BACKUP_FILE} (${SIZE})"

if [ -n "$S3_BACKUP_BUCKET" ]; then
  echo "[$(date)] Uploading to S3..."
  aws s3 cp "$BACKUP_FILE" "s3://${S3_BACKUP_BUCKET}/db-backups/$(basename "$BACKUP_FILE")" --storage-class STANDARD_IA
  aws s3 cp "${BACKUP_FILE}.sha256" "s3://${S3_BACKUP_BUCKET}/db-backups/$(basename "${BACKUP_FILE}.sha256")"
  echo "[$(date)] Offsite upload complete"
fi

echo "[$(date)] Cleaning up backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -name "db_backup_*" -mtime +"${RETENTION_DAYS}" -delete

REMAINING=$(find "$BACKUP_DIR" -name "db_backup_*" -not -name "*.sha256" | wc -l)
echo "[$(date)] Cleanup done. ${REMAINING} backups remaining."
