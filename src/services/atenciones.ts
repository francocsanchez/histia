import { Types } from "mongoose";

import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { normalizeDni, normalizeWhitespace } from "@/lib/utils";
import { AttentionModel } from "@/models/attention";
import { CodigoObraSocialModel } from "@/models/codigo-obra-social";
import { ObraSocialModel } from "@/models/obra-social";
import { PacienteModel } from "@/models/paciente";
import { UserModel } from "@/models/user";
import {
  AttentionCodeLineDto,
  AttentionCodeStatus,
  AttentionDto,
  PaymentStatus,
  QueryParams,
  SessionUser,
} from "@/types/domain";
import { createPaciente } from "@/services/pacientes";

type AttentionFormInput = {
  fecha: string;
  pacienteId?: string | null;
  paciente?: {
    nombre: string;
    apellido: string;
    dni: string;
    obraSocialId: string;
  };
  observacionGeneral?: string | null;
  codigos: Array<{
    lineId?: string;
    codigoObraSocialId: string;
    pieza?: string | null;
    coseguroCentavos?: number | null;
    coseguroOdontoCentavos?: number | null;
    observacion?: string | null;
    pagoOdontologoCentavos: number;
    estado: AttentionCodeStatus;
  }>;
};

type AttentionRow = {
  _id: unknown;
  fecha: Date;
  pacienteId: unknown;
  obraSocialId: unknown;
  usuarioCargaId: unknown;
  observacionGeneral: string | null;
  codigos: Array<{
    _id?: unknown;
    codigoObraSocialId: unknown;
    pieza: string | null;
    coseguroCentavos: number | null;
    coseguroOdontoCentavos: number | null;
    observacion: string | null;
    pagoOdontologoCentavos: number;
    estado: AttentionCodeStatus;
    codePaymentStatus?: PaymentStatus;
    codePaymentId?: unknown;
    codePaidAt?: Date | null;
    coseguroOdontoPaymentStatus?: PaymentStatus;
    coseguroOdontoPaymentId?: unknown;
    coseguroOdontoPaidAt?: Date | null;
  }>;
  createdAt: Date;
  updatedAt: Date;
  paciente?: { nombre: string; apellido: string; dni: string } | null;
  obraSocial?: { nombre: string } | null;
  usuarioCarga?: { name: string; apellido?: string | null } | null;
  codigosDetalle?: Array<{
    _id: unknown;
    nombre: string;
    codigo: string;
  }>;
};

type ResolvedAttentionCodeLine = {
  codigoObraSocialId: Types.ObjectId;
  pieza: string | null;
  coseguroCentavos: number | null;
  coseguroOdontoCentavos: number | null;
  observacion: string | null;
  pagoOdontologoCentavos: number;
  estado: AttentionCodeStatus;
  codePaymentStatus: PaymentStatus;
  codePaymentId: null;
  codePaidAt: null;
  coseguroOdontoPaymentStatus: PaymentStatus;
  coseguroOdontoPaymentId: null;
  coseguroOdontoPaidAt: null;
};

function hasAdministrativeAccess(user: SessionUser) {
  return user.roles.includes("administrador");
}

function isSameObjectId(left: unknown, right: string) {
  return String(left) === right;
}

function normalizeOptionalText(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  return normalized || null;
}

function normalizeOptionalPiece(value?: string | null) {
  return normalizeOptionalText(value);
}

function hasAnyPaidConcept(line: {
  codePaymentStatus?: PaymentStatus;
  coseguroOdontoPaymentStatus?: PaymentStatus;
}) {
  return (
    line.codePaymentStatus === "pagado" ||
    line.coseguroOdontoPaymentStatus === "pagado"
  );
}

function ensureAttentionOwnership(attention: { usuarioCargaId: unknown }, currentUser: SessionUser) {
  if (hasAdministrativeAccess(currentUser)) {
    return;
  }

  if (!isSameObjectId(attention.usuarioCargaId, currentUser.id)) {
    throw new AppError("FORBIDDEN", "No tenes permisos para acceder a esta atencion", 403);
  }
}

