# Changelog

## 2026-09-05

### Added

- `Pagos` ahora permite cargar multiples debitos manuales con importe y observacion dentro de una liquidacion, para descontar retiros u otros anticipos del profesional.
- Antes de confirmar una liquidacion, `Pagos` ahora muestra un resumen de codigos, coseguros, ortodoncia, debitos y total neto a transferir.

### Changed

- El gráfico `Honorarios anualizados` de `/inicio` ahora agrupa sus barras por estado de atención, visibilizando también los importes `diferido` y `denegado` junto a `pendiente`, `ok` y `no cargado`.
- `Pagos` ahora permite liquidar en una misma operación conceptos pendientes de distintos meses; cada pago conserva todos los períodos de atención incluidos y el historial puede recuperarlo al filtrar cualquiera de ellos.
- En `/inicio`, la card `Honorarios pendientes del año` ahora suma exclusivamente los honorarios de códigos de Atenciones cuyo estado es `pendiente`, sin incluir coseguros ni códigos auditados con otro estado.
- Los pagos y movimientos automaticos ahora guardan el total de debitos, el total neto y el detalle de cada descuento, manteniendo el total bruto historico para auditoria.
- El historial y `Ver detalle` de pagos ahora exponen los debitos aplicados y el neto efectivamente pagado.
- El listado de `Ortodoncia` ahora muestra correctamente el paciente y el profesional asociados a cada tratamiento.
- Los pagos parciales de `Ortodoncia` pendientes de liquidacion ahora pueden eliminarse con confirmacion; los pagos ya liquidados permanecen protegidos.
- La eliminacion de pagos pendientes de `Ortodoncia` ahora usa una operacion compatible con TypeScript sobre el arreglo de subdocumentos.

## 2026-08-31

### Added

- Nuevo modulo `Ortodoncia` para usuarios `administrador` u `ortodoncista`, con alta por DNI reutilizando/creando paciente inline, seguimiento de tratamientos activos y registro de pagos parciales del paciente.
- Nuevas APIs protegidas para `Ortodoncia`: listado, detalle, lookups por DNI y carga/edicion de pagos parciales dentro del tratamiento.

### Changed

- El sistema ahora reconoce el rol `ortodoncista` en tipos, validaciones, permisos, filtros de usuarios y navegacion principal.
- `Pagos` ahora integra candidatos y detalle de liquidaciones provenientes tanto de `Atenciones` como de `Ortodoncia`, distinguiendo el origen en la UI y en los `lineItems` persistidos.
- El historial de `Pagos` ahora muestra tambien el total liquidado de `Ortodoncia`, manteniendo el movimiento financiero automatico unificado por pago.
- La gestion de `Pacientes` para roles clinicos sin administracion queda en modo lectura desde el modulo dedicado, manteniendo el alta inline solo dentro de los flujos operativos como `Atenciones`, `RX` y `Ortodoncia`.

## 2026-08-30

### Changed

- La pantalla de `Codigos de obras sociales` ahora suma acciones de `Descargar Excel` e `Importar Excel` junto a `Nuevo codigo`, con exportacion completa de la base y preview validado antes de aplicar cambios masivos.
- La importacion masiva de `Codigos de obras sociales` ahora actualiza filas existentes por `id`, permite crear filas nuevas sin `id`, admite cambiar `activo` desde Excel y deja intactos los codigos que no vengan en el archivo.
- La exportacion de `Codigos de obras sociales` ahora incluye correctamente `obraSocialId` como texto utilizable en Excel, y el preview de importacion suma un boton para incluir de una vez todas las filas validas.
- El endpoint de exportacion de `Codigos de obras sociales` ahora devuelve el Excel como `Uint8Array` compatible con `Response`, corrigiendo el error de TypeScript en build.
- La grilla de codigos dentro de `Atenciones` ahora amplia la columna `Observacion` y usa un `textarea` mas alto por fila para que el texto sea visible al ver o editar una atencion.
- `Pagos` ahora ofrece botones de seleccion masiva para marcar todos los codigos o todos los coseguros odonto visibles y liquidables sin perder la seleccion persistida de otras paginas.
- La pantalla de `Pagos` ahora refresca candidatos e historial despues de generar una liquidacion y deja visibles los checks de conceptos ya pagados para evitar re-selecciones accidentales.
- El historial de `Pagos` ahora incorpora `Ver detalle` con dialog inline para auditar cada linea liquidada, incluyendo paciente, codigo, estado snapshot e importes por concepto.

