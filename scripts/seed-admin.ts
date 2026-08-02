import { loadEnvConfig } from "@next/env";

async function main() {
  loadEnvConfig(process.cwd());

  const { seedAdminUser } = await import("@/services/users");
  const user = await seedAdminUser();
  console.log(`Administrador listo: ${user.email}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
