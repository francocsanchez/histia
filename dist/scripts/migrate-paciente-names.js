"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_module_1 = require("node:module");
const runtimeRequire = (0, node_module_1.createRequire)(__filename);
const runningWithTsx = process.execArgv.join(" ").includes("tsx");
if (!runningWithTsx) {
    runtimeRequire("module-alias/register");
}
const { loadEnvConfig } = runtimeRequire("@next/env");
const { connectToDatabase } = runtimeRequire("../src/lib/db/mongoose");
const { PacienteModel } = runtimeRequire("../src/models/paciente");
const { normalizePacienteName } = runtimeRequire("../src/services/pacientes");
loadEnvConfig(process.cwd());
async function main() {
    await connectToDatabase();
    const patients = await PacienteModel.find({}).select("nombre apellido");
    let updated = 0;
    for (const patient of patients) {
        const nombre = normalizePacienteName(patient.nombre);
        const apellido = normalizePacienteName(patient.apellido);
        if (patient.nombre === nombre && patient.apellido === apellido)
            continue;
        patient.nombre = nombre;
        patient.apellido = apellido;
        await patient.save();
        updated += 1;
    }
    console.log(`Migracion de pacientes completada: ${updated} registro(s) actualizado(s).`);
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
