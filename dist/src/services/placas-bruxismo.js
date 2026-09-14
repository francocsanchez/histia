"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateBruxismPlateHonorarium = calculateBruxismPlateHonorarium;
exports.listBruxismPlates = listBruxismPlates;
exports.getBruxismPlate = getBruxismPlate;
exports.createBruxismPlate = createBruxismPlate;
exports.addBruxismPlatePayment = addBruxismPlatePayment;
exports.receiveBruxismPlate = receiveBruxismPlate;
exports.deliverBruxismPlate = deliverBruxismPlate;
exports.getBruxismLookups = getBruxismLookups;
exports.pendingDeliveryCount = pendingDeliveryCount;
/* eslint-disable @typescript-eslint/no-explicit-any */
const mongoose_1 = require("mongoose");
const api_1 = require("@/lib/api");
const mongoose_2 = require("@/lib/db/mongoose");
const utils_1 = require("@/lib/utils");
const bruxism_plate_1 = require("@/models/bruxism-plate");
const paciente_1 = require("@/models/paciente");
const obra_social_1 = require("@/models/obra-social");
const pacientes_1 = require("@/services/pacientes");
function isAdmin(user) { return user.roles.includes("administrador"); }
function id(value) {
    if (value && typeof value === "object" && "_id" in value) {
        return String(value._id);
    }
    return String(value);
}
function calculateBruxismPlateHonorarium(input) {
    const baseCentavos = input.patientPaymentsCentavos + input.coverageCentavos - input.laboratoryCostCentavos;
    return { baseCentavos, dentistAmountCentavos: baseCentavos > 0 && input.percentageToDentist > 0 ? Math.round(baseCentavos * (input.percentageToDentist / 100)) : 0 };
}
async function resolvePatient(input) {
    if (input.pacienteId) {
        const patient = await paciente_1.PacienteModel.findById(input.pacienteId).lean();
        if (!patient)
            throw new api_1.AppError("NOT_FOUND", "El paciente no existe", 404);
        if (!patient.activo)
            throw new api_1.AppError("INACTIVE_RELATED_RECORD", "El paciente debe estar activo", 409);
        return patient;
    }
    if (!input.paciente)
        throw new api_1.AppError("VALIDATION_ERROR", "Debes seleccionar un paciente", 400);
    const existing = await paciente_1.PacienteModel.findOne({ dni: (0, utils_1.normalizeDni)(input.paciente.dni) }).lean();
    if (existing) {
        if (!existing.activo)
            throw new api_1.AppError("INACTIVE_RELATED_RECORD", "El paciente debe estar activo", 409);
        return existing;
    }
    const created = await (0, pacientes_1.createPaciente)(input.paciente);
    const patient = await paciente_1.PacienteModel.findById(created.id).lean();
    if (!patient)
        throw new api_1.AppError("INTERNAL_ERROR", "No se pudo crear el paciente", 500);
    return patient;
}
function ensureOwner(plate, user) {
    if (!isAdmin(user) && id(plate.odontologoId) !== user.id)
        throw new api_1.AppError("FORBIDDEN", "No tenes permisos para esta placa", 403);
}
function toDto(plate) {
    const patient = plate.pacienteId;
    const dentist = plate.odontologoId;
    const payments = [...plate.payments].sort((a, b) => a.fecha.getTime() - b.fecha.getTime()).map((item) => ({ id: id(item._id), fecha: item.fecha.toISOString(), montoCentavos: item.montoCentavos, createdAt: item.createdAt.toISOString() }));
    return {
        id: id(plate._id), fecha: plate.fecha.toISOString(), pacienteId: id(patient._id), pacienteNombreCompleto: `${patient.apellido}, ${patient.nombre}`,
        pacienteDni: patient.dni, odontologoId: id(dentist._id), odontologoNombre: (0, utils_1.normalizeWhitespace)(`${dentist.apellido ?? ""}, ${dentist.name}`),
        estado: plate.estado, payments, totalPagosPacienteCentavos: payments.reduce((sum, item) => sum + item.montoCentavos, 0),
        laboratorioRecibidoAt: plate.laboratorioRecibidoAt?.toISOString() ?? null, costoLaboratorioCentavos: plate.costoLaboratorioCentavos,
        entregadaAt: plate.entregadaAt?.toISOString() ?? null, liquidadaAt: plate.liquidadaAt?.toISOString() ?? null,
        paymentId: plate.paymentId ? id(plate.paymentId) : null, createdAt: plate.createdAt.toISOString(), updatedAt: plate.updatedAt.toISOString(),
    };
}
async function getPlate(idValue) {
    const plate = await bruxism_plate_1.BruxismPlateModel.findById(idValue).populate("pacienteId", "nombre apellido dni").populate("odontologoId", "name apellido").lean();
    if (!plate)
        throw new api_1.AppError("NOT_FOUND", "Placa no encontrada", 404);
    return plate;
}
async function listBruxismPlates(user) {
    await (0, mongoose_2.connectToDatabase)();
    const match = isAdmin(user) ? {} : { odontologoId: new mongoose_1.Types.ObjectId(user.id) };
    const rows = await bruxism_plate_1.BruxismPlateModel.find(match).populate("pacienteId", "nombre apellido dni").populate("odontologoId", "name apellido").sort({ fecha: -1, createdAt: -1 }).lean();
    return rows.map(toDto);
}
async function getBruxismPlate(idValue, user) { await (0, mongoose_2.connectToDatabase)(); const plate = await getPlate(idValue); ensureOwner(plate, user); return toDto(plate); }
async function createBruxismPlate(input, user) {
    await (0, mongoose_2.connectToDatabase)();
    const patient = await resolvePatient(input);
    const created = await bruxism_plate_1.BruxismPlateModel.create({ fecha: (0, utils_1.parseDateOnlyAsUtc)(input.fecha), pacienteId: patient._id, odontologoId: new mongoose_1.Types.ObjectId(user.id), payments: [{ _id: new mongoose_1.Types.ObjectId(), fecha: (0, utils_1.parseDateOnlyAsUtc)(input.fecha), montoCentavos: input.montoCentavos, createdAt: new Date() }] });
    return getBruxismPlate(id(created._id), user);
}
async function addBruxismPlatePayment(idValue, input, user) {
    await (0, mongoose_2.connectToDatabase)();
    const plate = await bruxism_plate_1.BruxismPlateModel.findById(idValue);
    if (!plate)
        throw new api_1.AppError("NOT_FOUND", "Placa no encontrada", 404);
    ensureOwner(plate, user);
    if (plate.estado !== "en-laboratorio")
        throw new api_1.AppError("VALIDATION_ERROR", "No podes agregar pagos despues de la llegada de la placa", 409);
    plate.payments.push({ _id: new mongoose_1.Types.ObjectId(), fecha: (0, utils_1.parseDateOnlyAsUtc)(input.fecha), montoCentavos: input.montoCentavos, createdAt: new Date() });
    await plate.save();
    return getBruxismPlate(idValue, user);
}
async function receiveBruxismPlate(idValue, costoLaboratorioCentavos, user) {
    if (!isAdmin(user))
        throw new api_1.AppError("FORBIDDEN", "Solo administracion puede recibir la placa", 403);
    await (0, mongoose_2.connectToDatabase)();
    const plate = await bruxism_plate_1.BruxismPlateModel.findById(idValue);
    if (!plate)
        throw new api_1.AppError("NOT_FOUND", "Placa no encontrada", 404);
    if (plate.estado !== "en-laboratorio")
        throw new api_1.AppError("VALIDATION_ERROR", "La placa no puede marcarse como recibida", 409);
    plate.costoLaboratorioCentavos = costoLaboratorioCentavos;
    plate.laboratorioRecibidoAt = new Date();
    plate.estado = "lista-entrega";
    await plate.save();
    return getBruxismPlate(idValue, user);
}
async function deliverBruxismPlate(idValue, input, user) {
    await (0, mongoose_2.connectToDatabase)();
    const plate = await bruxism_plate_1.BruxismPlateModel.findById(idValue);
    if (!plate)
        throw new api_1.AppError("NOT_FOUND", "Placa no encontrada", 404);
    ensureOwner(plate, user);
    if (plate.estado !== "lista-entrega")
        throw new api_1.AppError("VALIDATION_ERROR", "La placa aun no esta lista para entregar", 409);
    plate.payments.push({ _id: new mongoose_1.Types.ObjectId(), fecha: (0, utils_1.parseDateOnlyAsUtc)(input.fecha), montoCentavos: input.montoCentavos, createdAt: new Date() });
    plate.entregadaAt = new Date();
    plate.estado = "entregada";
    await plate.save();
    return getBruxismPlate(idValue, user);
}
async function getBruxismLookups(dni) {
    await (0, mongoose_2.connectToDatabase)();
    const [patient, obrasSociales] = await Promise.all([
        dni ? paciente_1.PacienteModel.findOne({ dni: (0, utils_1.normalizeDni)(dni) }).lean() : null,
        obra_social_1.ObraSocialModel.find({ activo: true }).sort({ nombre: 1 }).lean(),
    ]);
    const obraSocial = patient?.obraSocialId
        ? await obra_social_1.ObraSocialModel.findById(patient.obraSocialId).lean()
        : null;
    return {
        paciente: patient ? {
            id: id(patient._id), nombre: patient.nombre, apellido: patient.apellido, dni: patient.dni,
            activo: Boolean(patient.activo), obraSocialId: patient.obraSocialId ? id(patient.obraSocialId) : null,
            obraSocialNombre: obraSocial?.nombre ?? null, obraSocialActiva: Boolean(obraSocial?.activo),
        } : null,
        obrasSociales: obrasSociales.map((obraSocialItem) => ({ id: id(obraSocialItem._id), nombre: obraSocialItem.nombre })),
    };
}
async function pendingDeliveryCount(userId) { await (0, mongoose_2.connectToDatabase)(); return bruxism_plate_1.BruxismPlateModel.countDocuments({ odontologoId: new mongoose_1.Types.ObjectId(userId), estado: "lista-entrega" }); }
