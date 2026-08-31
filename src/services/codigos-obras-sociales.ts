import { Types } from "mongoose";
import * as XLSX from "xlsx";

import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { can } from "@/lib/permissions";
import {
  formatMoneyInputFromCents,
  normalizeCode,
  normalizeName,
  normalizeTextKey,
  parseMoneyInputToCents,
} from "@/lib/utils";
import { CodigoObraSocialModel } from "@/models/codigo-obra-social";
import { ObraSocialModel } from "@/models/obra-social";
import { CodigoObraSocialDto, QueryParams, SessionUser } from "@/types/domain";

type CodigoInput = {
  nombre: string;
  codigo: string;
  obraSocialId: string;
  valorCentavos: number;
  activo?: boolean;
};

type CodigoExportRow = {
  id: string;
  codigo: string;
  nombre: string;
  obraSocialId: string;
  obraSocial: string;
  valor: string;
  activo: "SI" | "NO";
};

export type CodigoWorkbookPreviewRow = {
  previewId: string;
  rowNumber: number;
  id: string;
  codigo: string;
  nombre: string;
  obraSocialId: string;
  obraSocial: string;
  valor: string;
  activo: string;
  operation: "create" | "update" | null;
  selected: boolean;
  valid: boolean;
  errors: string[];
};

type CodigoWorkbookPreview = {
  fileName: string;
  rows: CodigoWorkbookPreviewRow[];
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    createRows: number;
    updateRows: number;
  };
};

type CodigoImportApplyResult = {
  created: number;
  updated: number;
  processed: number;
};

type CodigoDocumentShape = {
  _id: unknown;
  nombre: string;
  codigo: string;
  codigoNormalizado: string;
  obraSocialId: unknown;
  valorCentavos: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
  obraSocial?: { nombre: string } | null;
};

function extractDocumentId(value: unknown) {
  if (!value) {
    return "";
  }

  if (value instanceof Types.ObjectId) {
    return value.toString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null && "_id" in value) {
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
  codigo: string;
  obraSocialId: unknown;
  valorCentavos: number;
  activo: boolean;
  createdAt: Date;
  updatedAt: Date;
  obraSocial?: { nombre: string } | null;
}): CodigoObraSocialDto {
  return {
    id: String(document._id),
    nombre: document.nombre,
    codigo: document.codigo,
    obraSocialId: extractDocumentId(document.obraSocialId),
    obraSocialNombre: document.obraSocial?.nombre ?? "",
    valorCentavos: document.valorCentavos,
    activo: document.activo,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  };
}

function buildFilter(query: QueryParams, user: SessionUser): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (query.search) {
    filter.$or = [
      { nombre: { $regex: query.search, $options: "i" } },
      { codigo: { $regex: query.search, $options: "i" } },
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

  if (!can(user, "codigos-obras-sociales", "write")) {
    filter.activo = true;
  }

  return filter;
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
  const normalizedRow: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    normalizedRow[normalizeImportHeader(String(key))] = value;
  }

  return normalizedRow;
}

function stringifyCellValue(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return String(value).trim();
}

function parseActivoValue(value: unknown) {
  const normalized = stringifyCellValue(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (!normalized) {
    throw new Error("El estado activo es obligatorio");
  }

  if (["si", "sí", "s", "true", "1", "activo", "yes"].includes(normalized)) {
    return true;
  }

  if (["no", "n", "false", "0", "inactivo"].includes(normalized)) {
    return false;
  }

  throw new Error("El estado activo no es valido");
}

function parseValorToCents(value: unknown) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("El valor no es valido");
    }

    return Math.round(value * 100);
  }

  const parsed = parseMoneyInputToCents(stringifyCellValue(value));

  if (parsed === null) {
    throw new Error("El valor no es valido");
  }

  return parsed;
}

