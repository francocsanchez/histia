# Histia

## Descripción general

Histia será un sistema web para la gestión administrativa de una clínica dental.

El sistema estará enfocado exclusivamente en:

- Registrar atenciones realizadas.
- Gestionar pacientes.
- Gestionar obras sociales.
- Gestionar códigos y valores de prestaciones.
- Gestionar profesionales y usuarios.
- Controlar cantidades de prestaciones.
- Generar liquidaciones de odontólogos y radiólogos.
- Obtener reportes administrativos y económicos.

Histia no será utilizado, ni en esta versión ni en versiones futuras, para la gestión de turnos o agendas profesionales.

Este proyecto debe considerarse completamente nuevo, independiente y aislado de cualquier proyecto anterior.

---

# Regla de contexto cero

Este repositorio debe tratarse como un entorno completamente nuevo y sin antecedentes.

## Reglas obligatorias

- No reutilizar estilos visuales, paletas, componentes, estructuras, nombres, arquitecturas ni decisiones de otros proyectos.
- No asumir preferencias de diseño anteriores.
- No copiar patrones de otros repositorios, salvo que se solicite explícitamente.
- Ignorar cualquier referencia a proyectos anteriores que no esté escrita dentro de este repositorio.
- Analizar únicamente los archivos existentes en la carpeta actual.
- Las únicas reglas válidas para este proyecto serán las indicadas en este archivo, en el chat actual y en el archivo `AGENTS.md`.
- Si falta una definición de diseño, no debe heredarse de otro proyecto.
- Antes de crear la interfaz, debe definirse desde cero el sistema visual del proyecto.
- Los componentes reutilizables deben surgir de necesidades reales de Histia y no de patrones heredados.

---

# Exclusión definitiva de turnos y agendas

Histia no tendrá, ni ahora ni en versiones futuras:

- Gestión de turnos.
- Agenda de profesionales.
- Disponibilidad horaria.
- Reservas de citas.
- Confirmaciones de turnos.
- Cancelaciones de turnos.
- Reprogramaciones.
- Recordatorios de turnos.
- Calendarios de atención.
- Organización de horarios de odontólogos o radiólogos.
- Listas de espera.
- Gestión de consultorios por horario.

La aplicación registrará únicamente atenciones que ya fueron realizadas.

La fecha de una atención será un dato administrativo y no implicará la existencia de una agenda.

---

# Objetivo general

El objetivo de Histia es centralizar la información administrativa de las prestaciones realizadas en la clínica y utilizar esos datos para generar las liquidaciones de los profesionales.

El flujo general futuro será:

1. Configurar obras sociales.
2. Configurar códigos de prestaciones y valores.
3. Registrar pacientes.
4. Registrar profesionales y usuarios.
5. Registrar atenciones realizadas.
6. Controlar límites de prestaciones.
7. Generar liquidaciones.
8. Obtener reportes administrativos.

---

# Objetivo de la V1

La primera versión deberá establecer las bases maestras del sistema.

La V1 incluirá:

1. Autenticación.
2. Usuarios.
3. Roles.
4. Obras sociales.
5. Códigos de obras sociales.
6. Pacientes.
7. Dashboard administrativo básico.
8. Permisos básicos.
9. Sistema visual propio.
10. Base técnica preparada para incorporar atenciones y liquidaciones.

La V1 no incluirá todavía:

- Registro de atenciones.
- Liquidaciones.
- Facturación.
- Pagos.
- Historias clínicas.
- Auditorías avanzadas.

---

# Nombre del proyecto

El nombre del proyecto será:

```text
Histia
```

El nombre deberá utilizarse de forma consistente en:

- Título de la aplicación.
- Metadata.
- Pantalla de inicio de sesión.
- Navegación.
- Documentación.
- Variables de entorno cuando corresponda.
- Nombre del proyecto en `package.json`.

---

# Stack tecnológico

El proyecto deberá desarrollarse utilizando:

- Next.js.
- TypeScript.
- MongoDB.
- Mongoose.
- Tailwind CSS.
- shadcn/ui.
- React Hook Form.
- Zod.

El proyecto ya contará con shadcn/ui preconfigurado.

Utilizar el siguiente preset
npx shadcn@latest init --preset b2CRD5HQe --template next

