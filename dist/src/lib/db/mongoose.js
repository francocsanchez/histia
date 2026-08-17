"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectToDatabase = connectToDatabase;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("@/lib/env");
const mongooseCache = global.__histiaMongoose ?? {
    connection: null,
    promise: null,
};
if (process.env.NODE_ENV !== "production") {
    global.__histiaMongoose = mongooseCache;
}
async function connectToDatabase() {
    const env = (0, env_1.getServerEnv)();
    if (mongooseCache.connection) {
        return mongooseCache.connection;
    }
    if (!mongooseCache.promise) {
        mongooseCache.promise = mongoose_1.default.connect(env.MONGODB_URI, {
            dbName: env.MONGODB_DB_NAME,
        });
    }
    mongooseCache.connection = await mongooseCache.promise;
    return mongooseCache.connection;
}
