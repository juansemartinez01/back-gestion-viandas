<!--
SYNC IMPACT REPORT
==================
Version change: (unversioned template) → 1.0.0
Type: MAJOR — initial constitution ratification from blank template.

Modified principles: N/A (initial creation)

Added sections:
  - Core Principles (7 principles)
  - Technology Stack
  - Module Classification & Implementation Order
  - Governance

Removed sections: N/A

Templates reviewed:
  ✅ .specify/templates/plan-template.md — Constitution Check section present and generic;
     no domain-specific updates required (gates will be derived per-feature from this constitution).
  ✅ .specify/templates/spec-template.md — Generic; no domain-specific sections required.
  ✅ .specify/templates/tasks-template.md — Generic; NestJS module structure (entity/DTO/service/
     controller/module) should be used as task pattern when generating tasks for this project.
  ⚠  .specify/templates/commands/ — Directory not found; no command files to update.
  ⚠  README.md — Exists but contains project-level content; no principle references requiring update.

Deferred TODOs:
  - TODO(RATIFICATION_DATE): Exact project kick-off date not provided; set to first constitution
    authoring date 2026-06-06 as a reasonable proxy. Amend if a prior decision record exists.
-->

# Rochester Viandas Management System — Backend Constitution

## Core Principles

### I. Template API Contract (NON-NEGOTIABLE)

All HTTP responses MUST conform to the Innoview Backend Template standard without exception:

- **Success**: `{ ok: true, data, meta? }` — use `ok()` or `page()` helpers from
  `src/common/http/api-response.ts`. Never build response objects by hand.
- **Error**: `{ ok: false, requestId, statusCode, error: { code, message, details? }, timestamp, path }`
  — emitted automatically by the global exception filter; do not override per-controller.
- Business errors MUST be thrown as `AppError` instances with a code from `ErrorCodes` enum
  (`src/common/errors/error-codes.ts`). `throw new Error()` is FORBIDDEN for business exceptions.
- Every new domain error code MUST be added to `ErrorCodes` before it can be used anywhere.

**Rationale**: Consistency in the API contract allows clients, mobile apps, and the public portal
to handle responses with a single parser. Ad-hoc error shapes cause silent client regressions.

### II. Multi-Tenancy by Default

Every business entity MUST carry `tenant_id` and MUST be queried through tenant-aware abstractions:

- Extend `BaseCrudTenantService` (or call `TenancyService.requireTenantId()`) for every repository
  operation. Raw `repo.find()` / `repo.findOne()` without a tenant filter is FORBIDDEN.
- Public portal endpoints (unauthenticated) MUST resolve the tenant from the `x-tenant-key` header
  before any data access.
- `TENANCY_REQUIRED=true` MUST be set in production environments. Any bypass requires an explicit
  override approved by the project lead and documented in this constitution.
- Shared infrastructure (`src/common/`) is tenant-neutral; business modules (`src/modules/`) are
  always tenant-bound.

**Rationale**: A single leaked cross-tenant query exposes all client data. Defense-in-depth through
the service layer is the only acceptable approach given the SaaS model.

### III. Role-Based Access Control

Authentication and authorization are mandatory on all endpoints:

- Every endpoint MUST be protected by `JwtAuthGuard`. No unguarded route except explicitly listed
  public portal paths (which still apply rate limiting and tenant resolution).
- Role restriction MUST use the `@Roles()` decorator together with `RolesGuard` — never inline
  role checks inside service logic.
- Domain roles map as follows and MUST NOT be conflated:
  - `administrador` — full system access
  - `supervisor` — menu and order management; no user/configuration management
  - `operador_caja` — delivery, cash payments, surplus sales, day closing
  - `cocina` — read-only production sheet access
- Public portal routes are the ONLY exception to `JwtAuthGuard`; they MUST be explicitly
  annotated and reviewed during any security audit.

**Rationale**: Role violations are a P0 security defect. Centralizing guards prevents accidental
privilege escalation as the codebase grows.

### IV. Business Rule Integrity (NON-NEGOTIABLE)

The following domain invariants MUST be enforced at the service layer and MUST NOT be bypassed
by any endpoint, migration, or script:

1. A delivered order (`entregado`) cannot be delivered again — idempotency check required.
2. A cancelled order (`cancelado`) cannot transition to delivered.
3. An order with `pago_online_pendiente` status cannot be delivered until payment is confirmed.
4. Surplus sales (`ventas-sobrantes`) can only occur after production is confirmed for that day.
5. Surplus stock and order-reserved stock MUST be tracked in separate counters — never merged.
6. All stock mutations (delivery + surplus sales) MUST use concurrency control
   (`SELECT FOR UPDATE` or optimistic locking) to prevent overselling.
7. Online payment pending orders expire after 15 minutes; reserved availability MUST be
   released automatically when the reservation window expires.
8. Cancelling a confirmed order after production confirmation moves the unit to surplus stock,
   not discarded.
9. Day closing (`cierre-operativo`) MUST mark all confirmed-but-not-delivered orders as
   `no_retirado` atomically.
10. All orders MUST have a human-readable public code (format: `VIA-YYYY-NNNNNN`) in addition
    to their internal UUID.

**Rationale**: These rules represent contractual guarantees to end-users and cafeteria operators.
Violations cause inventory discrepancies, double-charges, or incorrect production counts.

### V. Audit Trail

Every sensitive action MUST write an audit log entry via `AuditService.write()` using the
`auditLogPayload()` helper before or within the same transaction:

