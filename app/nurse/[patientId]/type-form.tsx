"use client";

import { useActionState, useState } from "react";
import { readSentence, saveStatus, type ExtractResult } from "@/app/nurse/action";
import { STATUSES, LOCATIONS, BED_TYPES, NEEDS_BED_TYPE, word } from "@/lib/option";

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
    <section className="flex flex-col gap-2 rounded-xl border border-neutral-400 p-3">
      <h2 className="font-semibold">Type it instead</h2>
      <form onSubmit={read} className="flex flex-col gap-2">
        <textarea
          value={sentence}
          onChange={(e) => setSentence(e.target.value)}
          maxLength={500}
          rows={2}
          placeholder="e.g. waiting ICU bed, in observation, family asked about BPJS"
          aria-label="What happened, in one sentence"
          className="rounded-lg border border-neutral-400 bg-transparent p-2"
        />
        <button type="submit" disabled={reading || !sentence.trim()} className="rounded-lg border border-foreground px-3 py-2 disabled:opacity-40">
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
    <form action={formAction} className="flex flex-col gap-2 [&_label]:flex [&_label]:flex-col [&_label]:text-sm [&_select]:rounded-lg [&_select]:border [&_select]:bg-transparent [&_select]:p-2 [&_input]:rounded-lg [&_input]:border [&_input]:bg-transparent [&_input]:p-2">
      <p className="text-sm">Check before saving. Nothing is saved until you tap Confirm.</p>
      <input type="hidden" name="patient_id" value={patientId} />
      <input type="hidden" name="source" value="typed" />
      <input type="hidden" name="raw_transcript" value={sentence} />
      <input type="hidden" name="llm_output" value={JSON.stringify(raw)} />

      <label>
        Status{check("status")}
        <select name="status" value={status} onChange={(e) => setStatus(e.target.value)} required>
          <option value="">- pick one -</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{word(s)}</option>
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
            <option key={l} value={l}>{word(l)}</option>
          ))}
        </select>
      </label>

      <label>
        Note (staff only){check("note")}
        <input name="notes" defaultValue={card.note ?? ""} maxLength={500} />
      </label>

      {state?.error && <p>{state.error}</p>}
      <button type="submit" disabled={pending || !status} className="rounded-lg bg-foreground px-3 py-3 font-medium text-background disabled:opacity-40">
        {pending ? "Saving..." : "Confirm"}
      </button>
    </form>
  );
}
