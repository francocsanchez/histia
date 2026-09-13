"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRendition = buildRendition;
exports.getRenditionForUser = getRenditionForUser;
const api_1 = require("@/lib/api");
const permissions_1 = require("@/lib/permissions");
const pagos_1 = require("@/services/pagos");
function buildRendition(payment) {
    const attentionLines = payment.lineItems.filter((line) => line.sourceType === "attention");
    const codigosPagados = attentionLines.filter((line) => line.includesCodePayment && line.estadoAtencionSnapshot === "ok");
    const cosegurosPagados = attentionLines.filter((line) => line.includesCoseguroOdontoPayment);
    const ortodonciaPagada = payment.lineItems.filter((line) => line.sourceType === "orthodontic-payment");
    const pacientesPorObraSocial = new Map();
    const atenciones = new Map();
    attentionLines.forEach((line) => {
        const obraSocial = line.obraSocialNombre || "Sin obra social";
        const patients = pacientesPorObraSocial.get(obraSocial) ?? new Set();
        patients.add(line.pacienteId);
        pacientesPorObraSocial.set(obraSocial, patients);
        atenciones.set(line.attentionId, line.attentionFecha.slice(0, 10));
    });
    const patientIds = new Set(attentionLines.map((line) => line.pacienteId));
    const pacientesUnicos = patientIds.size;
    const obrasSociales = Array.from(pacientesPorObraSocial.entries())
        .map(([nombre, pacientes]) => ({
        nombre,
        pacientes: pacientes.size,
        porcentaje: pacientesUnicos === 0 ? 0 : Math.round((pacientes.size / pacientesUnicos) * 1000) / 10,
    }))
        .sort((left, right) => right.pacientes - left.pacientes || left.nombre.localeCompare(right.nombre));
    const dailyCounts = new Map();
    atenciones.forEach((date) => dailyCounts.set(date, (dailyCounts.get(date) ?? 0) + 1));
    return {
        payment,
        pacientesUnicos,
        atencionesUnicas: atenciones.size,
        obrasSociales,
        atencionesPorDia: Array.from(dailyCounts.entries())
            .map(([date, total]) => ({ date, total }))
            .sort((left, right) => left.date.localeCompare(right.date)),
        codigosPagados,
        cosegurosPagados,
        ortodonciaPagada,
    };
}
async function getRenditionForUser(paymentId, currentUser) {
    const payment = await (0, pagos_1.getPaymentById)(paymentId);
    if (!(0, permissions_1.isAdmin)(currentUser) && payment.usuarioId !== currentUser.id) {
        throw new api_1.AppError("FORBIDDEN", "No tenes permisos para acceder a esta rendicion", 403);
    }
    return buildRendition(payment);
}
