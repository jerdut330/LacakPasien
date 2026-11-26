"use client";

import { useState } from "react";
import type { ChatAnswer } from "@/lib/chatbot";

type Message =
  | { from: "family"; text: string }
  | { from: "bot"; answer: ChatAnswer }
  | { from: "error"; text: string };

export function ChatBox({ token }: { token: string }) {
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
      setMessages((m) => [...m, { from: "error", text: "Couldn't reach the chat. Please ask at the ER nurse station." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <section>
      <h2>Ask a question</h2>
      <p>Answers come only from this status and the hospital FAQ. This chat can&apos;t give medical advice.</p>

      {messages.map((msg, i) =>
        msg.from === "family" ? (
          <p key={i}>You: {msg.text}</p>
        ) : msg.from === "error" ? (
          <p key={i}>{msg.text}</p>
        ) : (
          <div key={i}>
            <p>{msg.answer.reply}</p>
            <Sources answer={msg.answer} />
          </div>
        ),
      )}
      {sending && <p>Thinking...</p>}

      <form onSubmit={send}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={500}
          placeholder="e.g. What does waiting for a bed mean?"
          aria-label="Your question"
        />
        <button type="submit" disabled={sending || !question.trim()}>
          Send
        </button>
      </form>
    </section>
  );
}

function Sources({ answer }: { answer: ChatAnswer }) {
  const items: string[] = [];
  if (answer.usedStatus) {
    items.push(
      answer.statusMinutesAgo === null
        ? "Status update"
        : `Status update from ${answer.statusMinutesAgo} min ago`,
    );
  }
  for (const f of answer.faq) items.push(`FAQ: ${f.question}`);
  if (items.length === 0) return null;

  return (
    <details>
      <summary>Sources</summary>
      <ul>
        {items.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </details>
  );
}
