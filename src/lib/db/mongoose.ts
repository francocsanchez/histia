import mongoose from "mongoose";

import { getServerEnv } from "@/lib/env";

declare global {
  var __histiaMongoose:
    | {
        connection: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
      }
    | undefined;
}

const mongooseCache = global.__histiaMongoose ?? {
  connection: null,
  promise: null,
};

if (process.env.NODE_ENV !== "production") {
  global.__histiaMongoose = mongooseCache;
}

export async function connectToDatabase() {
  const env = getServerEnv();

  if (mongooseCache.connection) {
    return mongooseCache.connection;
  }

  if (!mongooseCache.promise) {
    mongooseCache.promise = mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
    });
  }

  mongooseCache.connection = await mongooseCache.promise;
  return mongooseCache.connection;
}
