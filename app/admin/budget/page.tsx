import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { canManageTeam } from "@/lib/security/roles";
import {
  HCB_TRANSACTIONS_URL,
  getBudgetCash,
  getBudgetPosition,
  saveBudgetEstimate,
} from "@/lib/budget";
import { money, parseDollarsToCents, reservedCents } from "@/lib/budget-math";
import { YSWS, dollars, hoursValueCents } from "@/lib/ysws-config";
import {
  ActionButton,
  Callout,
  Card,
  CardHeader,
  EmptyRow,
  Field,
  Input,
  Mono,
  PageHeader,
  Table,
  TextLink,
} from "../components/ui";

export const dynamic = "force-dynamic";

const stamp = (value: string) =>
  `${new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST`;

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="hc-eyebrow">{label}</p>
      <p className="hc-stat-value mt-2 mb-0">{value}</p>
      {hint && <p className="hc-caption mt-1 text-sm">{hint}</p>}
    </Card>
  );
}

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--sunken)]">
      <div
        className="h-2 rounded-full bg-[var(--primary)]"
        style={{ width: `${Math.max(2, Math.min(100, percent))}%` }}
      />
    </div>
  );
}

export default async function AdminBudgetPage() {
  await requireAccess(canManageTeam);
  const [cash, position] = await Promise.all([getBudgetCash(), getBudgetPosition()]);

  const owed = position.waiting + position.inProgress;
  const reserved = reservedCents(owed, position.perPersonCents);
  const remaining = cash ? cash.balanceCents - reserved : null;
  const biggestSpend = Math.max(1, ...(cash?.spending.map((row) => row.cents) ?? [1]));
  const biggestMonth = Math.max(
    1,
    ...(cash?.months.flatMap((month) => [month.incomingCents, month.outgoingCents]) ?? [1]),
  );

  async function saveEstimate(formData: FormData) {
    "use server";
    const actor = await requireAccess(canManageTeam);
    if (!(await checkRateLimit("budget-estimate", actor.slackId, 20, 60)).allowed) return;
    const cents = parseDollarsToCents(String(formData.get("per_person") ?? ""));
    if (cents === null) return;
    await saveBudgetEstimate(cents, actor.slackId);
    await writeAudit({
      actor: actor.slackId,
      action: "budget.estimate",
      detail: { per_person_cents: cents },
    });
    revalidatePath("/admin/budget");
  }

  return (
    <div className="flex min-w-0 flex-col gap-6 [&>*]:min-w-0">
      <PageHeader
        title="Budget"
        description="Cash in HCB, rewards still owed and what remains. All amounts are USD."
      />
      <p className="hc-caption text-sm">
        Rewards read {stamp(position.readAt)}.{" "}
        {cash
          ? `HCB read ${stamp(cash.fetchedAt)}, cached for one minute. Reload to refresh.`
          : "HCB connection unavailable."}{" "}
        <TextLink href={HCB_TRANSACTIONS_URL} external>
          Open in HCB
        </TextLink>
      </p>

      {!cash && (
        <Callout tone="warning" icon="important">
          Couldn&apos;t read the HCB balance, so the cash and remaining figures are hidden. Try reloading.
        </Callout>
      )}
      {cash && !cash.reconciled && (
        <Callout tone="warning" icon="important">
          The transactions HCB returned don&apos;t add up to its balance, so treat the spending breakdown as
          approximate.
        </Callout>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Figure
          label="HCB balance"
          value={cash ? money(cash.balanceCents) : "unavailable"}
          hint={cash && cash.pendingCents !== 0 ? `${money(cash.pendingCents)} pending` : undefined}
        />
        <Figure
          label="Reserved for rewards"
          value={money(reserved)}
          hint={`${owed} ${owed === 1 ? "person" : "people"} × ${money(position.perPersonCents)}`}
        />
        <Figure
          label="Remaining"
          value={remaining === null ? "unavailable" : money(remaining)}
          hint="balance minus reserved"
        />
        <Figure
          label="Spent so far"
          value={cash ? money(cash.outgoingCents) : "unavailable"}
          hint={cash ? `${money(cash.incomingCents)} received` : undefined}
        />
      </div>

      <Card>
        <CardHeader title="Rewards still owed" />
        <Table headers={["Stage", "People", "Estimated"]}>
          <tr>
            <td>Shipped, waiting to start</td>
            <td>
              <Mono>{position.waiting}</Mono>
            </td>
            <td>
              <Mono>{money(reservedCents(position.waiting, position.perPersonCents))}</Mono>
            </td>
          </tr>
          <tr>
            <td>In fulfillment</td>
            <td>
              <Mono>{position.inProgress}</Mono>
            </td>
            <td>
              <Mono>{money(reservedCents(position.inProgress, position.perPersonCents))}</Mono>
            </td>
          </tr>
          <tr>
            <td>Fulfilled</td>
            <td>
              <Mono>{position.fulfilled}</Mono>
            </td>
            <td>done</td>
          </tr>
          <tr>
            <td>Still in review (not owed yet)</td>
            <td>
              <Mono>{position.inReview}</Mono>
            </td>
            <td>not counted</td>
          </tr>
        </Table>
        <p className="hc-caption mt-3 text-sm">
          People who already got an HCB grant from the dashboard aren&apos;t counted as owed, their grant is already
          out of the balance.
        </p>
        <form action={saveEstimate} className="mt-4 flex flex-wrap items-end gap-2">
          <Field label="Estimated cost per person ($)" className="w-full max-w-xs">
            <Input
              name="per_person"
              inputMode="decimal"
              defaultValue={(position.perPersonCents / 100).toString()}
              required
            />
          </Field>
          <ActionButton pendingLabel="Saving…" variant="outline">
            Save estimate
          </ActionButton>
        </form>
      </Card>

      <Card>
        <CardHeader title="Hours shipped" />
        <p className="hc-caption text-sm">
          <Mono>{(position.shippedSeconds / 3600).toFixed(1)}h</Mono> × <Mono>{dollars(YSWS.rates.hourlyCents)}/h</Mono>{" "}
          = <Mono>{money(hoursValueCents(position.shippedSeconds))}</Mono> of work across everyone with a shipped
          wonder. Rate comes from <Mono>lib/ysws-config.ts</Mono>.
        </p>
      </Card>

      <Card>
        <CardHeader title="Grants sent from the dashboard" />
        <p className="hc-caption text-sm">
          <Mono>{position.grants}</Mono> {position.grants === 1 ? "grant" : "grants"} totalling{" "}
          <Mono>{money(position.grantedCents)}</Mono>.
        </p>
      </Card>

      <Card>
        <CardHeader title="Spending by category" />
        {cash && cash.spending.length > 0 ? (
          <div className="flex flex-col gap-3">
            {cash.spending.map((row) => (
              <div key={row.label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{row.label}</span>
                  <Mono>{money(row.cents)}</Mono>
                </div>
                <Bar percent={(row.cents / biggestSpend) * 100} />
              </div>
            ))}
          </div>
        ) : (
          <p className="hc-caption text-sm">No spending yet.</p>
        )}
      </Card>

      <Card>
        <CardHeader title="By month" />
        <Table headers={["Month", "Received", "Spent", ""]}>
          {cash && cash.months.length > 0 ? (
            cash.months.map((month) => (
              <tr key={month.month}>
                <td>
                  <Mono>{month.month}</Mono>
                </td>
                <td>
                  <Mono>{money(month.incomingCents)}</Mono>
                </td>
                <td>
                  <Mono>{money(month.outgoingCents)}</Mono>
                </td>
                <td className="w-1/3">
                  <Bar percent={(month.outgoingCents / biggestMonth) * 100} />
                </td>
              </tr>
            ))
          ) : (
            <EmptyRow colSpan={4} title="No transactions yet" icon="payment" />
          )}
        </Table>
      </Card>
    </div>
  );
}
