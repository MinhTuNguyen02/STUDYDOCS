# StudyDocs Production Runbook

This runbook is intentionally command-oriented. Run production steps from a trusted workstation or CI runner; never paste database passwords into tracked files or shell history.

## 1. Required environments

- Local: local API plus Gotenberg; PostgreSQL may be local or a non-production Supabase project.
- Test: isolated PostgreSQL and isolated Supabase Storage bucket. E2E requires `TEST_DATABASE_URL` and refuses an unapproved remote database.
- Staging: production-like services and anonymized/sample data; migrations and browser regression run here first.
- Production: Supabase PostgreSQL/Storage, deployed API, frontend and Gotenberg.

Copy `backend/.env.example` and `frontend/.env.example`; fill secrets through the hosting platform. Do not commit `.env` files.

## 2. Pre-deploy gate

1. Confirm CI passes lint, typecheck, unit tests, builds, bundle budget, dependency critical-advisory gate and migration smoke test.
2. Review the SQL of every new migration, especially enum changes, destructive DDL and backfills.
3. Run `npx prisma migrate deploy` against staging and complete role-based browser regression.
4. Confirm `/api/health/live` and `/api/health/ready` are healthy in staging.
5. Schedule a maintenance window for destructive or locking migrations.

## 3. Backup and restore verification

Create a timestamped custom-format backup using the Supabase direct connection string. Supply the password through a temporary environment variable or secret manager, not in the command text.

```powershell
pg_dump --format=custom --no-owner --no-acl --file="studydocs-predeploy.backup" "$env:DIRECT_URL"
pg_restore --list "studydocs-predeploy.backup"
```

Restore the backup into a disposable PostgreSQL database and run a smoke query before approving production deployment:

```powershell
createdb "$env:RESTORE_TEST_DATABASE"
pg_restore --no-owner --no-acl --dbname="$env:RESTORE_TEST_DATABASE" "studydocs-predeploy.backup"
psql "$env:RESTORE_TEST_DATABASE" -c "SELECT COUNT(*) FROM accounts;"
```

Retain backups according to the organization retention policy and encrypt them at rest. A backup is not considered valid until a restore drill succeeds.

## 4. Deployment

1. Deploy the backend artifact with the new code but do not route traffic yet when the migration is not backward compatible.
2. Run from `backend/`:

```powershell
npx prisma migrate status
npx prisma migrate deploy
```

3. Check migration logs and `npx prisma migrate status` again.
4. Route traffic, deploy the frontend, then verify login/refresh/logout, document listing/preview, checkout callback, download entitlement and admin moderation.
5. Watch error rate, database latency, Gotenberg readiness and payment callback failures.

Never use `prisma db push` against staging or production.

## 5. Rollback and incident response

- Application regression with compatible schema: route traffic to the previous application artifact.
- Forward migration defect: stop writes for the affected flow, fix with a reviewed forward migration, test it on a restored copy, then deploy it.
- Destructive data loss or unrecoverable schema fault: stop writes, preserve logs, restore the verified pre-deploy backup to a new database, validate it, then switch the connection string.
- Do not manually edit Prisma migration history or run an ad-hoc reverse migration in production.
- Rotate any secret that may have appeared in logs, URLs, commits or screenshots.

Record the incident timeline, request IDs, affected migrations, recovery actions and follow-up tests in the incident report.

## 6. Scheduled operations

- Daily: verify backups and health/readiness alerts.
- Weekly: review failed payment callbacks, upload conversions, auth throttling and dependency advisories.
- Monthly: perform a restore drill in isolation, review storage access policy and expired object cleanup.
- Before each release: run the checklist in `docs/technical-remediation-plan.md` and record any explicitly accepted risk.
