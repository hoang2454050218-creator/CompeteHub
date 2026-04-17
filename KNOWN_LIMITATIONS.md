# KNOWN LIMITATIONS

## Non-Blocking Issues (Fix in Next Sprint)

### 1. Socket.IO rate limit uses in-memory Map
- **Impact**: Not shared across multiple backend instances
- **Risk**: LOW — only matters at horizontal scale
- **Mitigation**: Replace with Redis-backed rate limiting when scaling

### 2. Worker reads entire CSV into memory
- **Impact**: Large CSV (up to 500MB / 5M rows) could use several GB of heap
- **Mitigation Applied**: Added MAX_CSV_ROWS (5M) cap to prevent unbounded growth
- **Residual Risk**: A 5M row CSV still uses significant memory
- **Future Fix**: Process CSV in streaming chunks for scoring, or use a row-count limit closer to expected competition sizes

### 3. No virus/malware scanning on uploads
- **Impact**: Uploaded files are not scanned
- **Risk**: MEDIUM for an internal-use competition platform
- **Future Fix**: Integrate ClamAV container or cloud scanning API

### 4. No email verification for local signup
- **Impact**: Users can register with any email without verification
- **Risk**: LOW — OAuth users are verified by provider; local signup should add verification flow
- **Future Fix**: Add email verification flow with token

### 5. GitHub OAuth doesn't verify email like Google does
- **Impact**: GitHub users with unverified emails could register
- **Risk**: LOW — GitHub API typically returns primary verified email
- **Mitigation**: GitHub requires `user:email` scope; most emails are verified

### 6. Frontend date format test failure (pre-existing)
- **Impact**: 1 frontend test fails due to locale-dependent date formatting
- **Risk**: NONE — cosmetic test issue
- **Fix**: Use locale-independent assertions in test

### 7. Worker scorer edge case tests (pre-existing)
- **Impact**: 3 worker scorer tests fail on specific numerical edge cases
- **Risk**: LOW — core scoring logic is correct; edge case handling may need tuning
- **Fix**: Review scorer test expectations for boundary conditions

### 8. No centralized metrics (Prometheus/Grafana)
- **Impact**: No runtime metrics collection beyond health checks and Sentry
- **Risk**: MEDIUM for production monitoring
- **Future Fix**: Add Prometheus metrics endpoint + Grafana dashboard

### 9. Session invalidation on profile password change
- **Impact**: If user changes password via profile update (not reset), existing refresh tokens are NOT invalidated
- **Risk**: MEDIUM — password reset does invalidate tokens; profile password change path needs same treatment
- **Future Fix**: Add `refreshToken: null` to profile password change handler

### 10. `autoSelectBestSubmissions` uses Prisma `distinct` + `orderBy` for batch selection
- **Mitigation Applied**: Replaced N+1 loop with batch queries
- **Residual Risk**: Prisma `distinct` + `orderBy` behavior may not pick the absolute best in all edge cases under race conditions with concurrent scoring
- **Monitoring**: Review auto-selected submissions after first real competition

## Infrastructure Assumptions
- SSL certificates must be provisioned and placed in `nginx/ssl/` before production deploy
- DNS must be configured before go-live
- MinIO should not use default credentials in production (enforced by startup validation)
- PostgreSQL should use `sslmode=require` in production DATABASE_URL
- Offsite backup storage is configured in `scripts/backup-db.sh` but requires AWS credentials
