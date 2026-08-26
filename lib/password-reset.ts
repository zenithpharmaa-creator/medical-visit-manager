import type { PasswordResetRequest } from "@/shared/visit-types";

export function createPasswordResetRequest(input: {
  accountType: "manager" | "representative";
  representativeId?: string;
  accountLabel: string;
  requestedAt?: string;
}): PasswordResetRequest {
  return {
    id: `reset-${Date.now()}`,
    accountType: input.accountType,
    representativeId: input.accountType === "representative" ? input.representativeId : undefined,
    accountLabel: input.accountLabel,
    requestedAt: input.requestedAt ?? new Date().toISOString(),
    status: "pending",
  };
}

export function resolvePasswordResetRequest(request: PasswordResetRequest, status: "approved" | "dismissed", note: string, resolvedAt = new Date().toISOString()): PasswordResetRequest {
  return {
    ...request,
    status,
    resolvedAt,
    resolutionNote: note.trim() || undefined,
  };
}
