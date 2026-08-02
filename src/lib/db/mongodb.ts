import { Db, MongoClient } from "mongodb";

import { env } from "@/lib/env";

declare global {
  var __histiaMongoClient: MongoClient | undefined;
  var __histiaMongoClientPromise: Promise<MongoClient> | undefined;
}

const mongoClient = global.__histiaMongoClient ?? new MongoClient(env.MONGODB_URI);
const mongoClientPromise =
  global.__histiaMongoClientPromise ?? mongoClient.connect();

if (process.env.NODE_ENV !== "production") {
  global.__histiaMongoClient = mongoClient;
  global.__histiaMongoClientPromise = mongoClientPromise;
}

export async function getMongoClient() {
  return mongoClientPromise;
}

export function getMongoDb(): Db {
  return mongoClient.db(env.MONGODB_DB_NAME);
}
