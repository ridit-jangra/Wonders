"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, saveStaffSettings } from "@/lib/admin";
import { parseStaffSettings } from "@/lib/staff-settings";

export async function saveSettingsAction(input: unknown): Promise<{ ok: boolean }> {
  const admin = await requireAdmin();
  const ok = await saveStaffSettings(admin.slackId, parseStaffSettings(input));
  if (ok) {
    revalidatePath("/admin", "layout");
  }
  return { ok };
}
