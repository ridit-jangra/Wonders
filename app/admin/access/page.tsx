import { revalidatePath } from "next/cache";
import { requireAccess, searchProfilesForTeam } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { YSWS } from "@/lib/ysws-config";
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
  Avatar,
  Badge,
  Card,
  CardHeader,
  EmptyRow,
  Field,
  Mono,
  PageHeader,
  Table,
  Input,
} from "../components/ui";

export default async function AdminAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAccess(canManagePlayers);
  const { q } = await searchParams;
  const rows = await listDashboardAccess();
  const candidates = await searchProfilesForTeam(q ?? "");
  const hasAccess = new Set(rows.map((row) => row.slack_id));

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
        description={
          YSWS.access.dashboardOpen
            ? "The dashboard is open to everyone right now (dashboardOpen in lib/ysws-config.ts). This list only matters if you close it again."
            : "Who can use the player dashboard. Staff always can. Everyone else needs their Slack ID here."
        }
      />

      <Card>
        <CardHeader title="Give access" />
        <div className="flex flex-col gap-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <Field label="Find a Wonders account" hint="name, Slack name, email or Slack ID">
              <Input name="q" defaultValue={q ?? ""} />
            </Field>
            <ActionButton pendingLabel="Searching…" variant="outline" size="sm">
              Search
            </ActionButton>
          </form>
          {q && candidates.length === 0 && (
            <p className="text-sm">No Wonders accounts match that. They need to sign in once first.</p>
          )}
          {candidates.map((person) => (
            <form key={person.slack_id} action={grant} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="slack_ids" value={person.slack_id} />
              <Avatar src={person.slack_avatar_url} />
              <span className="min-w-40 font-bold">
                {person.name || person.email}
                <span className="block text-xs font-normal">
                  <Mono>{person.slack_id}</Mono>
                </span>
              </span>
              {hasAccess.has(person.slack_id) ? (
                <Badge>already has access</Badge>
              ) : (
                <ActionButton pendingLabel="Adding…" icon="plus" size="sm">
                  Give access
                </ActionButton>
              )}
            </form>
          ))}
        </div>
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
