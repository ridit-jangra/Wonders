import { notFound } from "next/navigation";
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
  EmptyState,
  HistoryTimeline,
  Mono,
  PageHeader,
  StatusBadge,
  TextLink,
} from "../../components/ui";

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfileByIdAdmin(id);
  if (!profile) notFound();

  const [projects, history, identity] = await Promise.all([
    getProjects(profile.id),
    getProfileHistory(profile.id),
    getProfileIdentityAdmin(profile.id),
  ]);

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
          <p className="hc-caption mt-4 text-xs">Synced from Hack Club Auth on each login.</p>
        </Card>
      </div>

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