## 2026-08-27

### Changed

- El listado de `/atenciones` ahora muestra una columna `Observaciones` que marca `Posible tope mensual superado` cuando el total mensual de esa atención queda por encima del límite de la obra social del paciente.
- `/inicio` ahora muestra un gráfico anualizado de honorarios por odontólogo, separando por mes lo pendiente de cobrar y lo ya pagado sobre `valor atención + coseguro odonto`.
- El gráfico anualizado de honorarios en `/inicio` ahora suma `valor atención` por su marca real de pago, aunque la línea todavía no esté en estado `ok`, evitando que se vean sólo los coseguros en pendientes.
- Las cards reutilizables de métricas ahora aceptan texto formateado además de números, corrigiendo el error de TypeScript en el build de `/inicio` al mostrar importes anuales en pesos.
- Las cuatro métricas principales de `/inicio` ahora se muestran en una sola fila cuando hay ancho suficiente, manteniendo el acomodo responsive en pantallas chicas.
- En desktop, la fila superior de `/inicio` ahora reparte el ancho en proporción `2/6` para métricas mensuales y `4/6` para honorarios anuales, dando más espacio visual a los importes.

## 2026-08-24

### Added

- La tabla operativa de `Encuestas` ahora incorpora la columna `Acciones` con el boton `Encuestar` para disparar cada mensaje de forma individual desde una encuesta pendiente o fallida.
- Nuevo endpoint protegido `POST /api/encuestas/surveys/[id]/send` y canal interno con el worker para enviar manualmente sin abrir una segunda sesion de WhatsApp.

### Changed

- La importacion de Excel de `Encuestas` ahora crea las encuestas como pendientes y deja la campana en `ready`, sin iniciar envios automaticos.
- Los envios manuales ignoran la ventana horaria configurada, pero siguen respetando la habilitacion general, la pausa global y una sesion de WhatsApp conectada.
- Los intentos manuales ahora quedan diferenciados en `whatsappConnectionEvents`, y los envios se serializan en el worker para evitar mensajes concurrentes.

## 2026-08-19

### Added

- Helpers puros y pruebas nuevas para la sesion de WhatsApp, cubriendo backoff de reconexion, polling de la vista de vinculacion y visibilidad del numero solo cuando la sesion esta realmente conectada.

### Changed

- La sesion de WhatsApp de `Encuestas` ahora usa una maquina de estados persistida en MongoDB con `desiredState`, `resetNonce` y metadata de ultimo corte para separar la intencion operativa del estado transitorio del socket.
- Las acciones `Desvincular` y `Preparar QR nuevo` ahora se registran como comandos para el worker en lugar de limpiar la auth desde la API, evitando carreras entre la UI y Baileys.
- El worker de `Encuestas` ahora ejecuta resets ordenados, invalida generaciones viejas, corta la sesion anterior antes de abrir una nueva y solo reintenta automaticamente desconexiones transitorias con backoff controlado.
- Los cortes terminales de WhatsApp como `loggedOut` o `connectionReplaced` ahora dejan la integracion detenida y requieren `Preparar QR nuevo`, en lugar de entrar en loops de reconexion.
- `Desvincular` ahora actua explicitamente como reset total + stop: limpia el numero visible de inmediato, ordena al worker borrar la auth activa y deja trazas mas claras para distinguir ese caso de un simple refresh del QR.
- La pantalla `/encuestas/vincular` ahora acelera el polling mientras la sesion esta conectando o esperando QR, oculta el numero fuera del estado `connected`, bloquea acciones durante resets y muestra mensajes mas claros segun el estado real.
- La vinculacion de WhatsApp ahora registra eventos recientes en MongoDB y los expone en la pantalla `/encuestas/vincular`, permitiendo rastrear resets, cierres, QR tardios ignorados, perdidas de lease y errores del worker sin depender solo de `docker logs`.
- El log visual de `/encuestas/vincular` ahora suma resumen operativo, detalles JSON por evento y un boton `Copiar log`, pensado para poder diagnosticar fallos tambien desde produccion sin entrar al servidor.
- El worker de WhatsApp ahora serializa las escrituras de credenciales en MongoDB, registra el ultimo envio intentado en los eventos de cierre y, ante un `401/logged_out`, activa `globalPause` y pausa las campañas `running` para evitar que la operacion siga como si la sesion siguiera valida.
- La vista principal de `/encuestas` ahora expone un boton rapido de `Pausar envios` / `Reanudar envios`, para poder volver a vincular WhatsApp sin disparar mensajes automaticamente mientras la cuenta sigue restringida o bajo revision.
- La pantalla `/encuestas/vincular` ahora permite borrar por completo el historial visual de eventos con `Borrar log`, para limpiar diagnosticos viejos que ya no aportan contexto.

