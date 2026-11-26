import "server-only";
import { admin } from "@/lib/supabase/admin";
import { generateJson } from "@/lib/gemini";
import { waitText, ago } from "@/lib/label";
import type { TrackInfo } from "@/lib/track";

// Same prompt, settings and output shape as scripts/chatbot-experiment.mjs,
// so the test results there describe what the app does.

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

// Returns null when no model answered (free tier overloaded): the page then
// tells the family to ask at the ER desk.
export async function askChatbot(info: TrackInfo, question: string): Promise<ChatAnswer | null> {
  const { data: faq, error } = await admin.from("faq").select("id, topic, language, question, answer");
  if (error || !faq) return null;

  // Only what the family may see: no name, no location, no notes.
  const status = {
    status: info.status,
    bed_type: info.bedType,
    // Ready-made text in both languages: the model copies instead of doing time maths or translating.
    updated_ago:
      info.minutesSinceUpdate === null
        ? null
        : { en: ago(info.minutesSinceUpdate, "en"), id: ago(info.minutesSinceUpdate, "id") },
    // Worked out by plain code (lib/wait.ts); the model only explains it.
    wait_estimate: info.wait ? { en: waitText(info.wait, "en"), id: waitText(info.wait, "id") } : null,
  };
  const faqForModel = faq.map(({ id, topic, language, answer }) => ({ id, topic, language, answer }));

  const out = await generateJson<ModelOutput>(
    "chatbot",
    `STATUS:\n${JSON.stringify(status)}\n\n` +
      `FAQ:\n${JSON.stringify(faqForModel)}\n\n` +
      `QUESTION:\n<question>${question}</question>`,
    responseSchema,
  );
  if (!out) return null;

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
}