function ensureEditableAttentionShape(
  currentAttention: {
    fecha: Date;
    pacienteId: unknown;
    observacionGeneral: string | null;
    codigos: AttentionFormInput["codigos"];
  },
  input: AttentionFormInput,
) {
  if (currentAttention.fecha.toISOString().slice(0, 10) !== input.fecha) {
    throw new AppError(
      "VALIDATION_ERROR",
      "No podes modificar la fecha de una atencion ya creada desde esta vista",
      400,
    );
  }

  if (!input.pacienteId || !isSameObjectId(currentAttention.pacienteId, input.pacienteId)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "No podes modificar el paciente de una atencion ya creada desde esta vista",
      400,
    );
  }

  if (normalizeOptionalText(currentAttention.observacionGeneral) !== normalizeOptionalText(input.observacionGeneral)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "La observacion general solo puede modificarse desde la vista administrativa",
      400,
    );
  }

  if (currentAttention.codigos.length !== input.codigos.length) {
    throw new AppError(
      "VALIDATION_ERROR",
      "No podes agregar ni quitar codigos en una atencion ya creada desde esta vista",
      400,
    );
  }
}

function ensureEditableLineState(
  persistedLine: AttentionFormInput["codigos"][number],
  inputLine: AttentionFormInput["codigos"][number],
  index: number,
) {
  if (persistedLine.estado !== inputLine.estado) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Una o mas lineas fueron auditadas mientras editabas la atencion. Recarga la pagina para continuar.",
      409,
      {
        [`codigos.${index}.estado`]:
          "La fila fue auditada mientras editabas la atencion. Recarga la pagina.",
      },
    );
  }
}

function ensureAuditedLineUnchanged(
  persistedLine: AttentionFormInput["codigos"][number],
  inputLine: AttentionFormInput["codigos"][number],
  index: number,
) {
  ensureEditableLineState(persistedLine, inputLine, index);

  const sameCode = persistedLine.codigoObraSocialId === inputLine.codigoObraSocialId;
  const samePiece =
    normalizeOptionalPiece(persistedLine.pieza) === normalizeOptionalPiece(inputLine.pieza);
  const sameCoseguro =
    (persistedLine.coseguroCentavos ?? null) === (inputLine.coseguroCentavos ?? null);
  const sameObservation =
    normalizeOptionalText(persistedLine.observacion) ===
    normalizeOptionalText(inputLine.observacion);
  const samePago =
    persistedLine.pagoOdontologoCentavos === inputLine.pagoOdontologoCentavos;
  const sameCoseguroOdonto =
    (persistedLine.coseguroOdontoCentavos ?? null) ===
    (inputLine.coseguroOdontoCentavos ?? null);

  if (
    sameCode &&
    samePiece &&
    sameCoseguro &&
    sameObservation &&
    samePago &&
    sameCoseguroOdonto
  ) {
    return;
  }

  throw new AppError(
    "VALIDATION_ERROR",
    "Solo podes editar filas que sigan en estado pendiente",
    400,
    {
      [`codigos.${index}`]:
        "La fila ya fue auditada y no puede modificarse desde esta vista",
    },
  );
}

function ensurePaidLineProtected(
  persistedLine: AttentionFormInput["codigos"][number],
  persistedPaymentState: {
    codePaymentStatus?: PaymentStatus;
    coseguroOdontoPaymentStatus?: PaymentStatus;
  },
  inputLine: AttentionFormInput["codigos"][number],
  index: number,
) {
  const sameCode = persistedLine.codigoObraSocialId === inputLine.codigoObraSocialId;
  const samePiece =
    normalizeOptionalPiece(persistedLine.pieza) === normalizeOptionalPiece(inputLine.pieza);
  const sameCoseguro =
    (persistedLine.coseguroCentavos ?? null) === (inputLine.coseguroCentavos ?? null);
  const sameCoseguroOdonto =
    (persistedLine.coseguroOdontoCentavos ?? null) ===
    (inputLine.coseguroOdontoCentavos ?? null);
  const sameObservation =
    normalizeOptionalText(persistedLine.observacion) ===
    normalizeOptionalText(inputLine.observacion);
  const samePago =
    persistedLine.pagoOdontologoCentavos === inputLine.pagoOdontologoCentavos;
  const sameStatus = persistedLine.estado === inputLine.estado;

  if (
    !sameCode ||
    !samePiece ||
    !sameCoseguro ||
    !sameCoseguroOdonto ||
    !sameObservation ||
    !samePago ||
    !sameStatus
  ) {
    throw new AppError(
      "VALIDATION_ERROR",
      "No podes modificar una linea que ya tiene conceptos pagados",
      400,
      {
        [`codigos.${index}`]:
          "La linea tiene conceptos pagados y queda bloqueada para edicion",
      },
    );
  }
}