Con el siguiente global.css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.148 0.004 228.8);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.148 0.004 228.8);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.148 0.004 228.8);
  --primary: oklch(0.508 0.118 165.612);
  --primary-foreground: oklch(0.979 0.021 166.113);
  --secondary: oklch(0.967 0.001 286.375);
  --secondary-foreground: oklch(0.21 0.006 285.885);
  --muted: oklch(0.963 0.002 197.1);
  --muted-foreground: oklch(0.56 0.021 213.5);
  --accent: oklch(0.963 0.002 197.1);
  --accent-foreground: oklch(0.218 0.008 223.9);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.925 0.005 214.3);
  --input: oklch(0.925 0.005 214.3);
  --ring: oklch(0.723 0.014 214.4);
  --chart-1: oklch(0.845 0.143 164.978);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.596 0.145 163.225);
  --chart-4: oklch(0.508 0.118 165.612);
  --chart-5: oklch(0.432 0.095 166.913);
  --radius: 0;
  --sidebar: oklch(0.987 0.002 197.1);
  --sidebar-foreground: oklch(0.148 0.004 228.8);
  --sidebar-primary: oklch(0.596 0.145 163.225);
  --sidebar-primary-foreground: oklch(0.979 0.021 166.113);
  --sidebar-accent: oklch(0.963 0.002 197.1);
  --sidebar-accent-foreground: oklch(0.218 0.008 223.9);
  --sidebar-border: oklch(0.925 0.005 214.3);
  --sidebar-ring: oklch(0.723 0.014 214.4);
}

.dark {
  --background: oklch(0.148 0.004 228.8);
  --foreground: oklch(0.987 0.002 197.1);
  --card: oklch(0.218 0.008 223.9);
  --card-foreground: oklch(0.987 0.002 197.1);
  --popover: oklch(0.218 0.008 223.9);
  --popover-foreground: oklch(0.987 0.002 197.1);
  --primary: oklch(0.432 0.095 166.913);
  --primary-foreground: oklch(0.979 0.021 166.113);
  --secondary: oklch(0.274 0.006 286.033);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.275 0.011 216.9);
  --muted-foreground: oklch(0.723 0.014 214.4);
  --accent: oklch(0.275 0.011 216.9);
  --accent-foreground: oklch(0.987 0.002 197.1);
  --destructive: oklch(0.704 0.191 22.216);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.56 0.021 213.5);
  --chart-1: oklch(0.845 0.143 164.978);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.596 0.145 163.225);
  --chart-4: oklch(0.508 0.118 165.612);
  --chart-5: oklch(0.432 0.095 166.913);
  --sidebar: oklch(0.218 0.008 223.9);
  --sidebar-foreground: oklch(0.987 0.002 197.1);
  --sidebar-primary: oklch(0.696 0.17 162.48);
  --sidebar-primary-foreground: oklch(0.262 0.051 172.552);
  --sidebar-accent: oklch(0.275 0.011 216.9);
  --sidebar-accent-foreground: oklch(0.987 0.002 197.1);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-ring: oklch(0.56 0.021 213.5);
}

Usar las font del preset, asi que si de ser necesario descargarlas.

No se deberá reemplazar el preset existente de shadcn/ui salvo que se solicite expresamente.

---

# Enfoque arquitectónico

Se utilizará una arquitectura monolítica dentro de Next.js.

La aplicación contendrá:

- Interfaz web.
- API interna.
- Lógica de negocio.
- Validación.
- Acceso a MongoDB.
- Autenticación.
- Autorización.
- Gestión de sesiones.
- Componentes reutilizables.
- Servicios de dominio.

La arquitectura deberá ser simple, mantenible y preparada para crecer.

No se deberán crear microservicios en la V1.

No se deberán crear capas o abstracciones innecesarias.

---

# Estructura sugerida

```text
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   ├── (dashboard)/
│   │   ├── page.tsx
│   │   ├── obras-sociales/
│   │   ├── codigos-obras-sociales/
│   │   ├── pacientes/
│   │   └── usuarios/
│   └── api/
│       ├── auth/
│       ├── obras-sociales/
│       ├── codigos-obras-sociales/
│       ├── pacientes/
│       └── usuarios/
├── components/
│   ├── ui/
│   ├── layout/
│   ├── forms/
│   ├── tables/
│   └── shared/
├── lib/
│   ├── auth/
│   ├── db/
│   ├── permissions/
│   ├── validations/
│   ├── constants/
│   └── utils/
├── models/
├── services/
├── types/
└── hooks/
```

