import { Suspense } from "react";
import { connection } from "next/server";
import { getTrackInfo } from "@/lib/track";
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



  return (
    <section>
      <p>Patient: {info.firstName}</p>
      <p>Status: {info.status ?? "No update yet"}</p>
      <p>Location: {info.location ?? "-"}</p>
      <p>Last updated: {info.minutesSinceUpdate === null ? "-" : `${info.minutesSinceUpdate} min ago`}</p>
      <ChatBox token={token} />
    </section>
  );
}