## 2026-08-17

### Added

- Nuevo modulo administrativo `Encuestas` con importacion manual de Excel `.xlsx/.xls`, preview validado, creacion de campanas y panel de control integrado en HISTIA.
- Nuevas APIs de encuestas para preview, campañas, cancelacion individual, configuracion operativa y estado de conexion WhatsApp.
- Worker dedicado `histia-whatsapp-worker` con healthcheck propio para mantener la sesion de WhatsApp, procesar respuestas y enviar encuestas de forma gradual sin depender del navegador.
- Persistencia nueva en MongoDB para campañas, encuestas, configuracion de encuestas, sesion de WhatsApp y control de mensajes espontaneos.

### Changed

- La navegacion principal ahora incluye la entrada `Encuestas`, visible solo para administradores.
- La configuracion operativa de `Encuestas` salio de `/encuestas` y ahora vive bajo `Configuracion > Mensajes encuestas`, con una pantalla dedicada para editar textos y parametros del modulo.
- La configuracion de entorno y los ejemplos de produccion ahora contemplan `WHATSAPP_WORKER_PORT`.
- El flujo de despliegue `histia-update` y `compose.yaml` ahora levantan y validan tanto `histia-app` como `histia-whatsapp-worker`.
- La tarjeta de WhatsApp en `Encuestas` ahora incluye un boton `Vincular numero` que abre una pestaña dedicada con el estado y el QR de vinculacion.
- El flujo de vinculacion de WhatsApp ahora permite `Preparar QR`/`Preparar QR nuevo` y corrige el caso en que el estado quedaba trabado en `disconnecting` sin volver a generar QR.
- El entorno local ahora levanta `next dev` y el worker de WhatsApp juntos desde `npm run dev`, evitando que la UI quede sin QR por falta de proceso `histia-whatsapp-worker`.
- La importacion de encuestas ahora normaliza encabezados del Excel sin depender de mayusculas/minusculas, por lo que columnas como `Paciente` y `Doctor` se procesan correctamente.
- La normalizacion telefonica de encuestas ahora persiste celulares argentinos en formato WhatsApp `549...` de manera consistente.
- El worker de WhatsApp ahora usa un lease en MongoDB para evitar que dos instancias tomen la misma sesion y disparen desconexiones `440` por reemplazo de conexion.
- El boton `Vincular numero` ahora abre la pantalla dedicada con una URL absoluta y fallback a la misma pestaña, evitando errores genericos del navegador embebido al intentar abrir una nueva pestaña.
- La instalacion ahora aplica un `postinstall` que parchea `Baileys` para tolerar ACKs antes del login y refrescar el QR cuando WhatsApp envia `companion_reg_refresh`, evitando fallos de vinculacion despues del escaneo.
- El lease del worker de WhatsApp ahora reutiliza el documento singleton existente y evita choques por `duplicate key` durante reinicios o reemplazos breves del proceso.
- El worker de WhatsApp ahora tolera en desarrollo que el puerto `3010` ya este ocupado por un proceso previo, evitando que `npm run dev` se caiga entero solo por el healthcheck local.
- El worker de WhatsApp ahora resuelve el telefono de respuestas entrantes tambien desde JIDs alternativos de Baileys, evitando que encuestas validas queden trabadas en `waiting_rating` cuando el paciente ya respondio.
- La recreacion de campañas ahora permite volver a importar la misma atencion si la encuesta previa habia sido cancelada, limpiando ese registro cancelado para habilitar un nuevo test o reenvio controlado.
- `/encuestas` ahora muestra los resultados de cada campaña con una columna de comentarios que abre un dialog solo cuando el paciente dejo texto adicional.
- El script `scripts/patch-baileys.js` ahora declara explicitamente su uso de CommonJS para que el lint de CI no falle por `require()` durante el pipeline de build.
- `/encuestas` fue redisenada para operacion diaria: ahora muestra una tabla full-width de encuestas individuales, cards clickeables que filtran por estado, importacion de Excel en modal y un indicador compacto de vinculacion WhatsApp en lugar de la card detallada.
- La tabla principal de `/encuestas` ahora es mas compacta: se quitaron las columnas `Archivo` y `Accion`, el `Estado` paso al final y se representa con iconos en lugar de texto.
- La fila de resultados de `/encuestas` ahora alinea verticalmente texto, boton de comentarios e icono de estado para que toda la tabla se vea centrada y pareja.
- El `Dockerfile` ahora copia `scripts/patch-baileys.js` antes de cada `npm ci`, evitando que el `postinstall` falle durante la construccion de imagenes por faltar ese script dentro del contexto de cada stage.
- El worker de WhatsApp ahora invalida eventos de sockets viejos y serializa mejor los reintentos de reconexion, reduciendo los loops internos que podian terminar en `conflict replaced` aun con una sola instancia viva.

