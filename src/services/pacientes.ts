import { Types } from "mongoose";
import * as XLSX from "xlsx";

import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { can } from "@/lib/permissions";
import { normalizeDni, normalizeName } from "@/lib/utils";
import { ObraSocialModel } from "@/models/obra-social";
import { PacienteModel } from "@/models/paciente";
import { PacienteDto, QueryParams, SessionUser } from "@/types/domain";

export function normalizePacienteName(value: string) {
  return normalizeName(value).toLocaleLowerCase("es-AR");
}

type PacienteInput = {
  nombre: string;
  apellido: string;
  dni: string;
  obraSocialId?: string | null;
  activo?: boolean;
};

type PacienteExportRow = {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  obraSocialId: string;
  obraSocial: string;
  activo: "SI" | "NO";
};

export type PacienteWorkbookPreviewRow = {
  previewId: string;
  rowNumber: number;
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  obraSocialId: string;
  obraSocial: string;
  activo: string;
  operation: "create" | "update" | null;
  selected: boolean;
  valid: boolean;
  errors: string[];
};

type PacienteWorkbookPreview = {
  fileName: string;
  rows: PacienteWorkbookPreviewRow[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    createRows: number;
    updateRows: number;
  };
};

type PacienteImportApplyResult = {
  created: number;
  updated: number;
  processed: number;
};

function extractObraSocialId(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && "_id" in value) {
    const nestedId = (value as { _id?: unknown })._id;

    if (nestedId instanceof Types.ObjectId) {
      return nestedId.toString();
    }

    if (typeof nestedId === "string") {
      return nestedId;
    }
  }

  return String(value);
}

function toDto(document: {
  _id: unknown;
  nombre: string;
  apellido: string;
  dni: string;
  obraSocialId: unknown;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
  obraSocial?: { nombre: string } | null;
}): PacienteDto {
  return {
    id: String(document._id),
    nombre: document.nombre,
    apellido: document.apellido,
    dni: document.dni,
    obraSocialId: extractObraSocialId(document.obraSocialId),
    obraSocialNombre: document.obraSocial?.nombre ?? null,
    activo: document.activo,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function buildFilter(
  query: QueryParams,
  user: SessionUser,
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.search) {
    filter.$or = [
      { nombre: { $regex: query.search, $options: "i" } },
      { apellido: { $regex: query.search, $options: "i" } },
      { dni: { $regex: query.search, $options: "i" } },
    ];
  }

  if (query.status === "active") {
    filter.activo = true;
  }

  if (query.status === "inactive") {
    filter.activo = false;
  }

  if (query.obraSocialId) {
    filter.obraSocialId = new Types.ObjectId(query.obraSocialId);
  }

  if (!can(user, "pacientes", "write")) {
    filter.activo = true;
  }

  return filter;
}

export async function listPacientes(query: QueryParams, user: SessionUser) {
  await connectToDatabase();

  const filter = buildFilter(query, user);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    PacienteModel.find(filter)
      .populate("obraSocialId", "nombre")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    PacienteModel.countDocuments(filter),
  ]);

  return {
    data: items.map((item) =>
      toDto({
        ...item,
        obraSocial: item.obraSocialId as unknown as { nombre: string },
      }),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function createPaciente(input: {
  nombre: string;
  apellido: string;
  dni: string;
  obraSocialId?: string | null;
  activo?: boolean;
}) {
  await connectToDatabase();

  const dni = normalizeDni(input.dni);
  const duplicate = await PacienteModel.findOne({ dni }).lean();

  if (duplicate) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "Ya existe un paciente con ese DNI",
      409,
      { dni: "Ya existe un paciente con ese DNI" },
    );
  }

  let obraSocialId: string | null = null;

  if (input.obraSocialId) {
    const obraSocial = await ObraSocialModel.findById(input.obraSocialId).lean();

    if (!obraSocial) {
      throw new AppError("NOT_FOUND", "La obra social no existe", 404);
    }

    if (!obraSocial.activo) {
      throw new AppError(
        "INACTIVE_RELATED_RECORD",
        "La obra social debe estar activa",
        409,
      );
    }

    obraSocialId = input.obraSocialId;
  }

  const paciente = await PacienteModel.create({
    nombre: normalizePacienteName(input.nombre),
    apellido: normalizePacienteName(input.apellido),
    dni,
    obraSocialId,
    activo: input.activo ?? true,
  });

  await paciente.populate("obraSocialId", "nombre");

  return toDto({
    ...paciente.toObject(),
    obraSocial: paciente.obraSocialId as unknown as { nombre: string } | null,
  });
}