Esta estructura podrá ajustarse si existe una solución más clara dentro del repositorio.

La separación mínima deberá distinguir:

- Presentación.
- Validaciones.
- Modelos.
- Servicios.
- Permisos.
- Acceso a datos.
- Tipos.
- Utilidades.

---

# Sistema visual

Antes de desarrollar las pantallas deberá definirse desde cero un sistema visual propio para Histia.

No deberán utilizarse estilos, colores, tipografías ni decisiones visuales de otros proyectos.

## Definiciones obligatorias

El sistema visual deberá establecer:

- Paleta principal.
- Paleta secundaria.
- Colores neutros.
- Colores de estados.
- Tipografía principal.
- Tipografía secundaria, si fuera necesaria.
- Escala de espaciados.
- Radios de bordes.
- Sombras.
- Alturas de controles.
- Tamaños de iconos.
- Estilo de tablas.
- Estilo de formularios.
- Estilo de botones.
- Estilo de navegación.
- Estilo de modales.
- Estilo de tarjetas.
- Estilo de alertas.
- Estilo de estados vacíos.
- Estilo de estados de carga.
- Estilo de errores.

## Principios visuales

La interfaz deberá transmitir:

- Orden.
- Claridad.
- Profesionalismo.
- Confianza.
- Simplicidad operativa.
- Buena legibilidad.
- Rapidez de uso.

## Alcance responsive

El sistema deberá estar optimizado principalmente para escritorio.

También deberá adaptarse correctamente a:

- Notebook.
- Tablet.
- Teléfono móvil.

La experiencia móvil podrá simplificar tablas y acciones sin perder funcionalidad.

---

# Autenticación

El sistema deberá contar con una pantalla de inicio de sesión.

## Credenciales

Los usuarios ingresarán mediante:

- Email.
- Contraseña.

## Reglas

- No habrá registro público.
- Los usuarios serán creados únicamente por un administrador.
- Las contraseñas deberán almacenarse con hash seguro.
- Un usuario inactivo no podrá iniciar sesión.
- La sesión deberá validarse en el servidor.
- Las rutas privadas no deberán depender únicamente de validaciones del frontend.
- La información sensible no deberá exponerse al cliente.
- El campo `passwordHash` nunca deberá enviarse al frontend.

---

# Roles

Los roles iniciales serán:

- Administrador.
- Odontólogo.
- Radiólogo.

Un usuario podrá tener más de un rol simultáneamente.

## Ejemplos

```text
Administrador
Odontólogo
Radiólogo
Administrador + Odontólogo
Administrador + Radiólogo
Odontólogo + Radiólogo
Administrador + Odontólogo + Radiólogo
```

## Representación sugerida

```ts
roles: ["administrador", "odontologo"]
```

Los roles deberán almacenarse como un arreglo de valores controlados.

---

# Permisos iniciales

## Administrador

Podrá:

- Acceder al sistema.
- Visualizar el dashboard.
- Crear obras sociales.
- Editar obras sociales.
- Activar obras sociales.
- Desactivar obras sociales.
- Crear códigos de obras sociales.
- Editar códigos de obras sociales.
- Activar códigos.
- Desactivar códigos.
- Crear pacientes.
- Editar pacientes.
- Activar pacientes.
- Desactivar pacientes.
- Crear usuarios.
- Editar usuarios.
- Asignar roles.
- Cambiar contraseñas.
- Activar usuarios.
- Desactivar usuarios.
- Consultar toda la información de la V1.

## Odontólogo

En la V1 podrá:

- Acceder al sistema.
- Consultar obras sociales activas.
- Consultar códigos de obras sociales activos.
- Consultar pacientes activos.

En versiones posteriores podrá:

- Registrar atenciones realizadas.
- Consultar sus propias atenciones.
- Consultar sus liquidaciones.

## Radiólogo

En la V1 podrá:

- Acceder al sistema.
- Consultar obras sociales activas.
- Consultar códigos de obras sociales activos.
- Consultar pacientes activos.

En versiones posteriores podrá:

