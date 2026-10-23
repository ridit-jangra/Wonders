import { getStaffSettings, requireAdmin } from "@/lib/admin";
import { PageHeader } from "../components/ui";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "Settings · Wonders admin" };

export default async function AdminSettingsPage() {
  const admin = await requireAdmin();
  const settings = await getStaffSettings(admin.slackId);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Settings" description="Saved to your account, so they follow you to any browser." />
      <SettingsClient initial={settings} account={{ name: admin.name, slackId: admin.slackId }} />
    </div>
  );
}
