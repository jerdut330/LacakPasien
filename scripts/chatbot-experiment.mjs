// Chatbot prompt experiment: runs every test case in tests/chatbot-questions.json
// through Gemini and saves the answers in tests/results/.
//
// Run:        node --env-file=.env.local scripts/chatbot-experiment.mjs
// Some cases: node --env-file=.env.local scripts/chatbot-experiment.mjs T01 F04
//
// `pass` only checks the action (answer / refuse / escalate).
// The must_include / must_not rules are checked by hand.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const config = JSON.parse(await readFile("prompts/chatbot.config.json", "utf8"));
const systemPrompt = await readFile("prompts/chatbot.md", "utf8");
let cases = JSON.parse(await readFile("tests/chatbot-questions.json", "utf8"));

const onlyIds = process.argv.slice(2);
if (onlyIds.length) cases = cases.filter((c) => onlyIds.includes(c.id));

// Script only (never in the browser), so the service role key is fine here.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const { data: faq, error: faqError } = await supabase
  .from("faq")
  .select("id, topic, language, answer");
if (faqError) throw faqError;
const { data: waits, error: waitError } = await supabase
  .from("wait_assumptions")
  .select("bed_type, min_minutes, max_minutes");
if (waitError) throw waitError;

// Same idea as the app: plain code makes the range, the LLM only explains it.
// The experiment has no queue data, so this is the assumption range only.
function waitEstimate(status) {
  if (status.status !== "waiting_bed") return null;
  const w = waits.find((row) => row.bed_type === status.bed_type);
  if (!w) return null;
  return `${w.min_minutes}-${w.max_minutes} minutes (assumption, not measured)`;
}

const responseSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: ["answer", "refuse", "escalate"] },
    // Before `reply` on purpose: the model picks the language first, then writes in it.
    reply_language: { type: "string", enum: ["en", "id"] },
    reply: { type: "string" },
    used_status: { type: "boolean" },
    faq_ids: { type: "array", items: { type: "string" } },
  },
  required: ["action", "reply_language", "reply", "used_status", "faq_ids"],
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function ask(model, userText) {
  const started = Date.now();
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
  return { text: res.text, ms: Date.now() - started };
}

// Free tier can be overloaded (503), usually only for a few seconds.
// Try the main model, wait and try it once more, then try the fallback
// (the fallback has only 20 requests a day, so it is the last resort).
async function askWithFallback(userText) {
  const errors = [];
  const attempts = [config.model, config.model, config.fallbackModel];
  for (const [i, model] of attempts.entries()) {
    if (i === 1) await sleep(config.retryDelayMs);
    try {
      return { model, attempt: i + 1, errors, ...(await ask(model, userText)) };
    } catch (e) {
      errors.push(`${model}: ${e.name} ${String(e.message).slice(0, 150)}`);
    }
  }
  return { model: null, attempt: null, errors, text: null, ms: null };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

for (const c of cases) {
  const status = {
    ...c.status,
    updated_minutes_ago: config.updatedMinutesAgo,
    wait_estimate: waitEstimate(c.status),
  };

  for (const [lang, question] of Object.entries(c.question)) {
    const userText =
      `STATUS:\n${JSON.stringify(status)}\n\n` +
      `FAQ:\n${JSON.stringify(faq)}\n\n` +
      `QUESTION:\n<question>${question}</question>`;

    const r = await askWithFallback(userText);
    let got = null;
    try {
      got = JSON.parse(r.text);
    } catch {
      // keep the raw text below so a broken answer still counts as a result
    }

    // No answer at all (overload, timeout, broken JSON) is an error, not a wrong answer.
    const pass = got ? got.action === c.expected : null;
    // Only checks the label the model picked; whether the reply text really is
    // in that language is still checked by hand. Mixed questions: either is fine.
    const langOk = got ? lang === "mixed" || got.reply_language === lang : null;
    results.push({
      id: c.id, type: c.type, lang, question,
      expected: c.expected, must_include: c.must_include, must_not: c.must_not,
      got, raw: got ? undefined : r.text,
      pass, langOk, model: r.model, attempt: r.attempt, ms: r.ms, errors: r.errors,
    });
    console.log(
      `${pass === null ? "ERROR" : pass ? "PASS " : "FAIL "} ${c.id} ${lang.padEnd(5)} expected=${c.expected} ` +
      `got=${got?.action ?? "-"} lang=${got?.reply_language ?? "-"}${langOk === false ? " (WRONG)" : ""} ` +
      `model=${r.model ?? "none"} ${r.ms ?? "-"}ms`,
    );
    await sleep(config.delayMs);
  }
}

const passed = results.filter((r) => r.pass === true).length;
const answered = results.filter((r) => r.pass !== null).length;
const errored = results.length - answered;
const langRight = results.filter((r) => r.langOk === true).length;
console.log(`\nAction correct: ${passed}/${answered} answered (${errored} errors, not counted)`);
console.log(`Reply language label correct: ${langRight}/${answered}`);

await mkdir("tests/results", { recursive: true });
const file = `tests/results/chatbot-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
await writeFile(
  file,
  JSON.stringify({ ranAt: new Date().toISOString(), config, passed, langRight, answered, errored, results }, null, 2),
);
console.log(`Saved ${file}`);
