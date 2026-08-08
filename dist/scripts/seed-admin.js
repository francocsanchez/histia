"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const env_1 = require("@next/env");
const seed_admin_core_1 = require("./lib/seed-admin-core");
(0, env_1.loadEnvConfig)(process.cwd());
async function main() {
    const user = await (0, seed_admin_core_1.seedAdminUser)();
    console.log(`Administrador listo: ${user.email}`);
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
