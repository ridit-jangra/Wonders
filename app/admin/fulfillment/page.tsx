import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasRecentAuth, reauthUrl, requireAccess } from "@/lib/admin";
import { getProfileIdentityAdmin } from "@/lib/profiles";
import { writeAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  airtableRecordUrl,
  fetchSubmissionStates,
  isUnitInUnified,
  pushAllMissingToAirtable,
  summarizeUnified,
} from "@/lib/airtable";
import { createCardGrant, hcbMaxGrantCents, isHcbConfigured } from "@/lib/hcb";
import { formatDollars, parseGrantInput } from "@/lib/hcb-grant";
import { money } from "@/lib/budget-math";
import { YSWS, dollars, hoursValueCents } from "@/lib/ysws-config";
import ShippingInfo, { type ShippingResult } from "../components/ShippingInfo";
import { canFulfill } from "@/lib/security/roles";
import { listAllProjects, getProjectWithOwner, startFulfillment } from "@/lib/projects";
import {
  claimUnitGrant,
  completeProjectIfDone,
  finishUnitGrant,
  fulfillUnit,
  getUnit,
  hasFulfillableUnit,
  listUnits,
  markUnitOrdered,
  markUnitSent,
  releaseUnitGrant,
  setUnitReward,
  type FulfillmentUnit,
} from "@/lib/units";
import { recordProjectHistory } from "@/lib/project-history";
import { hasPinDue, listPinsDue, markPinSent, REFERRALS_FOR_PIN } from "@/lib/referrals";
import { notifyPlayer, notifyTeam } from "@/lib/notifications";
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
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveUnit(id: string, memberProfileId: string) {
  if (!/^\d{1,9}$/.test(id) || !UUID.test(memberProfileId)) return null;
  const project = await getProjectWithOwner(id);
  if (!project) return null;
  const unit = await getUnit(project.id, memberProfileId);
  if (!unit) return null;
  return { project, unit };
}

async function unitNotInUnified(unit: FulfillmentUnit): Promise<boolean> {
  return !(await isUnitInUnified(unit.projectId, unit.profileId));
}

function hoursText(seconds: number) {
  return `${(seconds / 3600).toFixed(1)}h`;
}

