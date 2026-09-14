import assert from "node:assert/strict";
import test from "node:test";
import { calculateBruxismPlateHonorarium } from "@/services/placas-bruxismo";

test("calcula el honorario de una placa solo con resultado positivo", () => {
  assert.deepEqual(calculateBruxismPlateHonorarium({ patientPaymentsCentavos: 100000, coverageCentavos: 50000, laboratoryCostCentavos: 120000, percentageToDentist: 50 }), { baseCentavos: 30000, dentistAmountCentavos: 15000 });
  assert.equal(calculateBruxismPlateHonorarium({ patientPaymentsCentavos: 100000, coverageCentavos: 0, laboratoryCostCentavos: 100000, percentageToDentist: 50 }).dentistAmountCentavos, 0);
  assert.equal(calculateBruxismPlateHonorarium({ patientPaymentsCentavos: 100000, coverageCentavos: 0, laboratoryCostCentavos: 120000, percentageToDentist: 50 }).dentistAmountCentavos, 0);
});
