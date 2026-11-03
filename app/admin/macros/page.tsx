import { revalidatePath } from "next/cache";
import { requireAccess } from "@/lib/admin";
import { writeAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { canManagePlayers, canReview } from "@/lib/security/roles";
import {
  MACRO_BODY_MAX,
  MACRO_TITLE_MAX,
  createMacro,
  deleteMacro,
  listMacros,
} from "@/lib/review-macros";
import {
  ActionButton,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Mono,
  PageHeader,
  Textarea,
} from "../components/ui";

export default async function AdminMacrosPage() {
  const admin = await requireAccess(canReview);
  const macros = await listMacros();
  const isAdmin = canManagePlayers(admin);

  async function add(formData: FormData) {
    "use server";
    const actor = await requireAccess(canReview);
    if (!(await checkRateLimit("macro-write", actor.slackId, 30, 60)).allowed) return;
    const title = String(formData.get("title") ?? "");
    const body = String(formData.get("body") ?? "");
    if (await createMacro(title, body, actor.slackId)) {
      await writeAudit({ actor: actor.slackId, action: "macro.create", detail: { title: title.trim() } });
    }
    revalidatePath("/admin/macros");
  }

  async function remove(formData: FormData) {
    "use server";
    const actor = await requireAccess(canReview);
    if (!(await checkRateLimit("macro-write", actor.slackId, 30, 60)).allowed) return;
    const id = parseInt(String(formData.get("id") ?? ""), 10);
    if (!Number.isFinite(id)) return;
    if (await deleteMacro(id, actor.slackId, canManagePlayers(actor))) {
      await writeAudit({ actor: actor.slackId, action: "macro.delete", target: String(id) });
    }
    revalidatePath("/admin/macros");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Saved replies"
        count={macros.length}
        description="Reusable text for review notes. Pick one in the review form to drop it into a note, then edit it."
      />

      <Card>
        <CardHeader title="New saved reply" />
        <form action={add} className="flex flex-col gap-3">
          <Field label="Title">
            <Input name="title" required maxLength={MACRO_TITLE_MAX} placeholder="README is missing run steps" />
          </Field>
          <Field label="Text" hint="Never mention what the reward is.">
            <Textarea
              name="body"
              rows={5}
              required
              maxLength={MACRO_BODY_MAX}
              placeholder="Thanks for shipping! Could you add how to run it to the README? ..."
            />
          </Field>
          <div>
            <ActionButton pendingLabel="Saving…" icon="plus">
              Save reply
            </ActionButton>
          </div>
        </form>
      </Card>

      {macros.length === 0 ? (
        <Card>
          <EmptyState title="No saved replies yet" icon="message">
            Add the notes you keep writing and they show up in the review form.
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {macros.map((macro) => (
            <Card key={macro.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="hc-heading text-base">{macro.title}</h3>
                  <p className="hc-caption mt-1 text-sm whitespace-pre-wrap">{macro.body}</p>
                  <p className="hc-caption mt-2 text-xs">
                    by <Mono>{macro.created_by}</Mono>
                  </p>
                </div>
                {(isAdmin || macro.created_by === admin.slackId) && (
                  <form action={remove}>
                    <input type="hidden" name="id" value={macro.id} />
                    <ActionButton pendingLabel="Deleting…" variant="outline" icon="delete">
                      Delete
                    </ActionButton>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
