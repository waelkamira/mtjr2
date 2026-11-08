/** A privilege request must be decided by someone other than both requester and target. */
export function isIndependentPrivilegeReviewer(
  requestedById: string,
  targetUserId: string,
  reviewerId: string
): boolean {
  return reviewerId !== requestedById && reviewerId !== targetUserId;
}
