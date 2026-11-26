import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import { admin } from "@/lib/supabase/admin";
import type { TrackInfo } from "@/lib/track";

// Same prompt, settings and output shape as scripts/chatbot-experiment.mjs,
// so the test results there describe what the app does.

type Config = {
  model: string;
  fallbackModel: string;
  temperature: number;
  timeoutMs: number;
  retryDelayMs: number;
};

export type ChatAnswer = {
  action: "answer" | "refuse" | "escalate";
  reply: string;
  // Sources shown under the reply
  usedStatus: boolean;
  statusMinutesAgo: number | null;
  faq: { id: string; question: string }[];
};

type ModelOutput = {
  action: ChatAnswer["action"];
  reply_language: "en" | "id";
  reply: string;
  used_status: boolean;
  faq_ids: string[];
};

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

// The prompt files don't change while the server runs: read them once.
let promptFiles: Promise<{ systemPrompt: string; config: Config }> | null = null;
function loadPrompt() {
  promptFiles ??= Promise.all([
    readFile(path.join(process.cwd(), "prompts/chatbot.md"), "utf8"),
    readFile(path.join(process.cwd(), "prompts/chatbot.config.json"), "utf8"),
  ]).then(([systemPrompt, config]) => ({ systemPrompt, config: JSON.parse(config) as Config }));
  return promptFiles;
}

// Placeholder until the wait-time feature: the assumption range only, no queue position yet.
async function waitEstimate(info: TrackInfo): Promise<string | null> {
  if (info.status !== "waiting_bed" || !info.bedType) return null;
  const { data } = await admin
    .from("wait_assumptions")
    .select("min_minutes, max_minutes")
    .eq("bed_type", info.bedType)
    .maybeSingle();
  if (!data) return null;
  return `${data.min_minutes}-${data.max_minutes} minutes (assumption, not measured)`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Returns null when no model answered (free tier overloaded): the page then
// tells the family to ask at the ER desk.
export async function askChatbot(info: TrackInfo, question: string): Promise<ChatAnswer | null> {
  const { systemPrompt, config } = await loadPrompt();

  const { data: faq, error } = await admin.from("faq").select("id, topic, language, question, answer");
  if (error || !faq) return null;

  // Only what the family may see: no name, no location, no notes.
  const status = {
    status: info.status,
    bed_type: info.bedType,
    updated_minutes_ago: info.minutesSinceUpdate,
    wait_estimate: await waitEstimate(info),
  };
  const faqForModel = faq.map(({ id, topic, language, answer }) => ({ id, topic, language, answer }));

  const userText =
    `STATUS:\n${JSON.stringify(status)}\n\n` +
    `FAQ:\n${JSON.stringify(faqForModel)}\n\n` +
    `QUESTION:\n<question>${question}</question>`;

  // Main model, the same again after a short wait (503s pass quickly), then the fallback.
  const attempts = [config.model, config.model, config.fallbackModel];
  for (const [i, model] of attempts.entries()) {
    if (i === 1) await sleep(config.retryDelayMs);
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
      const out = JSON.parse(res.text ?? "") as ModelOutput;
      return {
        action: out.action,
        reply: out.reply,
        usedStatus: out.used_status,
        statusMinutesAgo: info.minutesSinceUpdate,
        // Keep only ids that really exist, so a made-up id never shows as a source.
        faq: faq
          .filter((row) => out.faq_ids.includes(row.id))
          .map((row) => ({ id: row.id, question: row.question })),
      };
    } catch (e) {
      console.error(`chatbot: ${model} failed:`, e instanceof Error ? e.message.slice(0, 200) : e);
    }
  }
  return null;
}
