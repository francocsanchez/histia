import { loadEnvConfig } from "@next/env";

import { seedAdminUser } from "./lib/seed-admin-core";

loadEnvConfig(process.cwd());

async function main() {
  const user = await seedAdminUser();
  console.log(`Administrador listo: ${user.email}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
