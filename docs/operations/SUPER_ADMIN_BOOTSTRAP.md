# First Super Admin bootstrap runbook

**Scope:** one-time creation of the first global `SUPER_ADMIN` assignment in a Matjar PostgreSQL database.

## Preconditions

- The target account already exists, is `ACTIVE`, and has a verified email address.
- The identity seed has created the `SUPER_ADMIN` role and its `platform:manage` permission.
- A database operator has independently confirmed the exact PostgreSQL host and database name.
- The operator is using a trusted workstation or controlled job with access to the intended database.
- The operator has confirmed that no global `platform:manage` assignment already exists.

## Execution

Set these values only in the trusted process environment or secret manager. Never commit them, paste them into chat, or put the database URL in a command transcript:

- `ALLOW_SUPER_ADMIN_BOOTSTRAP=true`
- `BOOTSTRAP_SUPER_ADMIN_CONFIRM=CREATE_FIRST_SUPER_ADMIN`
- `BOOTSTRAP_SUPER_ADMIN_EMAIL=<existing verified account email>`
- `BOOTSTRAP_SUPER_ADMIN_EXPECTED_HOST=<independently confirmed database host>`
- `BOOTSTRAP_SUPER_ADMIN_EXPECTED_DATABASE=<independently confirmed database name>`
- `DATABASE_URL=<connection string supplied by the database operator>`

Run:

```sh
node scripts/bootstrap-super-admin.cjs
```

The script validates the explicit database target, serializes concurrent attempts with a PostgreSQL advisory transaction lock, uses a serializable transaction, checks for any existing global platform-management grant, verifies the target account and seeded role, creates one assignment, and writes an immutable system audit event.

## Post-execution verification

1. Confirm the script reports success for the expected database host and database name.
2. Confirm the audit event `identity.super_admin.first_bootstrap` exists for the target user.
3. Sign in with the target account and complete mandatory MFA enrollment/verification before using platform administration.
4. Open `/admin/control-panel` and verify the account can access it.
5. Confirm a normal `ADMIN` account receives no platform-control access.

## Stop conditions

The script must fail closed if the confirmation flag, target email, expected host/database, active verified account, seeded role, or platform permission is missing, or if a global platform-management assignment already exists. Do not bypass these checks with a normal role-assignment API or an ad-hoc SQL update.

## Recovery boundary

This script is **first-admin bootstrap only**, not a recovery tool. A lost-access incident after bootstrap requires a separately approved two-person break-glass procedure, explicit database-target verification, and a recorded incident/audit trail. That automated recovery workflow is not implemented by this script; do not re-enable first-admin bootstrap by deleting or editing audit/assignment rows.
