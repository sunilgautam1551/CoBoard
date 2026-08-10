/**
 * Last-write-wins comparison per PRD §7.3: apply the incoming op only if
 * `incoming.updatedAt >= local.updatedAt`, tie-broken by `updatedBy`.
 */
export function shouldApplyRemote(
  incomingUpdatedAt: number,
  incomingUpdatedBy: string,
  local: { updatedAt: number; updatedBy: string } | undefined,
): boolean {
  if (!local) return true;
  if (incomingUpdatedAt > local.updatedAt) return true;
  if (incomingUpdatedAt < local.updatedAt) return false;
  return incomingUpdatedBy >= local.updatedBy;
}
