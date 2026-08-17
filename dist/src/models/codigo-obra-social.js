"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodigoObraSocialModel = void 0;
const mongoose_1 = require("mongoose");
const codigoObraSocialSchema = new mongoose_1.Schema({
    nombre: { type: String, required: true, trim: true },
    codigo: { type: String, required: true, trim: true },
    codigoNormalizado: { type: String, required: true },
    obraSocialId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
        ref: "ObraSocial",
        index: true,
    },
    valorCentavos: { type: Number, required: true, min: 0 },
    activo: { type: Boolean, default: true, index: true },
}, {
    collection: "codigos_obras_sociales",
    timestamps: true,
});
codigoObraSocialSchema.index({ obraSocialId: 1, codigoNormalizado: 1 }, { unique: true });
exports.CodigoObraSocialModel = mongoose_1.models.CodigoObraSocial ||
    (0, mongoose_1.model)("CodigoObraSocial", codigoObraSocialSchema);
