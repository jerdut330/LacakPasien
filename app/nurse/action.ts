"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUSES, NEEDS_BED_TYPE } from "@/lib/option";
import { extractStatus, type Extracted } from "@/lib/extract";

export type SaveState = { error: string } | null;

// Reads one form field; an empty choice becomes null
function field(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export async function saveStatus(prevState: SaveState, formData: FormData): Promise<SaveState> {
  const patientId = field(formData, "patient_id");
  const status = field(formData, "status");
  const location = field(formData, "location");
  const bedType = field(formData, "bed_type");
  const notes = field(formData, "notes");
  // Type mode sends these; tap mode doesn't
  const source = field(formData, "source") ?? "manual";
  const rawTranscript = field(formData, "raw_transcript");
  const llmOutput = field(formData, "llm_output");

  // 1. Never trust the browser: check the values
  if (!patientId || !status || !STATUSES.includes(status)) {
    return { error: "Please pick a status." };
  }
  if (NEEDS_BED_TYPE.includes(status) && !bedType) {
    return { error: "Please input the bed type" };
  }
  if (source !== "manual" && source !== "typed") {
    return { error: "Something went wrong. Please try again." };
  }
  let llmJson = null;
  if (source === "typed") {
    try {
      llmJson = JSON.parse(llmOutput ?? "");
    } catch {
      return { error: "Something went wrong. Please read the sentence again." };
    }
    if (!rawTranscript) return { error: "Something went wrong. Please read the sentence again." };
  }

  // 2. Who is saving?
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login");

  // 3. Save a NEW row (never edit old rows)
  const { error } = await supabase.from("status_updates").insert({
    patient_id: patientId,
    status,
    location,
    bed_type: bedType,
    notes,
    source,
    // Typed mode: the sentence + what the LLM extracted BEFORE the nurse edited it.
    // Comparing llm_output with the saved columns = field accuracy.
    raw_transcript: source === "typed" ? rawTranscript : null,
    llm_output: llmJson,
    updated_by: data.user.id,
  });
  if (error) return { error: "Could not save. Please try again." };

  // 4. Back to the list
  redirect("/nurse");
}

export type ExtractResult =
  | { ok: true; raw: Extracted; card: Extracted }
  | { ok: false; error: string };

// Type mode, step 1: read the sentence. Nothing is saved here.
export async function readSentence(patientId: string, sentence: string): Promise<ExtractResult> {
  const text = sentence.trim();
  if (!text || text.length > 500) return { ok: false, error: "Please type one sentence (up to 500 characters)." };

  // Logged-in worker only; RLS also hides patient_current from anyone else.
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) redirect("/login");

  const { data: current } = await supabase
    .from("patient_current")
    .select("status, bed_type, location")
    .eq("patient_id", patientId)
    .maybeSingle();
  if (!current) return { ok: false, error: "Patient not found." };

  const result = await extractStatus(current, text);
  if (!result) {
    return { ok: false, error: "The AI is busy right now. Try again in a minute, or use the buttons above." };
  }
  return { ok: true, ...result };
}
