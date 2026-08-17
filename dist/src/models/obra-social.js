"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ObraSocialModel = void 0;
const mongoose_1 = require("mongoose");
const obraSocialSchema = new mongoose_1.Schema({
    nombre: { type: String, required: true, trim: true },
    nombreNormalizado: { type: String, required: true },
    cantidadPrestacionesMes: { type: Number, required: true, min: 0 },
    activo: { type: Boolean, default: true, index: true },
}, {
    collection: "obras_sociales",
    timestamps: true,
});
obraSocialSchema.index({ nombreNormalizado: 1 }, { unique: true });
exports.ObraSocialModel = mongoose_1.models.ObraSocial ||
    (0, mongoose_1.model)("ObraSocial", obraSocialSchema);
