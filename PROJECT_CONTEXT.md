# PROJECT CONTEXT — CompeteHub Online Competition Platform

> Tài liệu này là **single source of truth** cho AI/agent đọc để hiểu toàn bộ hệ thống mà không cần khám phá lại code. Đọc tài liệu này trước khi đề xuất bất kỳ thay đổi nào.

---

## 1. Tóm tắt 1 phút

**CompeteHub** là một full-stack platform tổ chức và tham gia cuộc thi data science (mô hình Kaggle clone). Người dùng upload file CSV dự đoán, hệ thống chấm điểm tự động và xếp hạng theo public/private leaderboard.

| Thuộc tính | Giá trị |
|---|---|
| Pattern | Monorepo, multi-service, container-first |
| Services | `backend` (API) · `worker` (scoring) · `frontend` (SPA) · `nginx` (reverse proxy) |
| Datastores | PostgreSQL 16 · Redis 7 · MinIO (S3-compatible) |
| Communication | REST `/api/v1/*` · Socket.IO real-time · BullMQ jobs · Redis pub/sub |
| Languages | TypeScript end-to-end |
| Auth | JWT (access 15m + refresh 7d HttpOnly cookie) + OAuth Google/GitHub |
| Roles | `ADMIN` · `HOST` · `PARTICIPANT` |
| Production status | RELEASE READY (xem `RELEASE_READINESS.md`) — 198/198 backend tests pass, 49 security tests pass |

---

## 2. Cấu trúc thư mục cấp cao

```
cuộc thi/
├── backend/                  Express + Prisma + Socket.IO + BullMQ producer
│   ├── prisma/
│   │   ├── schema.prisma     Toàn bộ domain model (PostgreSQL)
│   │   ├── migrations/       3 migrations (init, indexes+checks, file_hash)
│   │   ├── init.sql          CREATE EXTENSION pg_trgm
│   │   └── seed.ts           Tạo admin/host/participant + 1 competition demo
│   └── src/
│       ├── app.ts            Bootstrap Express + cron + graceful shutdown
│       ├── config/           database, redis, minio, socket, passport, sentry, swagger
│       ├── middleware/       auth, validate, errorHandler, csrf
│       ├── modules/          auth, competition, dataset, enrollment, submission,
│       │                     leaderboard, discussion, team, notification, user, admin
│       ├── services/         storage.service, email.service (cross-cutting)
│       ├── jobs/             scheduledJobs (cron: stuck recovery, auto-complete, cleanup)
│       ├── utils/            jwt, fileHelpers, apiResponse, oauthState, logger, pagination
│       └── tests/            security.test, competition-rules.test, helpers
│
├── worker/                   BullMQ consumer (scoring)
│   └── src/
│       ├── index.ts          Worker bootstrap + DLQ + health server
│       ├── processor.ts      Tải CSV, parse, split public/private, score, upsert LB
│       └── scorers/          ACCURACY, RMSE, F1_SCORE, AUC_ROC, LOG_LOSS, CUSTOM
│
├── frontend/                 React 18 SPA
│   └── src/
│       ├── App.tsx           Routes (lazy) + auth rehydrate
│       ├── main.tsx          QueryClient + Sentry + ErrorBoundary
│       ├── pages/            Home, Login, Register, Competitions, CompetitionDetail,
│       │                     CreateCompetition, Profile, Notifications, AdminDashboard,
│       │                     ForgotPassword, ResetPassword, AuthCallback, NotFound
│       ├── components/       Layout, ProtectedRoute, ErrorBoundary, CompetitionCard, …
│       ├── services/api.ts   Axios + 401 refresh + scheduled refresh
│       ├── stores/           Zustand authStore (persist)
│       ├── socket/           Socket.IO client wrapper
│       └── types/            TypeScript domain types (mirror backend Prisma model)
│
├── nginx/
│   ├── nginx.conf            TLS + HSTS + CSP + rate limit zones (api/login/upload)
│   └── ssl/                  fullchain.pem, privkey.pem (cần cung cấp khi deploy)
│
├── scripts/
│   ├── backup-db.sh          pg_dump + gzip + sha256 + optional encrypt + S3
│   └── restore-db.sh         gunzip → psql với confirm prompt
│
├── .github/workflows/ci.yml  Security audit + 3 test jobs + docker build
├── docker-compose.yml        Dev (hot reload, no nginx, no SSL)
├── docker-compose.prod.yml   Prod (multi-stage build, non-root, healthcheck, db-backup)
├── .env.example              Tham chiếu mọi biến môi trường
└── *.md                      README, HANDOFF_CHECKLIST, RELEASE_READINESS,
                              SECURITY_FIXES, TEST_EVIDENCE, KNOWN_LIMITATIONS
```

---

## 3. Sơ đồ kiến trúc runtime

```
┌────────────┐  HTTPS  ┌──────────┐
│  Browser   │ ──────► │  Nginx   │  TLS, rate limit, WebSocket upgrade
└────────────┘         └────┬─────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
        ┌─────────┐   ┌─────────┐   ┌──────────┐
        │ Frontend│   │ Backend │◄──┤ Socket.IO│  (auth qua JWT)
        │ (Nginx) │   │ Express │   └──────────┘
        └─────────┘   └────┬────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
  ┌──────────┐       ┌──────────┐      ┌──────────┐
  │PostgreSQL│       │  Redis   │      │  MinIO   │
  │ (Prisma) │       │ pub/sub  │      │ (S3 API) │
  └──────────┘       │ + cache  │      └──────────┘
        ▲            │ + BullMQ │             ▲
        │            └────┬─────┘             │
        │                 │                   │
        │           ┌─────▼──────┐            │
        └───────────┤   Worker   ├────────────┘
                    │  (BullMQ)  │
                    └────────────┘
```

**Networks (prod)**: `frontend`, `backend`, `data`. Nginx ↔ frontend/backend; backend/worker ↔ data; postgres/redis/minio chỉ trong `data`.

---

## 4. Tech Stack chi tiết

