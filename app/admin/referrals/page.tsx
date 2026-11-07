import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { canFulfill } from "@/lib/security/roles";
import {
  listPinsDue,
  listStickersDue,
  markPinSent,
  markStickerSent,
  refreshPendingVerifications,
  REFERRALS_FOR_PIN,
  referralTotals,
} from "@/lib/referrals";
import {
  ActionButton,
  Card,
  CardHeader,
  EmptyRow,
  PageHeader,
  Stat,
  StatGrid,
  Table,
  TextLink, SlackId,
} from "../components/ui";

export default async function AdminReferralsPage() {
  await requireAccess(canFulfill);
  await refreshPendingVerifications();

  const [pins, stickers, totals] = await Promise.all([
    listPinsDue(),
    listStickersDue(),
    referralTotals(),
  ]);

  async function sendPin(formData: FormData) {
    "use server";
    const admin = await requireAccess(canFulfill);
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await markPinSent(id);
    await writeAudit({ actor: admin.slackId, action: "referral.pin_sent", target: id });
    revalidatePath("/admin/referrals");
  }

  async function sendSticker(formData: FormData) {
    "use server";
    const admin = await requireAccess(canFulfill);
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await markStickerSent(id);
    await writeAudit({ actor: admin.slackId, action: "referral.sticker_sent", target: id });
    revalidatePath("/admin/referrals");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Referrals" description="Pins for referrers, stickers for the people they brought in." />

      <StatGrid>
        <Stat label="Signups via link" value={totals.referrals} href="/admin/referrals" />
        <Stat label="Link clicks" value={totals.clicks} href="/admin/referrals" />
        <Stat label="Pins to send" value={pins.length} href="/admin/referrals" />
        <Stat label="Stickers to send" value={stickers.length} href="/admin/referrals" />
      </StatGrid>

      <Card padding="flush">
        <CardHeader title={`Pins to send (${REFERRALS_FOR_PIN}+ counted referrals)`} count={pins.length} />
        <Table headers={["Referrer", "Slack ID", "Counted", ""]}>
          {pins.length === 0 && <EmptyRow colSpan={4} title="No pins waiting" />}
          {pins.map((p) => (
            <tr key={p.profile_id}>
              <td>
                <TextLink href={`/admin/users/${p.profile_id}`} className="font-bold">
                  {p.name || p.slack_id}
                </TextLink>
              </td>
              <td>
                <SlackId id={p.slack_id} />
              </td>
              <td>{p.qualified}</td>
              <td>
                <form action={sendPin}>
                  <input type="hidden" name="id" value={p.profile_id} />
                  <ActionButton pendingLabel="Saving..." size="sm" icon="send">
                    Mark pin sent
                  </ActionButton>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card padding="flush">
        <CardHeader title="Stickers to send" count={stickers.length} />
        <Table headers={["New player", "Slack ID", "Referred by", ""]}>
          {stickers.length === 0 && <EmptyRow colSpan={4} title="No stickers waiting" />}
          {stickers.map((s) => (
            <tr key={s.referral_id}>
              <td>
                <TextLink href={`/admin/users/${s.profile_id}`} className="font-bold">
                  {s.name || s.slack_id}
                </TextLink>
              </td>
              <td>
                <SlackId id={s.slack_id} />
              </td>
              <td>{s.referrer_name}</td>
              <td>
                <form action={sendSticker}>
                  <input type="hidden" name="id" value={s.referral_id} />
                  <ActionButton pendingLabel="Saving..." size="sm" icon="send">
                    Mark stickers sent
                  </ActionButton>
                </form>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
