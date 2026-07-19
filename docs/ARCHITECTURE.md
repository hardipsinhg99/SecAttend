# Architecture and business rules

## Boundaries

- **Web:** React SPA responsible for accessible presentation and client-side session state.
- **API:** Express service responsible for authentication, authorization, validation, and domain rules.
- **Database:** PostgreSQL is the source of truth. Relations and uniqueness constraints prevent duplicate operational records.
- **Edge:** Nginx serves immutable frontend assets and proxies `/api` to the service network.

## Authorization

JWTs carry identity and role, but every authenticated request also verifies that the account still exists and is active. Admin-only routes are protected at the router level. Manager guard and attendance queries additionally filter through assigned location relations, preventing ID-based cross-location access.

## Attendance consistency

Each guard can have only one status per date. A save uses a database transaction and upserts the complete submitted set. Future dates are rejected. Historical edits are rejected after `ATTENDANCE_EDIT_HOURS`; each successful save creates an audit event with actor, timestamp, IP address, and record count.

## Payroll consistency

The daily rate is monthly salary divided by calendar days in the selected month. Every on-leave record deducts one daily rate. Calculations are rounded to two decimal places and persisted as a monthly snapshot. Re-running a month updates the same records, so the operation is idempotent.

## Scaling path

At the documented target (500 guards and 50 managers), indexed relational queries and bulk transactional writes are sufficient. A future scale-out can add Redis-backed rate limiting, BullMQ payroll jobs, S3-compatible uploads, read replicas for reporting, and independently scaled API replicas while retaining the same contracts.
