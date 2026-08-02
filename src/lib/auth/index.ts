import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";

import { connectToDatabase } from "@/lib/db/mongoose";
import { getMongoDb } from "@/lib/db/mongodb";
import { env } from "@/lib/env";
import { normalizeEmail } from "@/lib/utils";
import { UserModel } from "@/models/user";

const authDatabase = mongodbAdapter(getMongoDb());

export const auth = betterAuth({
  appName: env.NEXT_PUBLIC_APP_NAME,
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.BETTER_AUTH_URL],
  database: authDatabase,
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
    admin({
      adminRoles: ["admin"],
      defaultRole: "user",
    }),
    nextCookies(),
  ],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const internalSecret = ctx.headers?.get("x-histia-internal-secret");

        if (internalSecret !== env.BETTER_AUTH_SECRET) {
          throw new APIError("FORBIDDEN", {
            message: "No hay registro publico habilitado",
          });
        }
      }

      if (ctx.path === "/sign-in/email") {
        await connectToDatabase();

        const email = normalizeEmail(String(ctx.body?.email ?? ""));
        const user = await UserModel.findOne({ email }).lean();

        if (!user || user.activo === false || user.banned) {
          throw new APIError("FORBIDDEN", {
            message: "Tu usuario esta inactivo o no puede iniciar sesion",
          });
        }
      }
    }),
  },
});