- Registrar atenciones radiológicas realizadas.
- Consultar sus propias atenciones.
- Consultar sus liquidaciones.

## Regla general de permisos

Los permisos deberán centralizarse.

No se deberán distribuir reglas de autorización manualmente en cada componente.

La interfaz podrá ocultar opciones, pero la autorización deberá validarse también en el servidor.

---

# Módulo de obras sociales

Este módulo permitirá gestionar las obras sociales con las que trabaja la clínica.

## Campos

- Nombre.
- Cantidad de prestaciones por mes.
- Estado.
- Fecha de creación.
- Fecha de actualización.

## Modelo sugerido

```ts
ObraSocial {
  _id: ObjectId
  nombre: string
  cantidadPrestacionesMes: number
  activo: boolean
  createdAt: Date
  updatedAt: Date
}
```

## Cantidad de prestaciones por mes

El campo `cantidadPrestacionesMes` representará la cantidad de prestaciones mensuales permitidas, acordadas o controladas para esa obra social.

En la V1 será un dato de configuración.

En versiones posteriores se utilizará para:

- Comparar el límite con las atenciones realizadas.
- Mostrar alertas.
- Detectar excedentes.
- Generar reportes.
- Controlar consumo mensual.
- Informar disponibilidad administrativa.

No tendrá relación con turnos ni cupos de agenda.

## Validaciones

- El nombre es obligatorio.
- El nombre deberá eliminar espacios innecesarios.
- No podrá existir otra obra social con el mismo nombre normalizado.
- La cantidad de prestaciones deberá ser un número entero.
- La cantidad de prestaciones deberá ser igual o mayor que cero.
- El estado deberá ser booleano.
- Una obra social relacionada con otros registros no deberá eliminarse físicamente.
- Se utilizará baja lógica mediante el campo `activo`.

## Funcionalidades

- Listar obras sociales.
- Buscar por nombre.
- Filtrar por estado.
- Crear obra social.
- Ver detalle.
- Editar obra social.
- Activar obra social.
- Desactivar obra social.
- Paginar resultados.

---

# Módulo de códigos de obras sociales

Este módulo permitirá registrar los códigos de prestaciones reconocidos por cada obra social.

Cada código estará asociado a una única obra social.

## Campos

- Nombre.
- Código.
- Obra social.
- Valor.
- Estado.
- Fecha de creación.
- Fecha de actualización.

## Modelo sugerido

```ts
CodigoObraSocial {
  _id: ObjectId
  nombre: string
  codigo: string
  obraSocialId: ObjectId
  valor: number
  activo: boolean
  createdAt: Date
  updatedAt: Date
}
```

## Ejemplo

```text
Nombre: Consulta odontológica
Código: 01.01
Obra social: Obra Social Ejemplo
Valor: 18500
```

## Reglas del código

- El código deberá guardarse como texto.
- Podrá contener números, puntos, guiones o letras.
- No deberá convertirse automáticamente a número.
- Deberán conservarse ceros a la izquierda.
- El mismo código no podrá repetirse dentro de una misma obra social.
- El mismo código podrá existir en obras sociales diferentes.

## Reglas del valor

- El valor será monetario.
- Deberá ser igual o mayor que cero.
- Deberá almacenarse con una estrategia que evite errores de precisión.
- Se recomienda almacenar el importe en centavos como entero.

Ejemplo:

```ts
valorCentavos: 1850000
```

Si se utiliza `valor` como decimal, deberá documentarse la estrategia elegida.

## Validaciones

- El nombre es obligatorio.
- El código es obligatorio.
- La obra social es obligatoria.
- La obra social deberá existir.
- La obra social deberá estar activa al crear un código.
- El valor deberá ser igual o mayor que cero.
- No podrá duplicarse la combinación obra social + código.
- Se utilizará baja lógica mediante el campo `activo`.

## Funcionalidades

- Listar códigos.
- Buscar por nombre.
- Buscar por código.
- Filtrar por obra social.
- Filtrar por estado.
- Crear código.
- Ver detalle.
- Editar código.
- Activar código.
- Desactivar código.
- Paginar resultados.

---

# Módulo de pacientes

Este módulo permitirá administrar los datos básicos de los pacientes.

No gestionará:

- Turnos.
- Agendas.
- Horarios.
- Historias clínicas.
- Tratamientos clínicos.
- Archivos médicos.