**Mandatory audit events:**
- Create / edit / deactivate: sedes, puntos-retiro, menus-base, menus-publicados
- Publish or change state of menus-publicados
- Create manual orders, edit confirmed orders, cancel orders
- Confirm production
- Adjust stock (any manual adjustment)
- Deliver orders, register cash payments
- Sell surplus (ventas-sobrantes)
- Close operational day
- Change general configuration or Mercado Pago credentials

Audit writes MUST be transactional — if the main operation rolls back, the audit entry MUST also
be rolled back (same `EntityManager`/`DataSource.transaction()` scope).

**Rationale**: Regulatory compliance and operational forensics require a non-repudiable record of
every mutation to critical domain state.

### VI. Module Architecture & Code Quality

Every new domain module MUST follow this structural contract:

- **Directory**: `src/modules/<module-name>/`
- **Required files**: `<name>.entity.ts`, `<name>.dto.ts` (or `dto/` folder), `<name>.service.ts`,
  `<name>.controller.ts`, `<name>.module.ts`
- DTOs MUST use `class-validator` decorators (`@IsString`, `@IsUUID`, `@IsEnum`, etc.).
- Enums MUST be defined in the entity file or a sibling `<name>.enums.ts` — never inline strings.
- Business logic MUST live in services. Controllers MUST only call services and return results.
- Services MUST NOT import other services directly if doing so creates a circular dependency;
  use NestJS module imports instead.
- Queries MUST use TypeORM QueryBuilder or repository methods. Raw SQL is forbidden unless the
  query cannot be expressed via the ORM and the exception is documented in a code comment.
- All transactional operations MUST use `DataSource.transaction()` or an injected `EntityManager`.
- Every new module MUST be registered in `AppModule`.
- File uploads MUST store `public_id` (assetId) + `url` in the entity column — never binary data.
- Shared infrastructure belongs in `src/common/`; no domain logic may live there.

**Module classification** (determines base class selection):
- **Type A — CRUD tenant-safe simple**: extend `BaseCrudTenantService` + `BaseCrudController`.
  Applies to: sedes, puntos-retiro, categorias-menu, etiquetas-menu, alergenos, clientes,
  banners-promociones.
- **Type B — CRUD + business logic**: `BaseCrudTenantService` base with custom action endpoints.
  Applies to: menus-base, menus-publicados, pedidos, produccion-viandas, stock-viandas.
- **Type C — Purely operational**: custom services with transactional use-cases; no CRUD base.
  Applies to: mercado-pago, entregas, ventas-sobrantes, cierres-operativos, dashboard-viandas,
  reportes-viandas.

**Rationale**: Uniform structure makes every module immediately navigable, testable, and auditable.
Type misclassification leads to security gaps (missing tenant scoping) or technical debt.

### VII. Implementation Discipline

Modules MUST be implemented in the following stage order. No module in stage N+1 may be started
until all modules in stage N are complete and reviewed:

| Stage | Name | Modules |
|-------|------|---------|
| 1 | Master Data | sedes → puntos-retiro → categorias-menu → etiquetas-menu → alergenos → clientes |
| 2 | Menus | menus-base → menus-publicados → banners-promociones |
| 3 | Orders (offline) | pedidos (presencial only) → cancelaciones → consulta por DNI |
| 4 | Mercado Pago | preferencias → webhook → confirmación automática → logs → reserva 15min |
| 5 | Production & Stock | produccion-viandas → stock-viandas → movimientos-stock |
| 6 | Daily Operations | entregas → ventas-sobrantes → cierres-operativos |
| 7 | Reporting | dashboard-viandas → reportes-viandas → integracion-kiosco |

Any deviation from this order requires documented approval from the project lead and MUST be
noted in the relevant feature spec.

**Rationale**: Later stages depend on data produced by earlier stages. Out-of-order implementation
creates untestable modules and forces costly rewrites.

## Technology Stack

The following stack is NON-NEGOTIABLE. Substitutions require a constitution amendment:

| Concern | Choice |
|---------|--------|
| Framework | NestJS (TypeScript) |
| ORM | TypeORM |
| Database | PostgreSQL |
| Deployment | Railway (initial); architecture MUST remain AWS-compatible |
| File storage | S3 via existing template `FilesModule` integration |
| Payment gateway | Mercado Pago (webhooks + preferences API) |

No additional ORM, HTTP framework, or payment processor may be introduced without a MAJOR
version amendment to this constitution.

## Governance

**Authority**: This constitution supersedes all other written or verbal conventions. In case of
conflict between this document and any other guide (README, PR template, team convention), this
constitution takes precedence.

**Amendment procedure**:
1. Author opens a PR with proposed changes to this file.
2. PR title MUST include the target version (e.g., `constitution: amend to v1.1.0`).
3. At least one other contributor must approve.
4. The `LAST_AMENDED_DATE` and `CONSTITUTION_VERSION` MUST be updated in the same commit.
5. A Sync Impact Report (HTML comment at top of file) MUST accompany every amendment.

**Versioning policy**:
- MAJOR: Backward-incompatible removal or redefinition of a principle (e.g., removing multi-tenancy
  requirement, replacing TypeORM).
- MINOR: New principle, new section, or material expansion of guidance.
- PATCH: Clarifications, wording improvements, typo fixes, non-semantic refinements.

**Compliance review**: Every PR that introduces a new module or modifies an existing one MUST
include a Constitution Check confirming all seven principles are satisfied. The plan template's
`## Constitution Check` section is the canonical gate.

**Version**: 1.0.0 | **Ratified**: 2026-06-06 | **Last Amended**: 2026-06-06
