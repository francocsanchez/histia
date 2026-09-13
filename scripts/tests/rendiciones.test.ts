import assert from "node:assert/strict";
import test from "node:test";

import { buildRendition } from "@/services/rendiciones";
import { PaymentDto } from "@/types/domain";

const payment: PaymentDto = {
  id: "payment-1", usuarioId: "professional-1", usuarioNombreSnapshot: "Gómez, Ana", attentionMonth: "2026-09", attentionMonths: ["2026-08", "2026-09"], paidAt: "2026-09-10T12:00:00.000Z", createdByUserId: "admin-1",
  totalPagoCodigosCentavos: 15000, totalCoseguroOdontoCentavos: 5000, totalOrtodonciaCentavos: 12000, totalHonorariosCentavos: 32000, totalCreditosCentavos: 1000, totalDebitosCentavos: 3000, totalNetoPagarCentavos: 30000, quantityConceptsPaid: 4,
  debitItems: [{ montoCentavos: 3000, observacion: "Anticipo" }], creditItems: [{ montoCentavos: 1000, observacion: "Adicional" }], createdAt: "2026-09-10T12:00:00.000Z", updatedAt: "2026-09-10T12:00:00.000Z",
  lineItems: [
    { sourceType: "attention", attentionId: "attention-1", attentionFecha: "2026-08-04T12:00:00.000Z", pacienteId: "patient-1", pacienteNombre: "Paciente Uno", pacienteDni: "1", obraSocialId: "os-1", obraSocialNombre: "Cobertura A", codigoObraSocialId: "code-1", codigo: "001", codigoNombre: "Consulta", pieza: null, estadoAtencionSnapshot: "ok", pagoOdontologoCentavos: 10000, coseguroOdontoCentavos: 2000, includesCodePayment: true, includesCoseguroOdontoPayment: true, totalLineaCentavos: 12000 },
    { sourceType: "attention", attentionId: "attention-2", attentionFecha: "2026-08-04T12:00:00.000Z", pacienteId: "patient-2", pacienteNombre: "Paciente Dos", pacienteDni: "2", obraSocialId: "os-2", obraSocialNombre: "Cobertura B", codigoObraSocialId: "code-2", codigo: "002", codigoNombre: "Práctica", pieza: "11", estadoAtencionSnapshot: "denegado", pagoOdontologoCentavos: 5000, coseguroOdontoCentavos: 3000, includesCodePayment: true, includesCoseguroOdontoPayment: true, totalLineaCentavos: 8000 },
    { sourceType: "orthodontic-payment", orthodonticTreatmentId: "treatment-1", orthodonticPaymentId: "ortho-1", treatmentStartDate: "2026-01-01T12:00:00.000Z", paymentDate: "2026-09-02T12:00:00.000Z", treatmentType: "damon-q", patientId: "patient-3", patientName: "Paciente Tres", patientDni: "3", paymentAmountCentavos: 20000, percentageToOrthodontist: 60, orthodontistAmountCentavos: 12000, totalLineaCentavos: 12000 },
  ],
};

test("buildRendition counts attention activity and filters paid code rows by OK snapshot", () => {
  const rendition = buildRendition(payment);

  assert.equal(rendition.pacientesUnicos, 2);
  assert.equal(rendition.atencionesUnicas, 2);
  assert.deepEqual(rendition.atencionesPorDia, [{ date: "2026-08-04", total: 2 }]);
  assert.equal(rendition.obrasSociales.length, 2);
  assert.deepEqual(rendition.codigosPagados.map((line) => line.codigo), ["001"]);
  assert.deepEqual(rendition.cosegurosPagados.map((line) => line.codigo), ["001", "002"]);
  assert.equal(rendition.ortodonciaPagada.length, 1);
  assert.equal(rendition.payment.totalNetoPagarCentavos, 30000);
});
