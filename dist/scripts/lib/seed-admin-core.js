"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSeedEnv = getSeedEnv;
exports.countUsers = countUsers;
exports.seedAdminUser = seedAdminUser;
const mongo_adapter_1 = require("@better-auth/mongo-adapter");
const better_auth_1 = require("better-auth");
const mongodb_1 = require("mongodb");
const mongoose_1 = __importStar(require("mongoose"));
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    MONGODB_URI: zod_1.z.string().min(1, "MONGODB_URI es obligatoria"),
    MONGODB_DB_NAME: zod_1.z.string().min(1, "MONGODB_DB_NAME es obligatoria"),
    BETTER_AUTH_SECRET: zod_1.z
        .string()
        .min(16, "BETTER_AUTH_SECRET debe tener al menos 16 caracteres"),
    BETTER_AUTH_URL: zod_1.z.string().url("BETTER_AUTH_URL debe ser una URL valida"),
    NEXT_PUBLIC_APP_NAME: zod_1.z.string().min(1).default("Histia"),
    SEED_ADMIN_EMAIL: zod_1.z.string().email("SEED_ADMIN_EMAIL debe ser un email valido"),
    SEED_ADMIN_PASSWORD: zod_1.z
        .string()
        .min(8, "SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres"),
    SEED_ADMIN_NAME: zod_1.z.string().min(1, "SEED_ADMIN_NAME es obligatoria"),
    SEED_ADMIN_LAST_NAME: zod_1.z.string().min(1, "SEED_ADMIN_LAST_NAME es obligatoria"),
});
let envCache;
function getSeedEnv() {
    if (envCache) {
        return envCache;
    }
    envCache = envSchema.parse({
        MONGODB_URI: process.env.MONGODB_URI,
        MONGODB_DB_NAME: process.env.MONGODB_DB_NAME,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
        NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME ?? "Histia",
        SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL,
        SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD,
        SEED_ADMIN_NAME: process.env.SEED_ADMIN_NAME,
        SEED_ADMIN_LAST_NAME: process.env.SEED_ADMIN_LAST_NAME,
    });
    return envCache;
}
function normalizeWhitespace(value) {
    return value.trim().replace(/\s+/g, " ");
}
function normalizeName(value) {
    return normalizeWhitespace(value);
}
function normalizeEmail(value) {
    return value.trim().toLowerCase();
}
const userSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: null },
    role: { type: String, default: "user" },
    apellido: { type: String, default: "" },
    activo: { type: Boolean, default: true, index: true },
    roles: { type: String, default: "" },
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: null },
    banExpires: { type: Date, default: null },
}, {
    collection: "users",
    timestamps: true,
});
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ roles: 1 });
const UserModel = mongoose_1.models.User || (0, mongoose_1.model)("User", userSchema);
let mongoClientPromise;
async function getMongoClient() {
    if (!mongoClientPromise) {
        const env = getSeedEnv();
        mongoClientPromise = new mongodb_1.MongoClient(env.MONGODB_URI).connect();
    }
    return mongoClientPromise;
}
async function getMongoDb() {
    const env = getSeedEnv();
    const client = await getMongoClient();
    return client.db(env.MONGODB_DB_NAME);
}
let mongoosePromise;
async function connectToDatabase() {
    if (!mongoosePromise) {
        const env = getSeedEnv();
        mongoosePromise = mongoose_1.default.connect(env.MONGODB_URI, {
            dbName: env.MONGODB_DB_NAME,
        });
    }
    return mongoosePromise;
}
async function createAuth() {
    const env = getSeedEnv();
    const db = await getMongoDb();
    const client = await getMongoClient();
    return (0, better_auth_1.betterAuth)({
        appName: env.NEXT_PUBLIC_APP_NAME,
        baseURL: env.BETTER_AUTH_URL,
        secret: env.BETTER_AUTH_SECRET,
        trustedOrigins: [env.BETTER_AUTH_URL],
        database: (0, mongo_adapter_1.mongodbAdapter)(db, {
            client,
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
    });
}
async function countUsers() {
    await connectToDatabase();
    return UserModel.countDocuments({});
}
async function seedAdminUser() {
    const env = getSeedEnv();
    await connectToDatabase();
    const email = normalizeEmail(env.SEED_ADMIN_EMAIL);
    let user = await UserModel.findOne({ email });
    if (!user) {
        const auth = await createAuth();
        await auth.api.signUpEmail({
            headers: new Headers({
                "x-histia-internal-secret": env.BETTER_AUTH_SECRET,
            }),
            body: {
                email,
                password: env.SEED_ADMIN_PASSWORD,
                name: normalizeName(env.SEED_ADMIN_NAME),
            },
        });
        user = await UserModel.findOne({ email });
    }
    if (!user) {
        throw new Error("No se pudo crear el administrador inicial");
    }
    user.name = normalizeName(env.SEED_ADMIN_NAME);
    user.apellido = normalizeName(env.SEED_ADMIN_LAST_NAME);
    user.activo = true;
    user.roles = "administrador";
    user.role = "admin";
    await user.save();
    return user;
}
