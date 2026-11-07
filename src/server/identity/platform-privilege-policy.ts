/** A privilege request must be reviewed by someone other than both the requester and the target. */
export function isIndependentPrivilegeReviewer(
  requestedById: string,
  targetUserId: string,
  reviewerId: string
): boolean {
  return reviewerId !== requestedById && reviewerId !== targetUserId;
}
