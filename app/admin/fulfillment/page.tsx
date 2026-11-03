import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasRecentAuth, reauthUrl, requireAccess } from "@/lib/admin";
import { getProfileIdentityAdmin } from "@/lib/profiles";
import { writeAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  airtableRecordUrl,
  fetchSubmissionStates,
  isWonderInUnified,
  pushAllMissingToAirtable,
  summarizeUnified,
} from "@/lib/airtable";
import { createCardGrant, hcbMaxGrantCents, isHcbConfigured } from "@/lib/hcb";
import { formatDollars, parseGrantInput } from "@/lib/hcb-grant";
import ShippingInfo, { type ShippingResult } from "../components/ShippingInfo";
import { canFulfill } from "@/lib/security/roles";
import {
  listAllProjects,
  getProjectWithOwner,
  startFulfillment,
  fulfillProject,
  markRewardOrdered,
  markRewardSent,
  setProjectReward,
  hasFulfillableProject,
  claimHcbGrant,
  finishHcbGrant,
  releaseHcbGrant,
} from "@/lib/projects";
import { recordProjectHistory } from "@/lib/project-history";
import { notifyPlayer } from "@/lib/notifications";
import {
  ActionButton,
  Badge,
  Callout,
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

async function notInUnified(id: string): Promise<boolean> {
  return !(await isWonderInUnified(Number(id)));
}

const GRANT_NOTICE: Record<string, string> = {
  sent: "Grant sent.",
  failed: "HCB refused the grant, nothing was sent. Check the HCB connection and try again.",
  invalid: "Check the amount (within the limit) and purpose, then try again.",
  exists: "A grant was already sent for this wonder.",
  locked: "Verify it's you again to send grants.",
  limited: "Too many tries, wait a minute.",
  notconfigured: "HCB isn't connected yet.",
  notunified: "This wonder isn't in the Unified YSWS database yet.",
};

export default async function AdminFulfillmentPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; grant?: string; wonder?: string; airtable?: string }>;
}) {
  const admin = await requireAccess(canFulfill);
  const { page, grant: grantOutcome, wonder: grantWonder, airtable: airtableOutcome } = await searchParams;
  const hcbReady = isHcbConfigured();
  const canSendGrant = hcbReady && (await hasRecentAuth(admin.slackId));
  const currentPage = Math.max(1, parseInt(page ?? "1", 10) || 1);

  const { projects, total } = await listAllProjects({
    status: ["shipped", "fulfillment_started"],
    limit: PER_PAGE,
    offset: (currentPage - 1) * PER_PAGE,
  });
  const unifiedStates = await fetchSubmissionStates(projects.flatMap((p) => p.airtable_record_ids));
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  async function loadShipping(profileId: string): Promise<ShippingResult> {
    "use server";
    const actor = await requireAccess(canFulfill);
    if (!(await checkRateLimit("shipping-view", actor.slackId, 60, 60)).allowed) {
      return { ok: false, reason: "limited" };
    }
    if (!(await hasRecentAuth(actor.slackId))) {
      return { ok: false, reason: "locked" };
    }
    if (!(await hasFulfillableProject(profileId))) {
      return { ok: false, reason: "denied" };
    }
    const identity = await getProfileIdentityAdmin(profileId, true);
    if (!identity || !identity.address.line1) {
      return { ok: false, reason: "missing" };
    }
    await writeAudit({
      actor: actor.slackId,
      action: "admin.view_pii",
      target: profileId,
      detail: { where: "fulfillment" },
      sensitive: true,
    });
    return {
      ok: true,
      data: {
        name: [identity.first_name, identity.last_name].filter(Boolean).join(" "),
        phone: identity.phone,
        line1: identity.address.line1,
        line2: identity.address.line2,
        city: identity.address.city,
        state: identity.address.state,
        postal: identity.address.postal,
        country: identity.address.country,
      },
    };
  }

  async function sendGrant(formData: FormData) {
    "use server";

    const actor = await requireAccess(canFulfill);
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    const back = (code: string): never =>
      redirect(`/admin/fulfillment?grant=${code}&wonder=${encodeURIComponent(id)}`);

    if (!(await checkRateLimit("hcb-grant", actor.slackId, 10, 60)).allowed) back("limited");
    if (!isHcbConfigured()) back("notconfigured");
    if (await notInUnified(id)) back("notunified");
    if (!(await hasRecentAuth(actor.slackId))) back("locked");

    const existing = await getProjectWithOwner(id);
    const email = existing?.profile?.email;
    if (
      !existing ||
      !email ||
      existing.banned_at ||
      (existing.status !== "shipped" && existing.status !== "fulfillment_started")
    ) {
      back("invalid");
    }

    const input = parseGrantInput(
      {
        amount: String(formData.get("amount") ?? ""),
        purpose: String(formData.get("purpose") ?? ""),
        message: String(formData.get("message") ?? ""),
        keyword: String(formData.get("keyword") ?? ""),
        oneTime: formData.get("one_time") === "on",
      },
      hcbMaxGrantCents(),
    );
    if (!input) back("invalid");

    if (!(await claimHcbGrant(id, input!.amountCents))) back("exists");

    const result = await createCardGrant({ email: email!, ...input! });
    if (!result.ok) {
      await releaseHcbGrant(id);
      await writeAudit({
        actor: actor.slackId,
        action: "hcb.grant_failed",
        target: id,
        detail: { error: result.error, amount_cents: input!.amountCents },
      });
      back("failed");
    } else {
      await finishHcbGrant(id, result.id);
      if (!existing!.reward) {
        await setProjectReward(id, `HCB grant (${formatDollars(input!.amountCents)})`);
      }
      await writeAudit({
        actor: actor.slackId,
        action: "hcb.grant_create",
        target: id,
        detail: { grant_id: result.id, amount_cents: input!.amountCents, purpose: input!.purpose },
        sensitive: true,
      });
    }

    revalidatePath("/admin/fulfillment");
    back("sent");
  }

  async function pushAllMissing() {
    "use server";

    const actor = await requireAccess(canFulfill);
    if (!(await checkRateLimit("airtable-push-all", actor.slackId, 3, 60)).allowed) {
      redirect("/admin/fulfillment?airtable=limited");
    }
    const result = await pushAllMissingToAirtable();
    await writeAudit({
      actor: actor.slackId,
      action: "airtable.push_all",
      detail: result,
    });
    revalidatePath("/admin/fulfillment");
    redirect(`/admin/fulfillment?airtable=${result.pushed}-${result.failed}`);
  }

  async function saveReward(formData: FormData) {
    "use server";

    await requireAccess(canFulfill);
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const reward = String(formData.get("reward") ?? "").trim() || null;
    await setProjectReward(id, reward);

    revalidatePath("/admin/fulfillment");
  }

  async function beginFulfillment(formData: FormData) {
    "use server";

    const admin = await requireAccess(canFulfill);
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const existing = await getProjectWithOwner(id);
    if (!existing) return;
    if (await notInUnified(id)) return;

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

    await requireAccess(canFulfill);
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const existing = await getProjectWithOwner(id);
    if (!existing) return;
    if (await notInUnified(id)) return;

    const ordered = await markRewardOrdered(id);
    if (ordered) {
      notifyPlayer(existing.profile?.slack_id, "reward_ordered", { title: existing.title });
    }

    revalidatePath("/admin/fulfillment");
  }

  async function markSent(formData: FormData) {
    "use server";

    await requireAccess(canFulfill);
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const existing = await getProjectWithOwner(id);
    if (!existing) return;
    if (await notInUnified(id)) return;

    const sent = await markRewardSent(id);
    if (sent) {
      notifyPlayer(existing.profile?.slack_id, "reward_sent", { title: existing.title });
    }

    revalidatePath("/admin/fulfillment");
  }

  async function markFulfilled(formData: FormData) {
    "use server";

    const admin = await requireAccess(canFulfill);
    const id = String(formData.get("id") ?? "");
    if (!id) return;

    const existing = await getProjectWithOwner(id);
    if (!existing || !existing.reward) return;
    if (await notInUnified(id)) return;

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
        actions={
          <form action={pushAllMissing}>
            <ActionButton pendingLabel="Pushing…" variant="outline" icon="send">
              Push all missing to Airtable
            </ActionButton>
          </form>
        }
      />

      {airtableOutcome && (
        <div className="mb-4">
          <Callout tone={airtableOutcome === "limited" ? "warning" : "info"} icon="important">
            {airtableOutcome === "limited"
              ? "Too many tries, wait a minute."
              : `Pushed ${airtableOutcome.split("-")[0]} wonder(s) to Airtable, ${airtableOutcome.split("-")[1] ?? 0} failed.`}
          </Callout>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {projects.map((project) => {
          const unified = summarizeUnified(project.airtable_record_ids, unifiedStates);
          const inUnified = unified.state === "unified";
          const recordUrl = project.airtable_record_ids.length
            ? airtableRecordUrl(project.airtable_record_ids[project.airtable_record_ids.length - 1])
            : null;
          return (
          <Card key={project.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <TextLink href={`/admin/review/${project.id}`} className="hc-heading text-lg">
                    {project.title}
                  </TextLink>
                  <StatusBadge status={project.status} />
                  {unified.state === "unified" && <Badge tone="success">In Unified YSWS</Badge>}
                  {unified.state === "waiting" && <Badge tone="warning">Waiting on Airtable</Badge>}
                  {unified.state === "not_pushed" && <Badge tone="danger">Not in Airtable</Badge>}
                  {unified.state === "error" && <Badge tone="danger">Airtable check failed</Badge>}
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
                {project.hackatime_seconds !== null && (
                  <p className="hc-caption mt-1 text-sm">
                    Hours shipped: <Mono>{(project.hackatime_seconds / 3600).toFixed(1)}h</Mono>
                    {project.hackatime_seconds_prev !== null && (
                      <>
                        {" "}· <Mono>+{((project.hackatime_seconds - project.hackatime_seconds_prev) / 3600).toFixed(1)}h</Mono>{" "}
                        new in the latest ship
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>

            {project.reviewer_note && (
              <div className="mt-4">
                <Quote>{project.reviewer_note}</Quote>
              </div>
            )}

            <ShippingInfo
              profileId={project.profile_id}
              load={loadShipping}
              reauthHref={reauthUrl("/admin/fulfillment")}
            />

            <details
              className="hc-details mt-4"
              open={Boolean(project.hcb_grant_sent_at) || /grant/i.test(project.reward ?? "") || String(project.id) === grantWonder}
            >
              <summary>Send grant (surprise)</summary>
              <div className="hc-details-body flex flex-col gap-3">
                {String(project.id) === grantWonder && grantOutcome && GRANT_NOTICE[grantOutcome] && (
                  <Callout tone={grantOutcome === "sent" ? "success" : "warning"} icon="important">
                    {GRANT_NOTICE[grantOutcome]}
                    {grantOutcome === "locked" && (
                      <>
                        {" "}
                        <TextLink href={reauthUrl("/admin/fulfillment")}>Verify it&apos;s you</TextLink>
                      </>
                    )}
                  </Callout>
                )}
                {project.hcb_grant_sent_at ? (
                  <p className="hc-caption text-sm">
                    Grant of <Mono>{formatDollars(project.hcb_grant_cents ?? 0)}</Mono> sent to{" "}
                    <Mono>{project.profile?.email}</Mono>
                    {project.hcb_grant_id && (
                      <>
                        {" "}· <Mono>{project.hcb_grant_id}</Mono>
                      </>
                    )}
                    .
                  </p>
                ) : !hcbReady ? (
                  <p className="hc-caption text-sm">HCB isn&apos;t connected yet. Set the HCB env vars to turn this on.</p>
                ) : !inUnified ? (
                  <p className="hc-caption text-sm">Available once this wonder is in the Unified YSWS database.</p>
                ) : !canSendGrant ? (
                  <p className="hc-caption text-sm">
                    <TextLink href={reauthUrl("/admin/fulfillment")}>Verify it&apos;s you</TextLink> to send grants.
                  </p>
                ) : (
                  <form action={sendGrant} className="flex flex-col gap-3">
                    <input type="hidden" name="id" value={project.id} />
                    <p className="hc-caption text-sm">
                      Goes to <Mono>{project.profile?.email}</Mono> as an HCB card grant. Max{" "}
                      {formatDollars(hcbMaxGrantCents())}.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Field label="Amount ($)" className="w-32">
                        <Input name="amount" inputMode="decimal" placeholder="25" required />
                      </Field>
                      <Field label="What it's for" className="min-w-56 flex-1">
                        <Input name="purpose" defaultValue="Wonders reward" required maxLength={200} />
                      </Field>
                    </div>
                    <Field label="Message to them" hint="optional">
                      <Input name="message" defaultValue="something for the wonder you built :3" maxLength={500} />
                    </Field>
                    <Field label="Keyword lock" hint="optional, limits where the card works">
                      <Input name="keyword" maxLength={100} />
                    </Field>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="one_time" />
                      One time use
                    </label>
                    <div>
                      <ActionButton pendingLabel="Sending…" icon="send">
                        Send grant
                      </ActionButton>
                    </div>
                  </form>
                )}
              </div>
            </details>

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
                  <ActionButton pendingLabel="Starting…" icon="package" disabled={!inUnified}>
                    Start fulfillment
                  </ActionButton>
                </form>
              )}

              {project.status === "fulfillment_started" && !project.reward_ordered_at && (
                <form action={markOrdered}>
                  <input type="hidden" name="id" value={project.id} />
                  <ActionButton pendingLabel="Marking…" variant="outline" icon="package" disabled={!inUnified}>
                    Mark ordered
                  </ActionButton>
                </form>
              )}

              {project.status === "fulfillment_started" &&
                project.reward_ordered_at &&
                !project.reward_sent_at && (
                  <form action={markSent}>
                    <input type="hidden" name="id" value={project.id} />
                    <ActionButton pendingLabel="Marking…" variant="outline" icon="send" disabled={!inUnified}>
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
                    disabled={!project.reward || !inUnified}
                  >
                    Mark fulfilled
                  </ActionButton>
                </form>
              )}
            </div>

            {!inUnified && (
              <p className="hc-caption mt-2 flex items-center gap-1 text-sm">
                <Icon glyph="important" size={18} />
                {unified.state === "not_pushed"
                  ? "Not in Airtable yet. Use Push all missing, or push it from its review page."
                  : unified.state === "error"
                    ? `Couldn't check Airtable (${unified.error}).`
                    : "Waiting for this wonder to reach the Unified YSWS database (status 2–Submitted in Airtable)."}
                {recordUrl && (
                  <TextLink href={recordUrl} external>
                    Open record
                  </TextLink>
                )}
              </p>
            )}

            {project.status === "fulfillment_started" && !project.reward && (
              <p className="hc-caption mt-2 flex items-center gap-1 text-sm">
                <Icon glyph="important" size={18} />
                Set a reward before marking this fulfilled.
              </p>
            )}
          </Card>
          );
        })}

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
