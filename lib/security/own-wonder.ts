import { canReviewOwn, type StaffAccess } from "./roles";

export function isOwnWonder(reviewerSlackId: string, ownerSlackId: string | null | undefined): boolean {
  if (!reviewerSlackId || !ownerSlackId) {
    return false;
  }
  return reviewerSlackId.trim().toLowerCase() === ownerSlackId.trim().toLowerCase();
}

export function blocksOwnReview(
  admin: StaffAccess & { slackId: string },
  ownerSlackId: string | null | undefined,
): boolean {
  return isOwnWonder(admin.slackId, ownerSlackId) && !canReviewOwn(admin);
}
