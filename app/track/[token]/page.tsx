import { Suspense } from "react";
import { connection } from "next/server";
import { getTrackInfo } from "@/lib/track";
import { getWaitEstimate, describeWait } from "@/lib/wait";
import { ChatBox } from "./chat-box";

export default function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <main>
      <h1>LacakPasien</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <PatientStatus params={params} />
      </Suspense>
    </main>
  );
}

async function PatientStatus({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const info = await getTrackInfo(token);

  if (!info) {
    return <p>This link isn’t working. Please ask the ER front desk for a new QR code.</p>;
  }
  const wait = await getWaitEstimate(info.status, info.bedType, info.minutesWaitingForBed);



  return (
    <section>
      <p>Patient: {info.firstName}</p>
      <p>Status: {info.status ?? "No update yet"}</p>
      <p>Location: {info.location ?? "-"}</p>
      <p>Last updated: {info.minutesSinceUpdate === null ? "-" : `${info.minutesSinceUpdate} min ago`}</p>
      {info.status === "waiting_bed" && (
        <p>
          Estimated wait for a bed: {describeWait(wait) ?? "No estimate available."}{" "}
          <small>(The hours are assumptions, not measured data.)</small>
        </p>
      )}
      <ChatBox token={token} />
    </section>
  );
}