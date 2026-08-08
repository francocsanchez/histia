import { MovementDirection, MovementOriginType } from "@/types/domain";

export const movementDirectionLabels: Record<MovementDirection, string> = {
  ingreso: "Ingreso",
  egreso: "Egreso",
};

export const movementOriginLabels: Record<MovementOriginType, string> = {
  manual: "Manual",
  payment: "Pago",
};

export function buildPaymentMovementDescription(
  userName: string,
  attentionMonth: string,
) {
  return `Pago honorarios odontologicos - ${userName} - ${attentionMonth}`;
}
