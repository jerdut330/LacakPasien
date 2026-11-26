// Type-mode extraction experiment: runs every sentence in tests/extraction-sentences.json
// through Gemini with prompts/extract.md and scores each field against the expected value.
//
// Run:        node --env-file=.env.local scripts/extract-experiment.mjs
// Some cases: node --env-file=.env.local scripts/extract-experiment.mjs E01 E13
//
// Scored fields: status, bed_type, location (exact match; null = "not stated").
// note: only checked for "should there be a note or not". The note text is checked by hand.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { GoogleGenAI } from "@google/genai";

const config = JSON.parse(await readFile("prompts/extract.config.json", "utf8"));
const systemPrompt = await readFile("prompts/extract.md", "utf8");
let cases = JSON.parse(await readFile("tests/extraction-sentences.json", "utf8"));

const onlyIds = process.argv.slice(2);
if (onlyIds.length) cases = cases.filter((c) => onlyIds.includes(c.id));

const STATUSES = ["registered", "in_triage", "waiting_doctor", "being_treated", "waiting_results", "waiting_bed",
  "bed_assigned", "transferring", "moved_inpatient", "discharged", "referred", "speak_to_staff"];
const BED_TYPES = ["ward", "hcu", "icu"];
const LOCATIONS = ["waiting_area", "triage", "resus", "treatment", "observation", "radiology_ct", "lab", "moving"];

const nullableEnum = (values) => ({ type: ["string", "null"], enum: [...values, null] });
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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function extract(current, sentence) {
  const userText =
    `CURRENT:\n${JSON.stringify(current)}\n\n` +
    `SENTENCE:\n<sentence>${sentence}</sentence>`;
  const errors = [];
  const attempts = [config.model, config.model, config.fallbackModel];
  for (const [i, model] of attempts.entries()) {
    if (i === 1) await sleep(config.retryDelayMs);
    const started = Date.now();
    try {
      const res = await ai.models.generateContent({
        model,
        contents: userText,
        config: {
          systemInstruction: systemPrompt,
          temperature: config.temperature,
          responseMimeType: "application/json",
          responseJsonSchema: responseSchema,
          abortSignal: AbortSignal.timeout(config.timeoutMs),
        },
      });
      return { model, attempt: i + 1, ms: Date.now() - started, errors, got: JSON.parse(res.text) };
    } catch (e) {
      errors.push(`${model}: ${e.name} ${String(e.message).slice(0, 150)}`);
    }
  }
  return { model: null, attempt: null, ms: null, errors, got: null };
}

const FIELDS = ["status", "bed_type", "location"];
const results = [];

for (const c of cases) {
  const r = await extract(c.current, c.text);
  const scored = c.score !== false;
  const fields = {};
  if (r.got) {
    fields.status = r.got.status === c.expected.status;
    fields.bed_type = r.got.bed_type === c.expected.bed_type;
    // The app keeps the current location when the model says null, so score
    // what would be saved: copying the current location is the same as null.
    fields.location = (r.got.location ?? c.current.location) === (c.expected.location ?? c.current.location);
    // A note is needed when expected. An extra short note isn't an error
    // (staff-only); note text is checked by hand.
    fields.note = !c.expected.note || Boolean(r.got.note);
  }
  results.push({ id: c.id, lang: c.lang, text: c.text, current: c.current, expected: c.expected,
    expect_unsure: c.expect_unsure, scored, got: r.got, fields, model: r.model, attempt: r.attempt, ms: r.ms, errors: r.errors });

  const mark = !r.got ? "ERROR" : Object.values(fields).every(Boolean) ? "OK   " : "DIFF ";
  const diffs = r.got
    ? Object.entries(fields).filter(([, ok]) => !ok)
        .map(([f]) => `${f}: want ${JSON.stringify(c.expected[f])} got ${JSON.stringify(f === "note" ? Boolean(r.got.note) : r.got[f])}`)
        .join("; ")
    : r.errors.at(-1);
  console.log(`${mark} ${c.id} ${c.lang.padEnd(5)} ${scored ? "" : "(not scored) "}${diffs}`);
  await sleep(config.delayMs);
}

// Field accuracy over scored cases that got an answer
const answered = results.filter((r) => r.got && r.scored);
const summary = {};
for (const f of [...FIELDS, "note"]) {
  summary[f] = `${answered.filter((r) => r.fields[f]).length}/${answered.length}`;
}
const allRight = answered.filter((r) => Object.values(r.fields).every(Boolean)).length;
const errored = results.filter((r) => !r.got).length;
console.log(`\nField accuracy: ${JSON.stringify(summary)}`);
console.log(`All fields right: ${allRight}/${answered.length} (${errored} errors, not counted)`);

await mkdir("tests/results", { recursive: true });
const file = `tests/results/extract-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
await writeFile(file, JSON.stringify({ ranAt: new Date().toISOString(), config, summary, allRight,
  answered: answered.length, errored, results }, null, 2));
console.log(`Saved ${file}`);
