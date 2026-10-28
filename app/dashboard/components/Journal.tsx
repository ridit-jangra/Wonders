"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  applyFormat,
  continueList,
  insertImage,
  JOURNAL_MAX_CONTENT,
  JOURNAL_MAX_TITLE,
  journalTextLength,
  swapText,
  type EditResult,
  type FormatAction,
} from "@/lib/journal-shared";
import JournalMarkdown from "./JournalMarkdown";
import LocalTime from "./LocalTime";
import PageList from "./PageList";

export interface JournalItem {
  id: string;
  title: string | null;
  content: string;
  createdAt: string;
  editedAt: string | null;
}

export type JournalResult = { ok: true } | { ok: false; error: string };

interface Props {
  projectId: number;
  entries: JournalItem[];
  locked: boolean;
  post: (input: { title: string; content: string }) => Promise<JournalResult>;
  edit: (id: string, input: { title: string; content: string }) => Promise<JournalResult>;
  remove: (id: string) => Promise<JournalResult>;
  upload: (form: FormData) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
}

const FIELD =
  "w-full border border-[#8C8368]/30 bg-[#E7E2C9] px-4 py-3 font-finger-paint text-base text-[#5C4A2E] placeholder:text-[#8C8368] focus:border-[#8C8368] focus:outline-none";
const TOOL =
  "rounded-md bg-[#D9D2B0] px-2.5 py-1 font-finger-paint text-sm text-[#5C4A2E] transition-all hover:bg-[#cfc7a0] disabled:cursor-not-allowed disabled:opacity-50";

const TOOLS: { action: FormatAction; label: string; hint: string }[] = [
  { action: "bold", label: "B", hint: "bold (Ctrl+B)" },
  { action: "italic", label: "I", hint: "italic (Ctrl+I)" },
  { action: "heading", label: "H", hint: "heading (Ctrl+Shift+H)" },
  { action: "list", label: "list", hint: "bullet list (Ctrl+Shift+8)" },
  { action: "numbered", label: "1.", hint: "numbered list (Ctrl+Shift+7)" },
  { action: "quote", label: "quote", hint: "quote (Ctrl+Shift+9)" },
  { action: "code", label: "</>", hint: "code (Ctrl+E)" },
  { action: "link", label: "link", hint: "link (Ctrl+K)" },
];

const SHORTCUTS: [string, string][] = [
  ["Ctrl+B / I / E / K", "bold, italic, code, link"],
  ["Ctrl+Shift+H", "heading"],
  ["Ctrl+Shift+8 / 7 / 9", "bullets, numbers, quote"],
  ["Ctrl+Shift+P", "preview"],
  ["Ctrl+Enter", "post or save"],
  ["Enter in a list", "next item (twice to leave)"],
  ["Esc", "cancel editing"],
  ["paste / drop an image", "attach it"],
];

interface Draft {
  title: string;
  content: string;
}

