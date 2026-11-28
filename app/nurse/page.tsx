import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/action";
import { minutesSince } from "@/lib/time";
import { ago, STALE_MINUTES } from "@/lib/label";
import { word } from "@/lib/option";
import Link from "next/link";

type PatientRow = {
  patient_id: string;
  status: string;
  location: string | null;
  last_updated: string;
  patients: { name: string } | null;
};

export default function NursePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-3 p-4">
      <h1 className="text-2xl font-semibold">Nurse dashboard</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <Greeting />
      </Suspense>

      <Suspense fallback={<p>Loading patients...</p>}>
        <PatientList />
      </Suspense>

      <form action={logout}>
        <button type="submit" className="text-sm underline">Log out</button>
        </form>
    </main>
  );
}

async function Greeting() {
    await connection();
  const supabase = await createClient();

  // 1. Who is logged in?
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  // 2. Get their name
  const { data: worker } = await supabase
    .from("workers")
    .select("name")
    .eq("id", data.user.id)
    .single();

  return <p>Hello, {worker?.name}</p>;
}

async function PatientList() {
  await connection();
  const supabase = await createClient();

  const { data: patients } = await supabase
    .from("patient_current")
    .select("patient_id, status, location, last_updated, patients(name)")
    .not("status", "in", "(moved_inpatient,discharged,referred)")
    .order("last_updated", { ascending: true })
    .overrideTypes<PatientRow[], { merge: false }>();

  if (!patients || patients.length === 0) {
    return <p>No patients in the ER right now.</p>;
  }

  // "Needs a human" alerts: family questions the chatbot escalated. One stays open
  // until a nurse saves a newer status for that patient (the table is append-only).
  const { data: escalations } = await supabase
    .from("escalations")
    .select("id, patient_id, question, created_at")
    .in("patient_id", patients.map((p) => p.patient_id))
    .order("created_at", { ascending: false });

  const byId = new Map(patients.map((p) => [p.patient_id, p]));
  const open = (escalations ?? []).filter((e) => {
    const p = byId.get(e.patient_id);
    return p && new Date(e.created_at) > new Date(p.last_updated);
  });
  const hasAlert = new Set(open.map((e) => e.patient_id));

  return (
    <>
      {open.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border-2 border-red-500 bg-red-50 p-3 text-red-950">
          <h2 className="font-semibold">Family wants to talk to staff ({open.length})</h2>
          <ul className="flex flex-col gap-2">
            {open.map((e) => (
              <li key={e.id}>
                <Link href={`/nurse/${e.patient_id}`} className="flex flex-col">
                  <span className="font-medium">
                    {byId.get(e.patient_id)?.patients?.name} · {ago(minutesSince(e.created_at) ?? 0, "en")}
                  </span>
                  <span className="text-sm">&ldquo;{e.question}&rdquo;</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="text-xs">Clears when you save a new status for the patient (&ldquo;still …&rdquo; works too).</p>
        </section>
      )}
      <PatientRows patients={patients} hasAlert={hasAlert} />
    </>
  );
}

function PatientRows({ patients, hasAlert }: { patients: PatientRow[]; hasAlert: Set<string> }) {
  return (
    <ul className="flex flex-col gap-2">
      {patients.map((p) => {
        const mins = minutesSince(p.last_updated) ?? 0;
        return (
          <li key={p.patient_id}>
            <Link href={`/nurse/${p.patient_id}`} className="flex flex-col rounded-lg border border-neutral-400 p-3">
              <span className="font-medium">{p.patients?.name}</span>
              <span className="text-sm">
                {word(p.status)} · {ago(mins, "en")}
                {mins > STALE_MINUTES && <b className="ml-2 rounded bg-amber-100 px-1 text-amber-900">stale</b>}
                {hasAlert.has(p.patient_id) && <b className="ml-2 rounded bg-red-100 px-1 text-red-900">family asking</b>}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}