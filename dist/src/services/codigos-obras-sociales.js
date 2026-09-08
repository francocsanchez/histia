"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCodigosObrasSociales = listCodigosObrasSociales;
exports.createCodigoObraSocial = createCodigoObraSocial;
exports.updateCodigoObraSocial = updateCodigoObraSocial;
exports.setCodigoObraSocialStatus = setCodigoObraSocialStatus;
exports.buildCodigosObrasSocialesWorkbook = buildCodigosObrasSocialesWorkbook;
exports.previewCodigosObrasSocialesWorkbook = previewCodigosObrasSocialesWorkbook;
exports.importCodigosObrasSocialesFromPreview = importCodigosObrasSocialesFromPreview;
const mongoose_1 = require("mongoose");
const XLSX = __importStar(require("xlsx"));
const api_1 = require("@/lib/api");
const mongoose_2 = require("@/lib/db/mongoose");
const permissions_1 = require("@/lib/permissions");
const utils_1 = require("@/lib/utils");
const codigo_obra_social_1 = require("@/models/codigo-obra-social");
const obra_social_1 = require("@/models/obra-social");
function extractDocumentId(value) {
    if (!value) {
        return "";
    }
    if (value instanceof mongoose_1.Types.ObjectId) {
        return value.toString();
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "object" && value !== null && "_id" in value) {
        const nestedId = value._id;
        if (nestedId instanceof mongoose_1.Types.ObjectId) {
            return nestedId.toString();
        }
        if (typeof nestedId === "string") {
            return nestedId;
        }
    }
    return String(value);
}
function toDto(document) {
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
function buildFilter(query, user) {
    const filter = {};
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
        filter.obraSocialId = new mongoose_1.Types.ObjectId(query.obraSocialId);
    }
    if (!(0, permissions_1.can)(user, "codigos-obras-sociales", "write")) {
        filter.activo = true;
    }
    return filter;
}
function normalizeImportHeader(header) {
    return header
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase();
}
function normalizeSheetRow(row) {
    const normalizedRow = {};
    for (const [key, value] of Object.entries(row)) {
        normalizedRow[normalizeImportHeader(String(key))] = value;
    }
    return normalizedRow;
}
function stringifyCellValue(value) {
    if (value == null) {
        return "";
    }
    if (typeof value === "string") {
        return value.trim();
    }
    return String(value).trim();
}
function parseActivoValue(value) {
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
function parseValorToCents(value) {
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new Error("El valor no es valido");
        }
        return Math.round(value * 100);
    }
    const parsed = (0, utils_1.parseMoneyInputToCents)(stringifyCellValue(value));
    if (parsed === null) {
        throw new Error("El valor no es valido");
    }
    return parsed;
}
function toExportRow(document) {
    return {
        id: String(document._id),
        codigo: document.codigo,
        nombre: document.nombre,
        obraSocialId: extractDocumentId(document.obraSocialId),
        obraSocial: document.obraSocial?.nombre ?? "",
        valor: (0, utils_1.formatMoneyInputFromCents)(document.valorCentavos),
        activo: document.activo ? "SI" : "NO",
    };
}
async function validateCodigoInput(input, options) {
    const obraSocial = await obra_social_1.ObraSocialModel.findById(input.obraSocialId).lean();
    if (!obraSocial) {
        throw new api_1.AppError("NOT_FOUND", "La obra social no existe", 404);
    }
    if (!obraSocial.activo) {
        throw new api_1.AppError("INACTIVE_RELATED_RECORD", "La obra social debe estar activa", 409);
    }
    const nombre = (0, utils_1.normalizeName)(input.nombre);
    const codigo = (0, utils_1.normalizeCode)(input.codigo);
    const codigoNormalizado = (0, utils_1.normalizeTextKey)(codigo);
    const duplicateQuery = codigo_obra_social_1.CodigoObraSocialModel.findOne()
        .where("obraSocialId")
        .equals(new mongoose_1.Types.ObjectId(input.obraSocialId))
        .where("codigoNormalizado")
        .equals(codigoNormalizado);
    if (options?.excludeId) {
        duplicateQuery.where("_id").ne(options.excludeId);
    }
    const duplicate = await duplicateQuery.lean();
    if (duplicate) {
        throw new api_1.AppError("DUPLICATE_RECORD", "Ese codigo ya existe para la obra social seleccionada", 409, { codigo: "Ese codigo ya existe para la obra social seleccionada" });
    }
    return {
        nombre,
        codigo,
        codigoNormalizado,
        obraSocialId: new mongoose_1.Types.ObjectId(input.obraSocialId),
        valorCentavos: input.valorCentavos,
        activo: input.activo ?? true,
    };
}
async function getCodigosForExport() {
    await (0, mongoose_2.connectToDatabase)();
    const items = await codigo_obra_social_1.CodigoObraSocialModel.find({})
        .populate("obraSocialId", "nombre")
        .sort({ obraSocialId: 1, codigo: 1, nombre: 1 })
        .lean();
    return items.map((item) => toExportRow({
        ...item,
        obraSocial: item.obraSocialId,
    }));
}
async function listCodigosObrasSociales(query, user) {
    await (0, mongoose_2.connectToDatabase)();
    const filter = buildFilter(query, user);
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
        codigo_obra_social_1.CodigoObraSocialModel.find(filter)
            .populate("obraSocialId", "nombre")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        codigo_obra_social_1.CodigoObraSocialModel.countDocuments(filter),
    ]);
    return {
        data: items.map((item) => toDto({
            ...item,
            obraSocial: item.obraSocialId,
        })),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
        },
    };
}
async function createCodigoObraSocial(input) {
    await (0, mongoose_2.connectToDatabase)();
    const normalized = await validateCodigoInput(input);
    const codigoObraSocial = new codigo_obra_social_1.CodigoObraSocialModel();
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
        obraSocial: codigoObraSocial.obraSocialId,
    });
}
async function updateCodigoObraSocial(id, input) {
    await (0, mongoose_2.connectToDatabase)();
    const codigoObraSocial = await codigo_obra_social_1.CodigoObraSocialModel.findById(id);
    if (!codigoObraSocial) {
        throw new api_1.AppError("NOT_FOUND", "Codigo no encontrado", 404);
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
        obraSocial: codigoObraSocial.obraSocialId,
    });
}
async function setCodigoObraSocialStatus(id, activo) {
    await (0, mongoose_2.connectToDatabase)();
    const codigo = await codigo_obra_social_1.CodigoObraSocialModel.findById(id);
    if (!codigo) {
        throw new api_1.AppError("NOT_FOUND", "Codigo no encontrado", 404);
    }
    codigo.activo = activo;
    await codigo.save();
    await codigo.populate("obraSocialId", "nombre");
    return toDto({
        ...codigo.toObject(),
        obraSocial: codigo.obraSocialId,
    });
}
async function buildCodigosObrasSocialesWorkbook() {
    const rows = await getCodigosForExport();
    const sheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Codigos");
    return XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
    });
}
async function previewCodigosObrasSocialesWorkbook(fileName, fileBuffer) {
    await (0, mongoose_2.connectToDatabase)();
    const workbook = XLSX.read(Buffer.from(fileBuffer), {
        type: "buffer",
        cellDates: true,
        raw: true,
    });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
        throw new api_1.AppError("VALIDATION_ERROR", "El archivo no contiene hojas", 400);
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: "",
        raw: true,
    });
    const headerRow = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        range: 0,
        blankrows: false,
        defval: "",
    })[0] ?? [];
    const normalizedHeaders = headerRow.map((header) => normalizeImportHeader(String(header)));
    const requiredHeaders = ["codigo", "nombre", "obrasocialid", "valor", "activo"];
    const missingHeaders = requiredHeaders.filter((header) => !normalizedHeaders.includes(header));
    if (missingHeaders.length > 0) {
        throw new api_1.AppError("VALIDATION_ERROR", `Faltan columnas obligatorias: ${missingHeaders.join(", ")}`, 400);
    }
    const existingCodes = await codigo_obra_social_1.CodigoObraSocialModel.find({})
        .select("_id obraSocialId codigo codigoNormalizado")
        .lean();
    const activeObrasSociales = await obra_social_1.ObraSocialModel.find({ activo: true })
        .select("_id nombre")
        .lean();
    const existingById = new Map(existingCodes.map((item) => [
        String(item._id),
        {
            id: String(item._id),
            obraSocialId: String(item.obraSocialId),
            codigoNormalizado: item.codigoNormalizado,
        },
    ]));
    const existingByCompositeKey = new Map(existingCodes.map((item) => [
        `${String(item.obraSocialId)}::${item.codigoNormalizado}`,
        String(item._id),
    ]));
    const obraSocialById = new Map(activeObrasSociales.map((item) => [String(item._id), item.nombre]));
    const seenIds = new Set();
    const seenCompositeKeys = new Set();
    const previewRows = rows.map((sourceRow, index) => {
        const row = normalizeSheetRow(sourceRow);
        const previewRow = {
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
        }
        else if (!mongoose_1.Types.ObjectId.isValid(previewRow.obraSocialId)) {
            previewRow.errors.push("La obra social no tiene un ID valido");
        }
        else if (!obraSocialById.has(previewRow.obraSocialId)) {
            previewRow.errors.push("La obra social no existe o esta inactiva");
        }
        else if (!previewRow.obraSocial) {
            previewRow.obraSocial = obraSocialById.get(previewRow.obraSocialId) ?? "";
        }
        try {
            parseValorToCents(row.valor);
        }
        catch (error) {
            previewRow.errors.push(error instanceof Error ? error.message : "El valor no es valido");
        }
        try {
            parseActivoValue(row.activo);
        }
        catch (error) {
            previewRow.errors.push(error instanceof Error ? error.message : "El estado activo no es valido");
        }
        const codigoNormalizado = (0, utils_1.normalizeTextKey)((0, utils_1.normalizeCode)(previewRow.codigo));
        const compositeKey = previewRow.obraSocialId
            ? `${previewRow.obraSocialId}::${codigoNormalizado}`
            : null;
        if (previewRow.id) {
            if (!mongoose_1.Types.ObjectId.isValid(previewRow.id)) {
                previewRow.errors.push("El ID del codigo no es valido");
            }
            else if (!existingById.has(previewRow.id)) {
                previewRow.errors.push("El codigo indicado por ID no existe");
            }
            else {
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
        }
        else {
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
async function importCodigosObrasSocialesFromPreview(input) {
    await (0, mongoose_2.connectToDatabase)();
    const selectedRows = input.rows.filter((row) => row.selected && row.valid && row.operation);
    if (selectedRows.length === 0) {
        throw new api_1.AppError("VALIDATION_ERROR", "Debes seleccionar al menos una fila valida para importar", 400);
    }
    let created = 0;
    let updated = 0;
    for (const row of selectedRows) {
        const valorCentavos = parseValorToCents(row.valor);
        const activo = parseActivoValue(row.activo);
        const payload = {
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
