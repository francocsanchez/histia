"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const paciente_1 = require("@/models/paciente");
const pacientes_1 = require("@/services/pacientes");
(0, node_test_1.default)("normaliza nombres de pacientes a minusculas conservando espacios legibles", () => {
    strict_1.default.equal((0, pacientes_1.normalizePacienteName)("  María   DEL  CARMEN "), "maría del carmen");
});
(0, node_test_1.default)("el esquema de paciente normaliza escrituras directas", () => {
    const patient = new paciente_1.PacienteModel({
        nombre: "  JuAN  ",
        apellido: "PÉREZ",
        dni: "12345678",
    });
    strict_1.default.equal(patient.nombre, "juan");
    strict_1.default.equal(patient.apellido, "pérez");
});
