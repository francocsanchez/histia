import { Types } from "mongoose";

import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { normalizeName, normalizeWhitespace } from "@/lib/utils";
import { ObraSocialModel } from "@/models/obra-social";
import { PacienteModel } from "@/models/paciente";
import { RxAttentionModel } from "@/models/rx-attention";
import { UserModel } from "@/models/user";
import {
  QueryParams,
  ReferrerType,
  RxAttentionDto,
  RxType,
  SessionUser,
} from "@/types/domain";
import { createPaciente } from "@/services/pacientes";

function odontologoRegex() {
  return /(^|,)odontologo(,|$)/;
}

function toRxDto(document: {
  _id: unknown;
  fecha: Date;
  pacienteId: unknown;
  tipoRx: RxType;
  derivanteTipo: ReferrerType;
  derivanteUserId: unknown;
  derivanteExternoNombre: string | null;
  valorCentavos: number | null;
  usuarioGeneradorId: unknown;
  observaciones: string | null;
  createdAt: Date;
  updatedAt: Date;
  paciente?: { nombre: string; apellido: string; dni: string } | null;
  derivanteInterno?: { name: string; apellido?: string | null } | null;
  usuarioGenerador?: { name: string; apellido?: string | null } | null;
}): RxAttentionDto {
  const pacienteNombre = document.paciente
    ? `${document.paciente.apellido}, ${document.paciente.nombre}`
    : "Paciente sin datos";
  const derivanteNombre =
    document.derivanteTipo === "interno"
      ? normalizeWhitespace(
          `${document.derivanteInterno?.apellido ?? ""}, ${
            document.derivanteInterno?.name ?? ""
          }`,
        )
      : document.derivanteExternoNombre ?? "";
  const usuarioGeneradorNombre = normalizeWhitespace(
    `${document.usuarioGenerador?.apellido ?? ""}, ${
      document.usuarioGenerador?.name ?? ""
    }`,
  );

  return {
    id: String(document._id),
    fecha: document.fecha.toISOString(),
    pacienteId: String(document.pacienteId),
    pacienteNombreCompleto: pacienteNombre,
    pacienteDni: document.paciente?.dni ?? "",
    derivanteTipo: document.derivanteTipo,
    derivanteUserId: document.derivanteUserId ? String(document.derivanteUserId) : null,
    derivanteNombre,
    tipoRx: document.tipoRx,
    valorCentavos: document.valorCentavos,
    usuarioGeneradorId: String(document.usuarioGeneradorId),
    usuarioGeneradorNombre,
    observaciones: document.observaciones,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
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

export async function listRxAttentions(query: QueryParams) {
  await connectToDatabase();

  const match: Record<string, unknown> = {};
  const search = query.search?.trim();
  const dateMatch = buildDateMatch(query);

  if (query.rxType) {
    match.tipoRx = query.rxType;
  }

  if (dateMatch) {
    match.fecha = dateMatch;
  }

  const pipeline = [
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
        localField: "derivanteUserId",
        foreignField: "_id",
        as: "derivanteInterno",
      },
    },
    {
      $unwind: {
        path: "$derivanteInterno",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "usuarioGeneradorId",
        foreignField: "_id",
        as: "usuarioGenerador",
      },
    },
    { $unwind: "$usuarioGenerador" },
  ];

  if (search) {
    pipeline.push({
      $match: {
        $or: [
          { "paciente.dni": { $regex: search, $options: "i" } },
          { "paciente.nombre": { $regex: search, $options: "i" } },
          { "paciente.apellido": { $regex: search, $options: "i" } },
          { derivanteExternoNombre: { $regex: search, $options: "i" } },
          { "derivanteInterno.name": { $regex: search, $options: "i" } },
          { "derivanteInterno.apellido": { $regex: search, $options: "i" } },
        ],
      },
    });
  }

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const [rows, totalRows] = await Promise.all([
    RxAttentionModel.aggregate([
      ...pipeline,
      { $sort: { fecha: -1, createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]),
    RxAttentionModel.aggregate([
      ...pipeline,
      { $count: "total" },
    ]),
  ]);

  const total = totalRows[0]?.total ?? 0;

  return {
    data: rows.map((row) => toRxDto(row)),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function getRxLookups(dni?: string) {
  await connectToDatabase();

  const odontologos = await UserModel.find({
    activo: true,
    roles: { $regex: odontologoRegex() },
  })
    .sort({ apellido: 1, name: 1 })
    .lean();

  const result: {
    paciente: {
      id: string;
      nombre: string;
      apellido: string;
      dni: string;
      obraSocialId: string | null;
      obraSocialNombre: string | null;
    } | null;
    odontologos: Array<{ id: string; label: string }>;
    obrasSociales: Array<{ id: string; nombre: string }>;
  } = {
    paciente: null,
    odontologos: odontologos.map((user) => ({
      id: String(user._id),
      label: normalizeWhitespace(`${user.apellido ?? ""}, ${user.name}`),
    })),
    obrasSociales: [],
  };

  result.obrasSociales = (
    await ObraSocialModel.find({ activo: true }).sort({ nombre: 1 }).lean()
  ).map((obra) => ({
    id: String(obra._id),
    nombre: obra.nombre,
  }));

  if (dni) {
    const paciente = await PacienteModel.findOne({ dni }).populate("obraSocialId", "nombre").lean();

    if (paciente) {
      result.paciente = {
        id: String(paciente._id),
        nombre: paciente.nombre,
        apellido: paciente.apellido,
        dni: paciente.dni,
        obraSocialId: paciente.obraSocialId ? String(paciente.obraSocialId) : null,
        obraSocialNombre:
          (paciente.obraSocialId as { nombre?: string } | null)?.nombre ?? null,
      };
    }
  }

  return result;
}

async function resolvePaciente(input: {
  pacienteId?: string | null;
  paciente?: {
    nombre: string;
    apellido: string;
    dni: string;
    obraSocialId?: string | null;
  };
}) {
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
      "Debes indicar un paciente para la RX",
      400,
    );
  }

  const existingPaciente = await PacienteModel.findOne({ dni: input.paciente.dni }).lean();
  if (existingPaciente) {
    return existingPaciente;
  }

  const created = await createPaciente(input.paciente);
  const createdPaciente = await PacienteModel.findById(created.id).lean();

  if (!createdPaciente) {
    throw new AppError("INTERNAL_ERROR", "No se pudo crear el paciente", 500);
  }

  return createdPaciente;
}

async function resolveDerivante(input: {
  derivanteTipo: ReferrerType;
  derivanteUserId?: string | null;
  derivanteExternoNombre?: string | null;
}) {
  if (input.derivanteTipo === "interno") {
    if (!input.derivanteUserId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "Debes seleccionar un odontologo interno",
        400,
      );
    }

    const odontologo = await UserModel.findById(input.derivanteUserId).lean();

    if (!odontologo) {
      throw new AppError("NOT_FOUND", "El odontologo no existe", 404);
    }

    if (!odontologo.activo || !odontologo.roles?.match(odontologoRegex())) {
      throw new AppError(
        "VALIDATION_ERROR",
        "El derivante interno debe ser un odontologo activo",
        400,
      );
    }

    return {
      derivanteUserId: new Types.ObjectId(input.derivanteUserId),
      derivanteExternoNombre: null,
    };
  }

  const derivanteExternoNombre = normalizeName(input.derivanteExternoNombre ?? "");

  if (!derivanteExternoNombre) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Debes indicar el profesional derivante externo",
      400,
    );
  }

  return {
    derivanteUserId: null,
    derivanteExternoNombre,
  };
}

