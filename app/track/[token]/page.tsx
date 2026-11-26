import { Suspense } from "react";
import { connection } from "next/server";
import { getTrackInfo } from "@/lib/track";
import { TrackView } from "./track-view";

export default function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <main className="mx-auto w-full max-w-md p-4">
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
    return (
      <p>
        This link isn’t working. Please ask the ER front desk for a new QR code.
        <br />
        Tautan ini tidak berfungsi. Silakan minta QR code baru di meja depan IGD.
      </p>
    );
  }

  // Server renders the first status; the client view then keeps it live.
  return <TrackView token={token} initial={info} />;
}