## Campos

- Nombre.
- Apellido.
- DNI.
- Obra social.
- Estado.
- Fecha de creación.
- Fecha de actualización.

## Modelo sugerido

```ts
Paciente {
  _id: ObjectId
  nombre: string
  apellido: string
  dni: string
  obraSocialId: ObjectId | null
  activo: boolean
  createdAt: Date
  updatedAt: Date
}
```

## Reglas del DNI

- El DNI deberá almacenarse como texto.
- No deberá almacenarse como número.
- Deberán eliminarse puntos, guiones y espacios.
- No podrá duplicarse.
- Deberá conservarse la posibilidad de manejar documentos extranjeros en futuras versiones.

## Obra social

La obra social será opcional.

Esto permitirá registrar:

- Pacientes con obra social.
- Pacientes particulares.
- Pacientes cuya cobertura aún no se haya definido.

## Validaciones

- El nombre es obligatorio.
- El apellido es obligatorio.
- El DNI es obligatorio.
- El DNI no podrá estar duplicado.
- La obra social será opcional.
- Si se informa una obra social, deberá existir.
- Al crear o modificar la cobertura, la obra social deberá estar activa.
- Se utilizará baja lógica mediante el campo `activo`.

## Funcionalidades

- Listar pacientes.
- Buscar por nombre.
- Buscar por apellido.
- Buscar por nombre completo.
- Buscar por DNI.
- Filtrar por obra social.
- Filtrar por estado.
- Crear paciente.
- Ver detalle.
- Editar paciente.
- Activar paciente.
- Desactivar paciente.
- Paginar resultados.

---

# Módulo de usuarios

Este módulo permitirá gestionar los usuarios internos con acceso a Histia.

## Campos

- Nombre.
- Apellido.
- Email.
- Contraseña.
- Roles.
- Estado.
- Fecha de creación.
- Fecha de actualización.

## Modelo sugerido

```ts
Usuario {
  _id: ObjectId
  nombre: string
  apellido: string
  email: string
  passwordHash: string
  roles: Array<
    "administrador" |
    "odontologo" |
    "radiologo"
  >
  activo: boolean
  createdAt: Date
  updatedAt: Date
}
```

## Validaciones

- El nombre es obligatorio.
- El apellido es obligatorio.
- El email es obligatorio.
- El email deberá tener formato válido.
- El email deberá almacenarse en minúsculas.
- El email deberá normalizarse antes de validar duplicados.
- El email no podrá estar duplicado.
- La contraseña deberá cumplir una longitud mínima.
- El usuario deberá tener al menos un rol.
- Los roles no podrán repetirse.
- Solo se admitirán roles definidos por el sistema.
- Se utilizará baja lógica mediante el campo `activo`.
- Un usuario inactivo no podrá iniciar sesión.

## Funcionalidades

- Listar usuarios.
- Buscar por nombre.
- Buscar por apellido.
- Buscar por email.
- Filtrar por rol.
- Filtrar por estado.
- Crear usuario.
- Ver detalle.
- Editar usuario.
- Cambiar roles.
- Cambiar contraseña.
- Activar usuario.
- Desactivar usuario.
- Paginar resultados.

## Seguridad

- Nunca devolver `passwordHash`.
- Nunca registrar contraseñas en logs.
- Nunca enviar contraseñas por respuestas de API.
- No permitir que un usuario sin permisos cambie roles.
- Validar permisos en el servidor.
- Evitar que el último administrador activo quede sin rol de administrador.
- Evitar que el último administrador activo sea desactivado accidentalmente.

---

# Relaciones entre entidades

## Obra social y códigos

Una obra social podrá tener muchos códigos.

```text
ObraSocial 1 ─── N CodigoObraSocial
```

## Obra social y pacientes

Una obra social podrá estar asociada a muchos pacientes.

```text
ObraSocial 1 ─── N Paciente
```

Un paciente podrá no tener obra social.

## Usuarios y roles

Un usuario podrá tener uno o más roles.

```text
Usuario 1 ─── N Roles
```

Los roles se almacenarán dentro del usuario como arreglo.

## Relaciones futuras

En versiones posteriores se agregarán relaciones entre:

- Atención y paciente.
- Atención y profesional.
- Atención y obra social.
- Atención y código.
- Atención y liquidación.
- Liquidación y profesional.
- Liquidación y período.

