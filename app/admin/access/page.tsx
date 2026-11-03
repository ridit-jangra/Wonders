import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { canManagePlayers } from "@/lib/security/roles";
import {
  grantDashboardAccess,
  listDashboardAccess,
  parseSlackIds,
  revokeDashboardAccess,
  SLACK_ID_PATTERN,
} from "@/lib/dashboard-access";
import {
  ActionButton,
  Card,
  CardHeader,
  EmptyRow,
  Field,
  Mono,
  PageHeader,
  Table,
  Textarea,
} from "../components/ui";

export default async function AdminAccessPage() {
  await requireAccess(canManagePlayers);
  const rows = await listDashboardAccess();

  async function grant(formData: FormData) {
    "use server";
    const actor = await requireAccess(canManagePlayers);
    if (!(await checkRateLimit("dashboard-access", actor.slackId, 30, 60)).allowed) return;
    const ids = parseSlackIds(String(formData.get("slack_ids") ?? ""));
    const added = await grantDashboardAccess(ids, actor.slackId);
    if (added > 0) {
      await writeAudit({
        actor: actor.slackId,
        action: "dashboard.grant",
        detail: { slack_ids: ids },
      });
    }
    revalidatePath("/admin/access");
  }

  async function revoke(formData: FormData) {
    "use server";
    const actor = await requireAccess(canManagePlayers);
    if (!(await checkRateLimit("dashboard-access", actor.slackId, 30, 60)).allowed) return;
    const slackId = String(formData.get("slack_id") ?? "").trim().toUpperCase();
    if (!SLACK_ID_PATTERN.test(slackId)) return;
    if (await revokeDashboardAccess(slackId)) {
      await writeAudit({ actor: actor.slackId, action: "dashboard.revoke", target: slackId });
    }
    revalidatePath("/admin/access");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard access"
        count={rows.length}
        description="Who can use the player dashboard. Staff always can. Everyone else needs their Slack ID here."
      />

      <Card>
        <CardHeader title="Give access" />
        <form action={grant} className="flex flex-col gap-3">
          <Field label="Slack IDs" hint="One or more, separated by spaces, commas or new lines. Looks like U0123ABCD.">
            <Textarea name="slack_ids" rows={3} required placeholder="U0123ABCD U0456EFGH" />
          </Field>
          <div>
            <ActionButton pendingLabel="Adding…" icon="plus">
              Give access
            </ActionButton>
          </div>
        </form>
      </Card>

      <Table headers={["Slack ID", "Name", "Added by", "Added", ""]}>
        {rows.length === 0 ? (
          <EmptyRow colSpan={5} title="Nobody added yet" icon="people-2">
            Only staff can use the dashboard right now.
          </EmptyRow>
        ) : (
          rows.map((row) => (
            <tr key={row.slack_id}>
              <td>
                <Mono>{row.slack_id}</Mono>
              </td>
              <td>{row.name ?? "hasn't signed in yet"}</td>
              <td>
                <Mono>{row.added_by}</Mono>
              </td>
              <td>{new Date(row.created_at).toLocaleDateString()}</td>
              <td>
                <form action={revoke}>
                  <input type="hidden" name="slack_id" value={row.slack_id} />
                  <ActionButton pendingLabel="Removing…" variant="outline" size="sm">
                    Remove
                  </ActionButton>
                </form>
              </td>
            </tr>
          ))
        )}
      </Table>
    </div>
  );
}
