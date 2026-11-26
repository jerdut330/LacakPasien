"use client";

import { useState } from "react";
import type { ChatAnswer } from "@/lib/chatbot";
import { ago, type Lang } from "@/lib/label";

type Message =
  | { from: "family"; text: string }
  | { from: "bot"; answer: ChatAnswer }
  | { from: "error"; text: string };

const T = {
  title: { en: "Ask a question", id: "Ajukan pertanyaan" },
  intro: {
    en: "Answers come only from this status and the hospital FAQ. This chat can't give medical advice. You can ask in English or Bahasa Indonesia.",
    id: "Jawaban hanya berasal dari status ini dan FAQ rumah sakit. Chat ini tidak bisa memberi saran medis. Anda bisa bertanya dalam Bahasa Indonesia atau Inggris.",
  },
  placeholder: { en: "e.g. What does waiting for a bed mean?", id: "mis. Menunggu kamar itu maksudnya apa?" },
  send: { en: "Send", id: "Kirim" },
  thinking: { en: "Thinking...", id: "Sedang menjawab..." },
  sources: { en: "Sources", id: "Sumber" },
  status: { en: "Status update", id: "Pembaruan status" },
  from: { en: "from", id: "dari" },
  offline: {
    en: "Couldn't reach the chat. Please ask at the ER nurse station.",
    id: "Chat tidak bisa dihubungi. Silakan tanyakan di meja perawat IGD.",
  },
} satisfies Record<string, Record<Lang, string>>;

export function ChatBox({ token, lang }: { token: string; lang: Lang }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = question.trim();
    if (!text || sending) return;

    setMessages((m) => [...m, { from: "family", text }]);
    setQuestion("");
    setSending(true);
    try {
      const res = await fetch(`/track/${token}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();
      setMessages((m) => [
        ...m,
        res.ok ? { from: "bot", answer: data as ChatAnswer } : { from: "error", text: data.error },
      ]);
    } catch {
      setMessages((m) => [...m, { from: "error", text: T.offline[lang] }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-xl border border-neutral-300 p-4 dark:border-neutral-700">
      <h2 className="font-semibold">{T.title[lang]}</h2>
      <p className="mt-1 text-sm text-neutral-500">{T.intro[lang]}</p>

      <div className="mt-3 flex flex-col gap-2" aria-live="polite">
        {messages.map((msg, i) =>
          msg.from === "family" ? (
            <p key={i} className="self-end rounded-2xl bg-foreground px-3 py-2 text-background">
              {msg.text}
            </p>
          ) : msg.from === "error" ? (
            <p key={i} className="rounded-2xl bg-amber-100 px-3 py-2 text-amber-900">
              {msg.text}
            </p>
          ) : (
            <div key={i} className="self-start rounded-2xl bg-neutral-100 px-3 py-2 text-neutral-900">
              <p>{msg.answer.reply}</p>
              <Sources answer={msg.answer} lang={lang} />
            </div>
          ),
        )}
        {sending && <p className="text-sm text-neutral-500">{T.thinking[lang]}</p>}
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder={T.placeholder[lang]}
          aria-label={T.title[lang]}
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
        />
        <button
          type="submit"
          disabled={sending || !question.trim()}
          className="rounded-lg bg-foreground px-4 py-2 text-background disabled:opacity-40"
        >
          {T.send[lang]}
        </button>
      </form>
    </section>
  );
}

function Sources({ answer, lang }: { answer: ChatAnswer; lang: Lang }) {
  const items: string[] = [];
  if (answer.usedStatus) {
    items.push(
      answer.statusMinutesAgo === null
        ? T.status[lang]
        : `${T.status[lang]} ${T.from[lang]} ${ago(answer.statusMinutesAgo, lang)}`,
    );
  }
  for (const f of answer.faq) items.push(`FAQ: ${f.question}`);
  if (items.length === 0) return null;

  return (
    <details className="mt-1 text-sm text-neutral-600">
      <summary className="cursor-pointer">{T.sources[lang]}</summary>
      <ul className="ml-4 list-disc">
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </details>
  );
}