function buildAdministrativeProtectedLine(params: {
  persistedLine: {
    _id?: unknown;
    codigoObraSocialId: Types.ObjectId;
    pieza: string | null;
    coseguroCentavos: number | null;
    coseguroOdontoCentavos: number | null;
    observacion: string | null;
    pagoOdontologoCentavos: number;
    estado: AttentionCodeStatus;
    codePaymentStatus?: PaymentStatus;
    codePaymentId?: unknown;
    codePaidAt?: Date | null;
    coseguroOdontoPaymentStatus?: PaymentStatus;
    coseguroOdontoPaymentId?: unknown;
    coseguroOdontoPaidAt?: Date | null;
  };
  nextLine: ResolvedAttentionCodeLine;
}) {
  const { persistedLine, nextLine } = params;

  const protectedLine = {
    ...nextLine,
    _id: persistedLine._id,
    codePaymentStatus: persistedLine.codePaymentStatus ?? "pendiente",
    codePaymentId: persistedLine.codePaymentId ?? null,
    codePaidAt: persistedLine.codePaidAt ?? null,
    coseguroOdontoPaymentStatus:
      persistedLine.coseguroOdontoPaymentStatus ?? "pendiente",
    coseguroOdontoPaymentId: persistedLine.coseguroOdontoPaymentId ?? null,
    coseguroOdontoPaidAt: persistedLine.coseguroOdontoPaidAt ?? null,
  };

  if (hasAnyPaidConcept(persistedLine)) {
    protectedLine.coseguroCentavos = persistedLine.coseguroCentavos;
  }

  if (persistedLine.codePaymentStatus === "pagado") {
    protectedLine.codigoObraSocialId = persistedLine.codigoObraSocialId;
    protectedLine.pieza = persistedLine.pieza;
    protectedLine.observacion = persistedLine.observacion;
    protectedLine.pagoOdontologoCentavos = persistedLine.pagoOdontologoCentavos;
    protectedLine.estado = persistedLine.estado;
  }

  if (persistedLine.coseguroOdontoPaymentStatus === "pagado") {
    protectedLine.coseguroOdontoCentavos = persistedLine.coseguroOdontoCentavos;
  }

  return protectedLine;
}

function toAttentionCodeLineDto(
  line: AttentionRow["codigos"][number],
  codigoDetalle?: { nombre: string; codigo: string },
): AttentionCodeLineDto {
  return {
    lineId: String(line._id ?? ""),
    codigoObraSocialId: String(line.codigoObraSocialId),
    codigoNombre: codigoDetalle?.nombre ?? "Codigo sin datos",
    codigo: codigoDetalle?.codigo ?? "",
    pieza: line.pieza,
    coseguroCentavos: line.coseguroCentavos,
    coseguroOdontoCentavos: line.coseguroOdontoCentavos,
    observacion: line.observacion,
    pagoOdontologoCentavos: line.pagoOdontologoCentavos,
    estado: line.estado,
    codePaymentStatus: line.codePaymentStatus ?? "pendiente",
    coseguroOdontoPaymentStatus: line.coseguroOdontoPaymentStatus ?? "pendiente",
  };
}