---

# Reglas generales de los CRUD

Todos los módulos deberán seguir un patrón funcional consistente.

## Listados

Cada listado deberá incluir:

- Título.
- Descripción breve.
- Botón para crear.
- Campo de búsqueda.
- Filtros cuando correspondan.
- Tabla o vista equivalente.
- Acciones por registro.
- Paginación.
- Estado vacío.
- Estado de carga.
- Estado de error.

## Acciones

Las acciones posibles serán:

- Ver.
- Editar.
- Activar.
- Desactivar.

No se utilizará eliminación física desde la interfaz.

## Baja lógica

Las entidades principales deberán utilizar baja lógica mediante el campo `activo`.

Esto se aplicará a:

- Obras sociales.
- Códigos.
- Pacientes.
- Usuarios.

Los registros inactivos deberán conservarse para mantener la integridad histórica.

---

# Formularios

Todos los formularios deberán utilizar:

- React Hook Form.
- Zod.
- Componentes de shadcn/ui.
- Validación del lado del cliente.
- Validación del lado del servidor.

## Comportamiento esperado

- Mostrar errores junto al campo correspondiente.
- Mantener los valores ingresados cuando exista un error.
- Deshabilitar acciones mientras se procesa la solicitud.
- Evitar envíos duplicados.
- Mostrar confirmaciones claras.
- Mostrar errores comprensibles.
- Solicitar confirmación antes de desactivar un registro.

## Mensajes sugeridos

- Registro creado correctamente.
- Registro actualizado correctamente.
- Registro activado correctamente.
- Registro desactivado correctamente.
- No se pudo completar la operación.
- Ya existe un registro con esos datos.
- No tenés permisos para realizar esta acción.

---

# Tablas

Las tablas deberán permitir:

- Búsqueda.
- Filtros.
- Paginación.
- Visualización de estado.
- Acciones por fila.
- Diseño responsive.
- Estado vacío.
- Estado de carga.

El ordenamiento avanzado podrá incorporarse después.

La arquitectura deberá permitir agregarlo sin rehacer los módulos.

---

# Búsqueda y paginación

Las búsquedas deberán realizarse en el servidor cuando el volumen de datos lo requiera.

## Parámetros sugeridos

```text
page
limit
search
status
obraSocialId
role
```

## Reglas

- `page` deberá comenzar en 1.
- `limit` deberá tener un máximo controlado.
- La API deberá devolver cantidad total de registros.
- Los filtros deberán ser combinables.
- Los parámetros inválidos deberán normalizarse o rechazarse.

## Respuesta sugerida

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

---

# API

La API deberá validar siempre:

- Sesión activa.
- Usuario activo.
- Rol requerido.
- Permiso requerido.
- Datos recibidos.
- Relaciones existentes.
- Duplicados.
- Estado de los registros relacionados.
- Parámetros de búsqueda.
- Parámetros de paginación.

No se deberá confiar exclusivamente en la interfaz.

---

# Formato de respuestas

## Respuesta exitosa

```json
{
  "success": true,
  "data": {}
}
```

## Respuesta con paginación

```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 120,
    "totalPages": 6
  }
}
```

