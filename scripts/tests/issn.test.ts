import assert from "node:assert/strict";

import { classifyIssnStatus } from "@/lib/issn";

assert.deepEqual(classifyIssnStatus("ACTIVO"), { kind: "active", estado: "ACTIVO" });
assert.deepEqual(classifyIssnStatus("BAJA - VENC. CERTIFICADO"), {
  kind: "baja",
  estado: "BAJA - VENC. CERTIFICADO",
});
assert.deepEqual(classifyIssnStatus(""), { kind: "not_found", estado: "" });
assert.deepEqual(classifyIssnStatus("PENDIENTE DE REVISION"), {
  kind: "unknown",
  estado: "PENDIENTE DE REVISION",
});

console.log("ISSN status parser: OK");