function toAttentionDto(row: AttentionRow): AttentionDto {
  const codigosById = new Map(
    (row.codigosDetalle ?? []).map((codigo) => [String(codigo._id), codigo]),
  );
  const codigos = row.codigos.map((line) =>
    toAttentionCodeLineDto(line, codigosById.get(String(line.codigoObraSocialId))),
  );
  const totalCoseguroCentavos = codigos.reduce(
    (sum, line) => sum + (line.coseguroCentavos ?? 0),
    0,
  );
  const totalCoseguroOdontoCentavos = codigos.reduce(
    (sum, line) => sum + (line.coseguroOdontoCentavos ?? 0),
    0,
  );
  const totalPagoOdontologoCentavos = codigos.reduce(
    (sum, line) => sum + line.pagoOdontologoCentavos,
    0,
  );

  return {
    id: String(row._id),
    fecha: row.fecha.toISOString(),
    pacienteId: String(row.pacienteId),
    pacienteNombreCompleto: row.paciente
      ? `${row.paciente.apellido}, ${row.paciente.nombre}`
      : "Paciente sin datos",
    pacienteDni: row.paciente?.dni ?? "",
    obraSocialId: String(row.obraSocialId),
    obraSocialNombre: row.obraSocial?.nombre ?? "Obra social sin datos",
    usuarioCargaId: String(row.usuarioCargaId),
    usuarioCargaNombre: normalizeWhitespace(
      `${row.usuarioCarga?.apellido ?? ""}, ${row.usuarioCarga?.name ?? ""}`,
    ),
    observacionGeneral: row.observacionGeneral,
    codigos,
    cantidadCodigos: codigos.length,
    totalCoseguroCentavos,
    totalCoseguroOdontoCentavos,
    totalPagoOdontologoCentavos,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildDateMatch(query: QueryParams) {
  const fecha: Record<string, Date> = {};

  if (query.dateFrom) {
    fecha.$gte = new Date(`${query.dateFrom}T00:00:00.000`);
  }

  if (query.dateTo) {
    fecha.$lte = new Date(`${query.dateTo}T23:59:59.999`);
  }

  return Object.keys(fecha).length > 0 ? fecha : undefined;
}

function getMonthRange(fecha: string | Date) {
  const baseDate = new Date(fecha);
  const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0, 23, 59, 59, 999);

  return { start, end };
}

async function getMonthlyUsage(params: {
  pacienteId: string;
  obraSocialId: string;
  fecha: string | Date;
  excludeAttentionId?: string;
}) {
  const { start, end } = getMonthRange(params.fecha);
  const match: Record<string, unknown> = {
    pacienteId: new Types.ObjectId(params.pacienteId),
    obraSocialId: new Types.ObjectId(params.obraSocialId),
    fecha: {
      $gte: start,
      $lte: end,
    },
  };

  if (params.excludeAttentionId) {
    match._id = { $ne: new Types.ObjectId(params.excludeAttentionId) };
  }

  const rows = await AttentionModel.aggregate([
    { $match: match },
    {
      $project: {
        cantidadCodigos: { $size: "$codigos" },
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$cantidadCodigos" },
      },
    },
  ]);

  return rows[0]?.total ?? 0;
}

async function resolvePaciente(input: AttentionFormInput) {
  if (input.pacienteId) {
    const paciente = await PacienteModel.findById(input.pacienteId).lean();

    if (!paciente) {
      throw new AppError("NOT_FOUND", "El paciente no existe", 404);
    }

    return paciente;
  }

  if (!input.paciente) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Debes seleccionar un paciente o crearlo en el flujo",
      400,
    );
  }

  const dni = normalizeDni(input.paciente.dni);
  const existingPaciente = await PacienteModel.findOne({ dni }).lean();

  if (existingPaciente) {
    return existingPaciente;
  }

  const createdPaciente = await createPaciente({
    ...input.paciente,
    dni,
  });
  const paciente = await PacienteModel.findById(createdPaciente.id).lean();

  if (!paciente) {
    throw new AppError("INTERNAL_ERROR", "No se pudo resolver el paciente", 500);
  }

  return paciente;
}

async function resolveActiveObraSocial(paciente: {
  _id: unknown;
  obraSocialId: Types.ObjectId | null;
  activo: boolean;
  currentAttentionObraSocialId?: Types.ObjectId | null;
}) {
  if (!paciente.activo) {
    throw new AppError(
      "INACTIVE_RELATED_RECORD",
      "El paciente debe estar activo",
      409,
    );
  }

  const obraSocialId = paciente.currentAttentionObraSocialId ?? paciente.obraSocialId;

  if (!obraSocialId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "El paciente debe tener una obra social activa para registrar atenciones",
      400,
      {
        pacienteId:
          "El paciente debe tener una obra social activa para registrar atenciones",
      },
    );
  }

  const obraSocial = await ObraSocialModel.findById(obraSocialId).lean();

  if (!obraSocial) {
    throw new AppError("NOT_FOUND", "La obra social del paciente no existe", 404);
  }

  if (!obraSocial.activo) {
    throw new AppError(
      "INACTIVE_RELATED_RECORD",
      "La obra social del paciente debe estar activa",
      409,
    );
  }

  return obraSocial;
}