export async function updatePaciente(
  id: string,
  input: {
    nombre: string;
    apellido: string;
    dni: string;
  obraSocialId?: string | null;
  activo?: boolean;
  },
) {
  await connectToDatabase();

  const paciente = await PacienteModel.findById(id);

  if (!paciente) {
    throw new AppError("NOT_FOUND", "Paciente no encontrado", 404);
  }

  const dni = normalizeDni(input.dni);
  const duplicate = await PacienteModel.findOne({ dni, _id: { $ne: id } }).lean();

  if (duplicate) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "Ya existe un paciente con ese DNI",
      409,
      { dni: "Ya existe un paciente con ese DNI" },
    );
  }

  let obraSocialId: Types.ObjectId | null = null;

  if (input.obraSocialId) {
    const obraSocial = await ObraSocialModel.findById(input.obraSocialId).lean();

    if (!obraSocial) {
      throw new AppError("NOT_FOUND", "La obra social no existe", 404);
    }

    const keepsCurrentInactiveObraSocial =
      !obraSocial.activo &&
      paciente.obraSocialId &&
      String(paciente.obraSocialId) === input.obraSocialId;

    if (!obraSocial.activo && !keepsCurrentInactiveObraSocial) {
      throw new AppError(
        "INACTIVE_RELATED_RECORD",
        "La obra social debe estar activa",
        409,
      );
    }

    obraSocialId = new Types.ObjectId(input.obraSocialId);
  }

  paciente.nombre = normalizePacienteName(input.nombre);
  paciente.apellido = normalizePacienteName(input.apellido);
  paciente.dni = dni;
  paciente.obraSocialId = obraSocialId;
  if (input.activo !== undefined) {
    paciente.activo = input.activo;
  }
  await paciente.save();
  await paciente.populate("obraSocialId", "nombre");

  return toDto({
    ...paciente.toObject(),
    obraSocial: paciente.obraSocialId as unknown as { nombre: string } | null,
  });
}

export async function setPacienteStatus(id: string, activo: boolean) {
  await connectToDatabase();

  const paciente = await PacienteModel.findById(id);

  if (!paciente) {
    throw new AppError("NOT_FOUND", "Paciente no encontrado", 404);
  }

  paciente.activo = activo;
  await paciente.save();
  await paciente.populate("obraSocialId", "nombre");

  return toDto({
    ...paciente.toObject(),
    obraSocial: paciente.obraSocialId as unknown as { nombre: string } | null,
  });
}

function normalizeImportHeader(header: string) {
  return header
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function normalizeSheetRow(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeImportHeader(key), value]),
  );
}

