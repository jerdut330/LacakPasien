"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { STATUSES, NEEDS_BED_TYPE } from "@/lib/option";

export type SaveState = { error: string } | null;

// Reads one form field; an empty choice becomes null
function field(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value !== "" ? value : null;
}

export async function saveStatus(prevState: SaveState, formData: FormData): Promise<SaveState> {
  const patientId = field(formData, "patient_id");
  const status = field(formData, "status");
  const location = field(formData, "location");
  const bedType = field(formData, "bed_type");

  // 1. Never trust the browser: check the values
  if (!patientId || !status || !STATUSES.includes(status)) {
    return { error: "Something went wrong. Please try again." };
  }
  if (NEEDS_BED_TYPE.includes(status) && !bedType) {
    return { error: "Please input the bed type" };
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
    source: "manual",
    updated_by: data.user.id,
  });
  if (error) return { error: "Could not save. Please try again." };

  // 4. Back to the list
  redirect("/nurse");
}