async function resolveAttentionCodes(
  obraSocialId: string,
  lines: AttentionFormInput["codigos"],
) {
  const codeIds = Array.from(
    new Set(lines.map((line) => line.codigoObraSocialId).filter(Boolean)),
  );

  const codes = await CodigoObraSocialModel.find()
    .where("_id")
    .in(codeIds)
    .lean();
  const codesById = new Map(codes.map((code) => [String(code._id), code]));

  return lines.map((line, index) => {
    const code = codesById.get(line.codigoObraSocialId);

    if (!code) {
      throw new AppError(
        "NOT_FOUND",
        "Uno de los codigos seleccionados no existe",
        404,
        {
          [`codigos.${index}.codigoObraSocialId`]: "El codigo no existe",
        },
      );
    }

    if (!code.activo) {
      throw new AppError(
        "INACTIVE_RELATED_RECORD",
        "Todos los codigos deben estar activos",
        409,
        {
          [`codigos.${index}.codigoObraSocialId`]:
            "El codigo seleccionado debe estar activo",
        },
      );
    }

    if (String(code.obraSocialId) !== obraSocialId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Todos los codigos deben pertenecer a la obra social del paciente",
        400,
        {
          [`codigos.${index}.codigoObraSocialId`]:
            "El codigo no pertenece a la obra social del paciente",
        },
      );
    }

    return {
      codigoObraSocialId: new Types.ObjectId(line.codigoObraSocialId),
      pieza: line.pieza ? normalizeWhitespace(line.pieza) : null,
      coseguroCentavos: line.coseguroCentavos ?? null,
      coseguroOdontoCentavos: line.coseguroOdontoCentavos ?? null,
      observacion: line.observacion ? normalizeWhitespace(line.observacion) : null,
      pagoOdontologoCentavos: line.pagoOdontologoCentavos ?? code.valorCentavos,
      estado: line.estado,
      codePaymentStatus: "pendiente" as const,
      codePaymentId: null,
      codePaidAt: null,
      coseguroOdontoPaymentStatus: "pendiente" as const,
      coseguroOdontoPaymentId: null,
      coseguroOdontoPaidAt: null,
    };
  });
}

function buildAttentionPipeline(match: Record<string, unknown>) {
  return [
    { $match: match },
    {
      $lookup: {
        from: "pacientes",
        localField: "pacienteId",
        foreignField: "_id",
        as: "paciente",
      },
    },
    { $unwind: "$paciente" },
    {
      $lookup: {
        from: "obras_sociales",
        localField: "obraSocialId",
        foreignField: "_id",
        as: "obraSocial",
      },
    },
    { $unwind: "$obraSocial" },
    {
      $lookup: {
        from: "users",
        localField: "usuarioCargaId",
        foreignField: "_id",
        as: "usuarioCarga",
      },
    },
    { $unwind: "$usuarioCarga" },
    {
      $lookup: {
        from: "codigos_obras_sociales",
        localField: "codigos.codigoObraSocialId",
        foreignField: "_id",
        as: "codigosDetalle",
      },
    },
  ];
}

export async function listAttentionAssignableUsers() {
  await connectToDatabase();

  return (
    await UserModel.find({ activo: true })
      .sort({ apellido: 1, name: 1 })
      .lean()
  )
    .filter((user) => {
      const roles = String(user.roles ?? "");
      return roles.includes("odontologo") || roles.includes("administrador");
    })
    .map((user) => ({
      id: String(user._id),
      label: normalizeWhitespace(`${user.apellido ?? ""}, ${user.name}`),
    }));
}

