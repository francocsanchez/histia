import { PipelineStage, Types } from "mongoose";

import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  formatDateOnlyValue,
  normalizeDni,
  normalizeWhitespace,
  parseDateOnlyAsUtc,
} from "@/lib/utils";
import { OrthodonticTreatmentModel } from "@/models/orthodontic-treatment";
import { PacienteModel } from "@/models/paciente";
import { UserModel } from "@/models/user";
import { createPaciente } from "@/services/pacientes";
import {
  OrthodonticPaymentDto,
  OrthodonticTreatmentDto,
  OrthodonticTreatmentStatus,
  OrthodonticTreatmentTotalsDto,
  QueryParams,
  SessionUser,
} from "@/types/domain";

type OrthodonticTreatmentInput = {
  fechaInicio: string;
  pacienteId?: string | null;
  paciente?: {
    nombre: string;
    apellido: string;
    dni: string;
    obraSocialId?: string | null;
  };
  usuarioOrtodoncistaId?: string | null;
  tratamientoTipo: OrthodonticTreatmentDto["tratamientoTipo"];
  valorTratamientoCentavos: number;
  valorMaterialesCentavos: number;
  estado: OrthodonticTreatmentStatus;
};

type OrthodonticPaymentInput = {
  fecha: string;
  montoCentavos: number;
  porcentajeOrtodoncista: number;
};

function isAdmin(user: SessionUser) {
  return user.roles.includes("administrador");
}

function orthodontistRegex() {
  return /(^|,)ortodoncista(,|$)/;
}

function getObjectIdString(value: unknown) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toHexString" in value &&
    typeof (value as { toHexString?: unknown }).toHexString === "function"
  ) {
    return (value as { toHexString: () => string }).toHexString();
  }

  if (typeof value === "object" && value !== null) {
    const nestedId =
      "_id" in value
        ? (value as { _id?: unknown })._id
        : "id" in value
          ? (value as { id?: unknown }).id
          : undefined;

    if (nestedId) {
      return getObjectIdString(nestedId);
    }
  }

  return String(value);
}

function normalizeOptionalText(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = normalizeWhitespace(value);
  return normalized || null;
}

function calculateOrthodontistAmount(
  montoCentavos: number,
  porcentajeOrtodoncista: number,
) {
  return Math.round(montoCentavos * (porcentajeOrtodoncista / 100));
}

function buildTotals(input: {
  valorTratamientoCentavos: number;
  valorMaterialesCentavos: number;
  payments: Array<{
    montoCentavos: number;
    montoOrtodoncistaCentavos: number;
    paymentStatus: "pendiente" | "pagado";
  }>;
}): OrthodonticTreatmentTotalsDto {
  const totalPresupuestadoCentavos =
    input.valorTratamientoCentavos + input.valorMaterialesCentavos;
  const totalPagadoPacienteCentavos = input.payments.reduce(
    (acc, payment) => acc + payment.montoCentavos,
    0,
  );
  const totalLiquidableOrtodoncistaCentavos = input.payments.reduce(
    (acc, payment) => acc + payment.montoOrtodoncistaCentavos,
    0,
  );
  const totalPagadoOrtodoncistaCentavos = input.payments.reduce(
    (acc, payment) =>
      acc +
      (payment.paymentStatus === "pagado"
        ? payment.montoOrtodoncistaCentavos
        : 0),
    0,
  );
  const saldoPacienteCentavos = Math.max(
    totalPresupuestadoCentavos - totalPagadoPacienteCentavos,
    0,
  );
  const porcentajePagado =
    totalPresupuestadoCentavos > 0
      ? Math.min(
          100,
          Number(
            (
              (totalPagadoPacienteCentavos / totalPresupuestadoCentavos) *
              100
            ).toFixed(2),
          ),
        )
      : 0;

  return {
    totalPresupuestadoCentavos,
    totalPagadoPacienteCentavos,
    saldoPacienteCentavos,
    porcentajePagado,
    totalLiquidableOrtodoncistaCentavos,
    totalPendienteOrtodoncistaCentavos:
      totalLiquidableOrtodoncistaCentavos - totalPagadoOrtodoncistaCentavos,
    totalPagadoOrtodoncistaCentavos,
  };
}