## Respuesta de error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos ingresados no son válidos",
    "fields": {}
  }
}
```

## Códigos de error sugeridos

```text
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
DUPLICATE_RECORD
INACTIVE_RELATED_RECORD
INVALID_CREDENTIALS
INTERNAL_ERROR
```

---

# Índices recomendados en MongoDB

## Obras sociales

Índice único por nombre normalizado:

```ts
{ nombreNormalizado: 1 }
```

Otros índices:

```ts
{ activo: 1 }
```

## Códigos de obras sociales

Índice compuesto único:

```ts
{
  obraSocialId: 1,
  codigoNormalizado: 1
}
```

Otros índices:

```ts
{ obraSocialId: 1 }
{ activo: 1 }
```

## Pacientes

Índice único:

```ts
{ dni: 1 }
```

Otros índices:

```ts
{ obraSocialId: 1 }
{ activo: 1 }
{ apellido: 1, nombre: 1 }
```

## Usuarios

Índice único:

```ts
{ email: 1 }
```

Otros índices:

```ts
{ roles: 1 }
{ activo: 1 }
```

---

# Normalización de datos

La aplicación deberá normalizar los datos antes de guardarlos.

## Nombres y apellidos

- Eliminar espacios al inicio y al final.
- Evitar espacios duplicados.
- Conservar tildes.
- No forzar todo el texto a mayúsculas.

## Email

- Eliminar espacios.
- Convertir a minúsculas.

## DNI

- Eliminar puntos.
- Eliminar espacios.
- Eliminar guiones.
- Guardar como texto.

## Códigos

- Eliminar espacios externos.
- Conservar ceros a la izquierda.
- Definir una forma normalizada para validar duplicados.

## Valores monetarios

- Preferir enteros en centavos.
- Formatear en pesos argentinos en la interfaz.
- No utilizar números de punto flotante sin una estrategia explícita.

---

# Dashboard inicial

La V1 podrá incluir un dashboard administrativo simple.

## Indicadores

- Obras sociales activas.
- Códigos activos.
- Pacientes activos.
- Usuarios activos.

## Restricciones

- No mostrar estadísticas de atenciones porque el módulo todavía no existirá.
- No mostrar información inventada.
- No mostrar métricas de agenda.
- No mostrar métricas de turnos.
- No mostrar calendarios.
- No mostrar disponibilidad profesional.

---

# Navegación principal

La navegación inicial deberá incluir:

- Inicio.
- Obras sociales.
- Códigos de obras sociales.
- Pacientes.
- Usuarios.

La opción Usuarios deberá estar disponible únicamente para administradores.

Las opciones visibles deberán adaptarse a los roles.

La visibilidad de una opción no reemplazará la validación de permisos en el servidor.

---

# Estados y auditoría básica

Todos los registros deberán contar con:

- `createdAt`.
- `updatedAt`.

En futuras versiones podrá incorporarse:

- Usuario creador.
- Usuario que realizó la última modificación.
- Historial de cambios.
- Motivo de desactivación.

La V1 no necesita auditoría completa, pero la estructura no deberá impedir agregarla.

---

# Manejo de errores

La aplicación deberá diferenciar:

- Errores de validación.
- Errores de autenticación.
- Errores de permisos.
- Registros inexistentes.
- Duplicados.
- Errores de conexión.
- Errores inesperados.

Los mensajes técnicos no deberán mostrarse directamente al usuario.

Los errores internos podrán registrarse del lado del servidor.

No deberán registrarse:

- Contraseñas.
- Tokens.
- Hashes.
- Datos sensibles innecesarios.

---

# Criterios técnicos

- Utilizar TypeScript estricto.
- Evitar `any`.
- Centralizar validaciones.
- Centralizar permisos.
- Centralizar la conexión a MongoDB.
- Evitar duplicar lógica.
- Mantener servicios de dominio claros.
- No crear abstracciones prematuras.
- Utilizar nombres consistentes.
- No mezclar idiomas dentro de una misma capa.
- No almacenar contraseñas sin hash.
- No exponer información sensible.
- No devolver `passwordHash`.
- Validar relaciones en el servidor.
- Utilizar baja lógica.
- Mantener integridad referencial desde la aplicación.
- Preparar el sistema para atenciones y liquidaciones.
- No preparar ni agregar estructuras de turnos o agendas.

---

# Convención de idioma

El sistema podrá utilizar:

- Español para textos visibles.
- Inglés para nombres técnicos.

La convención elegida deberá mantenerse de forma consistente.

Ejemplo recomendado:

- Rutas visibles en español.
- Textos de interfaz en español.
- Modelos, servicios y variables en inglés.
- Nombres de colecciones documentados.

No deberá mezclarse español e inglés sin criterio.

---

# Variables de entorno sugeridas

```env
MONGODB_URI=
AUTH_SECRET=
NEXT_PUBLIC_APP_NAME=Histia
```

Podrán agregarse otras variables cuando sean necesarias.

Nunca deberán subirse secretos reales al repositorio.

Deberá existir un archivo:

```text
.env.example
```

con valores de ejemplo y sin credenciales.

---

# Datos iniciales

El proyecto deberá contemplar una forma segura de crear el primer usuario administrador.

Opciones válidas:

- Script de seed.
- Comando de inicialización.
- Variable temporal de entorno.
- Proceso manual documentado.

No deberá existir registro público.

El proceso deberá evitar crear administradores duplicados.

---

# Próxima etapa: atenciones

Luego de completar la V1 se desarrollará el módulo de atenciones realizadas.

Una atención podrá incluir:

- Paciente.
- Profesional.
- Rol profesional.
- Obra social.
- Código de prestación.
- Fecha de realización.
- Cantidad.
- Valor unitario.
- Valor total.
- Observaciones administrativas.
- Estado de liquidación.
- Fecha de creación.
- Fecha de actualización.

## Reglas futuras

- La atención representará una prestación ya realizada.
- No reservará horario.
- No bloqueará agenda.
- No creará turnos.
- No administrará disponibilidad.
- Podrá registrarse con fecha pasada o actual.
- El valor podrá conservarse históricamente aunque luego cambie el código.

---

# Próxima etapa: liquidaciones

Las liquidaciones agruparán atenciones realizadas por profesional y período.

## Campos posibles

- Profesional.
- Mes.
- Año.
- Atenciones incluidas.
- Total producido.
- Criterio de liquidación.
- Porcentaje profesional.
- Importe fijo, si correspondiera.
- Ajustes.
- Descuentos.
- Total a liquidar.
- Estado.
- Observaciones.
- Fecha de generación.
- Fecha de pago.

## Estados posibles

```text
borrador
calculada
confirmada
pagada
anulada
```

La definición final se realizará al desarrollar el módulo.

---

# Próxima etapa: reportes

Los reportes podrán incluir:

- Prestaciones por obra social.
- Prestaciones por código.
- Prestaciones por profesional.
- Prestaciones por paciente.
- Consumo mensual por obra social.
- Comparación con límites mensuales.
- Producción por profesional.
- Liquidaciones por período.
- Valores pendientes de liquidar.
- Atenciones liquidadas y no liquidadas.

No se incluirán reportes de turnos, agendas, ausencias o disponibilidad.

---

# Resultado esperado de la V1

Al finalizar esta etapa, Histia deberá permitir:

- Iniciar sesión.
- Gestionar usuarios.
- Asignar múltiples roles.
- Gestionar obras sociales.
- Definir cantidades mensuales de prestaciones.
- Gestionar códigos y valores por obra social.
- Gestionar pacientes.
- Consultar información según permisos.
- Activar y desactivar registros.
- Buscar y filtrar información.
- Paginar listados.
- Mantener datos persistidos en MongoDB.
- Contar con una interfaz coherente y propia.
- Contar con una base técnica para registrar atenciones.
- Contar con una base técnica para generar liquidaciones.
- Mantener completamente excluida la gestión de turnos y agendas.

---

# Criterios de aceptación de la V1

La V1 se considerará completa cuando:

1. Exista autenticación funcional.
2. Un administrador pueda iniciar sesión.
3. Un usuario inactivo no pueda iniciar sesión.
4. Los permisos se validen en frontend y servidor.
5. Se pueda crear, editar, listar, buscar, activar y desactivar obras sociales.
6. Se pueda definir la cantidad mensual de prestaciones.
7. Se pueda crear, editar, listar, buscar, filtrar, activar y desactivar códigos.
8. No puedan repetirse códigos dentro de una misma obra social.
9. Se pueda crear, editar, listar, buscar, filtrar, activar y desactivar pacientes.
10. No puedan existir pacientes con DNI duplicado.
11. Se pueda crear, editar, listar, buscar, filtrar, activar y desactivar usuarios.
12. Un usuario pueda tener varios roles.
13. No puedan existir usuarios con email duplicado.
14. No se expongan contraseñas ni hashes.
15. Todos los formularios validen cliente y servidor.
16. Todos los listados incluyan estados de carga, error y vacío.
17. Las eliminaciones sean lógicas.
18. La interfaz sea responsive.
19. El sistema visual haya sido definido desde cero.
20. No exista ninguna funcionalidad relacionada con turnos o agendas.

---

# Regla final

Toda funcionalidad nueva deberá evaluarse según el objetivo principal de Histia:

> Registrar y administrar atenciones realizadas para controlar prestaciones y generar liquidaciones profesionales.

Si una funcionalidad está relacionada con turnos, agendas, reservas, calendarios, horarios o disponibilidad profesional, quedará fuera del alcance del proyecto.
