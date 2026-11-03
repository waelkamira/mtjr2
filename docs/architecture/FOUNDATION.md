# Technical foundation

## Purpose

This document records the initial technical decisions for Mtjr2. It is a clean implementation and does not import legacy application code.

## Stack baseline

- Next.js App Router and React with TypeScript.
- PostgreSQL as the transactional system of record.
- Prisma as the data access and migration tool.
- Zod for runtime input validation.
- Vitest as the initial unit-test runner.

Dependency versions are explicitly pinned where framework compatibility matters. They must be installed and verified in a real Node.js environment before the foundation is considered operational.

## Application boundaries

- `src/app`: routing, layouts, pages, and thin HTTP handlers.
- `src/features`: feature-oriented UI and client state.
- `src/server`: server-only domain services, repositories, policies, and integrations.
- `src/lib`: shared infrastructure such as database access and environment parsing.
- `src/components`: reusable presentation components.
- `prisma`: canonical schema, migrations, and seed scripts.
- `tests`: unit, integration, and end-to-end tests.
- `docs`: architecture decisions, system specifications, and evidence.

Business rules must not live in React components. Route handlers must authenticate, validate, call a service, and translate the result into an HTTP response. Services own business workflows; repositories own persistence queries.

## Identity and access domain — first vertical slice

The initial schema establishes:
- users and account status;
- normalized unique email identifiers;
- roles, permissions, and scoped role assignments. Global assignments use the reserved `GLOBAL` scope pair; scoped grants must provide a concrete scope type and identifier. The scope columns are non-null so PostgreSQL's composite uniqueness constraint cannot be bypassed by multiple `NULL` values;
- revocable sessions stored by token hash;
- OAuth account linkage;
- single-use password-reset and verification token records;
- consent history;
- login-attempt audit data;
- append-oriented security audit events.

This is a persistence foundation only. It does not yet implement registration, login, password hashing, session issuance, OAuth callbacks, email delivery, rate limiting, authorization middleware, or UI workflows.

## Security rules

- Never store raw session, reset, or verification tokens; persist cryptographic hashes.
- Never return password hashes or token hashes in API DTOs.
- Resolve authorization on the server and deny by default.
- Scope seller/staff permissions to the relevant store or resource.
- Do not trust role names or scope identifiers supplied by a browser.
- Financial, inventory, order, and permission changes must be audited.
- Secrets belong in environment variables or a managed secret store, never in Git.

## Schema governance

Before adding a model, document the capability, owning domain, write/read workflow, service/API, authorization, invariants, indexes, migration, and tests. Prefer extending an existing model or relation when it already represents the business concept.

## Verification still required

This repository bootstrap was written through GitHub. It has not yet been installed or executed in a local Node.js/PostgreSQL environment. Before calling the foundation operational, run dependency installation, Prisma validation/client generation, typecheck, lint, tests, and a clean-database migration rehearsal, then record exact output and commit SHA.


## Runtime configuration

- `src/lib/env.ts` validates required environment variables with Zod before the Prisma singleton is created.
- The database URL must use PostgreSQL; the application URL must be valid; `AUTH_SECRET` must contain at least 32 characters.
- Validation errors identify variable names and constraints but never echo secret values.
