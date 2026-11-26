import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

// Shared by the chatbot and type mode. Prompts and model settings live in
// prompts/<name>.md and prompts/<name>.config.json, not in code.

type Config = {
  model: string;
  fallbackModel: string;
  temperature: number;
  timeoutMs: number;
  retryDelayMs: number;
};

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Prompt files don't change while the server runs: read each one once.
const prompts = new Map<string, Promise<{ systemPrompt: string; config: Config }>>();
function loadPrompt(name: string) {
  let p = prompts.get(name);
  if (!p) {
    p = Promise.all([
      readFile(path.join(process.cwd(), `prompts/${name}.md`), "utf8"),
      readFile(path.join(process.cwd(), `prompts/${name}.config.json`), "utf8"),
    ]).then(([systemPrompt, config]) => ({ systemPrompt, config: JSON.parse(config) as Config }));
    prompts.set(name, p);
  }
  return p;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Asks Gemini for JSON matching `schema`. Main model, the same again after a
// short wait (free-tier 503s pass quickly), then the fallback model.
// Returns null when every attempt failed.
export async function generateJson<T>(promptName: string, userText: string, schema: object): Promise<T | null> {
  const { systemPrompt, config } = await loadPrompt(promptName);
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
          responseJsonSchema: schema,
          abortSignal: AbortSignal.timeout(config.timeoutMs),
        },
      });
      return JSON.parse(res.text ?? "") as T;
    } catch (e) {
      console.error(`${promptName}: ${model} failed:`, e instanceof Error ? e.message.slice(0, 200) : e);
    }
  }
  return null;
}
