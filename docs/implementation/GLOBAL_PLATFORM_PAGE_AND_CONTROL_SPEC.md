# Global Platform Page and Control Specification — Super Admin

## Scope
This specification covers the platform-wide Super Admin control center only. It does not replace the operational Admin modules or duplicate their existing pages.

## Access boundary
- All control-center pages and APIs require a verified server-side session with the global `platform:manage` permission.
- The permission must be a GLOBAL grant with the reserved GLOBAL scope marker.
- Ordinary role assignment and revocation cannot grant or remove `SUPER_ADMIN` or any role containing `platform:manage`.
- First Super Admin provisioning remains an explicit, guarded bootstrap operation; it is not exposed as an ordinary UI action.
- Unauthorized page access is hidden with not-found; APIs return 401/403 as appropriate.

## Implemented page: Platform audit log
- Route: `/admin/control-panel/audit-log`
- Entry: link in `/admin/control-panel`.
- Purpose: read-only inspection of platform audit events.
- Filters: action substring and resource substring.
- Columns: timestamp, actor identity/type, action, resource and resource ID, scope, recorded metadata.
- Pagination: descending by timestamp and ID, cursor-based, 50 records by default, maximum 100 per request.
- API: `GET /api/admin/control-panel/audit-log`.
- Service: `src/server/admin/platform-audit.ts`.
- Data source: existing Prisma `AuditLog` model; no migration required.
- Security: authorization is enforced inside the service as well as the page; private/no-store response; no write or delete endpoint exists.

## Remaining Super Admin control-center work
1. Role and permission catalogue: inspect existing Role/Permission seed and assignment flows, then add read-only catalogue and tightly guarded edits only where the model supports them.
2. Approval workflows: define explicit pending/approved/rejected state transitions for high-risk platform actions; require actor separation and immutable audit records.
3. Platform settings: expose only settings backed by existing typed persistence; do not create generic arbitrary key/value writes for secrets or security controls.
4. Operational health: show verified service state only when a real health check exists; never infer service health from missing data.

## Critical verification
- Verify page and API denial for unauthenticated and non-platform users.
- Verify GLOBAL scope requirements and ensure scoped grants cannot enter the control center.
- Verify action/resource filters, empty results, page boundaries, cursor continuation and stable ordering.
- Verify audit metadata is rendered as text and never interpreted as markup.
- Verify role assignment and revocation both block canonical and alternate platform-management roles.
- Run Prisma validation/generation, typecheck, lint, focused tests and production build. Do not run migrations against production or a user database.
