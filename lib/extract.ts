import "server-only";
import { generateJson } from "@/lib/gemini";
import { STATUSES, LOCATIONS, BED_TYPES, NEEDS_BED_TYPE } from "@/lib/option";

// Type mode: one nurse sentence -> status fields. Same prompt, settings and
// schema as scripts/extract-experiment.mjs, so its results describe the app.

export type Current = { status: string | null; bed_type: string | null; location: string | null };

export type Extracted = {
  status: string | null;
  bed_type: string | null;
  location: string | null;
  note: string | null;
  unsure: string[];
};

const nullableEnum = (values: string[]) => ({ type: ["string", "null"], enum: [...values, null] });
const responseSchema = {
  type: "object",
  properties: {
    status: nullableEnum(STATUSES),
    bed_type: nullableEnum(BED_TYPES),
    location: nullableEnum(LOCATIONS),
    note: { type: ["string", "null"] },
    unsure: { type: "array", items: { type: "string", enum: ["status", "bed_type", "location", "note"] } },
  },
  required: ["status", "bed_type", "location", "note", "unsure"],
};

// Returns the raw model output (saved as llm_output, to measure accuracy later)
// and the values to show on the confirm card. Null when the model didn't answer.
export async function extractStatus(current: Current, sentence: string) {
  const raw = await generateJson<Extracted>(
    "extract",
    `CURRENT:\n${JSON.stringify(current)}\n\n` + `SENTENCE:\n<sentence>${sentence}</sentence>`,
    responseSchema,
  );
  if (!raw) return null;

  const status = raw.status;
  const needsBed = status !== null && NEEDS_BED_TYPE.includes(status);
  const card: Extracted = {
    status,
    // Bed type only where the database needs it; else keep the current one if it has one.
    bed_type: needsBed ? (raw.bed_type ?? current.bed_type) : null,
    // Not stated = stays where they are.
    location: raw.location ?? current.location,
    note: raw.note,
    unsure: needsBed && !(raw.bed_type ?? current.bed_type) ? [...new Set([...raw.unsure, "bed_type"])] : raw.unsure,
  };
  return { raw, card };
}
