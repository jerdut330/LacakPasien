import { getTrackInfo } from "@/lib/track";
import { askChatbot } from "@/lib/chatbot";
import { saveEscalation } from "@/lib/escalation";

const MAX_QUESTION_LENGTH = 500;

// The Gemini free tier allows 500 calls a day for the whole app, so each QR link
// gets a few questions only. Kept in memory: resets on restart and isn't shared
// between server instances. Good enough for the demo.
const MAX_QUESTIONS_PER_TOKEN = 20;
const questionsAsked = new Map<string, number>();

export async function POST(req: Request, ctx: RouteContext<"/track/[token]/chat">) {
  const { token } = await ctx.params;

  // Same check as the family page: unknown or expired token = no access.
  const info = await getTrackInfo(token);
  if (!info) {
    return Response.json({ error: "This link isn't working." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  if (!question || question.length > MAX_QUESTION_LENGTH) {
    return Response.json(
      { error: `Please type a question (up to ${MAX_QUESTION_LENGTH} characters).` },
      { status: 400 },
    );
  }

  const asked = questionsAsked.get(token) ?? 0;
  if (asked >= MAX_QUESTIONS_PER_TOKEN) {
    return Response.json(
      { error: "You've reached the question limit for this link. Please ask at the ER nurse station." },
      { status: 429 },
    );
  }
  questionsAsked.set(token, asked + 1);

  const answer = await askChatbot(info, question);
  if (!answer) {
    return Response.json(
      { error: "The chat is busy right now. Please try again in a minute, or ask at the ER nurse station." },
      { status: 503 },
    );
  }

  // "Needs a human": save it for the nurse page. A failed save still returns the answer.
  if (answer.action === "escalate") {
    await saveEscalation(token, question, answer.reply);
  }
  return Response.json(answer);
}
