"use client";

import { useActionState, useState } from "react";
import { readSentence, saveStatus, type ExtractResult } from "@/app/nurse/action";
import { STATUSES, LOCATIONS, BED_TYPES, NEEDS_BED_TYPE } from "@/lib/option";

// Type mode: the nurse types one sentence, the AI fills the fields,
// the nurse checks them and taps Confirm. Nothing is saved before that tap.
export function TypeForm({ patientId }: { patientId: string }) {
  const [sentence, setSentence] = useState("");
  const [reading, setReading] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  // The sentence the card was made from (the box may be edited afterwards)
  const [readText, setReadText] = useState("");

  async function read(e: React.FormEvent) {
    e.preventDefault();
    if (!sentence.trim() || reading) return;
    setReading(true);
    setResult(null);
    const text = sentence.trim();
    setResult(await readSentence(patientId, text));
    setReadText(text);
    setReading(false);
  }

  return (
    <section>
      <h2>Type it instead</h2>
      <form onSubmit={read}>
        <textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="e.g. waiting ICU bed, in observation, family asked about BPJS"
          aria-label="What happened, in one sentence"
        />
        <button type="submit" disabled={reading || !sentence.trim()}>
          {reading ? "Reading..." : "Read sentence"}
        </button>
      </form>

      {result && !result.ok && <p>{result.error}</p>}
      {result?.ok && (
        // key: a new reading resets the card's fields
        <ConfirmCard key={JSON.stringify(result.raw) + readText} patientId={patientId} sentence={readText} result={result} />
      )}
    </section>
  );
}

function ConfirmCard({
  patientId,
  sentence,
  result,
}: {
  patientId: string;
  sentence: string;
  result: Extract<ExtractResult, { ok: true }>;
}) {
  const [state, formAction, pending] = useActionState(saveStatus, null);
  const { card, raw } = result;
  const [status, setStatus] = useState(card.status ?? "");
  const check = (f: string) => (card.unsure.includes(f) ? " (check this)" : "");

  return (
    <form action={formAction}>
      <p>Check before saving. Nothing is saved until you tap Confirm.</p>
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="source" value="typed" />
      <input type="hidden" name="raw_transcript" value={sentence} />
      <input type="hidden" name="llm_output" value={JSON.stringify(raw)} />

      <label>
        Status{check("status")}
        <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} required>
          <option value="">- pick one -</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>

      {NEEDS_BED_TYPE.includes(status) && (
        <label>
          Bed type{check("bed_type")}
          <select name="bed_type" defaultValue={card.bed_type ?? ""} required>
            <option value="">- pick one -</option>
            {BED_TYPES.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </label>
      )}

      <label>
        Location{check("location")}
        <select name="location" defaultValue={card.location ?? ""}>
          <option value="">-</option>
          {LOCATIONS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      </label>

      <label>
        Note (staff only){check("note")}
        <input name="notes" defaultValue={card.note ?? ""} maxLength={500} />
      </label>

      {state?.error && <p>{state.error}</p>}
      <button type="submit" disabled={pending || !status}>
        {pending ? "Saving..." : "Confirm"}
      </button>
    </form>
  );
}
