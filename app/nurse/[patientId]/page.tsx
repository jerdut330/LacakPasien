import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusForm } from "./status-form";
import { TypeForm } from "./type-form";

type PatientDetailRow = {
  patient_id: string;
  status: string;
  location: string | null;
  bed_type: string | null;
  patients: { name: string } | null;
};

export default function PatientPage({ params }: { params: Promise<{ patientId: string }> }) {
  return (
    <main>
      <Link href="/nurse">← Back to list</Link>
      <Suspense fallback={<p>Loading...</p>}>
        <PatientDetail params={params} />
      </Suspense>
    </main>
  );
}

async function PatientDetail({ params }: { params: Promise<{ patientId: string }> }) {
  await connection();
  const { patientId } = await params;
  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patient_current")
    .select("patient_id, status, location, bed_type, patients(name)")
    .eq("patient_id", patientId)
    .maybeSingle()
    .overrideTypes<PatientDetailRow, { merge: false }>();

  if (!patient) notFound();

  return (
    <section>
      <h1>{patient.patients?.name}</h1>
      <p>Current status: {patient.status}</p>
      <p>Location: {patient.location ?? "-"}</p>
      <p>Bed type: {patient.bed_type ?? "-"}</p>
        <StatusForm
            patientId={patient.patient_id}
            currentLocation={patient.location}
            currentBedType={patient.bed_type}
            />
      <TypeForm patientId={patient.patient_id} />
    </section>
  );
}