import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProfileByIdAdmin, getProfileIdentityAdmin } from "@/lib/profiles";
import { getProjects } from "@/lib/projects";
import { getProfileHistory } from "@/lib/project-history";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  CardHeader,
  DescriptionList,
  ActionButton,
  Callout,
  EmptyState,
  Field,
  HistoryTimeline,
  Input,
  Mono,
  PageHeader,
  StatusBadge,
  TextLink,
} from "../../components/ui";
import Select from "../../components/Select";
import { hasRecentAuth, reauthUrl, requireAccess } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { banPlayer, getActiveBan, unbanPlayer } from "@/lib/bans";
import { canManagePlayers } from "@/lib/security/roles";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requireAccess(canManagePlayers);
  const { id } = await params;
  const profile = await getProfileByIdAdmin(id);
  if (!profile) notFound();

  const unlocked = await hasRecentAuth(admin.slackId);
  const [projects, history, identity, ban] = await Promise.all([
    getProjects(profile.id),
    getProfileHistory(profile.id),
    getProfileIdentityAdmin(profile.id, unlocked),
    getActiveBan(profile.slack_id),
  ]);

  if (unlocked) {
    await writeAudit({
      actor: admin.slackId,
      action: "admin.view_pii",
      target: profile.slack_id,
      sensitive: true,
    });
  }

  async function banAction(formData: FormData) {
    "use server";
    const actor = await requireAccess(canManagePlayers);
    const target = await getProfileByIdAdmin(id);
    if (!target || target.slack_id === actor.slackId) return;
    const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
    if (!reason) return;
    const days = Number(formData.get("days"));
    await banPlayer({
      slackId: target.slack_id,
      reason,
      bannedBy: actor.slackId,
      days: Number.isFinite(days) && days > 0 ? Math.min(days, 3650) : null,
    });
    await writeAudit({
      actor: actor.slackId,
      action: "player.ban",
      target: target.slack_id,
      detail: { reason, days: days > 0 ? days : null },
      sensitive: true,
    });
    revalidatePath(`/admin/users/${id}`);
    redirect(`/admin/users/${id}`);
  }

  async function unban() {
    "use server";
    const actor = await requireAccess(canManagePlayers);
    const target = await getProfileByIdAdmin(id);
    if (!target) return;
    await unbanPlayer(target.slack_id, actor.slackId);
    await writeAudit({ actor: actor.slackId, action: "player.unban", target: target.slack_id });
    revalidatePath(`/admin/users/${id}`);
    redirect(`/admin/users/${id}`);
  }

  const address = identity?.address;
  const verification = identity?.hca_verification_status;
  const fullName = [identity?.first_name, identity?.last_name].filter(Boolean).join(" ");

  let verificationTone: "success" | "warning" = "warning";
  if (verification === "verified" && identity?.hca_ysws_eligible) {
    verificationTone = "success";
  }

  let addressBlock = null;
  if (address?.line1) {
    addressBlock = (
      <address className="not-italic">
        {address.line1}
        {address.line2 && (
          <>
            <br />
            {address.line2}
          </>
        )}
        <br />
        {[address.city, address.state, address.postal].filter(Boolean).join(", ")}
        <br />
        {address.country}
      </address>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <ButtonLink href="/admin/users" variant="ghost" size="sm" icon="view-back">
          Users
        </ButtonLink>
      </div>

      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar src={identity?.slack_avatar_url} size={40} />
            {profile.name ? profile.name : profile.email}
          </span>
        }
        description={identity?.slack_display_name ? `@${identity.slack_display_name} on Slack` : undefined}
        actions={
          verification && (
            <Badge tone={verificationTone} icon={verificationTone === "success" ? "badge-check" : "important"}>
              HCA {verification}
              {identity?.hca_ysws_eligible === false && " · not YSWS eligible"}
            </Badge>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account" icon="person-card" />
          <DescriptionList
            items={[
              ["Email", profile.email],
              ["Slack ID", <Mono key="slack">{profile.slack_id}</Mono>],
              ["Interest", profile.interest],
              ["Joined", <Mono key="joined">{new Date(profile.created_at).toLocaleString()}</Mono>],
            ]}
          />
        </Card>

        <Card>
          <CardHeader title="Shipping & identity" icon="map-pin" />
          <DescriptionList
            items={[
              ["Name", fullName],
              ["Birthday", identity?.birthday ? <Mono key="birthday">{identity.birthday}</Mono> : null],
              ["Phone", identity?.phone ? <Mono key="phone">{identity.phone}</Mono> : null],
              ["Address", addressBlock],
            ]}
          />
          {unlocked ? (
            <p className="hc-caption mt-4 text-xs">
              Synced from Hack Club Auth on each login. Viewing this is logged.
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <Callout tone="info" icon="private">
                Birthday, phone and address are hidden. Sign in again to Hack Club Auth to view
                them; it&apos;s logged.
              </Callout>
              <div>
                <ButtonLink href={reauthUrl(`/admin/users/${profile.id}`)} variant="cream" size="sm">
                  Verify it&apos;s you
                </ButtonLink>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Ban" icon="flag" />
        {ban ? (
          <form action={unban} className="flex flex-col gap-3">
            <Callout tone="danger">
              Banned {ban.expires_at ? `until ${new Date(ban.expires_at).toLocaleDateString()}` : "permanently"}:{" "}
              {ban.reason}
            </Callout>
            <div>
              <ActionButton pendingLabel="Unbanning..." variant="cream" size="sm">
                Unban
              </ActionButton>
            </div>
          </form>
        ) : profile.slack_id === admin.slackId ? (
          <p className="hc-caption text-sm">You can&apos;t ban yourself.</p>
        ) : (
          <form action={banAction} className="flex flex-col gap-3">
            <Field label="Reason">
              <Input name="reason" required maxLength={500} />
            </Field>
            <Field label="Length">
              <Select
                name="days"
                defaultValue="7"
                options={[
                  { value: "1", label: "1 day" },
                  { value: "7", label: "7 days" },
                  { value: "30", label: "30 days" },
                  { value: "0", label: "Permanent" },
                ]}
              />
            </Field>
            <div>
              <ActionButton pendingLabel="Banning..." variant="danger" size="sm">
                Ban player
              </ActionButton>
            </div>
          </form>
        )}
      </Card>

      <Card padding="flush">
        <CardHeader title="Wonders" icon="rep" count={projects.length} />
        {projects.length === 0 ? (
          <EmptyState title="No wonders yet" icon="rep" />
        ) : (
          <ul>
            {projects.map((project) => (
              <li
                key={project.id}
                className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-3 last:border-b-0"
              >
                <TextLink href={`/admin/review/${project.id}`} className="font-bold">
                  {project.title}
                </TextLink>
                <StatusBadge status={project.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="History" icon="history" count={history.length} />
        <HistoryTimeline entries={history} linkProjects />
      </Card>
    </div>
  );
}