## 2026-08-15

### Changed

- El formulario de `RX` ahora captura el valor en pesos con mascara monetaria y lo convierte internamente a centavos sin exponer esa aclaracion en la UI.
- La tabla de `RX` ahora muestra la obra social del paciente en lugar de la columna `Generada por`, y el modal deja de mostrar el campo `Usuario generador`.
- La columna `Derivante` en `RX` ahora prioriza una sola linea con mas ancho disponible y un indicador visual de origen interno o externo.

### Fixed

- La edicion de `RX` ahora vuelve a mostrar correctamente el importe guardado en formato pesos y persiste los cambios de valor al guardar.

## 2026-08-13

### Changed

- La sincronizacion de Mercado Pago ahora consulta una ventana principal de 24 horas en las corridas horarias y manuales, manteniendo la recovery diaria de 48 horas.
- La importacion de Mercado Pago ahora conserva metadata adicional del reporte de cuenta, incluyendo descripcion original, referencia externa, medio de pago y segmentacion para auditoria.
- La importacion de Mercado Pago ahora usa `PAYER_NAME` del CSV nuevo para mostrar `Mercado Pago - Nombre` en el detalle visible de los ingresos cuando el pagador viene informado.
- Los tipos de movimientos ahora permiten repetir nombre entre `ingreso` y `egreso`, manteniendo la unicidad solo dentro de la misma direccion.
- La barra de filtros de `Movimientos` ahora muestra la fecha y hora de la ultima sincronizacion de Mercado Pago junto con un indicador visual de estado.

### Fixed

- La persistencia de `Tipos de movimientos` ahora sincroniza el indice compuesto `nombreNormalizado + direccion`, evitando conflictos con nombres iguales en direcciones distintas.
- La importacion automatica de Mercado Pago ahora etiqueta mejor las salidas de dinero reales como egresos de tipo `Salida de dinero Mercado Pago`.
- Las sincronizaciones fallidas de Mercado Pago ahora escriben el error persistido y su contexto en la consola del server, incluso cuando la API remota marca el reporte como fallido.
- El scheduler de Mercado Pago ahora trata los bloqueos `429` por limite de reportes como una omision esperada y los baja a warning en lugar de registrarlos como fallo de tarea.
- El modelo de sincronizaciones de Mercado Pago dejo de declarar dos veces el indice de `reportId`, eliminando el warning de Mongoose en runtime.

