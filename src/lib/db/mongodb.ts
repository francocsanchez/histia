import { Db, MongoClient } from "mongodb";

import { getServerEnv } from "@/lib/env";

declare global {
  var __histiaMongoClient: MongoClient | undefined;
  var __histiaMongoClientPromise: Promise<MongoClient> | undefined;
}

function getMongoClientInstance() {
  if (!global.__histiaMongoClient) {
    const env = getServerEnv();
    global.__histiaMongoClient = new MongoClient(env.MONGODB_URI);
  }

  return global.__histiaMongoClient;
}

export async function getMongoClient() {
  if (!global.__histiaMongoClientPromise) {
    global.__histiaMongoClientPromise = getMongoClientInstance().connect();
  }

  return global.__histiaMongoClientPromise;
}

export function getMongoDb(): Db {
  const env = getServerEnv();
  const client = getMongoClientInstance();

  return client.db(env.MONGODB_DB_NAME);
}
