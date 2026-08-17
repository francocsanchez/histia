"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserModel = void 0;
const mongoose_1 = require("mongoose");
const userSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true },
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
userSchema.index({ roles: 1 });
exports.UserModel = mongoose_1.models.User || (0, mongoose_1.model)("User", userSchema);
