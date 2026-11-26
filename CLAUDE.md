# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands
- `npm run dev`: dev server on http://localhost:3000 (Turbopack)
- `npm run build`: production build (also the type check)
- `npm run lint`: ESLint (flat config, `eslint-config-next`)
- No test runner is set up yet. The Dec 1-5 tests will need one added.
- `node --env-file=.env.local scripts/chatbot-experiment.mjs [T01 F04 ...]`: runs the chatbot test cases (all, or the given ids) through Gemini with `prompts/chatbot.md` + `prompts/chatbot.config.json`, saves `tests/results/chatbot-<time>.json`. `pass` checks only the action; 503/timeouts are counted as errors, not fails. A full run is ~63 calls: mind the free-tier daily limit.
- `tests/chatbot-questions.*`: the developer's chatbot test cases (same cases as `.md`, `.txt` and `.json`; the JSON has `expected` answer/refuse/escalate, `must_include`, `must_not` per case, for the Nov 22 prompt-experiment script to read).

Env vars: copy `.env.example` to `.env.local` (gitignored) and fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Code architecture
- Next.js 16 with `cacheComponents` and `partialPrefetching` on (`next.config.ts`; `experimental.agentFeedback` is also on, leave it). Tailwind v4 is loaded via a Turbopack CSS rule, not PostCSS. Import alias `@/*` = repo root.
- `proxy.ts` (Next 16's replacement for `middleware.ts`) refreshes the Supabase login cookie and redirects logged-out users from `/nurse/*` to `/login`. Its matcher covers only `/nurse` and `/login`; `/track` skips it on purpose.
- Three Supabase clients in `lib/supabase/`, pick by context:
  - `client.ts`: browser, anon key + user session (nurse/management UI).
  - `server.ts`: server components/actions/routes, anon key + cookie session, so RLS applies as the logged-in worker.
  - `admin.ts`: service role, `server-only`, bypasses RLS. Only for the family page and chatbot routes, after validating `qr_token`.
- Where things live (the developer uses singular file names; keep that style):
  - `app/login/action.ts`: `login` (useActionState) and `logout` server actions.
  - `app/nurse/page.tsx`: greeting + active-patient list (`patient_current` minus final statuses, stalest first). `app/nurse/[patientId]/page.tsx` + `status-form.tsx` (client) + `app/nurse/action.ts` (`saveStatus`, inserts a `source = manual` row).
  - `app/track/[token]/page.tsx` -> `lib/track.ts` (`getTrackInfo`): the only place family data is read with the admin client; returns first name + status fields only, never notes; null for unknown or expired tokens.
  - `lib/option.ts`: STATUSES / LOCATIONS / BED_TYPES / NEEDS_BED_TYPE, mirroring the DB enums. Keep in sync with `001_lacakpasien_schema.sql`.
  - `lib/time.ts`: `minutesSince()`.
- Patterns that bite in this setup:
  - Anything that reads cookies, params or the current time renders inside `<Suspense>`, and the async component starts with `await connection()`. Without it, Supabase auth's internal `Date.now()` triggers a "blocking-prerender-current-time" error (partial prefetching resolves cookies during prerender).
  - Lint rule `react-hooks/purity` rejects `Date.now()` inside components: compute times in `lib/` (e.g. `minutesSince`).
  - A `"use server"` file may export only async functions (types are fine). Shared constants go in a normal module.
  - No generated DB types: embedded selects like `patients(name)` are mistyped as arrays, so add `.overrideTypes<Row[], { merge: false }>()` with a local row type.
- Tooling quirk: when the built-in browser pane is hidden, React 19 never swaps Suspense fallbacks (no animation frames), so pages look stuck on "Loading...". Verify with `curl` or ask the developer to show the pane.

# LacakPasien ("TrackPatient")

Hackathon entry for AI OpenBuild (Devpost). Deadline: submit by Dec 9 evening (hard deadline Dec 11 11:45 AM Jakarta time).

A package-tracking-style web app that shows families the live status of a patient in the ER.
- Nurse update, two modes (the nurse picks whichever fits the moment; voice was dropped as the main input because it is too slow in a hectic ER):
  - Tap mode (fast, default): patient list (stalest first) -> big status buttons, likely next status first. Ask bed_type only when needed, location defaults to the last one, note optional. One tap saves, with a ~5s Undo. `source = manual`.
  - Type mode (complex situations): nurse types one sentence (EN or ID), e.g. "waiting ICU bed, in observation, family asked about BPJS" -> LLM extracts 4 fields (status, bed_type, location, note) -> confirm card -> nurse edits if needed and taps Confirm. Nothing is saved without the tap. `source = typed`.
  - Voice (bonus, only if time after the feature freeze): speech-to-text feeding the same extractor. `source = voice`.
- Family scans a QR code -> opens /track/[token] -> sees status, wait-time range with explanation, "last updated X min ago". Updates live.
- Family chatbot answers ONLY from that patient's current status + the FAQ table. Refuses medical questions and other patients' data. Every answer shows its sources (which status update and how old it is, which FAQ entries).
- Stretch: "needs a human" alert. The chatbot classifies each question as answer / refuse / escalate; escalations show on the nurse page (e.g. "family wants to talk to doctor"). Needs a new table (new migration, next free number), inserted only by the server route via the admin client; anon still has no access.
- Wait-time estimate: plain code computes a RANGE from wait_assumptions + patients ahead for the same bed type; the LLM only writes the explanation. Show "no estimate available" when data is missing.
- Management page (build last): read-only. Patients waiting per bed type, longest waits (flag > 4 hours), stale updates, average boarding time.

## Stack
Next.js (App Router) + Supabase (Postgres, auth, realtime) + an LLM (free tier; check its rate limits) + QR codes. Speech-to-text only for the voice bonus.
Rules: no paid service required; the live demo must work without anyone's personal keys; no secrets in the repo.

## Database (already created in Supabase, do not recreate)
SQL files in `supabase/`: `001_lacakpasien_schema.sql`, `002_seed_faq.sql`, `003_seed_patients.sql`, `004_faq_fixes.sql` (FAQ edits from the chatbot hand check). New migrations take the next free number.

Enums:
- bed_type: ward, hcu, icu
- er_location: waiting_area, triage, resus, treatment, observation, radiology_ct, lab, moving
- patient_status: registered, in_triage, waiting_doctor, being_treated, waiting_results, waiting_bed, bed_assigned, transferring, moved_inpatient, discharged, referred, speak_to_staff
  - Final statuses: moved_inpatient, discharged, referred
- worker_role: nurse, management
- update_source: voice, manual. `typed` is NOT in the DB yet: add it in a new migration (next free number, e.g. `005_...sql`) (`alter type update_source add value 'typed';`) before building type mode.

Tables:
- workers (id = auth.users.id, name, role)
- patients (id, name, qr_token unique, arrived_at, token_expires_at). One row = one ER visit (no admissions table, on purpose).
- status_updates (id, patient_id, status, bed_type, location, notes, source, raw_transcript, llm_output jsonb, updated_by -> workers, created_at). APPEND-ONLY: every update is a new row; never update old rows. Check constraint: bed_type required for waiting_bed, bed_assigned, moved_inpatient.
  - llm_output = what the LLM extracted BEFORE the nurse edited it. The columns hold the confirmed values. Comparing them = field accuracy metric. Always fill raw_transcript (typed text or speech transcript) + llm_output for typed and voice updates.
- faq (id, question, answer, language 'id'|'en', topic). 20 topics x 2 languages, 42 rows after 004 (bpjs has 2 questions per language). Fictional hospital.
- wait_assumptions (bed_type, min_minutes, max_minutes). PLACEHOLDER numbers: label as assumptions in the UI and README.
- View patient_current (security_invoker): latest status per patient + minutes_waiting_for_bed.
- Trigger: inserting a final status sets patients.token_expires_at = created_at + 3 hours.

Security (RLS is on):
- Logged-in workers (nurse or management) can read all tables.
- Only nurses can insert patients and status_updates, and updated_by must equal auth.uid().
- anon has NO access. The family page and chatbot must go through a Next.js server route that validates qr_token (and rejects expired tokens) and uses the service role key server-side only. Never expose the service role key to the client. Never open anon read policies.
- Family live updates: poll the server route (~5s) or use Supabase Broadcast on a channel named by the token. Do not use Postgres Changes with anon.

Demo accounts: nurse@lacakpasien.test (Sarah Cooper, nurse), manager@lacakpasien.test (Clark Kent, management).
Reseed patients: `truncate public.patients cascade;` then run 003 again (times are relative to now(); reseed before recording the demo).

## Safety rules (from the brief)
- Status always from the fixed enum; the app never diagnoses.
- The app never shows deterioration or death statuses; "speak_to_staff" covers anything that needs an in-person talk.
- Chatbot: no medical advice, no other patients' data, resist prompt injection.
- Show uncertainty; flag stale updates.
- Synthetic data only. Fictional hospital.

## International judges
English-first UI with a Bahasa Indonesia option. Type mode and the chatbot work in both languages (and mixed EN/ID). Explain BPJS as "Indonesia's national health insurance" and HCU as "high-care (step-down) bed, one level below ICU".

## Hackathon judging & rules
- Judging: AI Integration & Technical Execution 30%, Originality & Problem Framing 25%, Usefulness & UX 25%, Testing & Communication 20%. Ties go to AI first, then originality.
- AI must play a meaningful role. Keep LLM prompts and model settings in files in the repo, not buried in code.
- Never claim performance we have not measured: every number in the README comes from our own tests. State model limitations.
- Disclose AI-generated components (Claude Code was used as a guide/helper), credit all sources, and explain what the developer built.
- Keep `BUILD_LOG.md`: date, decision, why, prompts/model config, data sources, test results.
- Before submitting: demo link works, screenshots show the real prototype, credits complete, no secrets, fallback video (the free LLM tier may fail during judging).

## Plan
- Nov 21: thin slice: nurse login, tap-mode status update, family page /track/[token]. DONE Nov 19. Tap-mode leftovers for polish week: Undo, friendly EN/ID status labels, bed type shown only when needed, likely next status first, stale-update flag, styling.
- Before the chatbot experiment (test questions DONE, in `tests/`): developer writes ~20 test questions (typical / confusing / failure, EN + ID) with the expected behaviour, picks a free-tier LLM and puts its key in `.env.local` (name only in `.env.example`), and starts `BUILD_LOG.md`. Seed data is stale: reseed before realistic testing and before the demo.
- Nov 22: chatbot prompt experiment: ~20 sample questions in a small script, before any chat UI.
- Nov 23-30: type mode (AI field extraction + confirm card), chatbot with sources, wait-time estimate + AI explanation, family page polish. Stretch: "needs a human" alert. Feature freeze Nov 30.
- Dec 1-5: tests (field extraction accuracy on 60-100 typed sentences in EN, ID and mixed; chatbot on 80-100 questions: typical, confusing and failure cases; wait-time logic test; escalation accuracy if built), 5-8 person trial (time per update, tap vs type).
- Dec 6-9: video (doubles as fallback demo), README with limits + AI disclosure, Devpost page. Submit Dec 9 (portal closes Dec 10 US Eastern).

## Working style
The developer prefers direct, quick, actionable answers and honest pushback over agreement.

## Workflow (the developer is learning: they write the code, Claude guides)
Do not write app code for them unless they ask for a specific piece. For each step:
1. Pick one small step from the plan.
2. Claude explains the goal in plain words and gives hints: which file, which function or API, and a short example or skeleton with gaps to fill. Not the full solution.
3. The developer writes it. Claude reviews it, points out bugs, and explains why (nudge first, give the answer only if they are stuck or ask).
4. Both test it: the developer in their own browser, Claude in the built-in browser (dev server config `dev` in `.claude/launch.json`). Then compare results; if they differ, find out why. Claude also runs `npm run lint` and `npm run build`.
5. Commit straight to `main` after each working step.
If the deadline is at risk, say so and offer to write the boilerplate-heavy parts.
