# SECURITY FIXES — Production Hardening

## 1. Stored XSS via regex-based HTML sanitization
- **Risk**: CRITICAL — Any enrolled user could execute JavaScript in all other users' browsers via discussion/reply content
- **Root Cause**: `stripHtmlTags()` used regex which missed `<svg onload>`, `<img onerror>`, `<details ontoggle>`, `<math>` payloads, data URIs
- **Files Changed**: `backend/src/utils/fileHelpers.ts`
- **Mitigation**: Replaced regex with `sanitize-html` library (zero allowed tags, recursive escape)
- **Tests Added**: `backend/src/tests/security.test.ts` — 12 XSS payload tests including svg, img, details, math, nested, script, iframe, data URI, javascript URI

## 2. `updateTopic` and `updateReply` bypassed sanitization
- **Risk**: HIGH — Authors could inject XSS on update even though create was sanitized
- **Root Cause**: `updateTopic()` and `updateReply()` stored raw input without calling `stripHtmlTags()`
- **Files Changed**: `backend/src/modules/discussion/discussion.service.ts`
- **Mitigation**: Added `stripHtmlTags()` to both update paths
- **Tests Added**: Covered by existing create tests + new XSS payload tests

## 3. Socket.IO JWT verification missing algorithm/issuer/audience
- **Risk**: HIGH — Algorithm confusion attack, token forgery potential
- **Root Cause**: `socket.ts` called `jwt.verify()` directly without pinning algorithm, issuer, audience
- **Files Changed**: `backend/src/config/socket.ts`
- **Mitigation**: Replaced with `verifyAccessToken()` from `utils/jwt.ts` which enforces HS256, issuer, audience
- **Tests Added**: `backend/src/tests/security.test.ts` — 8 JWT tests: wrong secret, wrong algorithm (HS384), missing issuer, missing audience, expired, garbage, none algorithm attack

## 4. Vote IDOR — cross-competition voting
- **Risk**: HIGH — Enrolled user in Competition A could vote on discussions in Competition B
- **Root Cause**: Vote service checked entity existence but not competition alignment; `targetId` from request body overrode URL context
- **Files Changed**:
  - `backend/src/modules/discussion/discussion.service.ts` — added `competitionId` parameter, use `findFirst` with competition scope
  - `backend/src/modules/discussion/discussion.controller.ts` — pass `req.params.id` as competitionId
  - `backend/src/modules/discussion/discussion.validator.ts` — made `type` and `targetId` required
- **Mitigation**: Vote target must belong to the competition in the URL. `findFirst` with `{ competitionId }` replaces `findUnique`.
- **Tests Added**: `discussion.service.test.ts` — 2 IDOR tests (cross-competition discussion vote, cross-competition reply vote)

## 5. Submission duplicate hash check race condition
- **Risk**: HIGH — Two concurrent identical submissions could both pass the duplicate check
- **Root Cause**: Duplicate hash `findFirst` was outside the Serializable transaction
- **Files Changed**: `backend/src/modules/submission/submission.service.ts`
- **Mitigation**: Moved `findFirst` for duplicate hash inside the `$transaction(... { isolationLevel: 'Serializable' })` block
- **Tests Added**: `submission.service.test.ts` — duplicate submission rejection test

## 6. OAuth exchange-code endpoint missing validation
- **Risk**: MEDIUM — No Zod schema validation; `JSON.parse` on Redis data without shape check
- **Files Changed**:
  - `backend/src/modules/auth/auth.validator.ts` — added `exchangeCodeSchema`
  - `backend/src/modules/auth/auth.routes.ts` — applied `validate(exchangeCodeSchema)`
  - `backend/src/modules/auth/auth.controller.ts` — added JSON parse error handling + shape validation
- **Tests Added**: `auth.validator.test.ts` — 3 exchange code schema tests

## 7. Health endpoint information disclosure
- **Risk**: LOW — Publicly accessible endpoint exposed database/Redis/MinIO status names
- **Files Changed**: `backend/src/app.ts`
- **Mitigation**: Detailed `checks` object only returned for internal requests (no X-Forwarded-For). External requests get only status + timestamp.
