"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  /** Called when the user commits a change. Throw or return rejected promise to surface an error. */
  onSave: (next: string) => Promise<void> | void;
  /** Render mode for the read-only view; controls editor element used. */
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  /** Classes for the read-only / static container. */
  className?: string;
  /** Classes for the input/textarea while editing. */
  editClassName?: string;
  /** Disables click-to-edit. */
  disabled?: boolean;
  /** aria-label for the edit field. */
  ariaLabel?: string;
}

/**
 * Click-to-edit text. Click the text to enter edit mode, blur or Cmd/Ctrl+Enter
 * to save, Escape to cancel. Shows a tiny "Saving…" / "Failed" indicator
 * while a save is in flight or after a failure.
 */
export function EditableText({
  value,
  onSave,
  multiline = false,
  maxLength,
  placeholder = "Click to edit",
  className = "",
  editClassName = "",
  disabled = false,
  ariaLabel,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Sync external value changes back into draft when not editing.
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      const el = inputRef.current;
      el.focus();
      // Place caret at end rather than selecting all — feels less destructive.
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        // ignore — some browsers don't allow on certain types
      }
    }
  }, [editing]);

  async function commit() {
    if (!editing) return;
    const next = draft.trim();
    if (next === value.trim()) {
      setEditing(false);
      setError(null);
      return;
    }
    if (next.length === 0) {
      setError("Can't be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
    setError(null);
  }

  function onKeyDown(
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
      return;
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      commit();
      return;
    }
    // Plain Enter saves for single-line inputs; multiline allows newlines.
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      commit();
    }
  }

  if (editing) {
    const sharedProps = {
      ref: inputRef as React.MutableRefObject<HTMLInputElement & HTMLTextAreaElement>,
      value: draft,
      maxLength,
      onChange: (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
      ) => setDraft(e.target.value),
      onBlur: () => commit(),
      onKeyDown,
      "aria-label": ariaLabel,
      disabled: saving,
      className:
        "w-full resize-none rounded-md border border-accent/60 bg-surface px-2 py-1 outline-none ring-2 ring-accent/20 focus:border-accent focus:ring-accent/30 disabled:opacity-60 " +
        editClassName,
    };
    return (
      <div className="relative">
        {multiline ? (
          <textarea {...sharedProps} rows={Math.min(6, Math.max(2, draft.split("\n").length + 1))} />
        ) : (
          <input type="text" {...sharedProps} />
        )}
        <div className="mt-1 flex items-center justify-between text-[11px]">
          <span className={error ? "text-red-600" : "text-ink-faint"}>
            {error
              ? error
              : saving
              ? "Saving…"
              : multiline
              ? "⌘+Enter to save · Esc to cancel"
              : "Enter to save · Esc to cancel"}
          </span>
          {maxLength && (
            <span className="font-mono text-ink-faint">
              {draft.length}/{maxLength}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <span
      role={disabled ? undefined : "button"}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && setEditing(true)}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      title={disabled ? undefined : "Click to edit"}
      className={
        (disabled
          ? ""
          : "cursor-text rounded-[3px] outline-none transition-colors hover:bg-accent-soft/40 focus-visible:bg-accent-soft/60 focus-visible:ring-2 focus-visible:ring-accent/40 ") +
        className
      }
    >
      {value || (
        <span className="text-ink-faint">{placeholder}</span>
      )}
    </span>
  );
}