const GRANT_NOTICE: Record<string, string> = {
  sent: "Grant sent.",
  failed: "HCB refused the grant, nothing was sent. Check the HCB connection and try again.",
  invalid: "Check the amount (within the limit) and purpose, then try again.",
  exists: "A grant was already sent for this person.",
  locked: "Verify it's you again to send grants.",
  limited: "Too many tries, wait a minute.",
  notconfigured: "HCB isn't connected yet.",
  notunified: "This person isn't in the Unified YSWS database yet.",
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
  const pins = currentPage === 1 ? await listPinsDue() : [];
  const unitsByProject = await listUnits(projects.map((p) => p.id));
  const unifiedStates = await fetchSubmissionStates(
    [...unitsByProject.values()].flat().flatMap((unit) => unit.airtableIds),
  );
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
    if (!(await hasFulfillableUnit(profileId)) && !(await hasPinDue(profileId))) {
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
    const member = String(formData.get("member") ?? "");
    if (!id || !member) return;
    const back = (code: string): never =>
      redirect(`/admin/fulfillment?grant=${code}&wonder=${encodeURIComponent(`${id}:${member}`)}`);

    if (!(await checkRateLimit("hcb-grant", actor.slackId, 10, 60)).allowed) back("limited");
    if (!isHcbConfigured()) back("notconfigured");
    if (!(await hasRecentAuth(actor.slackId))) back("locked");

    const resolved = await resolveUnit(id, member);
    if (
      !resolved ||
      !resolved.unit.email ||
      resolved.project.banned_at ||
      (resolved.project.status !== "shipped" && resolved.project.status !== "fulfillment_started")
    ) {
      back("invalid");
    }
    const { unit, project } = resolved!;
    if (await unitNotInUnified(unit)) back("notunified");

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

    if (!(await claimUnitGrant(unit, input!.amountCents))) back("exists");

    const result = await createCardGrant({ email: unit.email, ...input! });
    if (!result.ok) {
      await releaseUnitGrant(unit);
      await writeAudit({
        actor: actor.slackId,
        action: "hcb.grant_failed",
        target: String(project.id),
        detail: { error: result.error, amount_cents: input!.amountCents, member },
      });
      back("failed");
    } else {
      await finishUnitGrant(unit, result.id);
      if (!unit.reward) {
        await setUnitReward(unit, `HCB grant (${formatDollars(input!.amountCents)})`);
      }
      await writeAudit({
        actor: actor.slackId,
        action: "hcb.grant_create",
        target: String(project.id),
        detail: { grant_id: result.id, amount_cents: input!.amountCents, purpose: input!.purpose, member },
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

  async function sendPin(formData: FormData) {
    "use server";

    const actor = await requireAccess(canFulfill);
    const id = String(formData.get("id") ?? "");
    if (!UUID.test(id)) return;
    if (!(await hasPinDue(id))) return;
    await markPinSent(id);
    await writeAudit({ actor: actor.slackId, action: "referral.pin_sent", target: id });
    revalidatePath("/admin/fulfillment");
    revalidatePath("/admin/referrals");
  }

  async function saveReward(formData: FormData) {
    "use server";

    await requireAccess(canFulfill);
    const resolved = await resolveUnit(
      String(formData.get("id") ?? ""),
      String(formData.get("member") ?? ""),
    );
    if (!resolved) return;

    const reward = String(formData.get("reward") ?? "").trim() || null;
    await setUnitReward(resolved.unit, reward);

    revalidatePath("/admin/fulfillment");
  }

  async function beginFulfillment(formData: FormData) {
    "use server";

    const admin = await requireAccess(canFulfill);
    const id = String(formData.get("id") ?? "");
    if (!/^\d{1,9}$/.test(id)) return;

    const existing = await getProjectWithOwner(id);
    if (!existing) return;
    const units = (await listUnits([existing.id])).get(existing.id) ?? [];
    let anyUnified = false;
    for (const unit of units) {
      if (await isUnitInUnified(unit.projectId, unit.profileId)) {
        anyUnified = true;
        break;
      }
    }
    if (!anyUnified) return;

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
      await notifyTeam(existing.id, "fulfillment_started", { title: existing.title });
    }

    revalidatePath("/admin/fulfillment");
  }

  async function markOrdered(formData: FormData) {
    "use server";

    await requireAccess(canFulfill);
    const resolved = await resolveUnit(
      String(formData.get("id") ?? ""),
      String(formData.get("member") ?? ""),
    );
    if (!resolved) return;
    if (await unitNotInUnified(resolved.unit)) return;

    const ordered = await markUnitOrdered(resolved.unit);
    if (ordered) {
      notifyPlayer(resolved.unit.slackId, "reward_ordered", { title: resolved.project.title });
    }

    revalidatePath("/admin/fulfillment");
  }

  async function markSent(formData: FormData) {
    "use server";

    await requireAccess(canFulfill);
    const resolved = await resolveUnit(
      String(formData.get("id") ?? ""),
      String(formData.get("member") ?? ""),
    );
    if (!resolved) return;
    if (await unitNotInUnified(resolved.unit)) return;

    const sent = await markUnitSent(resolved.unit);
    if (sent) {
      notifyPlayer(resolved.unit.slackId, "reward_sent", { title: resolved.project.title });
    }

    revalidatePath("/admin/fulfillment");
  }

  async function markFulfilled(formData: FormData) {
    "use server";

    const admin = await requireAccess(canFulfill);
    const resolved = await resolveUnit(
      String(formData.get("id") ?? ""),
      String(formData.get("member") ?? ""),
    );
    if (!resolved || !resolved.unit.reward) return;
    if (await unitNotInUnified(resolved.unit)) return;

    const fulfilled = await fulfillUnit(resolved.unit, admin.slackId);
    if (fulfilled) {
      notifyPlayer(resolved.unit.slackId, "fulfilled", { title: resolved.project.title });
      if (await completeProjectIfDone(resolved.project.id)) {
        await recordProjectHistory({
          projectId: resolved.project.id,
          profileId: resolved.project.profile_id,
          fromStatus: "fulfillment_started",
          toStatus: "fulfilled",
          reviewerNote: null,
          reward: resolved.project.reward,
          reviewedBy: admin.slackId,
        });
      }
    }

    revalidatePath("/admin/fulfillment");
  }

  return (
    <div>
      <PageHeader
        title="Fulfillment"
        count={total}
        description="Published wonders working through their reward order. Everyone on a wonder gets their own reward."
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
              : `Pushed ${airtableOutcome.split("-")[0]} row(s) to Airtable, ${airtableOutcome.split("-")[1] ?? 0} failed.`}
          </Callout>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {pins.map((pin) => (
          <Card key={`pin-${pin.profile_id}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="hc-heading text-lg">Hack Club pin</span>
                  <Badge tone="purple">For referrals</Badge>
                  <Badge tone="warning">{pin.qualified} counted referrals</Badge>
                </div>
                <p className="hc-caption mt-1 text-sm">
                  For{" "}
                  <TextLink href={`/admin/users/${pin.profile_id}`}>{pin.name || pin.slack_id}</TextLink> · {pin.email} ·{" "}
                  <Mono>{pin.slack_id}</Mono>
                </p>
                <p className="hc-caption mt-1 text-sm">
                  Earned by bringing in {REFERRALS_FOR_PIN}+ verified players with their referral link.
                </p>
              </div>
              <form action={sendPin}>
                <input type="hidden" name="id" value={pin.profile_id} />
                <ActionButton pendingLabel="Saving…" icon="send">
                  Mark pin sent
                </ActionButton>
              </form>
            </div>
            <ShippingInfo
              profileId={pin.profile_id}
              load={loadShipping}
              reauthHref={reauthUrl("/admin/fulfillment")}
            />
          </Card>
        ))}
        {projects.map((project) => {
          const units = unitsByProject.get(project.id) ?? [];
          const unifiedByUnit = units.map((unit) => summarizeUnified(unit.airtableIds, unifiedStates));
          const anyUnified = unifiedByUnit.some((summary) => summary.state === "unified");
          return (
            <Card key={project.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <TextLink href={`/admin/wonders/${project.id}`} className="hc-heading text-lg">
                      {project.title}
                    </TextLink>
                    <StatusBadge status={project.status} />
                    {units.length > 1 && <Badge tone="purple">{units.length} people</Badge>}
                  </div>
                </div>
                {project.status === "shipped" && (
                  <form action={beginFulfillment}>
                    <input type="hidden" name="id" value={project.id} />
                    <ActionButton pendingLabel="Starting…" icon="package" disabled={!anyUnified}>
                      Start fulfillment
                    </ActionButton>
                  </form>
                )}
              </div>

              {project.reviewer_note && (
                <div className="mt-4">
                  <Quote>{project.reviewer_note}</Quote>
                </div>
              )}

              {project.status === "shipped" && !anyUnified && (
                <p className="hc-caption mt-2 flex items-center gap-1 text-sm">
                  <Icon glyph="important" size={18} />
                  Start fulfillment unlocks once someone on this wonder reaches the Unified YSWS database.
                </p>
              )}

              {units.map((unit, index) => {
                const unified = unifiedByUnit[index];
                const inUnified = unified.state === "unified";
                const recordUrl = unit.airtableIds.length
                  ? airtableRecordUrl(unit.airtableIds[unit.airtableIds.length - 1])
                  : null;
                const unitKey = `${project.id}:${unit.profileId}`;
                const started = project.status === "fulfillment_started";
                return (
                  <section key={unit.profileId} className="mt-5 border-t border-[var(--border)] pt-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <TextLink href={`/admin/users/${unit.profileId}`} className="hc-heading text-base">
                        {unit.name}
                      </TextLink>
                      <Badge tone={unit.kind === "owner" ? "info" : "purple"}>
                        {unit.kind === "owner" ? "Owner" : `Collaborator C${unit.unitId}`}
                      </Badge>
                      {unified.state === "unified" && <Badge tone="success">In Unified YSWS</Badge>}
                      {unified.state === "waiting" && <Badge tone="warning">Waiting on Airtable</Badge>}
                      {unified.state === "not_pushed" && <Badge tone="danger">Not in Airtable</Badge>}
                      {unified.state === "error" && <Badge tone="danger">Airtable check failed</Badge>}
                      {unit.fulfilledAt ? (
                        <Badge tone="success">Fulfilled</Badge>
                      ) : (
                        <>
                          {started && unit.sentAt && <Badge tone="info">On its way</Badge>}
                          {started && unit.orderedAt && !unit.sentAt && <Badge tone="info">Ordered</Badge>}
                        </>
                      )}
                    </div>
                    <p className="hc-caption mt-1 text-sm">
                      {unit.email} · <Mono>{unit.slackId}</Mono>
                    </p>
                    {unit.seconds !== null && (
                      <p className="hc-caption mt-1 text-sm">
                        Hours shipped: <Mono>{hoursText(unit.seconds)}</Mono> × <Mono>{dollars(YSWS.rates.hourlyCents)}/h</Mono>{" "}
                        = <Mono>{money(hoursValueCents(unit.seconds))}</Mono>
                        {unit.secondsPrev !== null && (
                          <>
                            {" "}· <Mono>+{hoursText(Math.max(0, unit.seconds - unit.secondsPrev))}</Mono> new in the
                            latest ship (<Mono>{money(hoursValueCents(Math.max(0, unit.seconds - unit.secondsPrev)))}</Mono>)
                          </>
                        )}
                      </p>
                    )}

                    <ShippingInfo
                      profileId={unit.profileId}
                      load={loadShipping}
                      reauthHref={reauthUrl("/admin/fulfillment")}
                    />

                    <details
                      className="hc-details mt-4"
                      open={Boolean(unit.grantSentAt) || /grant/i.test(unit.reward ?? "") || unitKey === grantWonder}
                    >
                      <summary>Send grant (surprise)</summary>
                      <div className="hc-details-body flex flex-col gap-3">
                        {unitKey === grantWonder && grantOutcome && GRANT_NOTICE[grantOutcome] && (
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
                        {unit.grantSentAt ? (
                          <p className="hc-caption text-sm">
                            Grant of <Mono>{formatDollars(unit.grantCents ?? 0)}</Mono> sent to{" "}
                            <Mono>{unit.email}</Mono>
                            {unit.grantId && (
                              <>
                                {" "}· <Mono>{unit.grantId}</Mono>
                              </>
                            )}
                            .
                          </p>
                        ) : !hcbReady ? (
                          <p className="hc-caption text-sm">
                            HCB isn&apos;t connected yet. Set the HCB env vars to turn this on.
                          </p>
                        ) : !inUnified ? (
                          <p className="hc-caption text-sm">
                            Available once this person is in the Unified YSWS database.
                          </p>
                        ) : !canSendGrant ? (
                          <p className="hc-caption text-sm">
                            <TextLink href={reauthUrl("/admin/fulfillment")}>Verify it&apos;s you</TextLink> to send
                            grants.
                          </p>
                        ) : (
                          <form action={sendGrant} className="flex flex-col gap-3">
                            <input type="hidden" name="id" value={project.id} />
                            <input type="hidden" name="member" value={unit.profileId} />
                            <p className="hc-caption text-sm">
                              Goes to <Mono>{unit.email}</Mono> as an HCB card grant. Max{" "}
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
                              <Input
                                name="message"
                                defaultValue="something for the wonder you built :3"
                                maxLength={500}
                              />
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
                        <input type="hidden" name="member" value={unit.profileId} />
                        <Field label="Reward" className="w-full max-w-sm">
                          <Input
                            name="reward"
                            defaultValue={unit.reward ?? ""}
                            placeholder="e.g. hoodie + stickers"
                          />
                        </Field>
                        <ActionButton pendingLabel="Saving…" variant="outline">
                          Save
                        </ActionButton>
                      </form>

                      {started && !unit.fulfilledAt && !unit.orderedAt && (
                        <form action={markOrdered}>
                          <input type="hidden" name="id" value={project.id} />
                          <input type="hidden" name="member" value={unit.profileId} />
                          <ActionButton
                            pendingLabel="Marking…"
                            variant="outline"
                            icon="package"
                            disabled={!inUnified}
                          >
                            Mark ordered
                          </ActionButton>
                        </form>
                      )}

                      {started && !unit.fulfilledAt && unit.orderedAt && !unit.sentAt && (
                        <form action={markSent}>
                          <input type="hidden" name="id" value={project.id} />
                          <input type="hidden" name="member" value={unit.profileId} />
                          <ActionButton pendingLabel="Marking…" variant="outline" icon="send" disabled={!inUnified}>
                            Mark on its way
                          </ActionButton>
                        </form>
                      )}

                      {started && !unit.fulfilledAt && (
                        <form action={markFulfilled}>
                          <input type="hidden" name="id" value={project.id} />
                          <input type="hidden" name="member" value={unit.profileId} />
                          <ActionButton
                            pendingLabel="Marking…"
                            variant="success"
                            icon="check-circle"
                            disabled={!unit.reward || !inUnified}
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
                          ? "Not in Airtable yet. Use Push all missing, or push it from the review page."
                          : unified.state === "error"
                            ? `Couldn't check Airtable (${unified.error}).`
                            : "Waiting for this person to reach the Unified YSWS database (status 2–Submitted in Airtable)."}
                        {recordUrl && (
                          <TextLink href={recordUrl} external>
                            Open record
                          </TextLink>
                        )}
                      </p>
                    )}

                    {started && !unit.fulfilledAt && !unit.reward && (
                      <p className="hc-caption mt-2 flex items-center gap-1 text-sm">
                        <Icon glyph="important" size={18} />
                        Set a reward before marking this fulfilled.
                      </p>
                    )}
                  </section>
                );
              })}
            </Card>
          );
        })}

        {projects.length === 0 && pins.length === 0 && (
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
