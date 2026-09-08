import assert from "node:assert/strict";
import test from "node:test";

import { PacienteModel } from "@/models/paciente";
import { normalizePacienteName } from "@/services/pacientes";

test("normaliza nombres de pacientes a minusculas conservando espacios legibles", () => {
  assert.equal(normalizePacienteName("  María   DEL  CARMEN "), "maría del carmen");
});

test("el esquema de paciente normaliza escrituras directas", () => {
  const patient = new PacienteModel({
    nombre: "  JuAN  ",
    apellido: "PÉREZ",
    dni: "12345678",
  });

  assert.equal(patient.nombre, "juan");
  assert.equal(patient.apellido, "pérez");
});
