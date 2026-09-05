# Histia Agent Guide

# npm cli
Siempre correr el npm ci localmente para evitar inconvenientes en el build de la imagen en github

# Sugerencia commit

Siempre debes actualizar el CHANGELOG.md de este proyecto y una vez de hacer eso debes sugerir el commit mostrando el mensaje en pantalla para que el usuario tenga una opcion para crear el commit. Y tambien deberas actualizar este archivo (AGENTS.md) para tener contexto.
Tambien debes corroborar que se realize el Deploy Image sin errores ya que se va a subir a github para contruir la imagen en github action

## Contexto reciente

- El gráfico `Honorarios anualizados` de `/inicio` debe agrupar `pagoOdontologoCentavos + coseguroOdontoCentavos` por estado de cada código (`pendiente`, `ok`, `diferido`, `denegado`, `no-cargado`), para reflejar los importes no cobrables; no debe volver a usar los estados de pago como segmentos del gráfico.
- `Pagos` permite incluir conceptos pendientes de meses distintos en una única liquidación. El filtro de mes es sólo de búsqueda; el documento y el movimiento deben persistir `attentionMonths`, y el historial debe encontrar un pago al filtrar cualquiera de esos períodos, sin perder `attentionMonth` por compatibilidad.
- En `/inicio`, la card `Honorarios pendientes del año` debe calcularse únicamente con `pagoOdontologoCentavos` de códigos de Atenciones en estado `pendiente`; el gráfico anual conserva su propia separación por marcas de pago e incluye coseguro odonto.
- `Pagos` permite cargar varios debitos manuales por liquidacion, cada uno con importe y observacion, y debe confirmarse mostrando codigos, coseguros, ortodoncia, debitos y total neto antes de marcar conceptos como pagados.
- Los debitos de `Pagos` se persisten como snapshot dentro del pago y de su movimiento automatico; el movimiento usa el neto, mientras el bruto se conserva para auditoria y un neto de cero debe seguir dejando trazabilidad.
- En `Ortodoncia`, el listado debe conservar los datos poblados de paciente y ortodoncista al transformar resultados de agregacion; los pagos parciales pendientes se pueden editar o eliminar, pero quedan bloqueados una vez liquidados desde `Pagos`. Para eliminar un subdocumento tipado se debe usar `splice()` con su indice, no `pull()`.
- `Codigos de obras sociales` ahora debe ofrecer al lado izquierdo de `Nuevo codigo` las acciones `Descargar Excel` e `Importar Excel`, reutilizando un flujo de preview validado antes de aplicar cambios masivos.
- La importacion de `Codigos de obras sociales` usa el Excel exportado como base editable: si una fila trae `id` actualiza ese codigo, si no trae `id` intenta crear uno nuevo, puede cambiar tambien `activo`, y la ausencia de una fila no debe modificar ni desactivar registros existentes.
- La columna `obraSocialId` del Excel exportado de `Codigos de obras sociales` debe persistir como string real del documento, nunca como objeto poblado, y el preview de importacion debe permitir marcar todas las filas validas con un solo boton.
- El route handler de exportacion de `Codigos de obras sociales` debe responder el workbook como `Uint8Array` compatible con `Response`, porque `Buffer` directo dispara error de TypeScript en el build.
- En `Atenciones`, la columna `Observacion` de cada codigo debe tener mas ancho y usar un `textarea` visible tambien en edicion/solo lectura, porque con un input corto el texto practicamente no se alcanza a auditar.
- `Pagos` ahora debe ofrecer dos acciones masivas junto a `Generar pago` para seleccionar todos los codigos liquidables o todos los coseguros odonto liquidables dentro de la pagina visible y respetando los filtros activos.
- El historial de `Pagos` ahora debe incluir `Ver detalle` por fila, abriendo un dialog inline con los `lineItems` liquidados para auditar exactamente que codigo o coseguro se pago.
- El listado de `/atenciones` ahora debe exponer una columna `Observaciones` y marcar `Posible tope mensual superado` cuando la suma mensual de códigos para esa atención excede el límite de la obra social del paciente.
- La pantalla `/inicio` ahora debe incluir un gráfico anualizado por odontólogo con la suma mensual de `valor atención + coseguro odonto`, distinguiendo claramente lo pendiente de cobrar y lo ya pagado.
- En el gráfico anualizado de `/inicio`, `valor atención` debe contabilizarse por su marca de pago (`pendiente` o `pagado`) aunque la línea siga en estado de auditoría distinto de `ok`, para que no queden visibles sólo los coseguros.
- `StatCard` debe tolerar valores renderizables (`ReactNode`) y no sólo `number`, porque `/inicio` ya muestra métricas monetarias formateadas en pesos dentro del mismo componente reutilizable.
- En `/inicio`, las cuatro cards de métricas principales deben entrar en una sola fila en desktop, manteniendo un layout responsive para resoluciones más chicas.
- En esa fila superior de `/inicio`, `Atenciones del mes` y `Códigos del mes` deben ocupar juntos `2/6` del ancho, mientras `Honorarios pendientes` y `Honorarios pagados` deben ocupar juntos `4/6`.
- En `RX`, los importes visibles para carga y edicion se ingresan en pesos con mascara monetaria, aunque la persistencia interna siga siendo en centavos.
- En el listado de `RX`, la columna operativa visible debe priorizar la obra social del paciente y no mostrar `Generada por`.
- En el formulario de `RX`, no se muestra `Usuario generador`; el origen del derivante debe verse compacto en una sola linea cuando sea posible.
- Existe un nuevo modulo admin-only `Encuestas` con importacion manual de Excel, campañas de WhatsApp y worker dedicado `histia-whatsapp-worker` separado de `histia-app`.
- La sesion de WhatsApp para `Encuestas` se persiste en MongoDB; el numero se usa solo para encuestas y no se almacena historial completo de conversacion, solo estados y respuestas.
- `Encuestas` ahora tiene una pantalla dedicada `/encuestas/vincular` para operar la vinculacion del numero y mostrar el QR en una pestaña separada.
- Si la vinculacion de `Encuestas` queda en `disconnecting`, el flujo correcto ahora es `Preparar QR`, que limpia el estado y deja al worker regenerar un QR nuevo.
- En desarrollo local, `npm run dev` ahora debe levantar tanto la app como el worker de WhatsApp para que `Encuestas` pueda mostrar QR y estado real sin pasos manuales extra.
- La importacion de `Encuestas` debe normalizar los encabezados del Excel antes de mapear filas, porque los archivos reales pueden traer `Paciente` y `Doctor` con mayusculas iniciales.
- Los telefonos de `Encuestas` deben persistirse en formato WhatsApp argentino `549...`; no alcanza con un numero argentino valido si queda como linea fija `54...`.
- El worker de `Encuestas` debe tomar un lease en MongoDB antes de abrir Baileys para evitar sesiones pisadas y errores `440` cuando aparezcan multiples instancias por error.
- El acceso a `/encuestas/vincular` desde la card principal debe abrirse con un enlace absoluto y fallback en la misma pestaña, porque `window.open` solo puede fallar dentro del navegador embebido con mensajes genericos de conexion.
- La vinculacion QR de `Encuestas` depende hoy de un `postinstall` que parchea `@whiskeysockets/baileys` para cubrir el ACK pre-login y el `companion_reg_refresh`; sin ese parche el telefono puede escanear el QR y aun asi mostrar error de conexion.
- Al reiniciar el worker de `Encuestas`, el lease de Mongo no debe crear otro singleton: hay que reutilizar el documento `whatsappConnection` existente para evitar `E11000 duplicate key` durante reemplazos cortos del proceso.
- En desarrollo, si el puerto `3010` ya quedo tomado por un worker previo, el health server de `Encuestas` no debe tirar abajo `npm run dev`; tiene que avisar y continuar.
- Las respuestas entrantes de `Encuestas` no deben depender solo de `remoteJid @s.whatsapp.net`; con Baileys actual pueden venir por `@lid` con telefono en campos alternativos y hay que resolverlos para no dejar la encuesta clavada en `waiting_rating`.
- Si una encuesta de `Encuestas` fue cancelada por admin, se debe permitir recrear la misma atencion en una nueva campaña; para eso hay que limpiar el registro cancelado previo antes de insertar el nuevo, manteniendo el bloqueo solo para duplicados no cancelados.
- La configuracion operativa de `Encuestas` ya no vive dentro de `/encuestas`: ahora se administra desde `Configuracion > Mensajes encuestas` en una pantalla separada.
- La pantalla `/encuestas` debe priorizar la operacion diaria con campañas, conexion WhatsApp y resultados; los comentarios del paciente se consultan desde un boton `Comentarios` por fila solo cuando existe texto guardado.
- El script `scripts/patch-baileys.js` sigue ejecutandose en CommonJS desde `postinstall`; si CI vuelve a lintarlo, debe mantener la excepcion explicita para `require()` o migrarse completo a un formato compatible sin romper Node.
- `/encuestas` ya no debe organizar el trabajo alrededor del historial de campañas visible: la vista principal ahora usa una tabla plana de encuestas individuales, cards filtrables por estado, importacion via modal y un indicador minimo de vinculacion WhatsApp con punto rojo/verde.
- La tabla operativa de `/encuestas` debe mantenerse compacta: sin columnas de archivo ni acciones administrativas en la grilla principal, con `Estado` al final y preferentemente representado con iconos para lectura rapida.
- La grilla principal de `/encuestas` debe mantener tambien el alineado vertical centrado entre texto, botones e iconos para evitar filas visualmente desparejas.
- Como `postinstall` ejecuta `scripts/patch-baileys.js`, cualquier stage de Docker que haga `npm ci` debe copiar ese archivo antes de instalar dependencias; si no, la imagen falla incluso con `package.json` y `package-lock.json` correctos.
- El worker de `Encuestas` necesita invalidar eventos de sockets viejos al reconectar; si no, un unico proceso puede entrar en loops de `connected/logging in/conflict replaced` y parecer una colision entre instancias cuando en realidad se esta auto-pisando.
- La sesion de WhatsApp de `Encuestas` ahora debe obedecer una intencion persistida `desiredState` (`running` o `stopped`) y un `resetNonce` en `whatsappConnection`, para que `Desvincular` detenga de verdad la integracion y `Preparar QR nuevo` fuerce un reset limpio sin que la API borre auth por su cuenta.
- La pantalla `/encuestas/vincular` ya no debe mostrar el telefono como vinculado fuera de `connected`; durante `disconnecting`, errores o sesion detenida solo se refleja el estado real del worker y se acelera el polling para seguir la transicion de QR.
- La vinculacion de `Encuestas` ahora deja un historial corto de eventos en `whatsappConnectionEvents`; si vuelve a haber desalineacion entre el celular y la UI, primero revisar esos eventos recientes para distinguir `QR tardio`, `connection close`, `lease perdido`, `reset` o error de boot del worker.
- `Desvincular` en `Encuestas` debe entenderse como reset total de la sesion: limpia el numero visible enseguida, deja la integracion en `stopped` y obliga a generar un QR nuevo para volver a vincular.
- La pantalla `/encuestas/vincular` debe ofrecer tambien un log visible y copiable desde la propia UI, incluyendo `details` de cada evento, para poder diagnosticar problemas en produccion sin depender de `docker logs` o Mongo manual.
- La importacion de `Encuestas` deja las encuestas en `queued` dentro de una campana `ready`; el envio operativo se dispara manualmente desde la columna `Acciones` con `Encuestar`, disponible tambien para `send_failed`.
- El envio manual de `Encuestas` debe pasar por el worker que posee la sesion de WhatsApp mediante `WHATSAPP_WORKER_URL`; no abrir sockets desde el route handler para evitar reemplazos de sesion.
- Si WhatsApp devuelve un corte terminal `logged_out`, el worker ahora debe dejar trazado el ultimo envio intentado y activar una pausa operativa (`globalPause` + campañas `running` a `paused`) para que el equipo revise la sesion antes de retomar envios.
- La pantalla principal `/encuestas` debe ofrecer ademas un control rapido de pausa global de envios, visible junto a `Vincular numero`, para poder escanear un QR nuevo sin que arranque un envio automatico apenas vuelva la sesion.
- La pantalla `/encuestas/vincular` debe permitir tambien borrar todos los eventos de `whatsappConnectionEvents` desde la UI cuando el historial acumulado ya no sirva para diagnostico actual.
- Existe un nuevo modulo `Ortodoncia` accesible para `administrador` y `ortodoncista`, con un solo tratamiento activo por paciente, alta por DNI como en `Atenciones` y pagos parciales libres que calculan saldo del paciente y monto liquidable del profesional.
- `Pagos` ahora debe contemplar tambien conceptos provenientes de `Ortodoncia`, distinguiendo el origen en candidatos, historial y detalle, mientras sigue creando un unico movimiento automatico por liquidacion.
- El rol `ortodoncista` debe estar disponible en `Usuarios`, en permisos y en navegacion, pero el modulo dedicado de `Pacientes` para roles clinicos no administradores sigue siendo solo de lectura.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes. Before changing routes, pages, layouts, route handlers, or framework behavior, read the relevant guide in `node_modules/next/dist/docs/`.

<!-- END:nextjs-agent-rules -->

## Project Snapshot

Histia is an administrative web system for a dental clinic. It manages already-completed work only.

Current implemented scope as of August 10, 2026:

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
- Encuestas de satisfaccion por WhatsApp
- Ortodoncia

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
- `ortodoncista`
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
  - `Mensajes encuestas`
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
- Authenticated users can change their own password from the account menu
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
- Supports filtering by code status
- Persists active filters and pagination in the URL across navigation and administrative edits
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
