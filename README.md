# SHREEDEVI SECURITY SERVICE

SHREEDEVI SECURITY SERVICE is a production-oriented attendance and payroll workspace for security operations. It gives administrators a complete workforce view and gives field managers a fast, touch-friendly daily attendance workflow.

## Included

- Role-based admin and manager workspaces
- Guard CRUD, status filtering, location assignment, and Excel bulk import
- Dynamic location and address directory with guarded activation/deactivation
- Manager CRUD with multi-location access control
- Monthly attendance calendar with complete/partial/unmarked states
- Present/absent marking, bulk present action, joining-date eligibility, and always-open historical editing
- Separate company-billing and guard in-hand salaries with live absence and joining-date deductions
- Manual monthly paid/unpaid guard payment tracking with an audit trail
- Dynamic manager compliance reporting plus general and site-register Excel exports
- JWT authentication, bcrypt password hashing, rate-limited login, Helmet, Zod validation, and audit logs
- PostgreSQL schema designed for indexed location/date queries
- Multi-stage Docker images and Nginx reverse proxy

## Quick start with Docker

1. Copy `.env.example` to `.env` and replace the database password and JWT secret.
2. Start the stack:

   ```bash
   docker compose up --build
   ```

3. Seed local demo data once:

   ```bash
   docker compose exec api node apps/api/dist/prisma/seed.js
   ```

4. Open [http://localhost:8080](http://localhost:8080).

The API applies versioned Prisma migrations at startup. Named Docker volumes preserve PostgreSQL data. Demo data is never seeded automatically in production; run `npm run db:seed` only in development.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@secattend.local` | `Secure@123` |
| Manager | `manager@secattend.local` | `Secure@123` |

Change or remove these seeded credentials before a production deployment.

## Local development

Requirements: Node.js 20+, npm 10+, and PostgreSQL 16.

```bash
npm install
copy .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

Set `DATABASE_URL` in `.env`, for example:

```env
DATABASE_URL=postgresql://secattend:password@localhost:5432/secattend?schema=public
```

The frontend runs on port 5173 and proxies `/api` to the backend on port 4000.

## Excel import format

The first worksheet must contain these headers:

Required: `Name`, `Location`, and either `GuardMonthlySalary` or the legacy `MonthlySalary`.

Supported optional columns: `EmployeeID` (blank or `NEW` creates a provisional code), `Phone`, `Email`, `Address`, `CompanyMonthlySalary`, `DateOfJoining`, `Project`, `Village`, `Shift` (`DAY`, `NIGHT`, or `ROTATING`), `PostDetail`, and `Designation` (`SECURITY_GUARD` or `SUPERVISOR`).

Location names must already exist in SHREEDEVI SECURITY SERVICE. Imports are capped at 1,000 rows and 5 MB; invalid rows are skipped and returned with row-specific errors.

## API surface

- `POST /api/auth/login`, `GET /api/auth/me`
- `GET|POST|PATCH|DELETE /api/guards`
- `POST /api/guards/import/excel`
- `GET|POST|PATCH|DELETE /api/managers`
- `GET /api/attendance/calendar/summary`
- `GET|POST /api/attendance/:date`
- `GET /api/salary/:month`, `GET /api/salary/:month/export`, `POST /api/salary/calculate/:month`, `PATCH /api/salary/:month/:guardId/payment`
- `GET /api/reports/attendance`, `/attendance/export`, `/site-attendance/export`, `/compliance`
- `GET /api/dashboard`, `/api/health`
- `GET|POST|PATCH|DELETE /api/locations`, `POST /api/locations/:id/activate`

## Architecture notes

The web and API are independent deployable services. PostgreSQL owns durable state, Prisma provides transactional access and schema constraints, and Nginx serves the compiled SPA while reverse-proxying the API. Attendance has a unique `(guardId, date)` key, salary has a unique `(guardId, monthYear)` key, and all frequent filters are indexed.

For larger deployments, the API can run as multiple stateless replicas behind a load balancer. Move monthly payroll generation to a queue worker, uploads to object storage, and rate-limit state to Redis without changing the domain schema or frontend contracts.

## Production checklist

- Replace demo accounts and secrets.
- Use a managed PostgreSQL instance with encryption and backups.
- Terminate TLS at the load balancer or ingress.
- Add object storage for photos/import artifacts.
- Configure centralized logs and alerting.
- Run `prisma migrate deploy` during deployment (the supplied API image already does this).
- Add your organization’s retention and privacy policy.

For an existing database originally created with `prisma db push`, the supplied API entrypoint detects Prisma error `P3005`, records the matching legacy baseline once, and then applies the dual-salary migration. Other migration errors still abort startup instead of being ignored.
