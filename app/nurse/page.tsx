import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/action";
import { minutesSince } from "@/lib/time";

type PatientRow = {
  patient_id: string;
  status: string;
  location: string | null;
  last_updated: string;
  patients: { name: string } | null;
};

export default function NursePage() {
  return (
    <main>
      <h1>Nurse dashboard</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <Greeting />
      </Suspense>

      <Suspense fallback={<p>Loading patients...</p>}>
        <PatientList />
      </Suspense>

      <form action={logout}>
        <button type="submit">Log out</button>
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

  return (
    <ul>
      {patients.map((p) => (
        <li key={p.patient_id}>
          {p.patients?.name} · {p.status} · {minutesSince(p.last_updated)} min ago
        </li>
      ))}
    </ul>
  );
}