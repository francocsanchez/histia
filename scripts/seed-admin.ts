import { loadEnvConfig } from "@next/env";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";
import { Db, MongoClient } from "mongodb";
import mongoose, { Model, Schema, model, models } from "mongoose";
import { z } from "zod";

loadEnvConfig(process.cwd());

const envSchema = z.object({
  MONGODB_URI: z.string().min(1, "MONGODB_URI es obligatoria"),
  MONGODB_DB_NAME: z.string().min(1, "MONGODB_DB_NAME es obligatoria"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(16, "BETTER_AUTH_SECRET debe tener al menos 16 caracteres"),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL debe ser una URL valida"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Histia"),
  SEED_ADMIN_EMAIL: z.string().email("SEED_ADMIN_EMAIL debe ser un email valido"),
  SEED_ADMIN_PASSWORD: z
    .string()
    .min(8, "SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres"),
  SEED_ADMIN_NAME: z.string().min(1, "SEED_ADMIN_NAME es obligatoria"),
  SEED_ADMIN_LAST_NAME: z.string().min(1, "SEED_ADMIN_LAST_NAME es obligatoria"),
});

const env = envSchema.parse({
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

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeName(value: string) {
  return normalizeWhitespace(value);
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

interface UserDocument {
  _id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role?: string | null;
  apellido?: string | null;
  activo?: boolean | null;
  roles?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
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
  },
  {
    collection: "users",
    timestamps: true,
  },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ roles: 1 });

const UserModel =
  (models.User as Model<UserDocument>) || model<UserDocument>("User", userSchema);

let mongoClientPromise: Promise<MongoClient> | undefined;

function getMongoClient() {
  if (!mongoClientPromise) {
    mongoClientPromise = new MongoClient(env.MONGODB_URI).connect();
  }

  return mongoClientPromise;
}

async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(env.MONGODB_DB_NAME);
}

let mongoosePromise: Promise<typeof mongoose> | undefined;

async function connectToDatabase() {
  if (!mongoosePromise) {
    mongoosePromise = mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
    });
  }

  return mongoosePromise;
}

async function createAuth() {
  const db = await getMongoDb();
  const client = await getMongoClient();

  return betterAuth({
    appName: env.NEXT_PUBLIC_APP_NAME,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.BETTER_AUTH_URL],
    database: mongodbAdapter(db, {
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

async function seedAdminUser() {
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

async function main() {
  const user = await seedAdminUser();
  console.log(`Administrador listo: ${user.email}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
