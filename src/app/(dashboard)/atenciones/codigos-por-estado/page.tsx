import { redirect } from "next/navigation";

import { AttentionCodeStatusManager } from "@/components/shared/attention-code-status-manager";
import { requireSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/permissions";
import { attentionCodeStatusValues, AttentionCodeStatus } from "@/types/domain";

function isAttentionStatus(value: string | undefined): value is AttentionCodeStatus {
  return attentionCodeStatusValues.includes(value as AttentionCodeStatus);
}

export default async function AttentionCodeStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ attentionStatus?: string; dateFrom?: string; dateTo?: string; userId?: string }>;
}) {
  const user = await requireSessionUser();
  if (!can(user, "atenciones", "read")) redirect("/inicio");

  const { attentionStatus, dateFrom, dateTo, userId } = await searchParams;
  if (!isAttentionStatus(attentionStatus) || !dateFrom || !dateTo) redirect("/inicio");

  return (
    <AttentionCodeStatusManager
      attentionStatus={attentionStatus}
      dateFrom={dateFrom}
      dateTo={dateTo}
      userId={userId ?? ""}
    />
  );
}
