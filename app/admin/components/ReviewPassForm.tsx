"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

const MIN_AUDIT_LENGTH = 20;
const MIN_FEEDBACK_LENGTH = 10;
const AUTOSAVE_DELAY_MS = 800;

export interface DraftInput {
  technicalNotes: string;
  additionalNotes: string;
  feedback: string;
  checks: string[];
}

export interface DraftResult {
  ok: boolean;
  savedAt: string | null;
}

function formatSavedAt(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function SaveStatus({
  status,
  savedAt,
  savedBy,
}: {
  status: "idle" | "pending" | "saving" | "saved" | "error";
  savedAt: string | null;
  savedBy: string | null;
}) {
  if (status === "pending" || status === "saving") {
    return <span className="hc-save-status">Saving…</span>;
  }
  if (status === "error") {
    return (
      <span className="hc-save-status" data-tone="danger">
        Couldn&apos;t save, retrying on next change
      </span>
    );
  }
  if (savedAt) {
    return (
      <span className="hc-save-status" data-tone="success">
        Saved {formatSavedAt(savedAt)}
        {savedBy ? ` · ${savedBy}` : ""}
      </span>
    );
  }
  return <span className="hc-save-status">Autosaves as you type</span>;
}

function VerdictButtons({
  canApprove,
  canSubmit,
  onBack,
}: {
  canApprove: boolean;
  canSubmit: boolean;
  onBack: () => void;
}) {
  const { pending, data } = useFormStatus();
  const pendingVerdict = data?.get("verdict");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="hc-btn hc-btn-outline" onClick={onBack} disabled={pending}>
        ← Back
      </button>
      <button
        type="submit"
        name="verdict"
        value="approved"
        className="hc-btn hc-btn-success"
        disabled={pending || !canSubmit || !canApprove}
      >
        {pending && pendingVerdict === "approved" ? "Approving…" : "Approve"}
      </button>
      <button
        type="submit"
        name="verdict"
        value="changes_requested"
        className="hc-btn"
        disabled={pending || !canSubmit}
      >
        {pending && pendingVerdict === "changes_requested" ? "Sending…" : "Request changes"}
      </button>
    </div>
  );
}

