import Link from "next/link";
import { revalidatePath } from "next/cache";
import { hasRecentAuth, listStaff, searchProfilesForTeam, reauthUrl, requireAccess, setStaffRoles } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { YSWS } from "@/lib/ysws-config";
import { STAFF_ROLES, canManageTeam, parseRoles } from "@/lib/security/roles";
import {
  ActionButton,
  Avatar,
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

export default async function AdminTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const admin = await requireAccess(canManageTeam);
  const unlocked = await hasRecentAuth(admin.slackId);
  const staff = await listStaff();
  const candidates = await searchProfilesForTeam(q ?? "");
  const staffIds = new Set(staff.map((member) => member.slack_id));

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
        <Table headers={["Member", "Roles", "Edit"]}>
          {staff.length === 0 ? (
            <EmptyRow colSpan={3} title="No role-based staff yet" />
          ) : (
            staff.map((member) => (
              <tr key={member.slack_id}>
                <td>
                  {member.profile_id ? (
                    <Link href={`/admin/users/${member.profile_id}`} className="font-bold">
                      {member.name || member.slack_id}
                    </Link>
                  ) : (
                    <Mono>{member.slack_id}</Mono>
                  )}
                  {member.name && (
                    <div>
                      <Mono>{member.slack_id}</Mono>
                    </div>
                  )}
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
        <div className="flex flex-col gap-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <Field label="Find a Wonders account" hint="name, Slack name, email or Slack ID">
              <Input name="q" defaultValue={q ?? ""} />
            </Field>
            <ActionButton pendingLabel="Searching..." variant="outline" size="sm">
              Search
            </ActionButton>
          </form>
          <Callout tone="info" icon="info">
            Only people with a Wonders account can be added. If they are not listed, ask them to sign in at{" "}
            {YSWS.origin}/login once, then search again.
          </Callout>
          {q && candidates.length === 0 && <p className="text-sm">No Wonders accounts match that.</p>}
          {candidates.map((person) => (
            <form key={person.slack_id} action={save} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="slack_id" value={person.slack_id} />
              <Avatar src={person.slack_avatar_url} />
              <span className="min-w-40 font-bold">
                {person.name || person.email}
                <span className="block text-xs font-normal">
                  <Mono>{person.slack_id}</Mono>
                </span>
              </span>
              {staffIds.has(person.slack_id) ? (
                <Badge>already on the team</Badge>
              ) : (
                <>
                  {STAFF_ROLES.map((role) => (
                    <label key={role} className="flex items-center gap-1 text-sm">
                      <input type="checkbox" name="role" value={role} />
                      {role}
                    </label>
                  ))}
                  <ActionButton pendingLabel="Adding..." size="sm" disabled={!unlocked}>
                    Add
                  </ActionButton>
                </>
              )}
            </form>
          ))}
        </div>
      </Card>
    </div>
  );
}
