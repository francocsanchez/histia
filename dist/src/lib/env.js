"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicEnv = void 0;
exports.getServerEnv = getServerEnv;
const zod_1 = require("zod");
const publicEnvSchema = zod_1.z.object({
    NEXT_PUBLIC_APP_NAME: zod_1.z.string().min(1).default("Histia"),
});
const serverEnvSchema = zod_1.z.object({
    MONGODB_URI: zod_1.z.string().min(1, "MONGODB_URI es obligatoria"),
    MONGODB_DB_NAME: zod_1.z.string().min(1, "MONGODB_DB_NAME es obligatoria"),
    BETTER_AUTH_SECRET: zod_1.z
        .string()
        .min(16, "BETTER_AUTH_SECRET debe tener al menos 16 caracteres"),
    BETTER_AUTH_URL: zod_1.z.string().url("BETTER_AUTH_URL debe ser una URL valida"),
    NEXT_PUBLIC_APP_NAME: zod_1.z.string().min(1).default("Histia"),
    SEED_ADMIN_EMAIL: zod_1.z.string().email().optional(),
    SEED_ADMIN_PASSWORD: zod_1.z.string().min(8).optional(),
    SEED_ADMIN_NAME: zod_1.z.string().min(1).optional(),
    SEED_ADMIN_LAST_NAME: zod_1.z.string().min(1).optional(),
    MERCADOPAGO_ACCESS_TOKEN: zod_1.z.string().min(1).optional(),
    WHATSAPP_WORKER_PORT: zod_1.z.coerce.number().int().min(1).max(65535).optional(),
});
exports.publicEnv = publicEnvSchema.parse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
});
let serverEnvCache;
function getServerEnv() {
    if (serverEnvCache) {
        return serverEnvCache;
    }
    const parsedEnv = serverEnvSchema.safeParse({
        MONGODB_URI: process.env.MONGODB_URI,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
        NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? exports.publicEnv.NEXT_PUBLIC_APP_NAME,
        SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
        SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
        SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME,
        SEED_ADMIN_LAST_NAME: process.env.SEED_ADMIN_LAST_NAME,
        MERCADOPAGO_ACCESS_TOKEN: process.env.MERCADOPAGO_ACCESS_TOKEN,
        WHATSAPP_WORKER_PORT: process.env.WHATSAPP_WORKER_PORT,
    });
    if (!parsedEnv.success) {
        const issues = parsedEnv.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("\n");
        throw new Error(`Configuracion de entorno invalida:\n${issues}`);
    }
    serverEnvCache = parsedEnv.data;
    return serverEnvCache;
}
