import "server-only";
import { getAdminSession } from "@/lib/admin";
import { YSWS } from "@/lib/ysws-config";

export async function canCreateWonders(): Promise<boolean> {
  if (YSWS.access.creationOpen) return true;
  return (await getAdminSession()) !== null;
}