### Backend (`backend/package.json`)
- Runtime: Node 20, TypeScript 5, `tsx` cho dev hot reload
- HTTP: `express` 4.21
- Database: `@prisma/client` 6.5 + Prisma migrations
- Cache/queue: `ioredis` 5.4, `bullmq` 5.20, `rate-limit-redis`
- Auth: `jsonwebtoken`, `bcryptjs` (cost 12), `passport` + `passport-google-oauth20` + `passport-github2`
- Files: `multer` (disk storage), `minio` 8.0
- Validation/sanitization: `zod` 3.24, `sanitize-html` 2.17
- Realtime: `socket.io` 4.8
- Email: `nodemailer`
- Security: `helmet`, `cors`, `cookie-parser`, `express-rate-limit`
- Observability: `pino`, `pino-pretty`, `@sentry/node`
- Cron: `node-cron`
- Misc: `slug`, `uuid`, `swagger-jsdoc`, `swagger-ui-express`

### Worker (`worker/package.json`)
- `@prisma/client`, `bullmq`, `ioredis`, `minio`, `csv-parse`, `pino`, `socket.io-client`
- Không có Express; tự dựng `http` server cho healthcheck (port 3001)

### Frontend (`frontend/package.json`)
- React 18 + Vite 6 + TypeScript
- Routing: `react-router-dom` 6
- State: `zustand` 5 (auth store), `@tanstack/react-query` 5 (server state)
- Styling: `tailwindcss` 3, `@tailwindcss/typography`, `clsx`, `tailwind-merge`
- HTTP: `axios` 1.7
- Realtime: `socket.io-client` 4.8
- UI: `lucide-react` icons, `recharts`, `react-hot-toast`, `react-markdown` + `remark-gfm` + `rehype-sanitize`
- Date: `date-fns`
- Observability: `@sentry/react`
- Tests: `vitest` 4, `@testing-library/react`, `msw`

---

## 5. Domain Model (Prisma `schema.prisma`)

### Enums
| Enum | Values |
|---|---|
| `Role` | `ADMIN`, `HOST`, `PARTICIPANT` |
| `CompetitionStatus` | `DRAFT` → `PENDING_REVIEW` → `ACTIVE` → `COMPLETED` → `ARCHIVED` |
| `EvalMetric` | `ACCURACY`, `RMSE`, `F1_SCORE`, `AUC_ROC`, `LOG_LOSS`, `CUSTOM` |
| `CompetitionCategory` | `FEATURED`, `GETTING_STARTED`, `RESEARCH`, `COMMUNITY` |
| `SubmissionStatus` | `QUEUED`, `SCORING`, `SCORED`, `FAILED` |
| `VoteableType` | `DISCUSSION`, `REPLY` |
| `NotificationType` | `SUBMISSION_SCORED`, `TEAM_INVITE`, `TEAM_INVITE_ACCEPTED`, `TEAM_INVITE_REJECTED`, `COMPETITION_STATUS_CHANGED`, `COMPETITION_APPROVED`, `COMPETITION_REJECTED`, `NEW_DISCUSSION`, `NEW_REPLY`, `SYSTEM` |
| `TeamInvitationStatus` | `PENDING`, `ACCEPTED`, `REJECTED` |

### Bảng chính & quan hệ

```
User (1) ───< Competition (host)            User (1) ───< Enrollment >─── (1) Competition
User (1) ───< Submission                    Enrollment (N) ─── (0..1) Team
User (1) ───< Discussion (author)           Team (1) ───< TeamInvitation
User (1) ───< DiscussionReply               Team (1) ───< Submission (optional)
User (1) ───< Vote                          Competition (1) ───< Dataset (versioned)
User (1) ───< Notification                  Competition (1) ───< LeaderboardEntry
User (1) ───< Team (leader)                 Competition (1) ───< Discussion
User (1) ───< LeaderboardEntry              Discussion (1) ───< DiscussionReply (self-ref ≤ 2 levels)
```

### Bảng quan trọng — field ý nghĩa

#### `users`
- Auth: `email` (unique), `passwordHash` (nullable cho OAuth-only), `googleId`, `githubId`
- State: `role`, `isActive`, `failedLogins`, `lockedUntil` (brute force lock)
- Token: `refreshToken` (lưu **SHA-256 hash**, không phải plaintext), `resetToken`, `resetTokenExp`
- Profile: `name`, `avatarUrl`, `bio`, `githubUrl`, `linkedinUrl`

#### `competitions`
- Identity: `slug` (unique, auto-gen từ title), `hostId`
- Lifecycle: `status`, `category`, `tags[]`
- Scoring config: `evalMetric`, `pubPrivSplit` (0–1, mặc định 0.3), `customScript` (cho `CUSTOM` metric)
- Limits: `maxTeamSize` (1 = disabled), `maxDailySubs` (5), `maxTotalSubs` (nullable), `maxFileSize` (100MB default)
- Timeline: `startDate`, `endDate`, `mergeDeadline` (cho team merging)
- Files: `coverImage`, `sampleFileUrl`, `groundTruthUrl` (MinIO object names)
- Indexes: `(status, startDate)`, `(hostId)`, `(category, status)`, GIN trigram trên `title` cho search

#### `submissions`
- `userId`, `competitionId`, `teamId` (nullable)
- `fileUrl` (MinIO key), `fileName`, `fileHash` (SHA-256, dùng cho duplicate detection)
- `status`, `publicScore`, `privateScore`, `errorMessage`, `isSelected` (cho private LB)
- `scoredAt`, `createdAt`
- Indexes: `(competitionId, userId)`, `(competitionId, createdAt)`, `(status)`

#### `leaderboard_entries`
- Unique `(competitionId, userId)` — **1 entry per user per competition** (best-of)
- `bestPublicScore`, `bestPrivateScore`, `submissionCount`, `lastSubmittedAt`
- `publicRank`, `privateRank` (computed, optional)

#### `votes`
- Unique `(userId, voteableType, voteableId)` — 1 vote per user per target
- `value` ∈ {1, -1} (CHECK constraint)

### CHECK constraints (migration thứ 2)
- `pub_priv_split` strict (0,1)
- `max_team_size`, `max_daily_subs` ≥ 1
- `max_file_size` > 0
- `vote.value` ∈ {1, -1}
- Counters non-negative: `upvote_count`, `reply_upvote_count`, `submission_count`

---

## 6. Backend — Cấu trúc module

