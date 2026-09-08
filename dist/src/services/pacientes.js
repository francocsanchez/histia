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
exports.normalizePacienteName = normalizePacienteName;
exports.listPacientes = listPacientes;
exports.createPaciente = createPaciente;
exports.updatePaciente = updatePaciente;
exports.setPacienteStatus = setPacienteStatus;
exports.buildPacientesWorkbook = buildPacientesWorkbook;
exports.previewPacientesWorkbook = previewPacientesWorkbook;
exports.importPacientesFromPreview = importPacientesFromPreview;
const mongoose_1 = require("mongoose");
const XLSX = __importStar(require("xlsx"));
const api_1 = require("@/lib/api");
const mongoose_2 = require("@/lib/db/mongoose");
const permissions_1 = require("@/lib/permissions");
const utils_1 = require("@/lib/utils");
const obra_social_1 = require("@/models/obra-social");
const paciente_1 = require("@/models/paciente");
function normalizePacienteName(value) {
    return (0, utils_1.normalizeName)(value).toLocaleLowerCase("es-AR");
}
function extractObraSocialId(value) {
    if (!value) {
        return null;
    }
    if (value instanceof mongoose_1.Types.ObjectId) {
        return value.toString();
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "object" && "_id" in value) {
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
        apellido: document.apellido,
        dni: document.dni,
        obraSocialId: extractObraSocialId(document.obraSocialId),
        obraSocialNombre: document.obraSocial?.nombre ?? null,
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
        filter.obraSocialId = new mongoose_1.Types.ObjectId(query.obraSocialId);
    }
    if (!(0, permissions_1.can)(user, "pacientes", "write")) {
        filter.activo = true;
    }
    return filter;
}
async function listPacientes(query, user) {
    await (0, mongoose_2.connectToDatabase)();
    const filter = buildFilter(query, user);
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await Promise.all([
        paciente_1.PacienteModel.find(filter)
            .populate("obraSocialId", "nombre")
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(query.limit)
            .lean(),
        paciente_1.PacienteModel.countDocuments(filter),
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
async function createPaciente(input) {
    await (0, mongoose_2.connectToDatabase)();
    const dni = (0, utils_1.normalizeDni)(input.dni);
    const duplicate = await paciente_1.PacienteModel.findOne({ dni }).lean();
    if (duplicate) {
        throw new api_1.AppError("DUPLICATE_RECORD", "Ya existe un paciente con ese DNI", 409, { dni: "Ya existe un paciente con ese DNI" });
    }
    let obraSocialId = null;
    if (input.obraSocialId) {
        const obraSocial = await obra_social_1.ObraSocialModel.findById(input.obraSocialId).lean();
        if (!obraSocial) {
            throw new api_1.AppError("NOT_FOUND", "La obra social no existe", 404);
        }
        if (!obraSocial.activo) {
            throw new api_1.AppError("INACTIVE_RELATED_RECORD", "La obra social debe estar activa", 409);
        }
        obraSocialId = input.obraSocialId;
    }
    const paciente = await paciente_1.PacienteModel.create({
        nombre: normalizePacienteName(input.nombre),
        apellido: normalizePacienteName(input.apellido),
        dni,
        obraSocialId,
        activo: input.activo ?? true,
    });
    await paciente.populate("obraSocialId", "nombre");
    return toDto({
        ...paciente.toObject(),
        obraSocial: paciente.obraSocialId,
    });
}
async function updatePaciente(id, input) {
    await (0, mongoose_2.connectToDatabase)();
    const paciente = await paciente_1.PacienteModel.findById(id);
    if (!paciente) {
        throw new api_1.AppError("NOT_FOUND", "Paciente no encontrado", 404);
    }
    const dni = (0, utils_1.normalizeDni)(input.dni);
    const duplicate = await paciente_1.PacienteModel.findOne({ dni, _id: { $ne: id } }).lean();
    if (duplicate) {
        throw new api_1.AppError("DUPLICATE_RECORD", "Ya existe un paciente con ese DNI", 409, { dni: "Ya existe un paciente con ese DNI" });
    }
    let obraSocialId = null;
    if (input.obraSocialId) {
        const obraSocial = await obra_social_1.ObraSocialModel.findById(input.obraSocialId).lean();
        if (!obraSocial) {
            throw new api_1.AppError("NOT_FOUND", "La obra social no existe", 404);
        }
        const keepsCurrentInactiveObraSocial = !obraSocial.activo &&
            paciente.obraSocialId &&
            String(paciente.obraSocialId) === input.obraSocialId;
        if (!obraSocial.activo && !keepsCurrentInactiveObraSocial) {
            throw new api_1.AppError("INACTIVE_RELATED_RECORD", "La obra social debe estar activa", 409);
        }
        obraSocialId = new mongoose_1.Types.ObjectId(input.obraSocialId);
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
        obraSocial: paciente.obraSocialId,
    });
}
async function setPacienteStatus(id, activo) {
    await (0, mongoose_2.connectToDatabase)();
    const paciente = await paciente_1.PacienteModel.findById(id);
    if (!paciente) {
        throw new api_1.AppError("NOT_FOUND", "Paciente no encontrado", 404);
    }
    paciente.activo = activo;
    await paciente.save();
    await paciente.populate("obraSocialId", "nombre");
    return toDto({
        ...paciente.toObject(),
        obraSocial: paciente.obraSocialId,
    });
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
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeImportHeader(key), value]));
}
function stringifyCellValue(value) {
    return value == null ? "" : String(value).trim();
}
function parseActivoValue(value) {
    const normalized = stringifyCellValue(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    if (!normalized)
        throw new Error("El estado activo es obligatorio");
    if (["si", "sí", "s", "true", "1", "activo", "yes"].includes(normalized))
        return true;
    if (["no", "n", "false", "0", "inactivo"].includes(normalized))
        return false;
    throw new Error("El estado activo no es valido");
}
async function getPacientesForExport() {
    await (0, mongoose_2.connectToDatabase)();
    const items = await paciente_1.PacienteModel.find({})
        .populate("obraSocialId", "nombre")
        .sort({ apellido: 1, nombre: 1, dni: 1 })
        .lean();
    return items.map((item) => ({
        id: String(item._id),
        nombre: item.nombre,
        apellido: item.apellido,
        dni: item.dni,
        obraSocialId: extractObraSocialId(item.obraSocialId) ?? "",
        obraSocial: item.obraSocialId?.nombre ?? "",
        activo: item.activo ? "SI" : "NO",
    }));
}
async function buildPacientesWorkbook() {
    const sheet = XLSX.utils.json_to_sheet(await getPacientesForExport());
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Pacientes");
    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
async function previewPacientesWorkbook(fileName, fileBuffer) {
    await (0, mongoose_2.connectToDatabase)();
    const workbook = XLSX.read(Buffer.from(fileBuffer), { type: "buffer", raw: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName)
        throw new api_1.AppError("VALIDATION_ERROR", "El archivo no contiene hojas", 400);
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
    const headerRow = XLSX.utils.sheet_to_json(sheet, {
        header: 1, range: 0, blankrows: false, defval: "",
    })[0] ?? [];
    const normalizedHeaders = headerRow.map((header) => normalizeImportHeader(String(header)));
    const missingHeaders = ["nombre", "apellido", "dni", "obrasocialid", "activo"]
        .filter((header) => !normalizedHeaders.includes(header));
    if (missingHeaders.length) {
        throw new api_1.AppError("VALIDATION_ERROR", `Faltan columnas obligatorias: ${missingHeaders.join(", ")}`, 400);
    }
    const [existingPatients, obrasSociales] = await Promise.all([
        paciente_1.PacienteModel.find({}).select("_id dni obraSocialId").lean(),
        obra_social_1.ObraSocialModel.find({}).select("_id nombre activo").lean(),
    ]);
    const existingById = new Map(existingPatients.map((item) => [String(item._id), item]));
    const existingByDni = new Map(existingPatients.map((item) => [item.dni, String(item._id)]));
    const obraSocialById = new Map(obrasSociales.map((item) => [String(item._id), item]));
    const seenIds = new Set();
    const seenDnis = new Set();
    const previewRows = rows.map((sourceRow, index) => {
        const row = normalizeSheetRow(sourceRow);
        const previewRow = {
            previewId: `row-${index + 1}`, rowNumber: index + 2,
            id: stringifyCellValue(row.id), nombre: stringifyCellValue(row.nombre),
            apellido: stringifyCellValue(row.apellido), dni: stringifyCellValue(row.dni),
            obraSocialId: stringifyCellValue(row.obrasocialid), obraSocial: stringifyCellValue(row.obrasocial),
            activo: stringifyCellValue(row.activo), operation: null, selected: false, valid: false, errors: [],
        };
        const dni = (0, utils_1.normalizeDni)(previewRow.dni);
        if (!previewRow.nombre)
            previewRow.errors.push("El nombre es obligatorio");
        if (!previewRow.apellido)
            previewRow.errors.push("El apellido es obligatorio");
        if (!dni)
            previewRow.errors.push("El DNI es obligatorio");
        try {
            parseActivoValue(row.activo);
        }
        catch (error) {
            previewRow.errors.push(error instanceof Error ? error.message : "El estado activo no es valido");
        }
        let existing = undefined;
        if (previewRow.id) {
            if (!mongoose_1.Types.ObjectId.isValid(previewRow.id))
                previewRow.errors.push("El ID del paciente no es valido");
            else if (!(existing = existingById.get(previewRow.id)))
                previewRow.errors.push("El paciente indicado por ID no existe");
            else {
                previewRow.operation = "update";
                if (seenIds.has(previewRow.id))
                    previewRow.errors.push("El mismo ID aparece repetido en el archivo");
            }
        }
        else {
            previewRow.operation = "create";
        }
        if (previewRow.obraSocialId) {
            if (!mongoose_1.Types.ObjectId.isValid(previewRow.obraSocialId)) {
                previewRow.errors.push("La obra social no tiene un ID valido");
            }
            else {
                const obraSocial = obraSocialById.get(previewRow.obraSocialId);
                const keepsCurrentInactive = Boolean(existing && !obraSocial?.activo && String(existing.obraSocialId) === previewRow.obraSocialId);
                if (!obraSocial)
                    previewRow.errors.push("La obra social no existe");
                else if (!obraSocial.activo && !keepsCurrentInactive) {
                    previewRow.errors.push("La obra social debe estar activa");
                }
                else if (!previewRow.obraSocial)
                    previewRow.obraSocial = obraSocial.nombre;
            }
        }
        if (dni) {
            const matchingId = existingByDni.get(dni);
            if (matchingId && matchingId !== previewRow.id)
                previewRow.errors.push("Ya existe un paciente con ese DNI");
            if (seenDnis.has(dni))
                previewRow.errors.push("El DNI aparece repetido en el archivo");
            seenDnis.add(dni);
        }
        if (previewRow.id)
            seenIds.add(previewRow.id);
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
async function importPacientesFromPreview(input) {
    const selectedRows = input.rows.filter((row) => row.selected && row.valid && row.operation);
    if (!selectedRows.length) {
        throw new api_1.AppError("VALIDATION_ERROR", "Debes seleccionar al menos una fila valida para importar", 400);
    }
    let created = 0;
    let updated = 0;
    for (const row of selectedRows) {
        const payload = {
            nombre: row.nombre, apellido: row.apellido, dni: row.dni,
            obraSocialId: row.obraSocialId || null, activo: parseActivoValue(row.activo),
        };
        if (row.operation === "update") {
            await updatePaciente(row.id, payload);
            updated += 1;
        }
        else {
            await createPaciente(payload);
            created += 1;
        }
    }
    return { created, updated, processed: selectedRows.length };
}
