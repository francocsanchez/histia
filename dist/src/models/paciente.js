"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PacienteModel = void 0;
const mongoose_1 = require("mongoose");
const pacienteSchema = new mongoose_1.Schema({
    nombre: { type: String, required: true, trim: true },
    apellido: { type: String, required: true, trim: true },
    dni: { type: String, required: true },
    obraSocialId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "ObraSocial",
        default: null,
        index: true,
    },
    activo: { type: Boolean, default: true, index: true },
}, {
    collection: "pacientes",
    timestamps: true,
});
pacienteSchema.index({ dni: 1 }, { unique: true });
pacienteSchema.index({ apellido: 1, nombre: 1 });
exports.PacienteModel = mongoose_1.models.Paciente ||
    (0, mongoose_1.model)("Paciente", pacienteSchema);
