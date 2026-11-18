@AGENTS.md

# LacakPasien ("TrackPatient")

Hackathon entry for AI OpenBuild (Devpost). Deadline: submit by Dec 9 evening (hard deadline Dec 11 11:45 AM Jakarta time).

A package-tracking-style web app that shows families the live status of a patient in the ER.
- Nurse holds the mic -> speech-to-text -> LLM extracts 4 fields (status, bed_type, location, note) -> nurse sees a confirm card and taps Confirm (or picks from dropdowns). Nothing is saved without the tap.
- Family scans a QR code -> opens /track/[token] -> sees status, wait-time range with explanation, "last updated X min ago". Updates live.
- Family chatbot answers ONLY from that patient's current status + the FAQ table. Refuses medical questions and other patients' data.
- Wait-time estimate: plain code computes a RANGE from wait_assumptions + patients ahead for the same bed type; the LLM only writes the explanation. Show "no estimate available" when data is missing.
- Management page (build last): read-only. Patients waiting per bed type, longest waits (flag > 4 hours), stale updates, average boarding time.

## Stack
Next.js (App Router) + Supabase (Postgres, auth, realtime) + a speech-to-text API + an LLM + QR codes.
Rules: no paid service required; the live demo must work without anyone's personal keys; no secrets in the repo.

## Database (already created in Supabase, do not recreate)
SQL files in `supabase/`: `001_lacakpasien_schema.sql`, `002_seed_faq.sql`, `003_seed_patients.sql`.

Enums:
- bed_type: ward, hcu, icu
- er_location: waiting_area, triage, resus, treatment, observation, radiology_ct, lab, moving
- patient_status: registered, in_triage, waiting_doctor, being_treated, waiting_results, waiting_bed, bed_assigned, transferring, moved_inpatient, discharged, referred, speak_to_staff
  - Final statuses: moved_inpatient, discharged, referred
- worker_role: nurse, management
- update_source: voice, manual

Tables:
- workers (id = auth.users.id, name, role)
- patients (id, name, qr_token unique, arrived_at, token_expires_at). One row = one ER visit (no admissions table, on purpose).
- status_updates (id, patient_id, status, bed_type, location, notes, source, raw_transcript, llm_output jsonb, updated_by -> workers, created_at). APPEND-ONLY: every update is a new row; never update old rows. Check constraint: bed_type required for waiting_bed, bed_assigned, moved_inpatient.
  - llm_output = what the LLM extracted BEFORE the nurse edited it. The columns hold the confirmed values. Comparing them = voice accuracy metric. Always fill raw_transcript + llm_output for voice updates.
- faq (id, question, answer, language 'id'|'en', topic). 19 topics x 2 languages. Fictional hospital.
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
English-first UI with a Bahasa Indonesia option. Voice and chatbot work in both languages. Explain BPJS as "Indonesia's national health insurance" and HCU as "high-care (step-down) bed, one level below ICU".

## Plan
- Nov 21: thin slice working: nurse login, voice -> confirm card -> save, family page /track/[token].
- Nov 22-30: chatbot, wait-time estimate, family page polish. Feature freeze Nov 30.
- Dec 1-5: tests (voice field accuracy on 60-100 clips, chatbot refusal/groundedness on 80-100 questions, wait-time logic test), 5-8 person trial.
- Dec 6-8: video, README, Devpost page.

## Working style
The developer prefers direct, quick, actionable answers and honest pushback over agreement.
