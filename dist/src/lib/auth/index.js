"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAuth = getAuth;
const mongo_adapter_1 = require("@better-auth/mongo-adapter");
const better_auth_1 = require("better-auth");
const api_1 = require("better-auth/api");
const next_js_1 = require("better-auth/next-js");
const plugins_1 = require("better-auth/plugins");
const mongoose_1 = require("@/lib/db/mongoose");
const mongodb_1 = require("@/lib/db/mongodb");
const env_1 = require("@/lib/env");
const utils_1 = require("@/lib/utils");
const user_1 = require("@/models/user");
function createAuth() {
    const env = (0, env_1.getServerEnv)();
    const db = (0, mongodb_1.getMongoDb)();
    return (0, better_auth_1.betterAuth)({
        appName: env.NEXT_PUBLIC_APP_NAME,
        baseURL: env.BETTER_AUTH_URL,
        secret: env.BETTER_AUTH_SECRET,
        trustedOrigins: [env.BETTER_AUTH_URL],
        database: (0, mongo_adapter_1.mongodbAdapter)(db, {
            client: db.client,
            transaction: false,
        }),
        emailAndPassword: {
            enabled: true,
            disableSignUp: false,
        },
        user: {
            modelName: "users",
            additionalFields: {
                apellido: {
                    type: "string",
                    required: false,
                    defaultValue: "",
                    input: false,
                },
                activo: {
                    type: "boolean",
                    required: false,
                    defaultValue: true,
                    input: false,
                },
                roles: {
                    type: "string",
                    required: false,
                    defaultValue: "",
                    input: false,
                },
            },
        },
        account: {
            modelName: "accounts",
        },
        session: {
            modelName: "sessions",
        },
        verification: {
            modelName: "verifications",
        },
        plugins: [
            (0, plugins_1.admin)({
                adminRoles: ["admin"],
                defaultRole: "user",
            }),
            (0, next_js_1.nextCookies)(),
        ],
        hooks: {
            before: (0, api_1.createAuthMiddleware)(async (ctx) => {
                if (ctx.path === "/sign-up/email") {
                    const internalSecret = ctx.headers?.get("x-histia-internal-secret");
                    if (internalSecret !== env.BETTER_AUTH_SECRET) {
                        throw new api_1.APIError("FORBIDDEN", {
                            message: "No hay registro publico habilitado",
                        });
                    }
                }
                if (ctx.path === "/sign-in/email") {
                    await (0, mongoose_1.connectToDatabase)();
                    const email = (0, utils_1.normalizeEmail)(String(ctx.body?.email ?? ""));
                    const user = await user_1.UserModel.findOne({ email }).lean();
                    if (!user || user.activo === false || user.banned) {
                        throw new api_1.APIError("FORBIDDEN", {
                            message: "Tu usuario esta inactivo o no puede iniciar sesion",
                        });
                    }
                }
            }),
        },
    });
}
let authInstance = null;
function getAuth() {
    if (authInstance) {
        return authInstance;
    }
    authInstance = createAuth();
    return authInstance;
}