function toPaymentDto(payment: {
  _id: unknown;
  fecha: Date;
  montoCentavos: number;
  porcentajeOrtodoncista: number;
  montoOrtodoncistaCentavos: number;
  paymentStatus: "pendiente" | "pagado";
  paymentId: unknown;
  paidAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}): OrthodonticPaymentDto {
  return {
    id: getObjectIdString(payment._id),
    fecha: payment.fecha.toISOString(),
    montoCentavos: payment.montoCentavos,
    porcentajeOrtodoncista: payment.porcentajeOrtodoncista,
    montoOrtodoncistaCentavos: payment.montoOrtodoncistaCentavos,
    paymentStatus: payment.paymentStatus,
    paymentId: payment.paymentId ? getObjectIdString(payment.paymentId) : null,
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
    createdAt: (payment.createdAt ?? payment.fecha).toISOString(),
    updatedAt: (payment.updatedAt ?? payment.fecha).toISOString(),
  };
}

function toTreatmentDto(document: {
  _id: unknown;
  fechaInicio: Date;
  pacienteId:
    | {
        _id: unknown;
        nombre: string;
        apellido: string;
        dni: string;
      }
    | unknown;
  usuarioOrtodoncistaId:
    | {
        _id: unknown;
        name: string;
        apellido?: string | null;
      }
    | unknown;
  tratamientoTipo: OrthodonticTreatmentDto["tratamientoTipo"];
  valorTratamientoCentavos: number;
  valorMaterialesCentavos: number;
  estado: OrthodonticTreatmentStatus;
  payments: Array<{
    _id: unknown;
    fecha: Date;
    montoCentavos: number;
    porcentajeOrtodoncista: number;
    montoOrtodoncistaCentavos: number;
    paymentStatus: "pendiente" | "pagado";
    paymentId: unknown;
    paidAt: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}): OrthodonticTreatmentDto {
  const patient =
    typeof document.pacienteId === "object" && document.pacienteId !== null
      ? (document.pacienteId as {
          _id: unknown;
          nombre: string;
          apellido: string;
          dni: string;
        })
      : null;
  const orthodontist =
    typeof document.usuarioOrtodoncistaId === "object" &&
    document.usuarioOrtodoncistaId !== null
      ? (document.usuarioOrtodoncistaId as {
          _id: unknown;
          name: string;
          apellido?: string | null;
        })
      : null;
  const payments = [...document.payments]
    .sort((left, right) => left.fecha.getTime() - right.fecha.getTime())
    .map(toPaymentDto);

  return {
    id: getObjectIdString(document._id),
    fechaInicio: document.fechaInicio.toISOString(),
    pacienteId: patient ? getObjectIdString(patient._id) : getObjectIdString(document.pacienteId),
    pacienteNombreCompleto: patient
      ? `${patient.apellido}, ${patient.nombre}`
      : "",
    pacienteDni: patient?.dni ?? "",
    usuarioOrtodoncistaId: orthodontist
      ? getObjectIdString(orthodontist._id)
      : getObjectIdString(document.usuarioOrtodoncistaId),
    usuarioOrtodoncistaNombre: orthodontist
      ? normalizeWhitespace(`${orthodontist.apellido ?? ""}, ${orthodontist.name}`)
      : "",
    tratamientoTipo: document.tratamientoTipo,
    valorTratamientoCentavos: document.valorTratamientoCentavos,
    valorMaterialesCentavos: document.valorMaterialesCentavos,
    estado: document.estado,
    payments,
    totals: buildTotals({
      valorTratamientoCentavos: document.valorTratamientoCentavos,
      valorMaterialesCentavos: document.valorMaterialesCentavos,
      payments: payments.map((payment) => ({
        montoCentavos: payment.montoCentavos,
        montoOrtodoncistaCentavos: payment.montoOrtodoncistaCentavos,
        paymentStatus: payment.paymentStatus,
      })),
    }),
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

async function resolveOrthodontistUser(
  requestedUserId: string | null | undefined,
  currentUser: SessionUser,
) {
  if (isAdmin(currentUser) && !requestedUserId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Debes seleccionar un ortodoncista",
      400,
      {
        usuarioOrtodoncistaId: "Debes seleccionar un ortodoncista",
      },
    );
  }

  const targetUserId = isAdmin(currentUser) ? requestedUserId : currentUser.id;

  const user = await UserModel.findById(targetUserId).lean();

  if (!user) {
    throw new AppError("NOT_FOUND", "El ortodoncista no existe", 404);
  }

  if (!user.activo || !String(user.roles ?? "").match(orthodontistRegex())) {
    throw new AppError(
      "INACTIVE_RELATED_RECORD",
      "Debes seleccionar un ortodoncista activo",
      409,
    );
  }

  return user;
}

async function resolvePaciente(input: OrthodonticTreatmentInput) {
  if (input.pacienteId) {
    const paciente = await PacienteModel.findById(input.pacienteId).lean();

    if (!paciente) {
      throw new AppError("NOT_FOUND", "El paciente no existe", 404);
    }

    if (!paciente.activo) {
      throw new AppError(
        "INACTIVE_RELATED_RECORD",
        "El paciente debe estar activo",
        409,
      );
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

  const duplicate = await PacienteModel.findOne({
    dni: normalizeDni(input.paciente.dni),
  }).lean();

  if (duplicate) {
    if (!duplicate.activo) {
      throw new AppError(
        "INACTIVE_RELATED_RECORD",
        "El paciente encontrado esta inactivo",
        409,
      );
    }

    return duplicate;
  }

  const createdPaciente = await createPaciente({
    ...input.paciente,
    obraSocialId: input.paciente.obraSocialId ?? null,
  });
  const paciente = await PacienteModel.findById(createdPaciente.id).lean();

  if (!paciente) {
    throw new AppError("INTERNAL_ERROR", "No se pudo resolver el paciente", 500);
  }

  return paciente;
}

async function ensureNoOtherActiveTreatment(
  pacienteId: string,
  excludeId?: string,
) {
  const duplicate = await OrthodonticTreatmentModel.findOne({
    pacienteId: new Types.ObjectId(pacienteId),
    estado: "activo",
    ...(excludeId ? { _id: { $ne: new Types.ObjectId(excludeId) } } : {}),
  }).lean();

  if (duplicate) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "El paciente ya tiene un tratamiento de ortodoncia activo",
      409,
      {
        pacienteId: "El paciente ya tiene un tratamiento de ortodoncia activo",
      },
    );
  }
}

async function loadTreatmentOrFail(id: string) {
  const treatment = await OrthodonticTreatmentModel.findById(id)
    .populate("pacienteId", "nombre apellido dni")
    .populate("usuarioOrtodoncistaId", "name apellido roles activo")
    .lean();

  if (!treatment) {
    throw new AppError("NOT_FOUND", "Tratamiento no encontrado", 404);
  }

  return treatment;
}

function ensureOwnership(
  treatment: { usuarioOrtodoncistaId: unknown },
  currentUser: SessionUser,
) {
  if (isAdmin(currentUser)) {
    return;
  }

  if (getObjectIdString(treatment.usuarioOrtodoncistaId) !== currentUser.id) {
    throw new AppError(
      "FORBIDDEN",
      "No tenes permisos para acceder a este tratamiento",
      403,
    );
  }
}

export async function listOrthodonticTreatments(
  query: QueryParams,
  currentUser: SessionUser,
) {
  await connectToDatabase();

  const match: Record<string, unknown> = {};

  if (query.status === "active") {
    match.estado = "activo";
  }

  if (query.status === "inactive") {
    match.estado = { $in: ["cerrado", "cancelado"] };
  }

  if (query.orthodonticTreatmentStatus) {
    match.estado = query.orthodonticTreatmentStatus;
  }

  if (query.userId) {
    match.usuarioOrtodoncistaId = new Types.ObjectId(query.userId);
  }

  if (!isAdmin(currentUser)) {
    match.usuarioOrtodoncistaId = new Types.ObjectId(currentUser.id);
  }

  if (query.dateFrom || query.dateTo) {
    match.fechaInicio = {};

    if (query.dateFrom) {
      (match.fechaInicio as Record<string, Date>).$gte = parseDateOnlyAsUtc(
        query.dateFrom,
      );
    }

    if (query.dateTo) {
      (match.fechaInicio as Record<string, Date>).$lte = parseDateOnlyAsUtc(
        query.dateTo,
        { endOfDay: true },
      );
    }
  }

  if (query.patientId) {
    match.pacienteId = new Types.ObjectId(query.patientId);
  }

  const skip = (query.page - 1) * query.limit;
  const search = query.search?.trim();

  const pipeline: PipelineStage[] = [
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
        from: "users",
        localField: "usuarioOrtodoncistaId",
        foreignField: "_id",
        as: "ortodoncista",
      },
    },
    { $unwind: "$ortodoncista" },
    {
      $set: {
        pacienteId: "$paciente",
        usuarioOrtodoncistaId: "$ortodoncista",
      },
    },
  ];

  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { "paciente.dni": { $regex: search, $options: "i" } },
          { "paciente.nombre": { $regex: search, $options: "i" } },
          { "paciente.apellido": { $regex: search, $options: "i" } },
          { tratamientoTipo: { $regex: search, $options: "i" } },
          { "ortodoncista.name": { $regex: search, $options: "i" } },
          { "ortodoncista.apellido": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  const [rows, totalRows] = await Promise.all([
    OrthodonticTreatmentModel.aggregate<
      {
        _id: Types.ObjectId;
        fechaInicio: Date;
        pacienteId: { _id: Types.ObjectId; nombre: string; apellido: string; dni: string };
        usuarioOrtodoncistaId: {
          _id: Types.ObjectId;
          name: string;
          apellido?: string | null;
        };
        tratamientoTipo: OrthodonticTreatmentDto["tratamientoTipo"];
        valorTratamientoCentavos: number;
        valorMaterialesCentavos: number;
        estado: OrthodonticTreatmentStatus;
        payments: Array<{
          _id: Types.ObjectId;
          fecha: Date;
          montoCentavos: number;
          porcentajeOrtodoncista: number;
          montoOrtodoncistaCentavos: number;
          paymentStatus: "pendiente" | "pagado";
          paymentId: Types.ObjectId | null;
          paidAt: Date | null;
          createdAt?: Date;
          updatedAt?: Date;
        }>;
        createdAt: Date;
        updatedAt: Date;
      }
    >([
      ...pipeline,
      { $sort: { fechaInicio: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: query.limit },
    ]),
    OrthodonticTreatmentModel.aggregate<{ total: number }>([
      ...pipeline,
      { $count: "total" },
    ]),
  ]);

  return {
    data: rows.map(toTreatmentDto),
    pagination: {
      page: query.page,
      limit: query.limit,
      total: totalRows[0]?.total ?? 0,
      totalPages: Math.max(1, Math.ceil((totalRows[0]?.total ?? 0) / query.limit)),
    },
  };
}

export async function getOrthodonticTreatment(
  id: string,
  currentUser: SessionUser,
) {
  await connectToDatabase();

  const treatment = await loadTreatmentOrFail(id);
  ensureOwnership(treatment, currentUser);

  return toTreatmentDto(treatment);
}

export async function getOrthodonticLookups(input?: {
  dni?: string;
}) {
  await connectToDatabase();

  const patientDoc = input?.dni
    ? await PacienteModel.findOne({ dni: normalizeDni(input.dni) }).lean()
    : null;

  const orthodontists = (
    await UserModel.find({
      activo: true,
      roles: { $regex: orthodontistRegex() },
    })
      .sort({ apellido: 1, name: 1 })
      .lean()
  ).map((user: { _id: unknown; apellido?: string | null; name: string }) => ({
    id: String(user._id),
    label: normalizeWhitespace(`${user.apellido ?? ""}, ${user.name}`),
  }));

  return {
    paciente: patientDoc
      ? {
          id: String(patientDoc._id),
          nombre: patientDoc.nombre,
          apellido: patientDoc.apellido,
          dni: patientDoc.dni,
          obraSocialId: patientDoc.obraSocialId ? String(patientDoc.obraSocialId) : null,
          obraSocialNombre: null,
        }
      : null,
    ortodoncistas: orthodontists,
  };
}

export async function createOrthodonticTreatment(
  input: OrthodonticTreatmentInput,
  currentUser: SessionUser,
) {
  await connectToDatabase();

  const paciente = await resolvePaciente(input);
  const ortodoncista = await resolveOrthodontistUser(
    input.usuarioOrtodoncistaId,
    currentUser,
  );

  if (input.estado === "activo") {
    await ensureNoOtherActiveTreatment(String(paciente._id));
  }

  const created = await OrthodonticTreatmentModel.create({
    fechaInicio: parseDateOnlyAsUtc(input.fechaInicio),
    pacienteId: new Types.ObjectId(String(paciente._id)),
    usuarioOrtodoncistaId: new Types.ObjectId(String(ortodoncista._id)),
    tratamientoTipo: input.tratamientoTipo,
    valorTratamientoCentavos: input.valorTratamientoCentavos,
    valorMaterialesCentavos: input.valorMaterialesCentavos,
    estado: input.estado ?? "activo",
    payments: [],
  });

  return getOrthodonticTreatment(String(created._id), currentUser);
}

export async function updateOrthodonticTreatment(
  id: string,
  input: OrthodonticTreatmentInput,
  currentUser: SessionUser,
) {
  await connectToDatabase();

  const treatment = await OrthodonticTreatmentModel.findById(id);

  if (!treatment) {
    throw new AppError("NOT_FOUND", "Tratamiento no encontrado", 404);
  }

  ensureOwnership(treatment, currentUser);

  const paciente = await resolvePaciente(input);
  const ortodoncista = await resolveOrthodontistUser(
    input.usuarioOrtodoncistaId || getObjectIdString(treatment.usuarioOrtodoncistaId),
    currentUser,
  );

  if (input.estado === "activo") {
    await ensureNoOtherActiveTreatment(String(paciente._id), id);
  }

  treatment.fechaInicio = parseDateOnlyAsUtc(input.fechaInicio);
  treatment.pacienteId = new Types.ObjectId(String(paciente._id));
  treatment.usuarioOrtodoncistaId = new Types.ObjectId(String(ortodoncista._id));
  treatment.tratamientoTipo = input.tratamientoTipo;
  treatment.valorTratamientoCentavos = input.valorTratamientoCentavos;
  treatment.valorMaterialesCentavos = input.valorMaterialesCentavos;
  treatment.estado = input.estado;
  await treatment.save();

  return getOrthodonticTreatment(id, currentUser);
}

export async function addOrthodonticPayment(
  treatmentId: string,
  input: OrthodonticPaymentInput,
  currentUser: SessionUser,
) {
  await connectToDatabase();

  const treatment = await OrthodonticTreatmentModel.findById(treatmentId);

  if (!treatment) {
    throw new AppError("NOT_FOUND", "Tratamiento no encontrado", 404);
  }

  ensureOwnership(treatment, currentUser);

  treatment.payments.push({
    _id: new Types.ObjectId(),
    fecha: parseDateOnlyAsUtc(input.fecha),
    montoCentavos: input.montoCentavos,
    porcentajeOrtodoncista: input.porcentajeOrtodoncista,
    montoOrtodoncistaCentavos: calculateOrthodontistAmount(
      input.montoCentavos,
      input.porcentajeOrtodoncista,
    ),
    paymentStatus: "pendiente",
    paymentId: null,
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await treatment.save();

  return getOrthodonticTreatment(treatmentId, currentUser);
}

export async function updateOrthodonticPayment(
  treatmentId: string,
  paymentId: string,
  input: OrthodonticPaymentInput,
  currentUser: SessionUser,
) {
  await connectToDatabase();

  const treatment = await OrthodonticTreatmentModel.findById(treatmentId);

  if (!treatment) {
    throw new AppError("NOT_FOUND", "Tratamiento no encontrado", 404);
  }

  ensureOwnership(treatment, currentUser);

  const paymentIndex = treatment.payments.findIndex(
    (item) => String(item._id) === paymentId,
  );
  const payment = treatment.payments[paymentIndex];

  if (paymentIndex < 0 || !payment) {
    throw new AppError("NOT_FOUND", "Pago no encontrado", 404);
  }

  if (payment.paymentStatus === "pagado" || payment.paymentId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "No podes editar un pago de ortodoncia ya liquidado",
      409,
    );
  }

  payment.fecha = parseDateOnlyAsUtc(input.fecha);
  payment.montoCentavos = input.montoCentavos;
  payment.porcentajeOrtodoncista = input.porcentajeOrtodoncista;
  payment.montoOrtodoncistaCentavos = calculateOrthodontistAmount(
    input.montoCentavos,
    input.porcentajeOrtodoncista,
  );
  payment.updatedAt = new Date();
  await treatment.save();

  return getOrthodonticTreatment(treatmentId, currentUser);
}

export async function deleteOrthodonticPayment(
  treatmentId: string,
  paymentId: string,
  currentUser: SessionUser,
) {
  await connectToDatabase();

  const treatment = await OrthodonticTreatmentModel.findById(treatmentId);

  if (!treatment) {
    throw new AppError("NOT_FOUND", "Tratamiento no encontrado", 404);
  }

  ensureOwnership(treatment, currentUser);

  const paymentIndex = treatment.payments.findIndex(
    (item) => String(item._id) === paymentId,
  );
  const payment = treatment.payments[paymentIndex];

  if (paymentIndex < 0 || !payment) {
    throw new AppError("NOT_FOUND", "Pago no encontrado", 404);
  }

  if (payment.paymentStatus === "pagado" || payment.paymentId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "No podes eliminar un pago de ortodoncia ya liquidado",
      409,
    );
  }

  treatment.payments.splice(paymentIndex, 1);
  await treatment.save();

  return getOrthodonticTreatment(treatmentId, currentUser);
}

export function getOrthodonticPaymentMonthKey(paymentDate: Date) {
  return formatDateOnlyValue(paymentDate).slice(0, 7);
}
