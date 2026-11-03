export function isOwnWonder(reviewerSlackId: string, ownerSlackId: string | null | undefined): boolean {
  if (!reviewerSlackId || !ownerSlackId) {
    return false;
  }
  return reviewerSlackId.trim().toLowerCase() === ownerSlackId.trim().toLowerCase();
}