export async function createRxAttention(
  input: {
    fecha: string;
    pacienteId?: string | null;
    paciente?: {
      nombre: string;
      apellido: string;
      dni: string;
      obraSocialId?: string | null;
    };
    derivanteTipo: ReferrerType;
    derivanteUserId?: string | null;
    derivanteExternoNombre?: string | null;
    tipoRx: RxType;
    valorCentavos?: number | null;
    observaciones?: string | null;
  },
  currentUser: SessionUser,
) {
  await connectToDatabase();

  const paciente = await resolvePaciente({
    pacienteId: input.pacienteId,
    paciente: input.paciente,
  });
  const derivante = await resolveDerivante(input);

  const rx = await RxAttentionModel.create({
    fecha: new Date(input.fecha),
    pacienteId: new Types.ObjectId(String(paciente._id)),
    derivanteTipo: input.derivanteTipo,
    derivanteUserId: derivante.derivanteUserId,
    derivanteExternoNombre: derivante.derivanteExternoNombre,
    tipoRx: input.tipoRx,
    valorCentavos: input.valorCentavos ?? null,
    usuarioGeneradorId: new Types.ObjectId(currentUser.id),
    observaciones: input.observaciones
      ? normalizeWhitespace(input.observaciones)
      : null,
  });

  return await getRxAttentionById(String(rx._id));
}

export async function updateRxAttention(
  id: string,
  input: {
    fecha: string;
    pacienteId?: string | null;
    paciente?: {
      nombre: string;
      apellido: string;
      dni: string;
      obraSocialId?: string | null;
    };
    derivanteTipo: ReferrerType;
    derivanteUserId?: string | null;
    derivanteExternoNombre?: string | null;
    tipoRx: RxType;
    valorCentavos?: number | null;
    observaciones?: string | null;
  },
) {
  await connectToDatabase();

  const rx = await RxAttentionModel.findById(id);

  if (!rx) {
    throw new AppError("NOT_FOUND", "La atencion RX no existe", 404);
  }

  const paciente = await resolvePaciente({
    pacienteId: input.pacienteId,
    paciente: input.paciente,
  });
  const derivante = await resolveDerivante(input);

  rx.fecha = new Date(input.fecha);
  rx.pacienteId = new Types.ObjectId(String(paciente._id));
  rx.derivanteTipo = input.derivanteTipo;
  rx.derivanteUserId = derivante.derivanteUserId;
  rx.derivanteExternoNombre = derivante.derivanteExternoNombre;
  rx.tipoRx = input.tipoRx;
  rx.valorCentavos = input.valorCentavos ?? null;
  rx.observaciones = input.observaciones
    ? normalizeWhitespace(input.observaciones)
    : null;
  await rx.save();

  return await getRxAttentionById(id);
}

export async function getRxAttentionById(id: string) {
  await connectToDatabase();

  const rows = await RxAttentionModel.aggregate([
    {
      $match: {
        _id: new Types.ObjectId(id),
      },
    },
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
        localField: "derivanteUserId",
        foreignField: "_id",
        as: "derivanteInterno",
      },
    },
    {
      $unwind: {
        path: "$derivanteInterno",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "usuarioGeneradorId",
        foreignField: "_id",
        as: "usuarioGenerador",
      },
    },
    { $unwind: "$usuarioGenerador" },
  ]);

  const row = rows[0];

  if (!row) {
    throw new AppError("NOT_FOUND", "La atencion RX no existe", 404);
  }

  return toRxDto(row);
}
