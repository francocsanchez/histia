"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.movementOriginLabels = exports.movementDirectionLabels = void 0;
exports.buildPaymentMovementDescription = buildPaymentMovementDescription;
exports.isPaymentMovementMetadata = isPaymentMovementMetadata;
exports.movementDirectionLabels = {
    ingreso: "Ingreso",
    egreso: "Egreso",
};
exports.movementOriginLabels = {
    manual: "Manual",
    payment: "Pago",
    mercadopago: "Mercado Pago",
};
function buildPaymentMovementDescription(userName, attentionMonth) {
    return `Pago honorarios odontologicos - ${userName} - ${attentionMonth}`;
}
function isPaymentMovementMetadata(metadata) {
    return metadata?.kind === "payment";
}
