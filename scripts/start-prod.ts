import { loadEnvConfig } from "@next/env";
import { spawn } from "node:child_process";

import { countUsers, seedAdminUser } from "./lib/seed-admin-core";

loadEnvConfig(process.cwd());

async function ensureInitialAdmin() {
  const totalUsers = await countUsers();

  if (totalUsers > 0) {
    console.log(`Bootstrap omitido: ya existen ${totalUsers} usuario(s).`);
    return;
  }

  console.log("Bootstrap inicial: base vacia, creando administrador.");
  const user = await seedAdminUser();
  console.log(`Administrador inicial listo: ${user.email}`);
}

async function main() {
  await ensureInitialAdmin();

  const child = spawn("node", ["server.js"], {
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

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
