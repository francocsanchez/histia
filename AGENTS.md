# Histia Agent Guide

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes. Before changing routes, pages, layouts, route handlers, or framework behavior, read the relevant guide in `node_modules/next/dist/docs/`.
<!-- END:nextjs-agent-rules -->

## Project Snapshot

Histia is an administrative web system for a dental clinic. It manages already-completed work only.

Current implemented scope as of August 9, 2026:

- Authentication with `Better Auth`
- Users with multiple roles
- Obras sociales
- Códigos de obras sociales
- Pacientes
- RX module
- Atenciones module
- Administrative Liquidaciones read view
- Pagos module
- Movimientos module
- Tipos de movimientos catalog
- Dashboard operativo mensual en `Inicio`
- Dashboard administrativo de indicadores

Out of scope:

- Turnos
- Agendas
- Disponibilidad horaria
- Reservas
- Calendarios de atención
- Historias clínicas

Every new feature must respect this rule:

> Histia registers and administers already performed prestaciones for later control and liquidation.

## Core Stack

- Next.js 16 App Router
- React 19
- TypeScript strict mode
- MongoDB local or remote
- Mongoose
- Better Auth
- Tailwind CSS v4
- React Hook Form
- Zod

## Environment

Expected local flow:

1. Complete `.env.local`
2. Run `npm install`
3. Run `npm run seed:admin`
4. Run `npm run dev`

Main environment variables in use:

```env
MONGODB_URI=
MONGODB_DB_NAME=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
NEXT_PUBLIC_APP_NAME=Histia
SEED_ADMIN_EMAIL=
SEED_ADMIN_PASSWORD=
SEED_ADMIN_NAME=
SEED_ADMIN_LAST_NAME=
```

There is a committed `.env.example` and the real local file is `.env.local`.

## Roles And Access

Supported roles:

- `administrador`
- `odontologo`
- `radiologo`

Role behavior currently implemented:

- `administrador`
  - Full access to all current modules
  - Can audit atenciones from the administrative flow
  - Can access Dashboard, Configuración, Liquidaciones, Pagos, and Movimientos
- `odontologo`
  - Can access `Atenciones`
  - Can only list, open, and edit their own atenciones
  - Can read active reference data needed by the app
- `radiologo`
  - Can access `RX`
  - Can read active reference data needed by the app

Permissions are centralized in `src/lib/permissions/` and must always be validated on both UI and server.

## Current Navigation

Main sidebar entries:

- `Dashboard`
- `Inicio`
- `Atenciones`
- `RX`
- `Pacientes`

Admin-only collapsible sections:

- `Configuracion`
  - `Obras sociales`
  - `Codigos`
  - `Tipos de movimientos`
  - `Usuarios`
- `Finanzas`
  - `Liquidaciones`
  - `Pagos`
  - `Movimientos`

If a user does not have the required role, the menu item should be hidden and the route/API must still reject access.

Notes:

- `Dashboard` is admin-only and must remain separate from `/inicio`
- `/inicio` keeps the operational monthly dashboard used by current non-admin flows

## Domain Modules

### Obras sociales

Managed with logical deactivation using `activo`.

Relevant fields:

- `nombre`
- `cantidadPrestacionesMes`
- `activo`

Rules:

- Unique normalized name
- Monthly prestation limit is a configuration value

### Códigos de obras sociales

Relevant fields:

- `nombre`
- `codigo`
- `obraSocialId`
- `valorCentavos`
- `activo`

Rules:

- `codigo` is text
- Preserve leading zeroes
- Unique per `obraSocialId + codigoNormalizado`
- Monetary values are stored in centavos

### Pacientes

Relevant fields:

- `nombre`
- `apellido`
- `dni`
- `obraSocialId | null`
- `activo`

Rules:

- `dni` is stored as normalized text
- Unique DNI
- Obra social is optional

### Usuarios

Relevant fields:

- `name`
- `apellido`
- `email`
- `passwordHash`
- `roles`
- `activo`

Rules:

- Unique lowercase email
- No public registration
- Only admins create users
- Never expose `passwordHash`
- Prevent leaving the last active admin without admin role or active status

### RX

This module registers radiographic attentions already performed.

Current types:

- `carpal`
- `panoramica`

Relevant fields:

- `fecha`
- `pacienteId`
- `derivanteTipo`
- `derivanteUserId | null`
- `derivanteExternoNombre | null`
- `tipoRx`
- `valorCentavos | null`
- `usuarioGeneradorId`
- `observaciones | null`

Rules:

- Access only for `radiologo` and `administrador`
- Patient search by DNI
- Inline patient creation inside RX flow
- Internal referrer must be an active user with role `odontologo`
- External referrer is free text

### Atenciones

This module registers dental prestations already performed.

Relevant root fields:

- `fecha`
- `pacienteId`
- `obraSocialId`
- `usuarioCargaId`
- `observacionGeneral | null`
- `codigos[]`

Each line in `codigos[]` stores:

- `codigoObraSocialId`
- `pieza | null`
- `coseguroCentavos | null`
- `coseguroOdontoCentavos | null`
- `observacion | null`
- `pagoOdontologoCentavos`
- `estado`

Supported line statuses:

- `no-cargado`
- `pendiente`
- `ok`
- `diferido`
- `denegado`

Important rules:

