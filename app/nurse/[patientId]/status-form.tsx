"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { saveStatus } from "@/app/nurse/action";
import { STATUSES, LOCATIONS, BED_TYPES, NEEDS_BED_TYPE, LIKELY_NEXT, word } from "@/lib/option";

const UNDO_MS = 5000;

type Props = {
  patientId: string;
  currentStatus: string;
  currentLocation: string | null;
  currentBedType: string | null;
};

type Choice = { status: string; bed: string | null };

// Tap mode: one tap picks a status, it saves after 5 s unless the nurse taps Undo.
// The wait happens before saving, so status_updates stays append-only (nothing is ever deleted).
export function StatusForm({ patientId, currentStatus, currentLocation, currentBedType }: Props) {
  const [state, formAction, pending] = useActionState(saveStatus, null);
  const [location, setLocation] = useState(currentLocation ?? "");
  const [choice, setChoice] = useState<Choice | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function pick(c: Choice) {
    setChoice(c);
    const fd = new FormData();
    fd.set("patient_id", patientId);
    fd.set("status", c.status);
    fd.set("location", location);
    if (c.bed) fd.set("bed_type", c.bed);
    timer.current = setTimeout(() => startTransition(() => formAction(fd)), UNDO_MS);
  }

  function undo() {
    clearTimeout(timer.current);
    setChoice(null);
  }

  // Likely next first, then "still <current>" (refreshes the time), then everything else.
  const likely = LIKELY_NEXT[currentStatus] ?? [];
  const others = STATUSES.filter((s) => !likely.includes(s) && s !== currentStatus);
  const busy = choice !== null || pending;

  function statusButton(status: string, main = false, label?: string) {
    const style = `rounded-lg border px-3 py-3 text-left disabled:opacity-40 ${
      main ? "border-foreground bg-foreground text-background font-medium" : "border-neutral-400"
    }`;
    // Bed statuses need a bed type: one button per bed type instead of an extra question.
    if (NEEDS_BED_TYPE.includes(status)) {
      return (
        <div key={status} className="flex flex-wrap items-center gap-2">
          <span className="w-full text-sm">{label ?? word(status)}:</span>
          {BED_TYPES.map((b) => (
            <button key={b} type="button" disabled={busy} onClick={() => pick({ status, bed: b })}
              className={`${style} ${b === currentBedType ? "ring-2 ring-offset-2" : ""}`}>
              {b === "ward" ? "Ward" : b.toUpperCase()}
            </button>
          ))}
        </div>
      );
    }
    return (
      <button key={status} type="button" disabled={busy} onClick={() => pick({ status, bed: null })} className={style}>
        {label ?? word(status)}
      </button>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        Location
        <select value={location} onChange={(e) => setLocation(e.target.value)} disabled={busy}
          className="rounded-lg border border-neutral-400 bg-transparent px-2 py-2">
          <option value="">-</option>
          {LOCATIONS.map((l) => (
            <option key={l} value={l}>{word(l)}</option>
          ))}
        </select>
      </label>

      {choice ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-100 p-3 text-amber-900" role="status">
          <span>
            {pending ? "Saving…" : `Saving "${word(choice.status)}${choice.bed ? ` (${choice.bed})` : ""}" in 5 seconds`}
          </span>
          {!pending && (
            <button type="button" onClick={undo} className="rounded-lg bg-amber-900 px-4 py-2 font-medium text-amber-50">
              Undo
            </button>
          )}
        </div>
      ) : null}
      {state?.error && <p className="text-red-600">{state.error}</p>}

      {likely.length > 0 && (
        <div className="grid gap-2">
          {likely.map((s) => statusButton(s, true))}
        </div>
      )}
      <div className="grid gap-2">
        {statusButton(currentStatus, false, `still ${word(currentStatus)} (update the time)`)}
      </div>

      <details>
        <summary className="cursor-pointer text-sm">Other statuses</summary>
        <div className="mt-2 grid gap-2">
          {others.map((s) => statusButton(s))}
        </div>
      </details>
    </section>
  );
}
