import "server-only";
import { admin } from "@/lib/supabase/admin";

export type TrackInfo = {
  firstName: string;
  status: string | null;
  bedType: string | null;
  location: string | null;
  lastUpdated: string | null;
  minutesWaitingForBed: number | null;
  minutesSinceUpdate: number | null;
};

export async function getTrackInfo(token: string): Promise<TrackInfo | null> {
  // 1. Find the patient by their QR token
  const { data: patient } = await admin
    .from("patients")
    .select("id, name, token_expires_at")
    .eq("qr_token", token)
    .maybeSingle();

  if (!patient) return null;

  // 2. Expired? (token_expires_at is empty while the patient is still in the ER)
  if (patient.token_expires_at && new Date(patient.token_expires_at) < new Date()) {
    return null;
  }

  // 3. Get their latest status
  const { data: current } = await admin 
    .from("patient_current")
    .select("status, bed_type, location, last_updated, minutes_waiting_for_bed")
    .eq("patient_id", patient.id)
    .maybeSingle();

  // 4. Hand back ONLY the safe fields
  return {
    firstName: patient.name.split(" ")[0],
    status: current?.status ?? null,
    bedType: current?.bed_type ?? null,
    location: current?.location ?? null,
    lastUpdated: current?.last_updated ?? null,
    minutesWaitingForBed: current?.minutes_waiting_for_bed ?? null,
    minutesSinceUpdate: current?.last_updated
      ? Math.round((Date.now() - new Date(current.last_updated).getTime()) / 60000)
      : null,
  };
}