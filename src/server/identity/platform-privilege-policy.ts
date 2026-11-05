export function isIndependentPrivilegeReviewer(requestedById: string, targetUserId: string, reviewerId: string): boolean {
  return reviewerId !== requestedById && reviewerId !== targetUserId;
}
