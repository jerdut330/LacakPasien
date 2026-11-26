import "server-only";
import { admin } from "@/lib/supabase/admin";

// Wait-time estimate for a bed. Plain code, no AI: the numbers come from
// wait_assumptions (PLACEHOLDER numbers, labelled as assumptions everywhere)
// minus the time already waited. The queue (patients ahead) is shown as
// context only; it doesn't change the numbers, because we have no data on
// how fast beds free up.

export type WaitEstimate =
  | { kind: "range"; minLeft: number; maxLeft: number; patientsAhead: number; bedType: string }
  | { kind: "longer_than_usual"; patientsAhead: number; bedType: string }
  | null; // no estimate available

export async function getWaitEstimate(
  status: string | null,
  bedType: string | null,
  minutesWaiting: number | null,
): Promise<WaitEstimate> {
  // 1. Only for patients waiting for a bed, with the data we need
  if (status !== "waiting_bed" || !bedType || minutesWaiting === null) return null;

  // 2. The assumed wait for this bed type
  const { data: a } = await admin
    .from("wait_assumptions")
    .select("min_minutes, max_minutes")
    .eq("bed_type", bedType)
    .maybeSingle();
  if (!a) return null;

  // 3. Patients ahead: waiting for the same bed type for longer than this one.
  //    +1 min margin: the view computes minutes from now(), so by the time this
  //    query runs the patient's own wait has grown a little and would count itself.
  const { count, error } = await admin
    .from("patient_current")
    .select("patient_id", { count: "exact", head: true })
    .eq("status", "waiting_bed")
    .eq("bed_type", bedType)
    .gt("minutes_waiting_for_bed", minutesWaiting + 1);
  if (error || count === null) return null;

  // 4. Past (or within an hour of) the assumed maximum: "up to 4 min more" would read
  //    like a promise, so say it's longer than usual instead of inventing a number.
  if (minutesWaiting >= a.max_minutes - 60) {
    return { kind: "longer_than_usual", patientsAhead: count, bedType };
  }

  // 5. What's left of the assumed range
  return {
    kind: "range",
    minLeft: Math.max(0, Math.round(a.min_minutes - minutesWaiting)),
    maxLeft: Math.round(a.max_minutes - minutesWaiting),
    patientsAhead: count,
    bedType,
  };
}