## 2026-08-10

### Added

- Integracion automatica con Mercado Pago para importar movimientos contables desde `account/settlement_report`, con endpoints administrativos protegidos, deduplicacion por `SOURCE_ID + COMPONENTE` y scheduler server-side.
- Persistencia de sincronizaciones de Mercado Pago con auditoria de estado, cantidades procesadas, errores y metadata de conciliacion.
- Script `npm run test:mercadopago` con pruebas focalizadas para parseo CSV, descomposicion de componentes y claves idempotentes de importacion.
- Boton `Forzar sync` en `Movimientos`, con icono de recarga, para disparar manualmente la sincronizacion de Mercado Pago desde la pantalla administrativa.
- Documentacion y ejemplos de despliegue Docker actualizados para incluir `MERCADOPAGO_ACCESS_TOKEN` en runtime.
- Opción `Cambiar contrasena` en el menú del ícono de usuario, con modal de confirmación por doble ingreso.
- Endpoint de autoservicio `POST /api/account/password` para que cualquier usuario autenticado cambie su propia contraseña.

### Changed

- La columna `Estado` de `Movimientos` fue reemplazada por `Accion`, con modal de edicion para cambiar concepto y descripcion desde la tabla.
- `Movimientos` ahora admite el origen `Mercado Pago` junto a `Manual` y `Pago`, manteniendo la tabla unificada y los filtros existentes.
- Los tipos de movimiento de sistema ahora incluyen variantes especificas para ingresos, impuestos y comisiones de Mercado Pago.
- La tarjeta `Balance total en pesos` de `/dashboard` ahora muestra tambien la conversion a USD usando la cotizacion oficial `venta` de `https://dolarapi.com/v1/dolares/oficial`.
- La tarjeta `Balance total en pesos` de `/dashboard` ahora separa `Importe en pesos` e `Importe en dolares` con tipografias mas chicas para evitar que el card crezca con montos largos.
- El formulario de `Codigos de obras sociales` ahora captura importes en pesos con mascara monetaria y los convierte correctamente a centavos al guardar.
- Los pacientes ahora normalizan `nombre` y `apellido` a minusculas al crear o editar, evitando diferencias de escritura como `Sanchez` vs `sanchez`.
- Las consultas administrativas de `Movimientos` y del historial de syncs ahora disparan mantenimiento automatico de Mercado Pago si la sincronizacion horaria o la revision de pendientes estan vencidas.
- La importacion de Mercado Pago ahora registra tambien transferencias cuyo impacto llega solo en `REAL_AMOUNT`, evitando perder egresos sin `TRANSACTION_AMOUNT`.
- La sincronizacion de Mercado Pago ahora tolera `reportId` reutilizados por la API y reaprovecha la sync existente en lugar de fallar con error interno.
- El helper interno de errores de Mercado Pago ahora descarta `null` explicitamente para evitar advertencias de TypeScript en build.
- Las fallas al iniciar syncs de Mercado Pago ahora exponen el mensaje concreto persistido por la sincronizacion en lugar de responder solo con un error generico.
- Las syncs de Mercado Pago ahora respetan un cooldown de 15 minutos despues de un rechazo por limite de uso para evitar seguir golpeando la API innecesariamente.
- La creacion automatica de reportes de Mercado Pago vuelve a un ritmo conservador de 1 hora, manteniendo el chequeo de pendientes cada 5 minutos para no saturar la API.

- El gráfico `Atenciones anualizadas` del dashboard administrativo ahora muestra barras apiladas por obra social del paciente en cada mes.
- `Liquidaciones` ahora soporta filtro por estado de código.
- Los filtros y la paginación de `/liquidaciones` ahora persisten en la URL y se conservan al entrar y salir de la edición administrativa de atenciones.

## 2026-08-09

### Added

- Dashboard administrativo nuevo en `/dashboard`, exclusivo para administradores, con tarjetas de pacientes activos, odontólogos activos y balance histórico total.
- Gráficos administrativos anuales para pacientes por obra social, atenciones por mes, ingresos vs egresos, ingresos por tipo, egresos por tipo y códigos por estado.
- Análisis mensual de odontólogos por volumen de códigos y distribución por estado para detectar quién más atiende.

