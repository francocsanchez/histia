import test from "node:test";
import assert from "node:assert/strict";

import { mapSheetRowsToPreviewRows } from "@/lib/surveys";

test("mapSheetRowsToPreviewRows normaliza encabezados con mayusculas", () => {
  const [row] = mapSheetRowsToPreviewRows([
    {
      Paciente: "Julieta Mora",
      Doctor: "Franco Sanchez",
      numero: 2996736238,
      "fecha atencion": "18-08 08:30AM",
    },
  ]);

  assert.equal(row.patientNameSnapshot, "Julieta Mora");
  assert.equal(row.doctorNameSnapshot, "Franco Sanchez");
  assert.equal(row.phoneE164, "5492996736238");
  assert.equal(row.valid, true);
  assert.deepEqual(row.errors, []);
});
