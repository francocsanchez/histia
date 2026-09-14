/* eslint-disable @typescript-eslint/no-explicit-any */
import { Types } from "mongoose";

import { AppError } from "@/lib/api";
import { connectToDatabase } from "@/lib/db/mongoose";
import { normalizeDni, normalizeWhitespace, parseDateOnlyAsUtc } from "@/lib/utils";
import { BruxismPlateModel, BruxismPlateStatus } from "@/models/bruxism-plate";
import { PacienteModel } from "@/models/paciente";
import { ObraSocialModel } from "@/models/obra-social";
import { createPaciente } from "@/services/pacientes";
import { SessionUser } from "@/types/domain";

type PatientInput = { nombre: string; apellido: string; dni: string; obraSocialId?: string | null };
type PlateInput = { fecha: string; pacienteId?: string | null; paciente?: PatientInput; montoCentavos: number };
type PlatePaymentInput = { fecha: string; montoCentavos: number };

function isAdmin(user: SessionUser) { return user.roles.includes("administrador"); }
function id(value: unknown) {
  if (value && typeof value === "object" && "_id" in value) {
    return String(value._id);
  }

  return String(value);
}

export function calculateBruxismPlateHonorarium(input: { patientPaymentsCentavos: number; coverageCentavos: number; laboratoryCostCentavos: number; percentageToDentist: number }) {
  const baseCentavos = input.patientPaymentsCentavos + input.coverageCentavos - input.laboratoryCostCentavos;
  return { baseCentavos, dentistAmountCentavos: baseCentavos > 0 && input.percentageToDentist > 0 ? Math.round(baseCentavos * (input.percentageToDentist / 100)) : 0 };
}

async function resolvePatient(input: PlateInput) {
  if (input.pacienteId) {
    const patient = await PacienteModel.findById(input.pacienteId).lean();
    if (!patient) throw new AppError("NOT_FOUND", "El paciente no existe", 404);
    if (!patient.activo) throw new AppError("INACTIVE_RELATED_RECORD", "El paciente debe estar activo", 409);
    return patient;
  }
  if (!input.paciente) throw new AppError("VALIDATION_ERROR", "Debes seleccionar un paciente", 400);
  const existing = await PacienteModel.findOne({ dni: normalizeDni(input.paciente.dni) }).lean();
  if (existing) {
    if (!existing.activo) throw new AppError("INACTIVE_RELATED_RECORD", "El paciente debe estar activo", 409);
    return existing;
  }
  const created = await createPaciente(input.paciente);
  const patient = await PacienteModel.findById(created.id).lean();
  if (!patient) throw new AppError("INTERNAL_ERROR", "No se pudo crear el paciente", 500);
  return patient;
}

function ensureOwner(plate: { odontologoId: unknown }, user: SessionUser) {
  if (!isAdmin(user) && id(plate.odontologoId) !== user.id) throw new AppError("FORBIDDEN", "No tenes permisos para esta placa", 403);
}

function toDto(plate: any) {
  const patient = plate.pacienteId as { _id: unknown; nombre: string; apellido: string; dni: string };
  const dentist = plate.odontologoId as { _id: unknown; name: string; apellido?: string | null };
  const payments = [...plate.payments].sort((a: any, b: any) => a.fecha.getTime() - b.fecha.getTime()).map((item: any) => ({ id: id(item._id), fecha: item.fecha.toISOString(), montoCentavos: item.montoCentavos, createdAt: item.createdAt.toISOString() }));
  return {
    id: id(plate._id), fecha: plate.fecha.toISOString(), pacienteId: id(patient._id), pacienteNombreCompleto: `${patient.apellido}, ${patient.nombre}`,
    pacienteDni: patient.dni, odontologoId: id(dentist._id), odontologoNombre: normalizeWhitespace(`${dentist.apellido ?? ""}, ${dentist.name}`),
    estado: plate.estado as BruxismPlateStatus, payments, totalPagosPacienteCentavos: payments.reduce((sum: number, item: any) => sum + item.montoCentavos, 0),
    laboratorioRecibidoAt: plate.laboratorioRecibidoAt?.toISOString() ?? null, costoLaboratorioCentavos: plate.costoLaboratorioCentavos,
    entregadaAt: plate.entregadaAt?.toISOString() ?? null, liquidadaAt: plate.liquidadaAt?.toISOString() ?? null,
    paymentId: plate.paymentId ? id(plate.paymentId) : null, createdAt: plate.createdAt.toISOString(), updatedAt: plate.updatedAt.toISOString(),
  };
}

