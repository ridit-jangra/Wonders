import { revalidatePath } from "next/cache";
import { hasRecentAuth, listStaff, reauthUrl, requireAccess, setStaffRoles } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { STAFF_ROLES, canManageTeam, parseRoles } from "@/lib/security/roles";
import {
  ActionButton,
  Badge,
  ButtonLink,
  Callout,
  Card,
  CardHeader,
  EmptyRow,
  Field,
  Input,
  Mono,
  PageHeader,
  Table,
} from "../components/ui";

const SLACK_ID = /^[UW][A-Z0-9]{6,}$/;

export default async function AdminTeamPage() {
  const admin = await requireAccess(canManageTeam);
  const unlocked = await hasRecentAuth(admin.slackId);
  const staff = await listStaff();

  async function save(formData: FormData) {
    "use server";
    const actor = await requireAccess(canManageTeam);
    if (!(await hasRecentAuth(actor.slackId))) return;
    const slackId = String(formData.get("slack_id") ?? "").trim().toUpperCase();
    if (!SLACK_ID.test(slackId)) return;
    const roles = parseRoles(formData.getAll("role"));
    await setStaffRoles(slackId, roles, actor.slackId);
    await writeAudit({
      actor: actor.slackId,
      action: "team.set_roles",
      target: slackId,
      detail: { roles },
      sensitive: true,
    });
    revalidatePath("/admin/team");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team"
        count={staff.length}
        description="Who can review, fulfil and manage players. Owners come from ADMIN_SLACK_IDS."
      />

      {!unlocked && (
        <Callout tone="info" icon="private">
          Sign in again to Hack Club Auth before changing roles.{" "}
          <ButtonLink href={reauthUrl("/admin/team")} variant="cream" size="sm">
            Verify it&apos;s you
          </ButtonLink>
        </Callout>
      )}

      <Card padding="flush">
        <CardHeader title="Members" icon="people-3" />
        <Table headers={["Slack ID", "Roles", "Edit"]}>
          {staff.length === 0 ? (
            <EmptyRow colSpan={3} title="No role-based staff yet" />
          ) : (
            staff.map((member) => (
              <tr key={member.slack_id}>
                <td>
                  <Mono>{member.slack_id}</Mono>
                </td>
                <td>
                  <span className="flex gap-1">
                    {member.roles.map((role) => (
                      <Badge key={role}>{role}</Badge>
                    ))}
                  </span>
                </td>
                <td>
                  <form action={save} className="flex flex-wrap items-center gap-3">
                    <input type="hidden" name="slack_id" value={member.slack_id} />
                    {STAFF_ROLES.map((role) => (
                      <label key={role} className="flex items-center gap-1 text-sm">
                        <input
                          type="checkbox"
                          name="role"
                          value={role}
                          defaultChecked={member.roles.includes(role)}
                        />
                        {role}
                      </label>
                    ))}
                    <ActionButton pendingLabel="Saving..." variant="outline" size="sm" disabled={!unlocked}>
                      Save
                    </ActionButton>
                  </form>
                </td>
              </tr>
            ))
          )}
        </Table>
      </Card>

      <Card>
        <CardHeader title="Add someone" icon="person-card" />
        <form action={save} className="flex flex-col gap-3">
          <Field label="Slack ID" hint="like U0123ABCD">
            <Input name="slack_id" required pattern="[UWuw][A-Za-z0-9]{6,}" />
          </Field>
          <div className="flex flex-wrap gap-4">
            {STAFF_ROLES.map((role) => (
              <label key={role} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="role" value={role} />
                {role}
              </label>
            ))}
          </div>
          <div>
            <ActionButton pendingLabel="Adding..." size="sm" disabled={!unlocked}>
              Add
            </ActionButton>
          </div>
        </form>
      </Card>
    </div>
  );
}
