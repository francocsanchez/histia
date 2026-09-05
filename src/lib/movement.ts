import {
  MovementDirection,
  MovementOriginType,
  MovementMetadataDto,
} from "@/types/domain";

export const movementDirectionLabels: Record<MovementDirection, string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
};

export const movementOriginLabels: Record<MovementOriginType, string> = {
  manual: "Manual",
  payment: "Pago",
  mercadopago: "Mercado Pago",
};

export function buildPaymentMovementDescription(
  userName: string,
  attentionMonth: string,
) {
  return `Pago honorarios profesionales - ${userName} - ${attentionMonth}`;
}

export function isPaymentMovementMetadata(
  metadata: MovementMetadataDto | null,
): metadata is Extract<MovementMetadataDto, { kind: "payment" }> {
  return metadata?.kind === "payment";
}
