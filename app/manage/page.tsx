import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/action";
import { minutesSince } from "@/lib/time";
import { duration, FINAL_STATUSES, STALE_MINUTES } from "@/lib/label";
import { BED_TYPES, word } from "@/lib/option";

// Read-only overview for management. Nurses can open it too (RLS lets every worker read).
const LONG_WAIT_MINUTES = 4 * 60;

type CurrentRow = {
  patient_id: string;
  status: string;
  bed_type: string | null;
  last_updated: string;
  minutes_waiting_for_bed: number | null;
  patients: { name: string } | null;
};

type UpdateRow = { patient_id: string; status: string; created_at: string };

export default function ManagePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-semibold">ER overview</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <Overview />
      </Suspense>
      <form action={logout}>
        <button type="submit" className="text-sm underline">Log out</button>
      </form>
    </main>
  );
}

async function Overview() {
  await connection();
  const supabase = await createClient();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: rows } = await supabase
    .from("patient_current")
    .select("patient_id, status, bed_type, last_updated, minutes_waiting_for_bed, patients(name)")
    .overrideTypes<CurrentRow[], { merge: false }>();

  const active = (rows ?? []).filter((r) => !FINAL_STATUSES.includes(r.status));
  const waiting = active
    .filter((r) => r.status === "waiting_bed" && r.minutes_waiting_for_bed != null)
    .sort((a, b) => b.minutes_waiting_for_bed! - a.minutes_waiting_for_bed!);
  const stale = active
    .filter((r) => (minutesSince(r.last_updated) ?? 0) > STALE_MINUTES)
    .sort((a, b) => a.last_updated.localeCompare(b.last_updated));

  // Boarding time = first "waiting_bed" -> "moved_inpatient", per patient who has both.
  // Supabase returns at most 1000 rows by default: fine for the demo (165 rows on Nov 28).
  const { data: updates } = await supabase
    .from("status_updates")
    .select("patient_id, status, created_at")
    .in("status", ["waiting_bed", "moved_inpatient"])
    .order("created_at", { ascending: true })
    .overrideTypes<UpdateRow[], { merge: false }>();
  const boarding = boardingMinutes(updates ?? []);
  const avgBoarding = boarding.length
    ? Math.round(boarding.reduce((sum, m) => sum + m, 0) / boarding.length)
    : null;

  return (
    <>
      <p className="text-sm">{active.length} patients in the ER now.</p>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Waiting for a bed</h2>
        <div className="grid grid-cols-3 gap-2">
          {BED_TYPES.map((bed) => (
            <div key={bed} className="rounded-lg border border-neutral-400 p-3 text-center">
              <div className="text-3xl font-semibold">{waiting.filter((r) => r.bed_type === bed).length}</div>
              <div className="text-sm uppercase">{bed}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Average boarding time</h2>
        <p>
          {avgBoarding == null
            ? "Not enough data yet (no patient has moved to a ward)."
            : `${duration(avgBoarding, "en")} from "waiting bed" to "moved to ward", over ${boarding.length} patients.`}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Longest bed waits</h2>
        {waiting.length === 0 ? (
          <p>No one is waiting for a bed.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {waiting.slice(0, 10).map((r) => {
              const mins = Math.round(r.minutes_waiting_for_bed!);
              return (
                <li key={r.patient_id} className="flex justify-between gap-2 border-b border-neutral-700 py-1">
                  <span>
                    {r.patients?.name} · <span className="uppercase">{r.bed_type}</span>
                  </span>
                  <span>
                    {duration(mins, "en")}
                    {mins > LONG_WAIT_MINUTES && <b className="ml-2 rounded bg-red-100 px-1 text-red-900">over 4 h</b>}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Stale updates (over {STALE_MINUTES} min): {stale.length}</h2>
        {stale.length > 0 && (
          <ul className="flex flex-col gap-1 text-sm">
            {stale.slice(0, 10).map((r) => (
              <li key={r.patient_id}>
                {r.patients?.name} · {word(r.status)} · {duration(minutesSince(r.last_updated) ?? 0, "en")} ago
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

// Rows come oldest first, so the first waiting_bed per patient is the start.
function boardingMinutes(updates: UpdateRow[]): number[] {
  const start = new Map<string, number>();
  const result: number[] = [];
  for (const u of updates) {
    const t = new Date(u.created_at).getTime();
    if (u.status === "waiting_bed" && !start.has(u.patient_id)) start.set(u.patient_id, t);
    if (u.status === "moved_inpatient" && start.has(u.patient_id)) {
      result.push(Math.round((t - start.get(u.patient_id)!) / 60000));
      start.delete(u.patient_id);
    }
  }
  return result;
}
