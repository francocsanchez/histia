import { AppError } from "@/lib/api";
import { isAdmin } from "@/lib/permissions";
import { getPaymentById } from "@/services/pagos";
import {
  AttentionPaymentLineItemDto,
  PaymentDto,
  RenditionDto,
  SessionUser,
} from "@/types/domain";

export function buildRendition(payment: PaymentDto): RenditionDto {
  const attentionLines = payment.lineItems.filter(
    (line): line is AttentionPaymentLineItemDto => line.sourceType === "attention",
  );
  const codigosPagados = attentionLines.filter(
    (line) => line.includesCodePayment && line.estadoAtencionSnapshot === "ok",
  );
  const cosegurosPagados = attentionLines.filter((line) => line.includesCoseguroOdontoPayment);
  const ortodonciaPagada = payment.lineItems.filter(
    (line) => line.sourceType === "orthodontic-payment",
  );

  const pacientesPorObraSocial = new Map<string, Set<string>>();
  const atenciones = new Map<string, string>();

  attentionLines.forEach((line) => {
    const obraSocial = line.obraSocialNombre || "Sin obra social";
    const patients = pacientesPorObraSocial.get(obraSocial) ?? new Set<string>();
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
  const dailyCounts = new Map<string, number>();
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

export async function getRenditionForUser(paymentId: string, currentUser: SessionUser) {
  const payment = await getPaymentById(paymentId);

  if (!isAdmin(currentUser) && payment.usuarioId !== currentUser.id) {
    throw new AppError("FORBIDDEN", "No tenes permisos para acceder a esta rendicion", 403);
  }

  return buildRendition(payment);
}