function Editor({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  onDraft,
  upload,
  autoFocus,
}: {
  initial: Draft;
  submitLabel: string;
  onSubmit: (draft: Draft) => Promise<string | null>;
  onCancel?: () => void;
  onDraft?: (draft: Draft) => void;
  upload: Props["upload"];
  autoFocus?: boolean;
}) {
  const [title, setTitle] = useState(initial.title);
  const [content, setContentState] = useState(initial.content);
  const latest = useRef(initial.content);
  const uploads = useRef(0);
  function setContent(value: string) {
    latest.current = value;
    setContentState(value);
  }
  const [preview, setPreview] = useState(false);
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const area = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const previewBox = useRef<HTMLDivElement>(null);
  const pending = useRef<{ start: number; end: number } | null>(null);

  const length = journalTextLength(content);
  const canSubmit = length > 0 && !saving && !busy;

  useLayoutEffect(() => {
    const target = pending.current;
    const el = area.current;
    if (target && el) {
      pending.current = null;
      el.focus();
      el.setSelectionRange(target.start, target.end);
    }
  }, [content]);

  function commit(result: EditResult) {
    pending.current = { start: result.start, end: result.end };
    setContent(result.value);
    onDraft?.({ title, content: result.value });
  }

  function format(action: FormatAction) {
    const el = area.current;
    if (!el) return;
    commit(applyFormat(el.value, el.selectionStart, el.selectionEnd, action));
  }

  async function attach(files: File[]) {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    setBusy(true);
    setError(null);
    for (const image of images) {
      uploads.current += 1;
      const token = `![uploading ${uploads.current}](#uploading)`;
      const at = area.current?.selectionEnd ?? latest.current.length;
      const placed = insertImage(latest.current, at, "#uploading", `uploading ${uploads.current}`);
      pending.current = { start: placed.end, end: placed.end };
      setContent(placed.value);

      const form = new FormData();
      form.append("image", image);
      const result = await upload(form).catch(() => ({ ok: false as const, error: "upload failed, try again" }));

      const el = area.current;
      const swapped = swapText(
        latest.current,
        token,
        result.ok ? `![screenshot](${result.url})` : "",
        el?.selectionStart ?? latest.current.length,
        el?.selectionEnd ?? latest.current.length,
      );
      if (!result.ok) setError(result.error);
      if (swapped) {
        pending.current = el ? { start: swapped.start, end: swapped.end } : null;
        setContent(swapped.value);
        onDraft?.({ title, content: swapped.value });
      }
      if (!result.ok) break;
    }
    setBusy(false);
  }

  function submit() {
    if (!canSubmit) return;
    startSaving(async () => {
      const problem = await onSubmit({ title, content });
      if (problem) {
        setError(problem);
        return;
      }
      setError(null);
      if (!onCancel) {
        setTitle("");
        setContent("");
        setPreview(false);
      }
    });
  }

  function globalKeys(event: React.KeyboardEvent<HTMLElement>): boolean {
    const mod = event.ctrlKey || event.metaKey;
    if (event.key === "Escape" && onCancel) {
      event.preventDefault();
      onCancel();
      return true;
    }
    if (mod && event.key === "Enter") {
      event.preventDefault();
      submit();
      return true;
    }
    if (mod && event.shiftKey && event.code === "KeyP") {
      event.preventDefault();
      setPreview((p) => !p);
      requestAnimationFrame(() => (preview ? area.current : previewBox.current)?.focus());
      return true;
    }
    return false;
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    const mod = event.ctrlKey || event.metaKey;
    const el = event.currentTarget;
    if (globalKeys(event)) {
      return;
    }
    if (mod && event.shiftKey) {
      const byCode: Record<string, FormatAction> = {
        KeyH: "heading",
        Digit8: "list",
        Digit7: "numbered",
        Digit9: "quote",
      };
      const hit = byCode[event.code];
      if (hit && !preview) {
        event.preventDefault();
        format(hit);
        return;
      }
    }
    if (preview) {
      return;
    }
    if (mod && !event.shiftKey && !event.altKey) {
      const plain: Record<string, FormatAction> = { b: "bold", i: "italic", e: "code", k: "link" };
      const hit = plain[event.key.toLowerCase()];
      if (hit) {
        event.preventDefault();
        format(hit);
        return;
      }
    }
    if (
      el instanceof HTMLTextAreaElement &&
      event.key === "Enter" &&
      !event.shiftKey &&
      !mod &&
      el.selectionStart === el.selectionEnd
    ) {
      const next = continueList(el.value, el.selectionStart);
      if (next) {
        event.preventDefault();
        commit(next);
      }
    }
  }

  return (
    <div
      className="flex flex-col gap-2 rounded-md bg-[#E7E2C9]/60 p-3"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        if (event.dataTransfer.files.length > 0) {
          event.preventDefault();
          void attach([...event.dataTransfer.files]);
        }
      }}
    >
      <input
        className={FIELD}
        maxLength={JOURNAL_MAX_TITLE}
        placeholder="title (optional)"
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          onDraft?.({ title: event.target.value, content });
        }}
        onKeyDown={globalKeys}
      />
      <div className="flex flex-wrap items-center gap-1.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.action}
            type="button"
            title={tool.hint}
            className={TOOL}
            disabled={preview}
            onClick={() => format(tool.action)}
          >
            {tool.label}
          </button>
        ))}
        <button
          type="button"
          title="attach an image (or paste / drop one)"
          className={TOOL}
          disabled={busy || preview}
          onClick={() => file.current?.click()}
        >
          {busy ? "uploading..." : "image"}
        </button>
        <span className="ml-auto flex gap-1.5">
          <button
            type="button"
            title="preview (Ctrl+Shift+P)"
            className={`${TOOL} ${preview ? "bg-[#8C8368] text-[#F7F5E6] hover:bg-[#8C8368]" : ""}`}
            onClick={() => {
              setPreview((p) => !p);
              requestAnimationFrame(() => (preview ? area.current : previewBox.current)?.focus());
            }}
          >
            preview
          </button>
          <button type="button" title="keyboard shortcuts" className={TOOL} onClick={() => setHelp((h) => !h)}>
            ?
          </button>
        </span>
      </div>
      {help && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-1 rounded-md bg-[#D9D2B0]/60 px-3 py-2 font-finger-paint text-sm text-[#5C4A2E] sm:grid-cols-2">
          {SHORTCUTS.map(([keys, what]) => (
            <div key={keys} className="flex justify-between gap-3">
              <dt className="text-[#7d7148]">{keys}</dt>
              <dd className="text-right">{what}</dd>
            </div>
          ))}
        </dl>
      )}
      {preview ? (
        <div
          ref={previewBox}
          tabIndex={0}
          onKeyDown={onKeyDown}
          className="min-h-40 rounded-md bg-[#F0EBD1] px-4 py-3 focus:outline-none"
        >
          {content.trim() ? (
            <JournalMarkdown>{content}</JournalMarkdown>
          ) : (
            <span className="font-finger-paint text-[#8C8368]">nothing to preview yet</span>
          )}
        </div>
      ) : (
        <textarea
          ref={area}
          autoFocus={autoFocus}
          className={`${FIELD} min-h-40 resize-y`}
          maxLength={JOURNAL_MAX_CONTENT}
          placeholder="what did you build today? markdown works. paste or drop an image to attach it."
          value={content}
          onChange={(event) => {
            setContent(event.target.value);
            onDraft?.({ title, content: event.target.value });
          }}
          onKeyDown={onKeyDown}
          onPaste={(event) => {
            const images = [...event.clipboardData.files].filter((f) => f.type.startsWith("image/"));
            if (images.length > 0) {
              event.preventDefault();
              void attach(images);
            }
          }}
        />
      )}
      <input
        ref={file}
        type="file"
        hidden
        multiple
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          event.target.value = "";
          void attach(files);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-finger-paint text-sm text-[#8C8368]">
          {content.length} / {JOURNAL_MAX_CONTENT}
        </span>
        {error && <span className="font-finger-paint text-sm text-[#A33B32]">{error}</span>}
        <span className="ml-auto flex gap-2">
          {onCancel && (
            <button
              type="button"
              className="rounded-md bg-[#F2B3AD] px-4 py-1.5 font-finger-paint text-base text-black/50 transition-all hover:zoom-110"
              onClick={onCancel}
            >
              cancel
            </button>
          )}
          <button
            type="button"
            disabled={!canSubmit}
            className="rounded-md bg-[#D1E4B5] px-4 py-1.5 font-finger-paint text-base text-black/50 transition-all hover:zoom-110 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={submit}
          >
            {saving ? "saving... :3" : submitLabel}
          </button>
        </span>
      </div>
    </div>
  );
}

