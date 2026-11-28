import "server-only";
import { admin } from "@/lib/supabase/admin";

// Saves a "needs a human" alert for the patient behind this QR token.
// Call only after getTrackInfo(token) said the token is valid.
// The patient id stays on the server: it is never sent to the family page.
export async function saveEscalation(token: string, question: string, reply: string) {
  const { data: patient } = await admin
    .from("patients")
    .select("id")
    .eq("qr_token", token)
    .maybeSingle();
  if (!patient) return;

  const { error } = await admin
    .from("escalations")
    .insert({ patient_id: patient.id, question, reply });
  if (error) console.error("escalation insert failed", error);
}
