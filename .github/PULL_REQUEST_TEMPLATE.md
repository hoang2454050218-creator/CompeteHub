## Summary
<!-- 1-3 sentences explaining what changed and why. -->

## Type of change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Refactor / cleanup
- [ ] Documentation
- [ ] Infrastructure / CI
- [ ] Security

## Checklist

### Code quality
- [ ] `tsc --noEmit` passes for every package I touched (backend / frontend / worker)
- [ ] No narration comments — only "why" comments where intent is non-obvious
- [ ] No hardcoded secrets, URLs, or magic numbers; uses config / constants

### Tests
- [ ] Added or updated unit tests
- [ ] All tests pass locally (`npm test`)
- [ ] Coverage threshold respected (backend ≥ 70% statements)

### Security
- [ ] No new endpoints exposed without `authenticate` / `authorize` where appropriate
- [ ] User-submitted text passes through `stripHtmlTags` on both create and update paths
- [ ] Multi-step writes that can race use `prisma.$transaction(..., { isolationLevel: 'Serializable' })`
- [ ] Sensitive admin actions emit an `auditLog.record(...)` entry

### Schema (if touched)
- [ ] Migration is backward-compatible (new columns have defaults / nullable)
- [ ] Backend AND worker schema synced (`backend/prisma/schema.prisma` ↔ `worker/prisma/schema.prisma`)
- [ ] Migration tested against an existing dataset (no data loss)

### API (if touched)
- [ ] Pagination capped at `limit=100` server-side
- [ ] Zod validator on body and query params
- [ ] Response uses `sendSuccess(...)` envelope; errors throw `AppError`

## Test plan
<!-- Steps reviewers can follow to verify the change works. -->
1. ...
2. ...

## Screenshots / logs (if relevant)
<!-- Drop here. -->

## Related
<!-- Issue, ADR, audit finding ID, etc. -->