### Changed

- `Inicio` se mantiene como tablero operativo mensual y queda separado del nuevo dashboard administrativo.
- `Movimientos` y sus vistas administrativas quedaron integrados como fuente contable para indicadores de ingresos, egresos y balance.

### Fixed

- Tooltips de los gráficos del dashboard administrativo ahora permanecen visibles dentro del contenedor incluso al inspeccionar puntos cercanos a los bordes.
- Inputs monetarios de carga manual en `Movimientos` respetan la máscara visual `x.xxx.xxx,xx`.

## 2026-08-08

### Added

- Módulo `Movimientos` dentro de `Finanzas` como libro contable operativo con listado, filtros, tarjetas de resumen y carga manual.
- Catálogo `Tipos de movimientos` dentro de `Configuración` con CRUD administrativo y tipos de sistema iniciales.
- Persistencia de movimientos contables con dirección, tipo configurable, origen y metadata operativa.

### Changed

- `Pagos` ahora genera automáticamente un movimiento contable al confirmar una liquidación.
- `Movimientos` dejó de depender de tipos hardcodeados y ahora usa el catálogo configurable de tipos activos.
- Navegación administrativa ampliada con accesos a `Movimientos` y `Tipos de movimientos`.

### Fixed

- El gráfico mensual de `Inicio` ahora renderiza correctamente la altura de barras en días con atenciones registradas.

## 2026-08-07

### Changed

- La selección de conceptos en `Pagos` ahora persiste entre páginas del paginador para permitir liquidaciones grandes sin perder ítems ya marcados.
- Los campos bloqueados en la edición administrativa de `Atenciones` ahora se muestran deshabilitados en UI para evitar falsas señales de edición disponible.

### Fixed

- `Pagos` dejaba de recordar códigos y coseguros seleccionados al cambiar de página.
- La edición administrativa de `Atenciones` podía arrastrar cambios inválidos sobre campos bloqueados al interactuar con importes ya pagados.
- El `coseguro odonto` pagado ya no bloquea el cambio de estado del código cuando el código en sí todavía no fue pagado.

## 2026-08-06

### Added

- Módulo `Pagos` operativo para liquidar honorarios odontológicos por línea y por concepto.
- Persistencia de pagos con snapshots históricos y marcas separadas de pago para `código` y `coseguro odonto`.
- Script `scripts/test-payments.ts` para validar generación de pagos en escenarios de código, coseguro odonto y ambos conceptos.
- Métricas de dashboard ampliadas con foco mensual y seguimiento operativo.

### Changed

- `Liquidaciones` y `Pagos` quedaron integrados dentro del flujo administrativo de finanzas.
- La edición administrativa de `Atenciones` ahora respeta completamente las líneas con conceptos pagados y las deja bloqueadas.
- Las atenciones existentes conservan la obra social histórica guardada al momento de su creación, aunque el paciente cambie o pierda su obra social actual.
- La validación del formulario de `Atenciones` quedó endurecida para tolerar estados intermedios de inputs monetarios sin romper el guardado.
- Las acciones de activar y desactivar en `Obras sociales`, `Códigos`, `Pacientes` y `Usuarios` ahora usan diálogos de confirmación propios en lugar de confirmaciones nativas del navegador.

### Fixed

- Generación de pagos que fallaba al marcar conceptos individuales o combinados.
- Selección visual de conceptos en `Pagos`, evitando checks incorrectos sobre filas no liquidables.
- Pérdida de `coseguro`, `coseguro odonto` o valor histórico al editar atenciones con líneas ya pagadas.
- Error `Expected number, received nan` al guardar cambios en atenciones administrativas.
- Bloqueo de edición de atenciones históricas cuando el paciente ya no tenía la misma obra social actual.
- Warning de hidratación en el layout raíz causado por atributos inyectados por extensiones del navegador sobre `<body>`.
- Pedido residual a `/recordatorios-sw.js` originado por un service worker viejo registrado en el navegador para este origen.

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