async function getPlate(idValue: string) {
  const plate = await BruxismPlateModel.findById(idValue).populate("pacienteId", "nombre apellido dni").populate("odontologoId", "name apellido").lean();
  if (!plate) throw new AppError("NOT_FOUND", "Placa no encontrada", 404);
  return plate;
}

export async function listBruxismPlates(user: SessionUser) {
  await connectToDatabase();
  const match = isAdmin(user) ? {} : { odontologoId: new Types.ObjectId(user.id) };
  const rows = await BruxismPlateModel.find(match).populate("pacienteId", "nombre apellido dni").populate("odontologoId", "name apellido").sort({ fecha: -1, createdAt: -1 }).lean();
  return rows.map(toDto);
}

export async function getBruxismPlate(idValue: string, user: SessionUser) { await connectToDatabase(); const plate = await getPlate(idValue); ensureOwner(plate, user); return toDto(plate); }

export async function createBruxismPlate(input: PlateInput, user: SessionUser) {
  await connectToDatabase();
  const patient = await resolvePatient(input);
  const created = await BruxismPlateModel.create({ fecha: parseDateOnlyAsUtc(input.fecha), pacienteId: patient._id, odontologoId: new Types.ObjectId(user.id), payments: [{ _id: new Types.ObjectId(), fecha: parseDateOnlyAsUtc(input.fecha), montoCentavos: input.montoCentavos, createdAt: new Date() }] });
  return getBruxismPlate(id(created._id), user);
}

export async function addBruxismPlatePayment(idValue: string, input: PlatePaymentInput, user: SessionUser) {
  await connectToDatabase(); const plate = await BruxismPlateModel.findById(idValue); if (!plate) throw new AppError("NOT_FOUND", "Placa no encontrada", 404); ensureOwner(plate, user);
  if (plate.estado !== "en-laboratorio") throw new AppError("VALIDATION_ERROR", "No podes agregar pagos despues de la llegada de la placa", 409);
  plate.payments.push({ _id: new Types.ObjectId(), fecha: parseDateOnlyAsUtc(input.fecha), montoCentavos: input.montoCentavos, createdAt: new Date() }); await plate.save(); return getBruxismPlate(idValue, user);
}

export async function receiveBruxismPlate(
  idValue: string,
  costoLaboratorioCentavos: number,
  user: SessionUser,
) {
  if (!isAdmin(user)) throw new AppError("FORBIDDEN", "Solo administracion puede recibir la placa", 403);
  await connectToDatabase(); const plate = await BruxismPlateModel.findById(idValue); if (!plate) throw new AppError("NOT_FOUND", "Placa no encontrada", 404);
  if (plate.estado !== "en-laboratorio") throw new AppError("VALIDATION_ERROR", "La placa no puede marcarse como recibida", 409);
  plate.costoLaboratorioCentavos = costoLaboratorioCentavos;
  plate.laboratorioRecibidoAt = new Date();
  plate.estado = "lista-entrega";
  await plate.save();
  return getBruxismPlate(idValue, user);
}

export async function deliverBruxismPlate(idValue: string, input: PlatePaymentInput, user: SessionUser) {
  await connectToDatabase(); const plate = await BruxismPlateModel.findById(idValue); if (!plate) throw new AppError("NOT_FOUND", "Placa no encontrada", 404); ensureOwner(plate, user);
  if (plate.estado !== "lista-entrega") throw new AppError("VALIDATION_ERROR", "La placa aun no esta lista para entregar", 409);
  plate.payments.push({ _id: new Types.ObjectId(), fecha: parseDateOnlyAsUtc(input.fecha), montoCentavos: input.montoCentavos, createdAt: new Date() }); plate.entregadaAt = new Date(); plate.estado = "entregada"; await plate.save(); return getBruxismPlate(idValue, user);
}

export async function getBruxismLookups(dni?: string) {
  await connectToDatabase();
  const [patient, obrasSociales] = await Promise.all([
    dni ? PacienteModel.findOne({ dni: normalizeDni(dni) }).lean() : null,
    ObraSocialModel.find({ activo: true }).sort({ nombre: 1 }).lean(),
  ]);
  const obraSocial = patient?.obraSocialId
    ? await ObraSocialModel.findById(patient.obraSocialId).lean()
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

export async function pendingDeliveryCount(userId: string) { await connectToDatabase(); return BruxismPlateModel.countDocuments({ odontologoId: new Types.ObjectId(userId), estado: "lista-entrega" }); }