Mọi module theo pattern: `*.routes.ts` → `*.controller.ts` → `*.service.ts` (+ `*.validator.ts` Zod). Giữ separation rõ ràng:
- **Routes**: gắn middleware (`authenticate`, `authorize`, `validateUUID`, `validate`, `requireEnrolled`), không có business logic.
- **Controller**: giải nén `req`, gọi service, trả response qua `sendSuccess`/`AppError`.
- **Service**: business logic, dùng Prisma trực tiếp.
- **Validator**: Zod schemas + inferred types.

### Bảng module

| Module | Routes prefix | Purpose |
|---|---|---|
| `auth` | `/auth/*` | register, login, refresh, forgot/reset password, OAuth (Google/GitHub), logout, exchange-code |
| `competition` | `/competitions` | CRUD, list (filter status/category/tag/search/sort), update status (FSM), get-by-slug |
| `dataset` | `/competitions/:id/datasets/*` | upload (host only, magic-byte validate), list, download (presigned URL), preview (stream first N rows) |
| `enrollment` | `/competitions/:id/enroll`, `/participants` | enroll/unenroll, check status, list participants |
| `submission` | `/competitions/:id/submissions/*` | submit CSV (multer disk → MinIO stream), list mine, select for private LB |
| `leaderboard` | `/competitions/:id/leaderboard*` | public, private (gated COMPLETED+), shakeup, CSV export |
| `discussion` | `/competitions/:id/discussions/*` | topics CRUD, replies (≤2 levels nest), vote, pin (host/admin) |
| `team` | `/teams/*` | create, invite by email, accept/reject, list invitations, get team |
| `notification` | `/notifications/*` | list (paginated, unread count), mark read, mark all read |
| `user` | `/users/*` | get profile (with history + best results), update own profile |
| `admin` | `/admin/*` | dashboard stats, review competition (approve/reject), user management |

### Middleware

- **`authenticate`**: parse `Authorization: Bearer <jwt>`, verify access token (HS256, issuer, audience), load user from DB, check `isActive`. Đặt `req.user = { userId, role, email, name }`.
- **`optionalAuth`**: như trên nhưng không throw nếu thiếu token.
- **`authorize(...roles)`**: factory; require `req.user.role ∈ roles`.
- **`requireEnrolled`**: lấy `competitionId` từ `req.params.id`/`competitionId`, kiểm tra `enrollment` (ADMIN bypass).
- **`validate(schema, source)`**: Zod parse với source ∈ `body|query|params`.
- **`validateUUID(...names)`**: regex check format UUID v4.
- **`csrfProtection`**: skip GET/HEAD/OPTIONS; require `Origin` hoặc `Referer` matches `config.frontendUrl`.
- **`errorHandler`**: handle `AppError`, `ZodError`, `Prisma.PrismaClientKnownRequestError` (P2002, P2025, P2003, P2034), `Prisma.PrismaClientValidationError`, fallback 500. Log via Pino + Sentry.

### Bootstrap (`backend/src/app.ts`)
```
1. initSentry()
2. helmet (CSP explicit), cors (credentials, frontendUrl), express.json (1mb limit)
3. cookieParser, csrfProtection, x-request-id middleware
4. Rate limiters (Redis-backed):
   - global  : 500 req / 15 min
   - login   : 5 req / 15 min
   - register: 3 req / hour
   - refresh : 30 req / 15 min
5. passport.initialize()
6. Mount /api/v1/* routes (xem bảng module)
7. /api/health (database + redis + minio); ẩn `checks` từ external
8. errorHandler
9. initSocket(httpServer) — gắn Socket.IO
10. start(): ensureBucket(), schedule cron jobs (every 5 min stuck recovery + auto-complete; daily 3am notification cleanup), httpServer.listen
11. SIGTERM/SIGINT/uncaughtException → graceful shutdown (15s timeout)
```

---

## 7. Auth & Security — Sâu

### Token model
- **Access token**: JWT HS256, expires `15m`, payload `{userId, role}`, claims `iss=competition-platform`, `aud=competition-platform-api`. Gửi qua `Authorization: Bearer <token>` header.
- **Refresh token**: JWT HS256, expires `7d`, lưu **SHA-256 hash** trong `users.refreshToken`. Gửi/nhận qua **HttpOnly + Secure (prod) + SameSite=Strict** cookie `refreshToken`, scoped tới `path=/api/v1/auth/refresh`.

### Token rotation & reuse detection
Mỗi lần `/auth/refresh` thành công:
1. Verify refresh token (HS256 + iss + aud).
2. So sánh `hash(token)` với `users.refreshToken` trong DB.
3. **Nếu mismatch** → hành vi đáng ngờ → set `refreshToken=null` (invalidate all sessions) → throw `TOKEN_REUSE`.
4. Nếu OK → cấp cặp token mới, lưu `hash(newRefresh)` vào DB.

### Password & session
- **Bcrypt cost 12** (`config.auth.bcryptRounds`).
- **Policy**: 8–128 chars, ≥1 upper, ≥1 lower, ≥1 digit (Zod `passwordSchema`).
- **Brute force lock**: 5 sai liên tiếp → khoá 15 phút (`failedLogins`, `lockedUntil`).
- **Reset password**: token random hex 32 bytes, lưu hash, expire 1h, dùng xong invalidate all sessions (set `refreshToken=null`).

### OAuth (Google/GitHub)
1. `/auth/{google|github}` → tạo `state` random hex 32, lưu `oauth:state:<state>` ở Redis TTL 600s.
2. Redirect tới provider với `state` đính kèm.
3. Callback verify state (single-use: `redis.del` returns 1).
4. `findOrCreateOAuthUser`:
   - Nếu user đã tồn tại với password và chưa link OAuth → throw `ACCOUNT_EXISTS` (yêu cầu login bằng password trước).
   - Nếu OAuth provider report `email.verified === false` → redirect login với `error=email_not_verified`.
5. Cấp tokens, lưu vào Redis với key `oauth:code:<random_hex_32>` TTL 60s, redirect frontend `/auth/callback?code=<...>`.
6. Frontend `POST /auth/exchange-code` để lấy access token + set HttpOnly cookie. Code single-use.

### CSRF
Origin/Referer check thay vì CSRF token (vì refresh dùng HttpOnly cookie + SameSite=Strict, browser không gửi cookie cross-site cho POST).