function toExportRow(document: CodigoDocumentShape): CodigoExportRow {
  return {
    id: String(document._id),
    codigo: document.codigo,
    nombre: document.nombre,
    obraSocialId: extractDocumentId(document.obraSocialId),
    obraSocial: document.obraSocial?.nombre ?? "",
    valor: formatMoneyInputFromCents(document.valorCentavos),
    activo: document.activo ? "SI" : "NO",
  };
}

async function validateCodigoInput(
  input: CodigoInput,
  options?: {
    excludeId?: string;
  },
) {
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

  const nombre = normalizeName(input.nombre);
  const codigo = normalizeCode(input.codigo);
  const codigoNormalizado = normalizeTextKey(codigo);

  const duplicateQuery = CodigoObraSocialModel.findOne()
    .where("obraSocialId")
    .equals(new Types.ObjectId(input.obraSocialId))
    .where("codigoNormalizado")
    .equals(codigoNormalizado);

  if (options?.excludeId) {
    duplicateQuery.where("_id").ne(options.excludeId);
  }

  const duplicate = await duplicateQuery.lean();

  if (duplicate) {
    throw new AppError(
      "DUPLICATE_RECORD",
      "Ese codigo ya existe para la obra social seleccionada",
      409,
      { codigo: "Ese codigo ya existe para la obra social seleccionada" },
    );
  }

  return {
    nombre,
    codigo,
    codigoNormalizado,
    obraSocialId: new Types.ObjectId(input.obraSocialId),
    valorCentavos: input.valorCentavos,
    activo: input.activo ?? true,
  };
}

async function getCodigosForExport() {
  await connectToDatabase();

  const items = await CodigoObraSocialModel.find({})
    .populate("obraSocialId", "nombre")
    .sort({ obraSocialId: 1, codigo: 1, nombre: 1 })
    .lean();

  return items.map((item) =>
    toExportRow({
      ...item,
      obraSocial: item.obraSocialId as unknown as { nombre: string },
    }),
  );
}

