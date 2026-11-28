-- LacakPasien: "needs a human" alerts. When the chatbot marks a family question as
-- escalate, the chat route saves it here (admin client). Nurses see it on /nurse.
-- An alert counts as open until a nurse saves a newer status for that patient,
-- so the table stays append-only (no update policy needed).
-- Run once, after 005.

create table public.escalations (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references public.patients(id) on delete cascade,
  question    text not null,
  reply       text,                      -- what the chatbot told the family
  created_at  timestamptz not null default now()
);

create index escalations_patient_time_idx on public.escalations (patient_id, created_at desc);

alter table public.escalations enable row level security;

-- Logged-in workers (nurse or management) can read, same rule as the other tables.
create policy escalations_read on public.escalations for select to authenticated
  using (public.current_worker_role() is not null);

-- No insert policy on purpose: only the chat route writes, with the service role key.
-- Families (anon) get nothing directly.
revoke all on public.escalations from anon;