function draftKey(projectId: number) {
  return `wonders-journal-draft-${projectId}`;
}

function parseDraft(raw: string): Draft {
  try {
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Draft>;
      return { title: String(parsed.title ?? ""), content: String(parsed.content ?? "") };
    }
  } catch {}
  return { title: "", content: "" };
}

function readStoredDraft(projectId: number): string | null {
  try {
    return localStorage.getItem(draftKey(projectId)) ?? "";
  } catch {
    return "";
  }
}

export default function Journal({ projectId, entries, locked, post, edit, remove, upload }: Props) {
  const router = useRouter();
  const stored = useSyncExternalStore(
    () => () => {},
    () => readStoredDraft(projectId),
    () => null,
  );
  const draft = stored === null ? null : parseDraft(stored);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [removing, startRemoving] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  function saveDraft(next: Draft) {
    try {
      if (next.title || next.content) {
        localStorage.setItem(draftKey(projectId), JSON.stringify(next));
      } else {
        localStorage.removeItem(draftKey(projectId));
      }
    } catch {}
  }

  async function handlePost(input: Draft) {
    const result = await post(input);
    if (!result.ok) return result.error;
    try {
      localStorage.removeItem(draftKey(projectId));
    } catch {}
    setNotice("entry posted :D");
    router.refresh();
    return null;
  }

  return (
    <section className="flex w-full flex-col gap-3 md:max-w-[90%]">
      <h2 className="font-finger-paint text-2xl text-[#5C4A2E]">journal</h2>
      <p className="font-finger-paint text-[#5C4A2E]/70">
        a private log of how it&apos;s going. only you and the reviewers can read it :3
      </p>
      {locked ? (
        <p className="rounded-md bg-[#F0E27D]/40 px-4 py-3 font-finger-paint text-[#5C4A2E]">
          your wonder is in review, so the journal is locked until the review is done.
        </p>
      ) : (
        draft && (
          <Editor
            key={`new-${projectId}`}
            initial={draft}
            submitLabel="post entry :3"
            onSubmit={handlePost}
            onDraft={saveDraft}
            upload={upload}
          />
        )
      )}
      {notice && <p className="font-finger-paint text-sm text-[#2F4A1F]">{notice}</p>}
      {entries.length === 0 ? (
        <p className="py-2 text-center font-finger-paint text-[#8C8368]">no entries yet, write one as you build :3</p>
      ) : (
        <PageList as="div">
          {entries.map((entry) =>
            editing === entry.id ? (
              <Editor
                key={entry.id}
                autoFocus
                initial={{ title: entry.title ?? "", content: entry.content }}
                submitLabel="save :3"
                upload={upload}
                onCancel={() => setEditing(null)}
                onSubmit={async (input) => {
                  const result = await edit(entry.id, input);
                  if (!result.ok) return result.error;
                  setEditing(null);
                  router.refresh();
                  return null;
                }}
              />
            ) : (
              <article key={entry.id} className="rounded-md bg-[#E7E2C9] px-4 py-3">
                <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {entry.title && <h3 className="font-finger-paint text-lg text-[#5C4A2E]">{entry.title}</h3>}
                  <LocalTime iso={entry.createdAt} className="font-finger-paint text-sm text-[#8C8368]" />
                  {entry.editedAt && <span className="font-finger-paint text-sm text-[#8C8368]">(edited)</span>}
                  {!locked && (
                    <span className="ml-auto flex gap-3 font-finger-paint text-sm text-[#5C4A2E]">
                      {confirming === entry.id ? (
                        <>
                          <span>delete it?</span>
                          <button
                            type="button"
                            className="underline"
                            disabled={removing}
                            onClick={() =>
                              startRemoving(async () => {
                                const result = await remove(entry.id);
                                setConfirming(null);
                                if (!result.ok) setNotice(result.error);
                                router.refresh();
                              })
                            }
                          >
                            {removing ? "deleting..." : "yes"}
                          </button>
                          <button type="button" className="underline" onClick={() => setConfirming(null)}>
                            no
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" className="underline" onClick={() => setEditing(entry.id)}>
                            edit
                          </button>
                          <button type="button" className="underline" onClick={() => setConfirming(entry.id)}>
                            delete
                          </button>
                        </>
                      )}
                    </span>
                  )}
                </div>
                <JournalMarkdown>{entry.content}</JournalMarkdown>
              </article>
            ),
          )}
        </PageList>
      )}
    </section>
  );
}