- Access for `odontologo` and `administrador`
- Normal user flow is for dentists to manage their own attentions
- Patient must exist and have an active obra social
- Codes available in the form come only from the patient's active obra social
- Monthly limit is controlled by `paciente + obra social + calendar month`
- Exceeding the monthly limit shows warning but does not block saving

### Atenciones Audit Rule

This is already implemented and must be preserved:

- Only lines with status `pendiente` are editable by odontólogos in the normal `Atenciones` flow
- Lines in `no-cargado`, `ok`, `diferido`, or `denegado` are considered audited
- Audited lines are visible but locked in the normal edit screen
- In normal edit mode, dentists cannot add or remove lines from an existing attention
- Dentists can only edit their own attentions
- Admins keep full edit power from the administrative flow

Administrative edit is currently entered from:

- `Liquidaciones` via `/atenciones/[id]/editar?admin=1`

### Liquidaciones

Current scope is read-only administrative review, not final liquidation generation.

Current behavior:

- Admin-only
- Uses existing `Atenciones` data
- One row per atención
- Compact table with code lines, values, coseguro totals, odontólogo totals, and statuses
- Includes access to administrative edit

### Pagos

Current scope:

- Admin-only operational module
- Generates odontologist payments by selectable concept line
- Separates `codigo` and `coseguro odonto` payment marks
- Persists payment history with snapshots
- Creates an automatic finance movement for each generated payment

### Movimientos

This module acts as the clinic's operational accounting ledger.

Relevant fields:

- `fecha`
- `descripcion`
- `direccion`
- `tipoMovimientoId | null`
- `tipo`
- `montoCentavos`
- `origenTipo`
- `origenId | null`
- `creadoAutomaticamente`
- `metadata | null`

Rules:

- Access only for `administrador`
- Manual movements can be created directly from the module
- Automatic movements are generated from other modules, currently `Pagos`
- Automatic movements are read-only from the UI
- Money is stored as integer centavos
- Accounting sign is represented by `direccion`, not by negative amounts

### Tipos de movimientos

This catalog configures the available movement types for accounting flows.

Relevant fields:

- `nombre`
- `direccion`
- `activo`
- `systemKey | null`

Rules:

- Access only for `administrador`
- User-created types can be created, edited, activated, and deactivated
- System types are reserved for integrated flows and cannot be deactivated
- Manual movement creation only uses active movement types

### Dashboard Admin

Admin-only route:

- `/dashboard`

Current behavior:

- Global cards for active patients, active odontologists, and historical balance
- Annual charts for patients by obra social, attentions by month, income vs expense by month, income by movement type, expense by movement type, and codes by status
- Monthly chart for odontologist performance based on total code volume and status distribution
- Chart tooltips must stay visible within their chart container bounds

Rules:

- Keep this dashboard separate from `/inicio`
- The annual selector only affects annualized charts
- The historical balance card must remain all-time
- Odontologist comparison is month-based and should make it easy to identify who attends the highest code volume

## UI And Visual Rules

The project uses a custom visual system on top of the configured shadcn preset.

Current UI conventions:

- Spanish UI text
- Technical identifiers in English
- Desktop-first layouts, but still usable on mobile
- Compact administrative tables
- Cards for filters, stats, and forms
- Every user-facing money input must use the money mask format `x.xxx.xxx,xx`
- Status badges for attention status colors:
  - `No cargado`: black
  - `Pendiente`: yellow
  - `OK`: green
  - `Diferido`: red
  - `Denegado`: red

When adjusting tables or forms, prefer denser layouts over tall rows if readability is preserved.

## Data And API Conventions

Current API shape:

```json
{
  "success": true,
  "data": {}
}
```

Paginated shape:

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 1
  }
}
```

Error shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos ingresados no son validos",
    "fields": {}
  }
}
```

Current error codes:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `VALIDATION_ERROR`
- `DUPLICATE_RECORD`
- `INACTIVE_RELATED_RECORD`
- `INVALID_CREDENTIALS`
- `INTERNAL_ERROR`

Note:

- The app currently uses HTTP `409` in some business-conflict cases while still returning one of the existing error codes.

## Persistence And Normalization

Keep these rules consistent:

- Emails normalized to lowercase
- DNI normalized by removing dots, dashes, and spaces
- Codes stored as text
- Money stored as integer centavos
- Main catalog entities use logical deactivation with `activo`

Current important indexes:

- Users by unique email
- Obras sociales by unique normalized name
- Códigos by unique `obraSocialId + codigoNormalizado`
- Pacientes by unique DNI

## Practical Implementation Notes

- Prefer existing patterns from `src/services`, `src/models`, `src/lib/validations`, and `src/components/shared`
- Do not add schedule-related abstractions
- Do not expose sensitive fields in DTOs or API responses
- When changing route handlers or App Router pages, check the local Next 16 docs first
- If you change attention status behavior, update both:
  - normal dentist flow
  - administrative liquidation flow

## Current Reality Over Old Plans

If you find older documentation in the repo describing `Atenciones`, `RX`, `Liquidaciones`, or `Pagos` as future work, consider that documentation outdated.

As of August 8, 2026:

- `RX` exists
- `Atenciones` exists
- `Liquidaciones` exists as an administrative read/audit view
- `Pagos` exists as an operational payment module
- `Movimientos` exists as the accounting ledger module
- `Tipos de movimientos` exists as a configurable catalog under `Configuracion`

Use the current codebase as the source of truth when older text conflicts with implemented behavior.
