"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const issn_1 = require("@/lib/issn");
strict_1.default.deepEqual((0, issn_1.classifyIssnStatus)("ACTIVO"), { kind: "active", estado: "ACTIVO" });
strict_1.default.deepEqual((0, issn_1.classifyIssnStatus)("BAJA - VENC. CERTIFICADO"), {
    kind: "baja",
    estado: "BAJA - VENC. CERTIFICADO",
});
strict_1.default.deepEqual((0, issn_1.classifyIssnStatus)(""), { kind: "not_found", estado: "" });
strict_1.default.deepEqual((0, issn_1.classifyIssnStatus)("PENDIENTE DE REVISION"), {
    kind: "unknown",
    estado: "PENDIENTE DE REVISION",
});
console.log("ISSN status parser: OK");
