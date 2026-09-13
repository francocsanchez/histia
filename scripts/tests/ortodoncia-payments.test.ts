import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateOrthodonticPaymentAmounts,
  calculateOrthodonticPaymentEligibleAmounts,
} from "@/services/ortodoncia";

test("los materiales se cubren antes de calcular honorarios de ortodoncia", () => {
  const amounts = calculateOrthodonticPaymentAmounts(80_000_000, [
    { montoCentavos: 40_000_000, porcentajeOrtodoncista: 50 },
    { montoCentavos: 50_000_000, porcentajeOrtodoncista: 50 },
    { montoCentavos: 30_000_000, porcentajeOrtodoncista: 50 },
  ]);

  assert.deepEqual(amounts, [0, 5_000_000, 15_000_000]);
  assert.deepEqual(
    calculateOrthodonticPaymentEligibleAmounts(80_000_000, [
      { montoCentavos: 40_000_000, porcentajeOrtodoncista: 50 },
      { montoCentavos: 50_000_000, porcentajeOrtodoncista: 50 },
      { montoCentavos: 30_000_000, porcentajeOrtodoncista: 50 },
    ]),
    [0, 10_000_000, 30_000_000],
  );
});
