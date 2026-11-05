export function isIndependentPrivilegeReviewer(requestedById: string, reviewerId: string): boolean {
  return requestedById !== reviewerId;
}
