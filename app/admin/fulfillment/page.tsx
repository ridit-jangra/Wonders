import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import {
  listAllProjects,
  getProjectWithOwner,
  startFulfillment,
  fulfillProject,
  markRewardOrdered,
  markRewardSent,
  setProjectReward,
} from "@/lib/projects";
import { recordProjectHistory } from "@/lib/project-history";
import { notifyPlayer } from "@/lib/notifications";
import {
  ActionButton,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Field,
  Icon,
  Input,
  Mono,
  PageHeader,
  Pagination,
  Quote,
  StatusBadge,
  TextLink,
} from "../components/ui";

const PER_PAGE = 25;

export default async function AdminFulfillmentPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const { page } = await searchParams;
  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);

  const { projects, total } = await listAllProjects({
    status: ["shipped", "fulfillment_started"],
    limit: PER_PAGE,
    offset: (currentPage - 1) * PER_PAGE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  async function saveReward(formData: FormData) {
    "use server";

    await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const reward = String(formData.get("reward") ?? "").trim() || null;
    await setProjectReward(id, reward);

    revalidatePath("/admin/fulfillment");
  }

  async function beginFulfillment(formData: FormData) {
    "use server";

    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const existing = await getProjectWithOwner(id);
    if (!existing) return;

    const started = await startFulfillment(id);
    if (started) {
      await recordProjectHistory({
        projectId: id,
        profileId: existing.profile_id,
        fromStatus: existing.status,
        toStatus: "fulfillment_started",
        reviewerNote: null,
        reward: existing.reward,
        reviewedBy: admin.slackId,
      });
      notifyPlayer(existing.profile?.slack_id, "fulfillment_started", { title: existing.title });
    }

    revalidatePath("/admin/fulfillment");
  }

  async function markOrdered(formData: FormData) {
    "use server";

    await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const existing = await getProjectWithOwner(id);
    if (!existing) return;

    const ordered = await markRewardOrdered(id);
    if (ordered) {
      notifyPlayer(existing.profile?.slack_id, "reward_ordered", { title: existing.title });
    }

    revalidatePath("/admin/fulfillment");
  }

  async function markSent(formData: FormData) {
    "use server";

    await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const existing = await getProjectWithOwner(id);
    if (!existing) return;

    const sent = await markRewardSent(id);
    if (sent) {
      notifyPlayer(existing.profile?.slack_id, "reward_sent", { title: existing.title });
    }

    revalidatePath("/admin/fulfillment");
  }

  async function markFulfilled(formData: FormData) {
    "use server";

    const admin = await requireAdmin();
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const existing = await getProjectWithOwner(id);
    if (!existing || !existing.reward) return;

    const fulfilled = await fulfillProject(id, admin.slackId);
    if (fulfilled) {
      await recordProjectHistory({
        projectId: id,
        profileId: existing.profile_id,
        fromStatus: existing.status,
        toStatus: "fulfilled",
        reviewerNote: null,
        reward: existing.reward,
        reviewedBy: admin.slackId,
      });
      notifyPlayer(existing.profile?.slack_id, "fulfilled", { title: existing.title });
    }

    revalidatePath("/admin/fulfillment");
  }

  return (
    <div>
      <PageHeader
        title="Fulfillment"
        count={total}
        description="Published wonders working through their reward order."
      />

      <div className="flex flex-col gap-4">
        {projects.map((project) => (
          <Card key={project.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <TextLink href={`/admin/review/${project.id}`} className="hc-heading text-lg">
                    {project.title}
                  </TextLink>
                  <StatusBadge status={project.status} />
                  {project.status === "fulfillment_started" && project.reward_sent_at && (
                    <Badge tone="info">On its way</Badge>
                  )}
                  {project.status === "fulfillment_started" &&
                    project.reward_ordered_at &&
                    !project.reward_sent_at && <Badge tone="info">Ordered</Badge>}
                </div>
                <p className="hc-caption mt-1 text-sm">
                  <TextLink href={`/admin/users/${project.profile_id}`}>
                    {project.profile?.name || project.profile?.email}
                  </TextLink>{" "}
                  · {project.profile?.email} · <Mono>{project.profile?.slack_id}</Mono>
                </p>
              </div>
              <ButtonLink
                href={`/admin/users/${project.profile_id}`}
                variant="outline"
                size="sm"
                icon="map-pin"
              >
                Shipping info
              </ButtonLink>
            </div>

            {project.reviewer_note && (
              <div className="mt-4">
                <Quote>{project.reviewer_note}</Quote>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-end gap-3 border-t border-[var(--border)] pt-5">
              <form action={saveReward} className="flex flex-1 flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={project.id} />
                <Field label="Reward" className="w-full max-w-sm">
                  <Input
                    name="reward"
                    defaultValue={project.reward ?? ""}
                    placeholder="e.g. hoodie + stickers"
                  />
                </Field>
                <ActionButton pendingLabel="Saving…" variant="outline">
                  Save
                </ActionButton>
              </form>

              {project.status === "shipped" && (
                <form action={beginFulfillment}>
                  <input type="hidden" name="id" value={project.id} />
                  <ActionButton pendingLabel="Starting…" icon="package">
                    Start fulfillment
                  </ActionButton>
                </form>
              )}

              {project.status === "fulfillment_started" && !project.reward_ordered_at && (
                <form action={markOrdered}>
                  <input type="hidden" name="id" value={project.id} />
                  <ActionButton pendingLabel="Marking…" variant="outline" icon="package">
                    Mark ordered
                  </ActionButton>
                </form>
              )}

              {project.status === "fulfillment_started" &&
                project.reward_ordered_at &&
                !project.reward_sent_at && (
                  <form action={markSent}>
                    <input type="hidden" name="id" value={project.id} />
                    <ActionButton pendingLabel="Marking…" variant="outline" icon="send">
                      Mark on its way
                    </ActionButton>
                  </form>
                )}

              {project.status === "fulfillment_started" && (
                <form action={markFulfilled}>
                  <input type="hidden" name="id" value={project.id} />
                  <ActionButton
                    pendingLabel="Marking…"
                    variant="success"
                    icon="check-circle"
                    disabled={!project.reward}
                  >
                    Mark fulfilled
                  </ActionButton>
                </form>
              )}
            </div>

            {project.status === "fulfillment_started" && !project.reward && (
              <p className="hc-caption mt-2 flex items-center gap-1 text-sm">
                <Icon glyph="important" size={18} />
                Set a reward before marking this fulfilled.
              </p>
            )}
          </Card>
        ))}

        {projects.length === 0 && (
          <Card>
            <EmptyState title="Nothing to fulfill" icon="package">
              Published wonders show up here once they need a reward sent.
            </EmptyState>
          </Card>
        )}
      </div>

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        hrefFor={(p) => `/admin/fulfillment?page=${p}`}
      />
    </div>
  );
}
