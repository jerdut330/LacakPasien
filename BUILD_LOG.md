# Build log

What we decided, why, and what we measured. Every number in the README must come from an entry here.

AI disclosure: Claude Code (Anthropic) is used as a guide and helper. Entries say when it wrote a file.

## 2026-11-18 to 2026-11-19: thin slice
- Built: nurse login, patient list (stalest first), tap-mode status update, family page `/track/[token]`.
- Decision: tap mode is the main nurse input; voice is a bonus. Why: speaking is too slow in a hectic ER, and one tap is faster.
- Decision: `status_updates` is append-only. Why: keeps the full history, and lets us compare what the LLM extracted with what the nurse confirmed.
- Decision: the family page reads data only through the server with the service role key, after checking the QR token. Why: anon has no database access, so one family can never read another patient.
- Data: synthetic patients and a fictional hospital FAQ (`supabase/002_seed_faq.sql`, `003_seed_patients.sql`).

## 2026-11-19: chatbot test cases
- Wrote 30 test cases in `tests/chatbot-questions.json`: 12 typical, 9 confusing, 9 failure. Each has an EN and an ID question (3 also have a mixed EN/ID one), the expected action (answer / refuse / escalate), and what the answer must and must not contain.

## 2026-11-26: LLM choice
- Decision: Google Gemini through Google AI Studio (free tier, no billing). Why: free, handles Bahasa Indonesia, can be forced to return JSON.
- Test (one "reply ok" request per model, 25 s timeout):
  - `gemini-3.8-flash`: 503 UNAVAILABLE (high demand), after several minutes
  - `gemini-3.5-flash`: no reply within 25 s
  - `gemini-3.5-flash-lite`: ok in about 2 s
  - `gemini-2.5-flash`: 404, closed to new users
- Decision: main model `gemini-3.5-flash-lite`, fallback `gemini-3.8-flash`, 20 s timeout per call. Why: the free tier can be overloaded, as the test showed.
- Free-tier limits for `gemini-3.5-flash-lite`: TODO ___ RPM / ___ RPD (check in AI Studio).
- Model settings: `prompts/chatbot.config.json`. System prompt: `prompts/chatbot.md`.

## 2026-11-26: chatbot prompt experiment set up
- Claude Code wrote the first draft of `prompts/chatbot.md`, `prompts/chatbot.config.json` and `scripts/chatbot-experiment.mjs` at the developer's request. The developer reviews and edits the prompt.
- How it works: for each test case the script sends that case's status, the 38 FAQ rows and the question. The model must return JSON: `action`, `reply`, `used_status`, `faq_ids`. The script marks `pass` when `action` matches the expected one; the must-include / must-not rules are checked by hand.
- Smoke test (4 cases x EN/ID = 8 calls, `tests/results/chatbot-2026-11-26T09-12-57-669Z.json`): action correct 7 of 7 answered; 1 call failed with 503 on both models (overload, not a wrong answer). Script changed so errors are counted apart from wrong answers.
- Problems found by hand in those answers:
  - C06 EN: reply mixed English and Indonesian, and said "this doesn't always mean there is a problem" (breaks the "don't say if it is bad news" rule).
  - F04 ID: Indonesian question, English reply.
  - T04 EN: gave the range but didn't say what the patient is waiting for.
- Prompt fix (v2): the model now has to pick `reply_language` ("en"/"id") from the question only, before writing the reply (field placed before `reply` in the JSON schema); the reply must be all in that language. Also: say what the status means, not only its age; for speak_to_staff never say it is or isn't a problem.
- Re-run of the same 4 cases (`chatbot-2026-11-26T09-17-12-291Z.json`, F04 retried in `...09-17-41-574Z.json` after a 503): action correct 8 of 8, language label correct 8 of 8. Read by hand: all 8 replies in the right language with no mixing, T04 now says "waiting for a free ICU bed", C06 no longer says whether it is bad news.
- Note: 8 calls is far too few to claim accuracy. Use the full run for any number in the README.
- Results of the full run: TODO.