### Rate limiting
| Layer | Implementation |
|---|---|
| Nginx (zone) | `api`: 10r/s burst 30; `login`: 1r/s burst 5; `upload`: 2r/s burst 5 |
| Express (per-IP) | Redis-backed via `rate-limit-redis`, prefix per route |

### Security fixes đã apply (xem `SECURITY_FIXES.md`)
1. **XSS**: `stripHtmlTags` chuyển từ regex sang `sanitize-html` (recursiveEscape, allowedTags=[], allowedAttributes={}). Apply cho create + **update** (topic & reply).
2. **Socket JWT**: dùng `verifyAccessToken` (pin HS256/issuer/audience) thay vì `jwt.verify` raw → chặn algorithm confusion + `alg:none` attack.
3. **Vote IDOR**: vote service nhận thêm `competitionId`, dùng `findFirst` với scope competition → block cross-competition voting.
4. **Submission race**: `findFirst` duplicate hash đặt **trong** `$transaction({ isolationLevel: 'Serializable' })`.
5. **Update sanitization**: `updateTopic`/`updateReply` cũng `stripHtmlTags`.
6. **OAuth exchange-code**: thêm Zod schema, JSON.parse trong try/catch, validate shape.
7. **Health endpoint**: ẩn `checks` cho external request (chỉ trả khi `req.ip ∈ {127.0.0.1, ::1}` hoặc no `x-forwarded-for`).
8. **JWT secret validation**: startup check `length ≥ 32` và không chứa `change-in-production`.
9. **MinIO credentials**: startup throw nếu `accessKey === 'minioadmin'` trong production.

### Helmet + CSP
```js
defaultSrc:  'self'
scriptSrc:   'self'
styleSrc:    'self', 'unsafe-inline'   // Tailwind cần unsafe-inline cho injected styles
imgSrc:      'self', data:, https:
connectSrc:  'self', wss:, frontendUrl
fontSrc:     'self', https://fonts.gstatic.com
objectSrc:   'none'
frameAncestors: 'none'
```

### Logging redaction (`utils/logger.ts`)
Pino redact paths: `req.headers.authorization`, `req.headers.cookie`, `*.password`, `*.passwordHash`, `*.token`, `*.refreshToken`, `*.accessToken`, `*.secret`, `*.secretKey`, `*.accessKey` → `[REDACTED]`.

### Sentry PII scrubbing
`beforeSend` xoá `event.request.headers.authorization`, `cookie`; redact body fields `password|token|refreshToken|accessToken|secret`; xoá `event.user.email`, `ip_address`.

---

## 8. Competition lifecycle (Finite State Machine)

```
DRAFT ──host submit──► PENDING_REVIEW ──admin approve──► ACTIVE ──auto/manual──► COMPLETED ──admin──► ARCHIVED
                              │
                              └──admin reject──► DRAFT
```

### Rules enforced (`competition.service.ts`, `competition-rules.test.ts`)
- **Valid transitions**: DRAFT→PENDING_REVIEW, PENDING_REVIEW→{ACTIVE|DRAFT}, ACTIVE→COMPLETED, COMPLETED→ARCHIVED. ARCHIVED là terminal.
- **PENDING_REVIEW → ACTIVE** chỉ admin được phép (host không tự approve).
- **Immutable fields khi ACTIVE/COMPLETED**: `evalMetric`, `pubPrivSplit`, `maxTeamSize`, `startDate`, `endDate`. Update sẽ throw `IMMUTABLE_FIELD` (400).
- **Delete khi ACTIVE** → 400.
- **Admin override**: ADMIN luôn pass authorization checks (trừ FSM rules).
- **DRAFT/PENDING_REVIEW** chỉ owner+admin xem được; public list filter ra trừ khi explicit `?status=`.

### Auto-completion (cron 5 phút)
`autoCompleteCompetitions()`:
1. Query competitions where `status=ACTIVE AND endDate < now`.
2. Bulk update → `COMPLETED`.
3. Với mỗi: `autoSelectBestSubmissions(competitionId, lowerIsBetter)` — chọn best submission theo `privateScore` cho user chưa có `isSelected=true`.
4. Distributed lock qua Redis `SET lock:auto-complete 1 EX 120 NX`.

---

## 9. Submission & Scoring Pipeline

### Flow đầy đủ
```
[Frontend]                  [Backend API]                [Redis/BullMQ]            [Worker]               [DB/MinIO]
   │                              │                            │                       │                       │
   │ POST /submissions (multipart)│                            │                       │                       │
   ├─────────────────────────────►│                            │                       │                       │
   │                              │ Multer disk save (/tmp)    │                       │                       │
   │                              │ validateCsvMagicBytes      │                       │                       │
   │                              │ computeFileHash (SHA-256)  │                       │                       │
   │                              │ check enrollment + ACTIVE  │                       │                       │
   │                              │ Stream upload → MinIO──────┼───────────────────────┼──────────────────────►│
   │                              │ unlink tmp file            │                       │                       │
   │                              │ $transaction Serializable: │                       │                       │
   │                              │   - duplicate hash check   │                       │                       │
   │                              │   - daily/total limit      │                       │                       │
   │                              │   - create submission(QUEUED)                      │                       │
   │                              │ scoringQueue.add(...)──────►│ enqueue              │                       │
   │ 200 {submissionId}           │                            │                       │                       │
   │◄─────────────────────────────┤                            │                       │                       │
   │                              │                            │ ──────────────────────►│ Worker.process       │
   │                              │                            │                       │ status=SCORING       │
   │                              │                            │                       │ download CSV ◄───────┤
   │                              │                            │                       │ download truth ◄─────┤
   │                              │                            │                       │ parse, validate cols │
   │                              │                            │                       │ split deterministic  │
   │                              │                            │                       │ scorer(public/private)│
   │                              │                            │                       │ update submission    │
   │                              │                            │                       │ upsert LB entry      │
   │                              │                            │                       │ ZADD redis           │
   │                              │                            │                       │ create notification  │
   │                              │                            │ ◄──publish──────────  │                       │
   │                              │                            │  scoring:complete     │                       │
   │                              │ ◄──Redis sub────────────── │                       │                       │
   │ ◄── socket emit ────────────  │                            │                       │                       │
   │  leaderboard:updated (public) │                            │                       │                       │
   │  submission:scored (private)  │                            │                       │                       │
```

