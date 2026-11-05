export const STAFF_ROLES = ["admin", "reviewer", "fulfiller"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export interface StaffAccess {
  isOwner: boolean;
  roles: StaffRole[];
}

export function parseRoles(value: unknown): StaffRole[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const found = new Set<StaffRole>();
  for (const item of value) {
    if ((STAFF_ROLES as readonly unknown[]).includes(item)) {
      found.add(item as StaffRole);
    }
  }
  return STAFF_ROLES.filter((role) => found.has(role));
}

function has(access: StaffAccess, ...roles: StaffRole[]) {
  return access.isOwner || roles.some((role) => access.roles.includes(role));
}

export function isStaff(access: StaffAccess) {
  return access.isOwner || access.roles.length > 0;
}

export function canReview(access: StaffAccess) {
  return has(access, "admin", "reviewer");
}

export function canFulfill(access: StaffAccess) {
  return has(access, "admin", "fulfiller");
}

export function canManagePlayers(access: StaffAccess) {
  return has(access, "admin");
}

export function canViewAudit(access: StaffAccess) {
  return has(access, "admin");
}

export function canManageTeam(access: StaffAccess) {
  return access.isOwner;
}