export async function listCodigosObrasSociales(query: QueryParams, user: SessionUser) {
  await connectToDatabase();

  const filter = buildFilter(query, user);
  const skip = (query.page - 1) * query.limit;

  const [items, total] = await Promise.all([
    CodigoObraSocialModel.find(filter)
      .populate("obraSocialId", "nombre")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    CodigoObraSocialModel.countDocuments(filter),
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

export async function createCodigoObraSocial(input: CodigoInput) {
  await connectToDatabase();

  const normalized = await validateCodigoInput(input);

  const codigoObraSocial = new CodigoObraSocialModel();
  codigoObraSocial.nombre = normalized.nombre;
  codigoObraSocial.codigo = normalized.codigo;
  codigoObraSocial.codigoNormalizado = normalized.codigoNormalizado;
  codigoObraSocial.obraSocialId = normalized.obraSocialId;
  codigoObraSocial.valorCentavos = normalized.valorCentavos;
  codigoObraSocial.activo = normalized.activo;
  await codigoObraSocial.save();

  await codigoObraSocial.populate("obraSocialId", "nombre");

  return toDto({
    ...codigoObraSocial.toObject(),
    obraSocial: codigoObraSocial.obraSocialId as unknown as { nombre: string },
  });
}

export async function updateCodigoObraSocial(id: string, input: CodigoInput) {
  await connectToDatabase();

  const codigoObraSocial = await CodigoObraSocialModel.findById(id);

  if (!codigoObraSocial) {
    throw new AppError("NOT_FOUND", "Codigo no encontrado", 404);
  }

  const normalized = await validateCodigoInput(input, { excludeId: id });

  codigoObraSocial.nombre = normalized.nombre;
  codigoObraSocial.codigo = normalized.codigo;
  codigoObraSocial.codigoNormalizado = normalized.codigoNormalizado;
  codigoObraSocial.obraSocialId = normalized.obraSocialId;
  codigoObraSocial.valorCentavos = normalized.valorCentavos;
  codigoObraSocial.activo = normalized.activo;
  await codigoObraSocial.save();
  await codigoObraSocial.populate("obraSocialId", "nombre");

  return toDto({
    ...codigoObraSocial.toObject(),
    obraSocial: codigoObraSocial.obraSocialId as unknown as { nombre: string },
  });
}

export async function setCodigoObraSocialStatus(id: string, activo: boolean) {
  await connectToDatabase();

  const codigo = await CodigoObraSocialModel.findById(id);

  if (!codigo) {
    throw new AppError("NOT_FOUND", "Codigo no encontrado", 404);
  }

  codigo.activo = activo;
  await codigo.save();
  await codigo.populate("obraSocialId", "nombre");

  return toDto({
    ...codigo.toObject(),
    obraSocial: codigo.obraSocialId as unknown as { nombre: string },
  });
}

export async function buildCodigosObrasSocialesWorkbook() {
  const rows = await getCodigosForExport();
  const sheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, sheet, "Codigos");

  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;
}

export async function previewCodigosObrasSocialesWorkbook(
  fileName: string,
  fileBuffer: ArrayBuffer,
): Promise<CodigoWorkbookPreview> {
  await connectToDatabase();

  const workbook = XLSX.read(Buffer.from(fileBuffer), {
    type: "buffer",
    cellDates: true,
    raw: true,
  });
  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new AppError("VALIDATION_ERROR", "El archivo no contiene hojas", 400);
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: true,
  });
  const headerRow = XLSX.utils.sheet_to_json<string[]>(sheet, {
    header: 1,
    range: 0,
    blankrows: false,
    defval: "",
  })[0] ?? [];

  const normalizedHeaders = headerRow.map((header) => normalizeImportHeader(String(header)));
  const requiredHeaders = ["codigo", "nombre", "obrasocialid", "valor", "activo"];
  const missingHeaders = requiredHeaders.filter((header) => !normalizedHeaders.includes(header));

  if (missingHeaders.length > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Faltan columnas obligatorias: ${missingHeaders.join(", ")}`,
      400,
    );
  }

  const existingCodes = await CodigoObraSocialModel.find({})
    .select("_id obraSocialId codigo codigoNormalizado")
    .lean();
  const activeObrasSociales = await ObraSocialModel.find({ activo: true })
    .select("_id nombre")
    .lean();

  const existingById = new Map(
    existingCodes.map((item) => [
      String(item._id),
      {
        id: String(item._id),
        obraSocialId: String(item.obraSocialId),
        codigoNormalizado: item.codigoNormalizado,
      },
    ]),
  );
  const existingByCompositeKey = new Map(
    existingCodes.map((item) => [
      `${String(item.obraSocialId)}::${item.codigoNormalizado}`,
      String(item._id),
    ]),
  );
  const obraSocialById = new Map(
    activeObrasSociales.map((item) => [String(item._id), item.nombre]),
  );

  const seenIds = new Set<string>();
  const seenCompositeKeys = new Set<string>();

  const previewRows = rows.map((sourceRow, index) => {
    const row = normalizeSheetRow(sourceRow);
    const previewRow: CodigoWorkbookPreviewRow = {
      previewId: `row-${index + 1}`,
      rowNumber: index + 2,
      id: stringifyCellValue(row.id),
      codigo: stringifyCellValue(row.codigo),
      nombre: stringifyCellValue(row.nombre),
      obraSocialId: stringifyCellValue(row.obrasocialid),
      obraSocial: stringifyCellValue(row.obrasocial),
      valor: stringifyCellValue(row.valor),
      activo: stringifyCellValue(row.activo),
      operation: null,
      selected: false,
      valid: false,
      errors: [],
    };

    if (!previewRow.codigo) {
      previewRow.errors.push("El codigo es obligatorio");
    }

    if (!previewRow.nombre) {
      previewRow.errors.push("El nombre es obligatorio");
    }

    if (!previewRow.obraSocialId) {
      previewRow.errors.push("La obra social es obligatoria");
    } else if (!Types.ObjectId.isValid(previewRow.obraSocialId)) {
      previewRow.errors.push("La obra social no tiene un ID valido");
    } else if (!obraSocialById.has(previewRow.obraSocialId)) {
      previewRow.errors.push("La obra social no existe o esta inactiva");
    } else if (!previewRow.obraSocial) {
      previewRow.obraSocial = obraSocialById.get(previewRow.obraSocialId) ?? "";
    }

    try {
      parseValorToCents(row.valor);
    } catch (error) {
      previewRow.errors.push(error instanceof Error ? error.message : "El valor no es valido");
    }

    try {
      parseActivoValue(row.activo);
    } catch (error) {
      previewRow.errors.push(
        error instanceof Error ? error.message : "El estado activo no es valido",
      );
    }

    const codigoNormalizado = normalizeTextKey(normalizeCode(previewRow.codigo));
    const compositeKey = previewRow.obraSocialId
      ? `${previewRow.obraSocialId}::${codigoNormalizado}`
      : null;

    if (previewRow.id) {
      if (!Types.ObjectId.isValid(previewRow.id)) {
        previewRow.errors.push("El ID del codigo no es valido");
      } else if (!existingById.has(previewRow.id)) {
        previewRow.errors.push("El codigo indicado por ID no existe");
      } else {
        previewRow.operation = "update";

        if (seenIds.has(previewRow.id)) {
          previewRow.errors.push("El mismo ID aparece repetido en el archivo");
        }
      }

      if (previewRow.operation === "update" && compositeKey) {
        const matchedId = existingByCompositeKey.get(compositeKey);

        if (matchedId && matchedId !== previewRow.id) {
          previewRow.errors.push("Ya existe otro codigo con esa obra social y codigo");
        }
      }
    } else {
      previewRow.operation = "create";

      if (compositeKey && existingByCompositeKey.has(compositeKey)) {
        previewRow.errors.push("Ese codigo ya existe para la obra social indicada");
      }
    }

    if (compositeKey) {
      if (seenCompositeKeys.has(compositeKey)) {
        previewRow.errors.push("La combinacion obra social + codigo esta repetida en el archivo");
      }
    }

    previewRow.valid = previewRow.errors.length === 0 && previewRow.operation !== null;
    previewRow.selected = previewRow.valid;

    if (previewRow.id) {
      seenIds.add(previewRow.id);
    }

    if (compositeKey) {
      seenCompositeKeys.add(compositeKey);
    }

    return previewRow;
  });

  return {
    fileName,
    rows: previewRows,
    summary: {
      totalRows: previewRows.length,
      validRows: previewRows.filter((row) => row.valid).length,
      invalidRows: previewRows.filter((row) => !row.valid).length,
      createRows: previewRows.filter((row) => row.operation === "create" && row.valid).length,
      updateRows: previewRows.filter((row) => row.operation === "update" && row.valid).length,
    },
  };
}

export async function importCodigosObrasSocialesFromPreview(input: {
  rows: CodigoWorkbookPreviewRow[];
}): Promise<CodigoImportApplyResult> {
  await connectToDatabase();

  const selectedRows = input.rows.filter((row) => row.selected && row.valid && row.operation);

  if (selectedRows.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Debes seleccionar al menos una fila valida para importar",
      400,
    );
  }

  let created = 0;
  let updated = 0;

  for (const row of selectedRows) {
    const valorCentavos = parseValorToCents(row.valor);
    const activo = parseActivoValue(row.activo);
    const payload: CodigoInput = {
      codigo: row.codigo,
      nombre: row.nombre,
      obraSocialId: row.obraSocialId,
      valorCentavos,
      activo,
    };

    if (row.operation === "update") {
      await updateCodigoObraSocial(row.id, payload);
      updated += 1;
      continue;
    }

    await createCodigoObraSocial(payload);
    created += 1;
  }

  return {
    created,
    updated,
    processed: selectedRows.length,
  };
}