### Submission validation (sequential)
1. Multer fileFilter: `mimetype === text/csv` HOẶC tên file `.csv`.
2. Multer limit: 100 MB (per `competition.maxFileSize`, ngầm 100 MB).
3. Service: `competition.status === 'ACTIVE'`.
4. Service: `file.size <= competition.maxFileSize` (cụ thể theo competition).
5. `validateCsvMagicBytes`: BOM-aware, first 512 bytes phải printable + chứa delimiter (`,` `\t` `;`).
6. `computeFileHash`: SHA-256 streaming.
7. Check enrollment.
8. Sanitize filename: `<uuid>_<safe-base-name>` (chỉ giữ `[a-zA-Z0-9._-]`).
9. Stream upload tới MinIO `submissions/<competitionId>/<userId>/<timestamp>_<safeName>`.
10. **Trong Serializable transaction**:
    - Duplicate hash check (status ∈ QUEUED/SCORING/SCORED → 409).
    - Daily count vs `maxDailySubs` (UTC midnight boundary → 429).
    - Total count vs `maxTotalSubs` nếu set → 429.
    - Create submission row.
11. Enqueue BullMQ job với `attempts=3, backoff=exponential delay 5s`.

### Worker processing (`worker/src/processor.ts`)
1. `submission.status = SCORING`.
2. Load competition + submission.
3. `parseCsvStream`: stream từ MinIO, `csv-parse` columns mode, **MAX 5M rows + 500MB cap**.
4. Validate ground truth + submission CSV non-empty, **row count match**, **columns match**.
5. Detect ID column (regex `/^id$/i`); detect target column (column ≠ ID).
6. Build `actualValues[]` and `predictedValues[]`:
   - Có ID → join by ID.
   - Không ID → assume cùng order.
7. Validate finite numbers (no NaN/Infinity).
8. `splitData` deterministic: seed = `hashCode(competitionId)`, Linear Congruential RNG, Fisher-Yates shuffle, slice theo `pubPrivSplit`. → Same split mọi submission cùng competition.
9. Run `SCORERS[evalMetric]` cho public và private partition.
10. Validate finite scores.
11. Update submission `status=SCORED, publicScore, privateScore, scoredAt`.
12. `upsertLeaderboardEntry` trong Serializable transaction: best-of comparison theo `HIGHER_IS_BETTER`.
13. Redis ZADD `leaderboard:<id>:public` và `:private` (sort score, member=userId).
14. Tạo notification `SUBMISSION_SCORED`.
15. **`redis.publish('scoring:complete', JSON.stringify({competitionId, userId, submissionId, publicScore}))`**.

### Scorer implementations (`worker/src/scorers/index.ts`)
| Metric | Formula | Higher better? |
|---|---|---|
| `ACCURACY` | correct / total | ✅ |
| `RMSE` | √(Σ(actual − predicted)² / n) | ❌ |
| `F1_SCORE` | 2·P·R/(P+R), binary or macro-avg | ✅ |
| `AUC_ROC` | trapezoidal integration of ROC curve | ✅ |
| `LOG_LOSS` | −Σ(y·log(p) + (1−y)·log(1−p))/n, clip ε=1e-15 | ❌ |
| `CUSTOM` | throws — yêu cầu host config script (chưa implement) | n/a |

### Resilience
- **BullMQ retry**: 3 attempts, exponential backoff 5s.
- **DLQ**: thất bại sau retry → push tới queue `scoring-dlq` với `{originalJobId, data, error, failedAt}`.
- **Stuck recovery cron** (mỗi 5 phút): submissions `status=SCORING AND createdAt < now - 10min` → set `FAILED` với `errorMessage='Scoring timed out after 10 minutes'`.
- **Distributed locks** (`recover-stuck`, `auto-complete`, `cleanup-notifications`) qua Redis `SET ... EX 120 NX`.
- **Job lock duration** trong worker: 300s.
- **removeOnComplete**: 1000 jobs / 24h; **removeOnFail**: 5000 jobs / 7 ngày.

---

## 10. Leaderboard — Privacy & Realtime

### Public leaderboard
- Endpoint: `GET /competitions/:id/leaderboard?page=1&limit=50` (no auth).
- Service select **không bao gồm** `bestPrivateScore` (chỉ `bestPublicScore`).
- Sort: `LOWER_IS_BETTER = {RMSE, LOG_LOSS}` → `asc`, còn lại `desc`.
- Cache: page 1 + limit 50 → Redis `leaderboard:cache:<id>:public` TTL 120s. Invalidate khi có submission mới score xong.
- Tied ranks: cùng score = cùng rank (next rank skip).

### Private leaderboard
- Endpoint: `GET /competitions/:id/leaderboard/private` (auth + enrolled).
- **403** nếu `competition.status NOT IN (COMPLETED, ARCHIVED)`.
- Trả cả `bestPublicScore` và `bestPrivateScore`.

### Shakeup analysis
- Endpoint: `GET /competitions/:id/leaderboard/shakeup`.
- Tính `rankChange = publicRank - privateRank` cho từng entry, sort theo `privateRank`.

### CSV export
- Endpoint: `GET /competitions/:id/leaderboard/export` (HOST/ADMIN).
- CSV injection prevention: prefix `'` cho cell bắt đầu bằng `=+-@\t\r`; escape `"` → `""`; remove `\r\n`.

### Socket.IO broadcast (`backend/src/config/socket.ts`)
Auth: socket handshake `auth.token` → `verifyAccessToken` (HS256/iss/aud).

Rooms:
- `user:<userId>` — auto-join on connect, dùng cho thông báo private.
- `competition:<id>` — join qua `socket.emit('join:competition', id)` sau khi check enrollment hoặc admin.
- `leaderboard:<id>` — như trên.

