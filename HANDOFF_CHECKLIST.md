# HANDOFF CHECKLIST

## Required Environment Variables

### Backend (.env or docker-compose env)
| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | YES | PostgreSQL connection string with `?sslmode=require` in production |
| `REDIS_URL` | YES | Redis URL with password: `redis://:PASSWORD@host:6379` |
| `JWT_ACCESS_SECRET` | YES | Minimum 32 random chars, validated at startup |
| `JWT_REFRESH_SECRET` | YES | Minimum 32 random chars, validated at startup |
| `JWT_ACCESS_EXPIRES_IN` | NO | Default: `15m` |
| `JWT_REFRESH_EXPIRES_IN` | NO | Default: `7d` |
| `MINIO_ENDPOINT` | YES | MinIO/S3 hostname |
| `MINIO_PORT` | YES | Default: `9000` |
| `MINIO_ACCESS_KEY` | YES | Not `minioadmin` in production (validated) |
| `MINIO_SECRET_KEY` | YES | Not `minioadmin` in production (validated) |
| `MINIO_BUCKET` | NO | Default: `competition-platform` |
| `MINIO_USE_SSL` | NO | Default: `false` |
| `FRONTEND_URL` | YES | CORS origin, e.g. `https://yourdomain.com` |
| `API_URL` | YES | Backend public URL |
| `OAUTH_CALLBACK_URL` | YES | OAuth callback base URL |
| `GOOGLE_CLIENT_ID` | NO | Required for Google OAuth |
| `GOOGLE_CLIENT_SECRET` | NO | Required for Google OAuth |
| `GITHUB_CLIENT_ID` | NO | Required for GitHub OAuth |
| `GITHUB_CLIENT_SECRET` | NO | Required for GitHub OAuth |
| `SMTP_HOST` | NO | Required for email (password reset) |
| `SMTP_PORT` | NO | Default: `587` |
| `SMTP_USER` | NO | Required for email |
| `SMTP_PASS` | NO | Required for email |
| `EMAIL_FROM` | NO | Default: `noreply@competition-platform.com` |
| `SENTRY_DSN` | NO | Sentry error tracking |
| `NODE_ENV` | YES | Must be `production` |

### Frontend (build-time)
| Variable | Required | Notes |
|----------|----------|-------|
| `VITE_API_URL` | NO | Default: `/api/v1` (same-origin) |
| `VITE_WS_URL` | NO | WebSocket URL |
| `VITE_SENTRY_DSN` | NO | Frontend error tracking |

### Worker
Same database, Redis, and MinIO variables as backend.

## Migration Steps

1. **Generate strong secrets**:
   ```bash
   openssl rand -hex 32  # JWT_ACCESS_SECRET
   openssl rand -hex 32  # JWT_REFRESH_SECRET
   openssl rand -hex 32  # REDIS_PASSWORD
   ```

2. **Create production .env** from `.env.example`:
   ```bash
   cp .env.example .env
   # Edit with production values
   ```

3. **Place SSL certificates**:
   ```bash
   cp fullchain.pem nginx/ssl/
   cp privkey.pem nginx/ssl/
   ```

4. **Start infrastructure**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d postgres redis minio
   ```

5. **Run database migrations**:
   ```bash
   docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
   ```

6. **Seed admin user**:
   ```bash
   docker compose -f docker-compose.prod.yml exec backend npx prisma db seed
   ```

7. **Start all services**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

## Seed / Test Data

- `backend/prisma/seed.ts` creates an admin user
- Seed is run via `npx prisma db seed`
- Admin credentials are set in the seed script — change immediately after first login

## Deploy Commands

```bash
# Full production deploy
docker compose -f docker-compose.prod.yml up -d --build

# Backend only redeploy
docker compose -f docker-compose.prod.yml up -d --build backend

# Worker only redeploy
docker compose -f docker-compose.prod.yml up -d --build worker

# View logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f worker

# Manual backup
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB | gzip > backup_$(date +%Y%m%d).sql.gz
```

## Rollback Notes

1. **Database rollback**: Restore from latest backup in `./backups/`
   ```bash
   gunzip < backups/backup_YYYYMMDD_HHMMSS.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U $POSTGRES_USER $POSTGRES_DB
   ```

2. **Application rollback**: Rebuild with previous git commit
   ```bash
   git checkout <previous-commit>
   docker compose -f docker-compose.prod.yml up -d --build backend worker frontend
   ```

3. **Migration rollback**: Not automatic — restore from backup if migration causes issues

## Smoke Test Checklist After Deployment

- [ ] Health endpoint returns 200: `curl https://yourdomain.com/api/health`
- [ ] Register a new user account
- [ ] Login with email/password
- [ ] Login with Google OAuth (if configured)
- [ ] Login with GitHub OAuth (if configured)
- [ ] Create a competition as HOST
- [ ] Submit competition for review
- [ ] Approve competition as ADMIN
- [ ] Enroll as PARTICIPANT
- [ ] Upload a dataset (as HOST)
- [ ] Download dataset (as PARTICIPANT)
- [ ] Submit a CSV prediction file
- [ ] Verify scoring completes (check notifications)
- [ ] Verify leaderboard shows score
- [ ] Create a discussion topic
- [ ] Reply to a discussion
- [ ] Vote on a discussion
- [ ] Check mobile responsiveness
- [ ] Verify backup was created in `./backups/`
- [ ] Check Sentry for any startup errors
- [ ] Verify HTTPS redirect works: `curl -I http://yourdomain.com`