function stringifyCellValue(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function parseActivoValue(value: unknown) {
  const normalized = stringifyCellValue(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (!normalized) throw new Error("El estado activo es obligatorio");
  if (["si", "sí", "s", "true", "1", "activo", "yes"].includes(normalized)) return true;
  if (["no", "n", "false", "0", "inactivo"].includes(normalized)) return false;
  throw new Error("El estado activo no es valido");
}

async function getPacientesForExport() {
  await connectToDatabase();
  const items = await PacienteModel.find({})
    .populate("obraSocialId", "nombre")
    .sort({ apellido: 1, nombre: 1, dni: 1 })
    .lean();

  return items.map((item): PacienteExportRow => ({
    id: String(item._id),
    nombre: item.nombre,
    apellido: item.apellido,
    dni: item.dni,
    obraSocialId: extractObraSocialId(item.obraSocialId) ?? "",
    obraSocial: (item.obraSocialId as unknown as { nombre?: string } | null)?.nombre ?? "",
    activo: item.activo ? "SI" : "NO",
  }));
}

export async function buildPacientesWorkbook() {
  const sheet = XLSX.utils.json_to_sheet(await getPacientesForExport());
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Pacientes");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function previewPacientesWorkbook(
  fileName: string,
  fileBuffer: ArrayBuffer,
): Promise<PacienteWorkbookPreview> {
  await connectToDatabase();
  const workbook = XLSX.read(Buffer.from(fileBuffer), { type: "buffer", raw: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new AppError("VALIDATION_ERROR", "El archivo no contiene hojas", 400);

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  const headerRow = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1, range: 0, blankrows: false, defval: "",
  })[0] ?? [];
  const normalizedHeaders = headerRow.map((header) => normalizeImportHeader(String(header)));
  const missingHeaders = ["nombre", "apellido", "dni", "obrasocialid", "activo"]
    .filter((header) => !normalizedHeaders.includes(header));
  if (missingHeaders.length) {
    throw new AppError("VALIDATION_ERROR", `Faltan columnas obligatorias: ${missingHeaders.join(", ")}`, 400);
  }

  const [existingPatients, obrasSociales] = await Promise.all([
    PacienteModel.find({}).select("_id dni obraSocialId").lean(),
    ObraSocialModel.find({}).select("_id nombre activo").lean(),
  ]);
  const existingById = new Map(existingPatients.map((item) => [String(item._id), item]));
  const existingByDni = new Map(existingPatients.map((item) => [item.dni, String(item._id)]));
  const obraSocialById = new Map(obrasSociales.map((item) => [String(item._id), item]));
  const seenIds = new Set<string>();
  const seenDnis = new Set<string>();

  const previewRows = rows.map((sourceRow, index) => {
    const row = normalizeSheetRow(sourceRow);
    const previewRow: PacienteWorkbookPreviewRow = {
      previewId: `row-${index + 1}`, rowNumber: index + 2,
      id: stringifyCellValue(row.id), nombre: stringifyCellValue(row.nombre),
      apellido: stringifyCellValue(row.apellido), dni: stringifyCellValue(row.dni),
      obraSocialId: stringifyCellValue(row.obrasocialid), obraSocial: stringifyCellValue(row.obrasocial),
      activo: stringifyCellValue(row.activo), operation: null, selected: false, valid: false, errors: [],
    };
    const dni = normalizeDni(previewRow.dni);
    if (!previewRow.nombre) previewRow.errors.push("El nombre es obligatorio");
    if (!previewRow.apellido) previewRow.errors.push("El apellido es obligatorio");
    if (!dni) previewRow.errors.push("El DNI es obligatorio");
    try { parseActivoValue(row.activo); } catch (error) {
      previewRow.errors.push(error instanceof Error ? error.message : "El estado activo no es valido");
    }

    let existing = undefined as (typeof existingPatients)[number] | undefined;
    if (previewRow.id) {
      if (!Types.ObjectId.isValid(previewRow.id)) previewRow.errors.push("El ID del paciente no es valido");
      else if (!(existing = existingById.get(previewRow.id))) previewRow.errors.push("El paciente indicado por ID no existe");
      else {
        previewRow.operation = "update";
        if (seenIds.has(previewRow.id)) previewRow.errors.push("El mismo ID aparece repetido en el archivo");
      }
    } else {
      previewRow.operation = "create";
    }

    if (previewRow.obraSocialId) {
      if (!Types.ObjectId.isValid(previewRow.obraSocialId)) {
        previewRow.errors.push("La obra social no tiene un ID valido");
      } else {
        const obraSocial = obraSocialById.get(previewRow.obraSocialId);
        const keepsCurrentInactive = Boolean(
          existing && !obraSocial?.activo && String(existing.obraSocialId) === previewRow.obraSocialId,
        );
        if (!obraSocial) previewRow.errors.push("La obra social no existe");
        else if (!obraSocial.activo && !keepsCurrentInactive) {
          previewRow.errors.push("La obra social debe estar activa");
        } else if (!previewRow.obraSocial) previewRow.obraSocial = obraSocial.nombre;
      }
    }

    if (dni) {
      const matchingId = existingByDni.get(dni);
      if (matchingId && matchingId !== previewRow.id) previewRow.errors.push("Ya existe un paciente con ese DNI");
      if (seenDnis.has(dni)) previewRow.errors.push("El DNI aparece repetido en el archivo");
      seenDnis.add(dni);
    }
    if (previewRow.id) seenIds.add(previewRow.id);
    previewRow.valid = previewRow.errors.length === 0 && previewRow.operation !== null;
    previewRow.selected = previewRow.valid;
    return previewRow;
  });

  return {
    fileName, rows: previewRows,
    summary: {
      totalRows: previewRows.length,
      validRows: previewRows.filter((row) => row.valid).length,
      invalidRows: previewRows.filter((row) => !row.valid).length,
      createRows: previewRows.filter((row) => row.valid && row.operation === "create").length,
      updateRows: previewRows.filter((row) => row.valid && row.operation === "update").length,
    },
  };
}

export async function importPacientesFromPreview(input: { rows: PacienteWorkbookPreviewRow[] }): Promise<PacienteImportApplyResult> {
  const selectedRows = input.rows.filter((row) => row.selected && row.valid && row.operation);
  if (!selectedRows.length) {
    throw new AppError("VALIDATION_ERROR", "Debes seleccionar al menos una fila valida para importar", 400);
  }
  let created = 0;
  let updated = 0;
  for (const row of selectedRows) {
    const payload: PacienteInput = {
      nombre: row.nombre, apellido: row.apellido, dni: row.dni,
      obraSocialId: row.obraSocialId || null, activo: parseActivoValue(row.activo),
    };
    if (row.operation === "update") {
      await updatePaciente(row.id, payload);
      updated += 1;
    } else {
      await createPaciente(payload);
      created += 1;
    }
  }
  return { created, updated, processed: selectedRows.length };
}
