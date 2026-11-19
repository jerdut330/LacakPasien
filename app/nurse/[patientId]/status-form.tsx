"use client";

import { useActionState } from "react";
import { saveStatus } from "@/app/nurse/action";
import { STATUSES, LOCATIONS, BED_TYPES } from "@/lib/option";

type Props = {
  patientId: string;
  currentLocation: string | null;
  currentBedType: string | null;
};

export function StatusForm({ patientId, currentLocation, currentBedType }: Props) {
  const [state, formAction, pending] = useActionState(saveStatus, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="patient_id" value={patientId} />

      <label>
        Location
        <select name="location" defaultValue={currentLocation ?? ""}>
          <option value="">-</option>
          {LOCATIONS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </label>

      <label>
        Bed type
        <select name="bed_type" defaultValue={currentBedType ?? ""}>
          <option value="">-</option>
          {BED_TYPES.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </label>

      {state?.error && <p>{state.error}</p>}

      <div>
        {STATUSES.map((s) => (
          <button key={s} type="submit" name="status" value={s} disabled={pending}>
            {s}
          </button>
        ))}
      </div>
    </form>
  );
}