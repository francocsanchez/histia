"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("@next/env");
const node_child_process_1 = require("node:child_process");
const seed_admin_core_1 = require("./lib/seed-admin-core");
(0, env_1.loadEnvConfig)(process.cwd());
async function ensureInitialAdmin() {
    const totalUsers = await (0, seed_admin_core_1.countUsers)();
    if (totalUsers > 0) {
        console.log(`Bootstrap omitido: ya existen ${totalUsers} usuario(s).`);
        return;
    }
    console.log("Bootstrap inicial: base vacia, creando administrador.");
    const user = await (0, seed_admin_core_1.seedAdminUser)();
    console.log(`Administrador inicial listo: ${user.email}`);
}
async function main() {
    await ensureInitialAdmin();
    const child = (0, node_child_process_1.spawn)("node", ["server.js"], {
        stdio: "inherit",
        env: process.env,
    });
    child.on("exit", (code, signal) => {
        if (signal) {
            process.kill(process.pid, signal);
            return;
        }
        process.exit(code ?? 0);
    });
    child.on("error", (error) => {
        console.error("No se pudo iniciar server.js", error);
        process.exit(1);
    });
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
