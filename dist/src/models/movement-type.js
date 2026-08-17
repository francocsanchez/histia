"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovementTypeModel = void 0;
const mongoose_1 = require("mongoose");
const movementTypeSchema = new mongoose_1.Schema({
    nombre: { type: String, required: true, trim: true },
    nombreNormalizado: { type: String, required: true },
    direccion: {
        type: String,
        enum: ["ingreso", "egreso"],
        required: true,
        index: true,
    },
    activo: { type: Boolean, default: true, index: true },
    systemKey: { type: String, default: null, index: true },
}, {
    collection: "movement_types",
    timestamps: true,
});
movementTypeSchema.index({ nombreNormalizado: 1, direccion: 1 }, { unique: true });
exports.MovementTypeModel = mongoose_1.models.MovementType ||
    (0, mongoose_1.model)("MovementType", movementTypeSchema);