Socket rate limit: 30 actions/phút/socket (in-memory Map, hạn chế: không shared multi-instance — xem `KNOWN_LIMITATIONS.md` #1).

UUID validation cho mọi room id.

Redis subscriber `scoring:complete`:
```js
io.to(`leaderboard:${competitionId}`).emit('leaderboard:updated', { competitionId, userId, publicScore });
io.to(`user:${userId}`).emit('submission:scored', { submissionId, publicScore, privateScore });
```
→ **Private score chỉ broadcast cho user room, không bao giờ broadcast cho leaderboard room**.

---

## 11. Worker chi tiết

### Bootstrap (`worker/src/index.ts`)
- Production startup validation: env `DATABASE_URL`, `REDIS_URL`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY` phải có; `MINIO_ACCESS_KEY ≠ 'minioadmin'`.
- Pino logger với redact (giống backend + thêm `MINIO_SECRET_KEY`, `MINIO_ACCESS_KEY`).
- 2 Redis connections: `connection` cho worker, `dlqConnection` cho dead-letter queue.
- BullMQ Worker concurrency = 5.
- Health server HTTP port 3001 (`WORKER_HEALTH_PORT`): trả 200 nếu Redis ping OK, 503 khi draining hoặc Redis unreachable.
- Graceful shutdown: SIGTERM → `worker.close()` (drain), close DLQ + redis connections, `process.exit(0)`.

### Schema sync
Worker có riêng `worker/prisma/schema.prisma` — phải **khớp** với backend schema. Giữ đồng bộ thủ công.

---

## 12. Frontend Architecture

### Routing (`App.tsx`)
- Lazy import mọi page → code splitting.
- `<Suspense fallback={<PageLoader/>}>` wrapper.
- `useEffect`: gọi `useAuthStore.getState().rehydrate()` lúc mount.

| Route | Component | Guard |
|---|---|---|
| `/` | Home | none |
| `/competitions` | Competitions | none |
| `/competitions/:slug` | CompetitionDetail | none (xem inside cho enrolled-only tabs) |
| `/competitions/create` | CreateCompetition | `ProtectedRoute roles=['HOST','ADMIN']` |
| `/profile/:id` | Profile | none |
| `/notifications` | Notifications | `ProtectedRoute` |
| `/admin` | AdminDashboard | `ProtectedRoute roles=['ADMIN']` |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/auth/callback` | Auth pages | none, render outside `<Layout>` |
| `*` | NotFound | none |

### State management
- **Server state**: `@tanstack/react-query` với `staleTime: 30s`, `gcTime: 5min`, `retry: 1`. Mutations: global `MutationCache.onError` toast (skip nếu mutation tự handle).
- **Client state**: `zustand` `authStore` với `persist` middleware, `partialize` chỉ persist `{user.id, name, role, avatarUrl}` + `isAuthenticated` (không persist `accessToken` — sẽ được rehydrate từ refresh cookie).

### Auth flow client
- `Login` page → `POST /auth/login` → `setAuth(user, accessToken)` → `scheduleTokenRefresh(token)`.
- `api.ts` axios interceptor:
  - Request: gắn `Authorization: Bearer <accessToken>`.
  - Response 401: gọi `/auth/refresh` (deduped via `refreshPromise`), retry original request. Nếu refresh fail → `logout()` + `window.location.href = '/login'`.
- `scheduleTokenRefresh`: parse JWT exp, set timeout refresh trước expire 60s.
- Reload page (`rehydrate`): nếu `state.user && !accessToken` → POST `/auth/refresh` (browser tự gửi HttpOnly cookie) → set new accessToken.

### Socket lifecycle
- `Layout.tsx`: connect socket khi `isAuthenticated`, disconnect khi unmount/logout. `AbortController` cho fetch unread count.
- `CompetitionDetail.tsx`: `joinCompetition(id)` + `joinLeaderboard(id)` trong `useEffect`, `leaveCompetition(id)` cleanup.
- Socket reconnect: khi `connect_error` với message `jwt expired|Invalid token|unauthorized` → re-auth với current token rồi retry sau 1s.

### Markdown rendering
- `react-markdown` + `remark-gfm` + `rehype-sanitize` cho mọi user content (description, rules, discussions). `rehype-sanitize` chặn HTML thô.

### Dark mode
- `useDarkMode` hook trong Layout: `localStorage('theme')`, fallback `prefers-color-scheme`. Toggle thêm/xoá class `dark` trên `<html>`.

### File upload
- Drag-drop hoặc file picker (`<input type="file" accept=".csv">`).
- `axios.post(..., formData, { onUploadProgress })` → progress bar.

---

## 13. Infrastructure & DevOps

### Docker images (production multi-stage)
- **backend/worker**: `node:20-alpine` builder → `npm ci`, `prisma generate`, `tsc build` → final stage copy `dist + node_modules + prisma`, `npm prune --production`, **non-root** user `appuser:appgroup` (UID/GID 1001), `EXPOSE 3000` (backend) / 3001 (worker).
- Backend `CMD`: `npx prisma migrate deploy && node dist/app.js` — auto migrate khi container start.
- **frontend**: builder build static → final stage `nginx:alpine` serve `/usr/share/nginx/html`, **non-root** user `nginx`.

### docker-compose.prod.yml
- 7 services: postgres, redis, minio, backend, worker, frontend, nginx, db-backup.
- Networks: `frontend`, `backend`, `data` (isolation).
- Healthchecks tất cả services với `start_period`, `interval`, `retries`.
- Memory limits: postgres 1G, redis 512M, backend 1G, worker 2G, frontend/nginx 256M, db-backup 256M.
- **db-backup**: postgres alpine container chạy loop `pg_dump | gzip > /backups/backup_<timestamp>.sql.gz` → cleanup `+7 days` → `sleep 86400`. Mount `./backups`.
- **Restart policy**: `unless-stopped` mọi service.
- **Logging**: `json-file` driver với `max-size: 100m`, `max-file: 5` (50m/5 cho frontend/nginx, 10m/3 cho db-backup).
- Redis cần password: `redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes`.

### Nginx (`nginx/nginx.conf`)
- Listen 80 → 301 redirect to HTTPS.
- 443 SSL: TLS 1.2+1.3, HSTS 1 year + subdomains, X-Frame-Options DENY, CSP strict, X-Content-Type-Options nosniff, Permissions-Policy disable camera/mic/geo.
- Rate limit zones: `api 10r/s`, `login 1r/s`, `upload 2r/s`.
- Routes:
  - `~* \.(js|css|png|...)$` → proxy frontend, cache 30d immutable.
  - `/api/v1/auth/login`, `/register` → `login` zone, burst 3-5.
  - `~ /api/v1/competitions/.*/submissions` → `upload` zone, body 200M, timeout 120s.
  - `~ /api/v1/competitions/.*/datasets` → `upload` zone, body 500M, timeout 300s.
  - `/api/` → `api` zone, burst 30.
  - `/socket.io/` → WebSocket upgrade, read timeout 86400s.
  - `/` → frontend SPA.

### Backup
- **Internal cron**: `db-backup` container daily.
- **Manual script**: `scripts/backup-db.sh`:
  - `pg_dump` qua docker exec → gzip → SHA-256 sidecar.
  - Optional encrypt: `openssl enc -aes-256-cbc -salt -pbkdf2` với `BACKUP_ENCRYPTION_KEY`.
  - Optional offsite: `aws s3 cp ... --storage-class STANDARD_IA` với `S3_BACKUP_BUCKET`.
  - Cleanup `+30 days` (env `RETENTION_DAYS`).
- **Restore**: `scripts/restore-db.sh <file>` → confirm prompt → `gunzip | psql`.

### CI/CD (`.github/workflows/ci.yml`)
4 jobs (parallel where possible):
1. **security-audit**: `npm audit --audit-level=high` cho 3 packages (continue-on-error). Check `.env` không bị commit.
2. **backend-test**: services postgres+redis, install, prisma generate+migrate deploy, `npm test --coverage`, `tsc --noEmit`. Upload coverage artifact.
3. **frontend-test**: install, `tsc --noEmit`, `npm test --coverage`, `npm run build`.
4. **worker-test**: install, prisma generate, `npm test --coverage`, `tsc --noEmit`.
5. **docker-build** (needs all 3 above): build 3 prod images.

### Required env vars (`.env.example`, `HANDOFF_CHECKLIST.md`)
Production phải set: `DATABASE_URL` (sslmode=require), `REDIS_URL` (password), `JWT_ACCESS_SECRET`+`JWT_REFRESH_SECRET` (≥32 chars, validated), `MINIO_*` (không default), `FRONTEND_URL`, `API_URL`, `OAUTH_CALLBACK_URL`, `NODE_ENV=production`. Optional: OAuth client IDs, SMTP, `SENTRY_DSN`, `S3_BACKUP_BUCKET`, `BACKUP_ENCRYPTION_KEY`.

---

## 14. Observability

### Logging (Pino)
- Production: `level=info`, JSON.
- Dev: `level=debug`, `pino-pretty` colorized.
- Redaction list xem mục Auth & Security.
- Mỗi request được gán `x-request-id` (uuid v4) propagate qua Nginx tới upstream.

### Sentry
- Backend (`@sentry/node`) + Frontend (`@sentry/react`).
- Dynamic `tracesSampleRate`: 1.0 dev, 0.1 prod.
- `beforeSend` scrub headers, body fields, user.email, ip.

### Health endpoints
- Backend: `/api/health` — checks `prisma.$queryRaw 'SELECT 1'`, `redis.ping`, `minio.bucketExists`. 200 nếu all OK, 503 nếu degraded. Detail bị ẩn cho external.
- Worker: `:3001/` — Redis ping. Trả 503 nếu draining hoặc Redis unreachable.

### Cron jobs (`backend/src/jobs/scheduledJobs.ts`)
- `*/5 * * * *` — `recoverStuckSubmissions`
- `*/5 * * * *` — `autoCompleteCompetitions`
- `0 3 * * *` — `cleanupOldNotifications` (delete read notifications > 90 days)
- Tất cả dùng Redis SETNX lock TTL 120s để tránh duplicate execution multi-instance.
- Startup chạy `recoverStuckSubmissions` 1 lần.

---

## 15. Testing strategy

### Backend (Jest, 198/198 pass, 16 suites, ~11s)
- Unit: services (auth, competition, discussion, enrollment, submission, notification, admin).
- Integration: `competition-rules.test.ts` (FSM + immutability), `security.test.ts` (49 tests), `auth.validator.test.ts`, `discussion.service.test.ts` (vote IDOR), `submission.service.test.ts` (race + limits).
- Helpers: `tests/helpers.ts`.
- Middleware tests: `auth.test.ts`, `validate.test.ts`, `errorHandler.test.ts`.
- Utils tests: `apiResponse.test.ts`, `jwt.test.ts`.

### Frontend (Vitest, 39/40 pass)
- Components: `CompetitionCard`, `LoadingSpinner`, `ProtectedRoute`.
- Stores: `authStore`.
- Utils: `cn`.
- Setup: `tests/setup.ts` (jsdom, jest-dom matchers, MSW).
- 1 failure pre-existing: locale-dependent date format test (xem `KNOWN_LIMITATIONS.md` #6).

### Worker (Jest, 32/35 pass)
- `scorers/index.test.ts`.
- 3 failures pre-existing: scorer registry test expects 5 entries nhưng code có 6 (`CUSTOM` đã thêm). Code đúng, test lỗi thời.

### Security tests (xem `TEST_EVIDENCE.md`)
- 12 XSS payloads (svg, img, details, math, nested, script, iframe, data:, javascript:, BOM).
- 8 JWT attacks (wrong secret, wrong alg HS384, missing iss, missing aud, expired, garbage, `alg:none`, valid).
- 2 IDOR (cross-competition vote on discussion, on reply).
- 14 fairness rules.
- 3 private LB access.
- 12 submission safety.

---

## 16. Quy ước project (PHẢI tuân theo)

### Code style
- TypeScript strict, không có comment thừa giải thích "what" — chỉ comment "why" khi non-obvious.
- Naming: camelCase variables/functions, PascalCase classes/components, snake_case database columns (Prisma `@map`).
- Không hardcode — dùng `config/index.ts`, env vars, constants.
- Reuse: shared logic vào `services/` hoặc `utils/`. Không duplicate.
- Backward compatibility: thay đổi API/schema phải migrate cẩn thận, không break existing flow.
- Single responsibility per function/class.

### Module pattern (backend)
Bất kỳ module mới phải tuân:
```
modules/<name>/
  <name>.routes.ts       Express router, mount middleware
  <name>.controller.ts   Thin: extract req → call service → sendSuccess/AppError
  <name>.service.ts      Business logic, Prisma calls, transactions
  <name>.validator.ts    Zod schemas + inferred types
  <name>.service.test.ts Unit tests
```

### Error handling
- Throw `AppError(message, statusCode, errorCode?)` cho expected errors.
- Để `errorHandler` middleware xử lý Prisma/Zod errors.
- Không `try/catch` chỉ để log lại — pass next(err).

### API response format
```ts
// Success
{ success: true, data: T, message: string, pagination?: Pagination }

// Error
{ success: false, data: null, message: string, errorCode?: string }
```

### Database
- Mọi multi-step write nguy cơ race condition phải dùng `prisma.$transaction(..., { isolationLevel: 'Serializable' })`.
- Index mọi foreign key + filter column thường dùng.
- CHECK constraints cho data integrity (đã apply trong migration thứ 2).

### File handling
- Upload qua disk (Multer disk storage), không dùng memory storage.
- Stream upload tới MinIO (`uploadStream`), không buffer.
- Always sanitize filename qua `sanitizeFilename(...)`.
- Always validate magic bytes qua `validateCsvMagicBytes` hoặc `validateDatasetMagicBytes`.
- Always `fs.unlink(file.path, () => {})` cleanup tmp file (trong `finally` hoặc mọi error path).

### Sanitization
- Mọi user-submitted text content (title, description, rules, discussion content/title, reply content) phải đi qua `stripHtmlTags(...)` cả ở **create** lẫn **update** path.

### Pagination cap
- Default limit 20, max **100** (cap trong service: `Math.min(Math.max(1, limit), 100)`).

---

## 17. Known limitations (`KNOWN_LIMITATIONS.md`)

10 known issues, không blocker. Highlights:
1. Socket rate limit dùng in-memory Map → không shared multi-instance.
2. Worker đọc full CSV vào RAM (đã cap 5M rows, nhưng vẫn nặng).
3. Không có virus scanning.
4. Không có email verification cho local signup.
5. GitHub OAuth không strict verify email như Google.
6. 1 frontend test fail do locale.
7. 3 worker scorer tests fail do registry mismatch.
8. Không có Prometheus/Grafana.
9. Profile password change không invalidate sessions (chỉ reset flow làm).
10. `autoSelectBestSubmissions` dùng Prisma `distinct + orderBy` — có thể không pick đúng best trong race condition.

---

## 18. Quick reference cho Agent

### Khi cần thêm endpoint mới
1. Thêm vào module phù hợp (hoặc tạo module mới theo pattern §16).
2. Tạo Zod validator.
3. Thêm route với middleware: `authenticate`, `authorize`, `validate`, `validateUUID` đúng yêu cầu.
4. Mount trong `app.ts` nếu module mới.
5. Viết unit test ở `*.service.test.ts`.

### Khi cần thay đổi schema
1. Sửa `backend/prisma/schema.prisma` **và** `worker/prisma/schema.prisma`.
2. Generate migration: `npx prisma migrate dev --name <descriptive>`.
3. Cập nhật seed nếu cần.
4. Cập nhật TypeScript types ở `frontend/src/types/index.ts`.
5. Cập nhật Swagger schema ở `backend/src/config/swagger.ts`.

### Khi cần thêm scorer mới
1. Thêm function vào `worker/src/scorers/index.ts`.
2. Thêm vào `SCORERS` map và `HIGHER_IS_BETTER` map.
3. Thêm vào `EvalMetric` enum trong cả 2 schema.prisma.
4. Generate Prisma migration.
5. Thêm vào Zod enum trong `competition.validator.ts`.
6. Thêm vào TypeScript type ở frontend.
7. Thêm vào dropdown ở `frontend/src/pages/CreateCompetition.tsx`.

### Khi cần thêm notification type mới
1. Thêm vào `NotificationType` enum trong cả 2 schema.prisma.
2. Generate migration.
3. Gọi `notificationService.create(...)` ở nơi thích hợp.
4. (Optional) Trigger Socket.IO emit nếu cần real-time.

### Common file paths cheat sheet
- API entry: `backend/src/app.ts`
- Auth logic: `backend/src/modules/auth/auth.service.ts`
- Submission flow: `backend/src/modules/submission/submission.service.ts` + `worker/src/processor.ts`
- LB privacy: `backend/src/modules/leaderboard/leaderboard.service.ts` + `backend/src/config/socket.ts`
- Schema: `backend/prisma/schema.prisma`
- Frontend routes: `frontend/src/App.tsx`
- Frontend API client: `frontend/src/services/api.ts`
- Frontend auth: `frontend/src/stores/authStore.ts`
- Frontend socket: `frontend/src/socket/index.ts`
- Nginx: `nginx/nginx.conf`
- Compose prod: `docker-compose.prod.yml`

---

## 19. Glossary

| Thuật ngữ | Ý nghĩa |
|---|---|
| **Public/Private split** | Ground truth chia ngẫu nhiên (deterministic theo competition) thành 2 phần. Public score hiển thị live, private score giấu tới khi competition COMPLETED. Chống overfit. |
| **Shakeup** | Khoảng cách rank giữa public vs private leaderboard sau khi reveal. |
| **isSelected** | User chọn submission nào đại diện mình trong private LB. Auto-select best private nếu user không chọn. |
| **DLQ** | Dead Letter Queue — BullMQ queue chứa job thất bại sau retries. |
| **Token reuse detection** | Khi refresh token được gửi sau khi đã rotate → detect attacker → invalidate all sessions. |
| **HSTS** | HTTP Strict Transport Security — force browser dùng HTTPS. |
| **CSP** | Content Security Policy — whitelist nguồn script/style/img. |
| **Magic bytes** | First bytes của file để detect type thật (vd ZIP `PK\x03\x04`, gzip `\x1f\x8b`). |
| **Serializable transaction** | Strictest isolation level — phòng race condition cho duplicate check + count + create. |

---

**Last updated**: 2026-04-15  
**Maintainer**: project owner  
**Related docs**: `README.md`, `HANDOFF_CHECKLIST.md`, `RELEASE_READINESS.md`, `SECURITY_FIXES.md`, `TEST_EVIDENCE.md`, `KNOWN_LIMITATIONS.md`