function StepPill({
  number,
  label,
  active,
  disabled,
  onClick,
}: {
  number: number;
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="hc-step"
      data-active={active ? true : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      {number}. {label}
    </button>
  );
}

export default function ReviewPassForm({
  pass,
  action,
  checks,
  summary,
  initialTechnical = "",
  initialAdditional = "",
  initialFeedback = "",
  initialChecks = [],
  initialSavedAt = null,
  initialSavedBy = null,
  autosave,
}: {
  pass: "first" | "second";
  action: (formData: FormData) => void;
  checks: { key: string; label: string }[];
  summary?: ReactNode;
  initialTechnical?: string;
  initialAdditional?: string;
  initialFeedback?: string;
  initialChecks?: string[];
  initialSavedAt?: string | null;
  initialSavedBy?: string | null;
  autosave: (draft: DraftInput) => Promise<DraftResult>;
}) {
  const [step, setStep] = useState(1);
  const [technical, setTechnical] = useState(initialTechnical);
  const [additional, setAdditional] = useState(initialAdditional);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [checked, setChecked] = useState<string[]>(initialChecks);
  const [saveStatus, setSaveStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [savedAt, setSavedAt] = useState<string | null>(initialSavedAt);
  const [savedBy, setSavedBy] = useState<string | null>(initialSavedBy);

  const lastSavedRef = useRef(
    JSON.stringify({
      technicalNotes: initialTechnical,
      additionalNotes: initialAdditional,
      feedback: initialFeedback,
      checks: initialChecks,
    }),
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittedRef = useRef(false);
  const latestRef = useRef<DraftInput>({
    technicalNotes: initialTechnical,
    additionalNotes: initialAdditional,
    feedback: initialFeedback,
    checks: initialChecks,
  });

  const saveNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (submittedRef.current) {
      return;
    }

    const draft = latestRef.current;
    const serialized = JSON.stringify(draft);
    if (serialized === lastSavedRef.current) {
      setSaveStatus("saved");
      return;
    }

    setSaveStatus("saving");
    try {
      const result = await autosave(draft);
      if (result.ok) {
        lastSavedRef.current = serialized;
        setSavedAt(result.savedAt);
        setSavedBy("you");
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  }, [autosave]);

  useEffect(() => {
    const draft = {
      technicalNotes: technical,
      additionalNotes: additional,
      feedback,
      checks: checked,
    };
    latestRef.current = draft;

    if (submittedRef.current || JSON.stringify(draft) === lastSavedRef.current) {
      return;
    }

    setSaveStatus("pending");
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      saveNow();
    }, AUTOSAVE_DELAY_MS);
  }, [technical, additional, feedback, checked, saveNow]);

  useEffect(() => {
    function flush() {
      if (timerRef.current) {
        saveNow();
      }
    }
    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        flush();
      }
    }

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [saveNow]);

  const auditDone =
    technical.trim().length >= MIN_AUDIT_LENGTH && additional.trim().length >= MIN_AUDIT_LENGTH;
  const feedbackDone = feedback.trim().length >= MIN_FEEDBACK_LENGTH;
  const allChecked = checked.length === checks.length;

  function toggleCheck(key: string) {
    if (checked.includes(key)) {
      setChecked(checked.filter((item) => item !== key));
    } else {
      setChecked([...checked, key]);
    }
  }

  return (
    <form
      action={action}
      onSubmit={() => {
        submittedRef.current = true;
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex justify-end">
        <SaveStatus status={saveStatus} savedAt={savedAt} savedBy={savedBy} />
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <StepPill number={1} label="Submission" active={step === 1} disabled={false} onClick={() => setStep(1)} />
        <span className="hc-muted">→</span>
        <StepPill number={2} label="Audit notes" active={step === 2} disabled={false} onClick={() => setStep(2)} />
        <span className="hc-muted">→</span>
        <StepPill number={3} label="Verdict" active={step === 3} disabled={!auditDone} onClick={() => setStep(3)} />
      </div>

      <div hidden={step !== 1} className="flex flex-col gap-4">
        {summary}

        {checks.length > 0 && (
          <div className="hc-panel flex flex-col gap-2">
            <p className="hc-eyebrow">Checks · {checked.length}/{checks.length}</p>
            {checks.map((check) => (
              <label key={check.key} className="hc-check">
                <input
                  type="checkbox"
                  name="checks"
                  value={check.key}
                  checked={checked.includes(check.key)}
                  onChange={() => toggleCheck(check.key)}
                />
                <span>{check.label}</span>
              </label>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <button type="button" className="hc-btn" onClick={() => setStep(2)}>
            Next: Audit notes →
          </button>
        </div>
      </div>

      <div hidden={step !== 2} className="flex flex-col gap-4">
        <p className="hc-eyebrow">
          Internal audit note, never shown to the user. Someone who wasn&apos;t involved should
          reach the same conclusion you did.
        </p>

        <label className="hc-label">
          Technical features
          <span className="hc-label-hint">
            What the project is and does, in specific terms, so it&apos;s clear you checked it.
          </span>
          <textarea
            name="technical_notes"
            rows={5}
            value={technical}
            onChange={(event) => setTechnical(event.target.value)}
            className="hc-textarea"
            placeholder="The demo is a weather dashboard served by an ESP32. It shows live temperature, humidity and pressure..."
          />
          <span className="hc-counter" data-done={technical.trim().length >= MIN_AUDIT_LENGTH ? true : undefined}>
            {technical.trim().length}/{MIN_AUDIT_LENGTH}
          </span>
        </label>

        <label className="hc-label">
          Additional notes
          <span className="hc-label-hint">
            Your thinking: the user&apos;s level, commit history, Hackatime, anything that supports the verdict.
          </span>
          <textarea
            name="additional_notes"
            rows={5}
            value={additional}
            onChange={(event) => setAdditional(event.target.value)}
            className="hc-textarea"
            placeholder="38 commits over 2 weeks showing steady progress. Hackatime matches the repo..."
          />
          <span className="hc-counter" data-done={additional.trim().length >= MIN_AUDIT_LENGTH ? true : undefined}>
            {additional.trim().length}/{MIN_AUDIT_LENGTH}
          </span>
        </label>

        <div className="flex justify-between">
          <button type="button" className="hc-btn hc-btn-outline" onClick={() => setStep(1)}>
            ← Back
          </button>
          <button type="button" className="hc-btn" disabled={!auditDone} onClick={() => setStep(3)}>
            Next: Verdict →
          </button>
        </div>
      </div>

      <div hidden={step !== 3} className="flex flex-col gap-4">
        <label className="hc-label">
          Note to the user
          <span className="hc-label-hint">
            Required. Be nice and personal, show you looked at their work.
          </span>
          <textarea
            name="feedback"
            rows={4}
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            className="hc-textarea"
            placeholder="Love the 3D-printed case! The live graph is a really nice touch. Keep it up!"
          />
          <span className="hc-counter" data-done={feedbackDone ? true : undefined}>
            {feedback.trim().length}/{MIN_FEEDBACK_LENGTH}
          </span>
        </label>

        {pass === "second" && !allChecked && (
          <p className="hc-caption text-sm">Tick every check in step 1 to approve.</p>
        )}

        <VerdictButtons
          canApprove={pass === "first" || allChecked}
          canSubmit={auditDone && feedbackDone}
          onBack={() => setStep(2)}
        />
      </div>
    </form>
  );
}
