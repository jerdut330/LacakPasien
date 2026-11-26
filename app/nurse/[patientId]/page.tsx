import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusForm } from "./status-form";
import { TypeForm } from "./type-form";
import { word } from "@/lib/option";

type PatientDetailRow = {
  patient_id: string;
  status: string;
  location: string | null;
  bed_type: string | null;
  patients: { name: string; qr_token: string } | null;
};

export default function PatientPage({ params }: { params: Promise<{ patientId: string }> }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      <Link href="/nurse" className="text-sm underline">← Back to list</Link>
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
    .select("patient_id, status, location, bed_type, patients(name, qr_token)")
    .eq("patient_id", patientId)
    .maybeSingle()
    .overrideTypes<PatientDetailRow, { merge: false }>();

  if (!patient) notFound();

  // Family link from the address this page was opened on, so it works on localhost and when deployed.
  const h = await headers();
  const familyUrl = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}/track/${patient.patients?.qr_token}`;
  const qrSvg = await QRCode.toString(familyUrl, { type: "svg", margin: 1 });

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{patient.patients?.name}</h1>
        <p>
          Now: <b>{word(patient.status)}</b>
          {patient.bed_type && ` · ${patient.bed_type.toUpperCase()} bed`}
          {patient.location && ` · ${word(patient.location)}`}
        </p>
      </div>
      <StatusForm
        patientId={patient.patient_id}
        currentStatus={patient.status}
        currentLocation={patient.location}
        currentBedType={patient.bed_type}
      />
      <TypeForm patientId={patient.patient_id} />
      <details className="rounded-xl border border-neutral-400 p-3">
        <summary>Family link (QR code)</summary>
        {/* SVG made by the qrcode package from our own URL, not from user input */}
        <div
          className="w-48 bg-white"
          role="img"
          aria-label="QR code for the family page"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <p className="break-all text-sm">{familyUrl}</p>
      </details>
    </section>
  );
}