export async function listAttentions(query: QueryParams, currentUser: SessionUser) {
  await connectToDatabase();

  const match: Record<string, unknown> = {};
  const search = query.search?.trim();
  const dateMatch = buildDateMatch(query);

  if (dateMatch) {
    match.fecha = dateMatch;
  }

  if (!hasAdministrativeAccess(currentUser)) {
    match.usuarioCargaId = new Types.ObjectId(currentUser.id);
  } else if (query.userId) {
    match.usuarioCargaId = new Types.ObjectId(query.userId);
  }

  if (query.obraSocialId) {
    match.obraSocialId = new Types.ObjectId(query.obraSocialId);
  }

  if (query.patientId) {
    match.pacienteId = new Types.ObjectId(query.patientId);
  }

  const pipeline = buildAttentionPipeline(match);

  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { "paciente.dni": { $regex: search, $options: "i" } },
          { "paciente.nombre": { $regex: search, $options: "i" } },
          { "paciente.apellido": { $regex: search, $options: "i" } },
          { "obraSocial.nombre": { $regex: search, $options: "i" } },
          { "usuarioCarga.name": { $regex: search, $options: "i" } },
          { "usuarioCarga.apellido": { $regex: search, $options: "i" } },
          { "codigosDetalle.nombre": { $regex: search, $options: "i" } },
          { "codigosDetalle.codigo": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  const skip = (query.page - 1) * query.limit;
  const [rows, totalRows] = await Promise.all([
    AttentionModel.aggregate([
      ...pipeline,
      { $sort: { fecha: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: query.limit },
    ]),
    AttentionModel.aggregate([...pipeline, { $count: "total" }]),
  ]);
  const total = totalRows[0]?.total ?? 0;

  return {
    data: rows.map((row) => toAttentionDto(row)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getAttentionById(id: string, currentUser: SessionUser) {
  await connectToDatabase();

  const rows = await AttentionModel.aggregate([
    ...buildAttentionPipeline({
      _id: new Types.ObjectId(id),
    }),
  ]);
  const row = rows[0] as AttentionRow | undefined;

  if (!row) {
    throw new AppError("NOT_FOUND", "La atencion no existe", 404);
  }

  ensureAttentionOwnership(row, currentUser);

  return toAttentionDto(row);
}

export async function getAttentionLookups(input?: {
  dni?: string;
  patientId?: string;
  obraSocialId?: string;
  fecha?: string;
  attentionId?: string;
}) {
  await connectToDatabase();

  const obrasSociales = (
    await ObraSocialModel.find({ activo: true }).sort({ nombre: 1 }).lean()
  ).map((obraSocial) => ({
    id: String(obraSocial._id),
    nombre: obraSocial.nombre,
    cantidadPrestacionesMes: obraSocial.cantidadPrestacionesMes,
  }));
  const usuariosCarga = await listAttentionAssignableUsers();

  let paciente = null as null | {
    id: string;
    nombre: string;
    apellido: string;
    dni: string;
    activo: boolean;
    obraSocialId: string | null;
    obraSocialNombre: string | null;
    obraSocialActiva: boolean;
  };
  let codigos: Array<{
    id: string;
    nombre: string;
    codigo: string;
    valorCentavos: number;
  }> = [];
  let resumenMensual = null as null | {
    limiteMensual: number;
    usadasMes: number;
    disponibles: number;
    superaTope: boolean;
  };

  let pacienteDoc = null;
  let obraSocialIdForCodes = input?.obraSocialId ?? null;
  let attentionObraSocial = null as null | {
    _id: unknown;
    nombre: string;
    activo: boolean;
    cantidadPrestacionesMes: number;
    pacienteId: unknown;
  };

  if (input?.attentionId) {
    const attentionDoc = await AttentionModel.findById(input.attentionId)
      .populate("obraSocialId", "nombre activo cantidadPrestacionesMes")
      .lean();

    const populatedObraSocial = attentionDoc?.obraSocialId as
      | {
          _id: unknown;
          nombre: string;
          activo: boolean;
          cantidadPrestacionesMes: number;
        }
      | null
      | undefined;

    if (attentionDoc && populatedObraSocial) {
      attentionObraSocial = {
        ...populatedObraSocial,
        pacienteId: attentionDoc.pacienteId,
      };
      obraSocialIdForCodes = String(populatedObraSocial._id);
    }
  }

  if (input?.patientId) {
    pacienteDoc = await PacienteModel.findById(input.patientId)
      .populate("obraSocialId", "nombre activo cantidadPrestacionesMes")
      .lean();
  } else if (input?.dni) {
    pacienteDoc = await PacienteModel.findOne({ dni: normalizeDni(input.dni) })
      .populate("obraSocialId", "nombre activo cantidadPrestacionesMes")
      .lean();
  }

  if (pacienteDoc) {
    const currentPacienteObraSocial = pacienteDoc.obraSocialId as
      | {
          _id: unknown;
          nombre?: string;
          activo?: boolean;
          cantidadPrestacionesMes?: number;
        }
      | null;
    const shouldUseAttentionObraSocial =
      Boolean(attentionObraSocial) &&
      String(attentionObraSocial?.pacienteId) === String(pacienteDoc._id);
    const obraSocial = shouldUseAttentionObraSocial
      ? {
          _id: attentionObraSocial!._id,
          nombre: attentionObraSocial!.nombre,
          activo: attentionObraSocial!.activo,
          cantidadPrestacionesMes: attentionObraSocial!.cantidadPrestacionesMes,
        }
      : currentPacienteObraSocial;

    paciente = {
      id: String(pacienteDoc._id),
      nombre: pacienteDoc.nombre,
      apellido: pacienteDoc.apellido,
      dni: pacienteDoc.dni,
      activo: pacienteDoc.activo,
      obraSocialId: obraSocial ? String(obraSocial._id) : null,
      obraSocialNombre: obraSocial?.nombre ?? null,
      obraSocialActiva: Boolean(obraSocial?.activo),
    };

    if (pacienteDoc.activo && obraSocial?.activo && obraSocial._id) {
      obraSocialIdForCodes = String(obraSocial._id);
      const usadasMes = await getMonthlyUsage({
        pacienteId: String(pacienteDoc._id),
        obraSocialId: String(obraSocial._id),
        fecha: input?.fecha ?? new Date(),
        excludeAttentionId: input?.attentionId,
      });
      const limiteMensual = obraSocial.cantidadPrestacionesMes ?? 0;

      resumenMensual = {
        limiteMensual,
        usadasMes,
        disponibles: Math.max(limiteMensual - usadasMes, 0),
        superaTope: usadasMes > limiteMensual,
      };
    }
  }

  if (obraSocialIdForCodes) {
    const obraSocial = await ObraSocialModel.findById(obraSocialIdForCodes).lean();

    if (obraSocial?.activo) {
      codigos = (
        await CodigoObraSocialModel.find({
          obraSocialId: obraSocial._id,
          activo: true,
        })
          .sort({ nombre: 1, codigo: 1 })
          .lean()
      ).map((codigo) => ({
        id: String(codigo._id),
        nombre: codigo.nombre,
        codigo: codigo.codigo,
        valorCentavos: codigo.valorCentavos,
      }));

      if (!resumenMensual) {
        resumenMensual = {
          limiteMensual: obraSocial.cantidadPrestacionesMes,
          usadasMes: 0,
          disponibles: obraSocial.cantidadPrestacionesMes,
          superaTope: false,
        };
      }
    }
  }

  return {
    paciente,
    codigos,
    obrasSociales,
    usuariosCarga,
    resumenMensual,
  };
}

export async function createAttention(input: AttentionFormInput, currentUser: SessionUser) {
  await connectToDatabase();

  const paciente = await resolvePaciente(input);
  const obraSocial = await resolveActiveObraSocial(paciente);
  const codigos = await resolveAttentionCodes(String(obraSocial._id), input.codigos);

  const attention = await AttentionModel.create({
    fecha: new Date(input.fecha),
    pacienteId: new Types.ObjectId(String(paciente._id)),
    obraSocialId: new Types.ObjectId(String(obraSocial._id)),
    usuarioCargaId: new Types.ObjectId(currentUser.id),
    observacionGeneral: input.observacionGeneral
      ? normalizeWhitespace(input.observacionGeneral)
      : null,
    codigos,
  });

  return getAttentionById(String(attention._id), currentUser);
}

export async function updateAttention(
  id: string,
  input: AttentionFormInput,
  currentUser: SessionUser,
  options?: {
    isAdministrative?: boolean;
  },
) {
  await connectToDatabase();

  const attention = await AttentionModel.findById(id);

  if (!attention) {
    throw new AppError("NOT_FOUND", "La atencion no existe", 404);
  }

  ensureAttentionOwnership(attention, currentUser);

  const isAdministrative = Boolean(options?.isAdministrative && hasAdministrativeAccess(currentUser));

  if (!isAdministrative) {
    ensureEditableAttentionShape(
      {
        fecha: attention.fecha,
        pacienteId: attention.pacienteId,
        observacionGeneral: attention.observacionGeneral,
        codigos: attention.codigos.map((line) => ({
          codigoObraSocialId: String(line.codigoObraSocialId),
          pieza: line.pieza,
          coseguroCentavos: line.coseguroCentavos,
          coseguroOdontoCentavos: line.coseguroOdontoCentavos,
          observacion: line.observacion,
          pagoOdontologoCentavos: line.pagoOdontologoCentavos,
          estado: line.estado,
        })),
      },
      input,
    );
  }

  const paciente = await resolvePaciente(input);
  const shouldReuseCurrentAttentionObraSocial =
    String(attention.pacienteId) === String(paciente._id);
  const obraSocial = await resolveActiveObraSocial({
    ...paciente,
    currentAttentionObraSocialId: shouldReuseCurrentAttentionObraSocial
      ? attention.obraSocialId
      : null,
  });
  const codigos = await resolveAttentionCodes(String(obraSocial._id), input.codigos);

  if (isAdministrative) {
    const persistedLinesById = new Map(
      attention.codigos.map((line) => [String(line._id), line]),
    );
    const incomingLineIds = new Set(
      input.codigos
        .map((line) => line.lineId)
        .filter((lineId): lineId is string => Boolean(lineId)),
    );

    const removedPaidLine = attention.codigos.find(
      (line) => !incomingLineIds.has(String(line._id)) && hasAnyPaidConcept(line),
    );

    if (removedPaidLine) {
      throw new AppError(
        "VALIDATION_ERROR",
        "No podes quitar una linea que ya tenga conceptos pagados",
        400,
      );
    }

    attention.fecha = new Date(input.fecha);
    attention.pacienteId = new Types.ObjectId(String(paciente._id));
    attention.obraSocialId = new Types.ObjectId(String(obraSocial._id));
    attention.observacionGeneral = input.observacionGeneral
      ? normalizeWhitespace(input.observacionGeneral)
      : null;
    attention.codigos = codigos.map((nextLine, index) => {
      const inputLine = input.codigos[index];
      const persistedLine =
        (inputLine?.lineId
          ? persistedLinesById.get(inputLine.lineId)
          : undefined) ?? attention.codigos[index];

      if (!persistedLine) {
        return nextLine;
      }

      if (hasAnyPaidConcept(persistedLine)) {
        ensurePaidLineProtected(
          {
            codigoObraSocialId: String(persistedLine.codigoObraSocialId),
            pieza: persistedLine.pieza,
            coseguroCentavos: persistedLine.coseguroCentavos,
            coseguroOdontoCentavos: persistedLine.coseguroOdontoCentavos,
            observacion: persistedLine.observacion,
            pagoOdontologoCentavos: persistedLine.pagoOdontologoCentavos,
            estado: persistedLine.estado,
          },
          {
            codePaymentStatus: persistedLine.codePaymentStatus,
            coseguroOdontoPaymentStatus:
              persistedLine.coseguroOdontoPaymentStatus,
          },
          inputLine,
          index,
        );

        return persistedLine;
      }

      return buildAdministrativeProtectedLine({
        persistedLine,
        nextLine,
      });
    }) as typeof attention.codigos;
  } else {
    attention.codigos = attention.codigos.map((persistedLine, index) => {
      const inputLine = input.codigos[index];
      const nextLine = codigos[index];

      if (!inputLine || !nextLine) {
        throw new AppError(
          "VALIDATION_ERROR",
          "No podes agregar ni quitar codigos en una atencion ya creada desde esta vista",
          400,
        );
      }

      const persistedComparable = {
        codigoObraSocialId: String(persistedLine.codigoObraSocialId),
        pieza: persistedLine.pieza,
        coseguroCentavos: persistedLine.coseguroCentavos,
        coseguroOdontoCentavos: persistedLine.coseguroOdontoCentavos,
        observacion: persistedLine.observacion,
        pagoOdontologoCentavos: persistedLine.pagoOdontologoCentavos,
        estado: persistedLine.estado,
      };

      if (persistedLine.estado !== "pendiente") {
        ensureAuditedLineUnchanged(persistedComparable, inputLine, index);
        return persistedLine;
      }

      if (hasAnyPaidConcept(persistedLine)) {
        ensurePaidLineProtected(
          persistedComparable,
          {
            codePaymentStatus: persistedLine.codePaymentStatus,
            coseguroOdontoPaymentStatus:
              persistedLine.coseguroOdontoPaymentStatus,
          },
          inputLine,
          index,
        );
        return persistedLine;
      }

      ensureEditableLineState(persistedComparable, inputLine, index);

      return {
        ...nextLine,
        _id: persistedLine._id,
        pagoOdontologoCentavos: persistedLine.pagoOdontologoCentavos,
        coseguroOdontoCentavos: persistedLine.coseguroOdontoCentavos,
        estado: persistedLine.estado,
        codePaymentStatus: persistedLine.codePaymentStatus ?? "pendiente",
        codePaymentId: persistedLine.codePaymentId ?? null,
        codePaidAt: persistedLine.codePaidAt ?? null,
        coseguroOdontoPaymentStatus:
          persistedLine.coseguroOdontoPaymentStatus ?? "pendiente",
        coseguroOdontoPaymentId: persistedLine.coseguroOdontoPaymentId ?? null,
        coseguroOdontoPaidAt: persistedLine.coseguroOdontoPaidAt ?? null,
      };
    });
  }

  await attention.save();

  return getAttentionById(id, currentUser);
}
