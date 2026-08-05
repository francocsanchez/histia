# Changelog

## 2026-08-05

### Added

- Módulo administrativo de `Liquidaciones` con vista compacta, filtros y acceso a edición administrativa de atenciones.
- Página `Pagos` como placeholder dentro del bloque de finanzas.
- Edición administrativa ampliada de atenciones con soporte para `coseguro odonto`, `valor atención` y cambios de estado.
- Reglas visuales reutilizables para estados de atención.
- Guía operativa actualizada del proyecto en `AGENTS.md`.

### Changed

- Navegación principal convertida a navbar superior con dropdowns para `Configuración` y `Finanzas`.
- `Atenciones` ahora muestra resúmenes de estado más compactos en el listado.
- Edición normal de `Atenciones` restringida a filas `pendiente`; filas auditadas quedan bloqueadas.
- Odontólogos limitados a sus propias atenciones en listado, apertura y edición.
- Todos los usuarios autenticados pueden crear y editar pacientes; activación y desactivación siguen reservadas a administradores.
- Lookups de obras sociales y códigos abiertos para usuarios autenticados en flujos que necesitan datos de referencia activos.
- Formulario de pacientes corregido para mostrar correctamente la obra social actual, incluso cuando la opción no venía en el lookup inicial.

### Fixed

- Guardado de edición administrativa de atenciones que quedaba bloqueado por validación silenciosa.
- Alineación de filas y encabezados en la tabla de `Liquidaciones`.
- Colores de estado en `Liquidaciones` según la convención operativa actual.
- Dropdowns del navbar que quedaban abiertos al cambiar entre menús o navegar.
- Resolución inconsistente de `obraSocialId` en pacientes cuando el documento venía populado desde Mongo.
