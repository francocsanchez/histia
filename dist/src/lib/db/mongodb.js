"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMongoClient = getMongoClient;
exports.getMongoDb = getMongoDb;
const mongodb_1 = require("mongodb");
const env_1 = require("@/lib/env");
function getMongoClientInstance() {
    if (!global.__histiaMongoClient) {
        const env = (0, env_1.getServerEnv)();
        global.__histiaMongoClient = new mongodb_1.MongoClient(env.MONGODB_URI);
    }
    return global.__histiaMongoClient;
}
async function getMongoClient() {
    if (!global.__histiaMongoClientPromise) {
        global.__histiaMongoClientPromise = getMongoClientInstance().connect();
    }
    return global.__histiaMongoClientPromise;
}
function getMongoDb() {
    const env = (0, env_1.getServerEnv)();
    const client = getMongoClientInstance();
    return client.db(env.MONGODB_DB_NAME);
}
