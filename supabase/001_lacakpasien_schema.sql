-- LacakPasien schema (Supabase / Postgres 15+)
-- Paste into Supabase: SQL Editor -> New query -> Run.

-- ========== ENUMS ==========
create type public.bed_type as enum ('ward','hcu','icu');
create type public.er_location as enum ('waiting_area','triage','resus','treatment','observation','radiology_ct','lab','moving');
create type public.patient_status as enum (
  'registered','in_triage','waiting_doctor','being_treated','waiting_results',
  'waiting_bed','bed_assigned','transferring',
  'moved_inpatient','discharged','referred',   -- final statuses
  'speak_to_staff'
);
create type public.worker_role as enum ('nurse','management');
create type public.update_source as enum ('voice','manual');

-- ========== TABLES ==========
create table public.workers (
  id   uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role public.worker_role not null default 'nurse'
);

create table public.patients (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,                          -- fake names only
  qr_token         text unique not null
                   default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  arrived_at       timestamptz not null default now(),
  token_expires_at timestamptz                             -- set automatically by trigger below
);

create table public.status_updates (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references public.patients(id) on delete cascade,
  status         public.patient_status not null,
  bed_type       public.bed_type,
  location       public.er_location,
  notes          text,
  source         public.update_source not null,
  raw_transcript text,
  llm_output     jsonb,
  updated_by     uuid not null references public.workers(id),
  created_at     timestamptz not null default now(),
  constraint bed_type_required check (
    status not in ('waiting_bed','bed_assigned','moved_inpatient') or bed_type is not null
  )
);
create index status_updates_patient_time_idx on public.status_updates (patient_id, created_at desc);

create table public.faq (
  id       uuid primary key default gen_random_uuid(),
  question text not null,
  answer   text not null,
  language text not null check (language in ('id','en')),
  topic    text
);

create table public.wait_assumptions (
  bed_type    public.bed_type primary key,
  min_minutes int not null check (min_minutes >= 0),
  max_minutes int not null,
  check (max_minutes >= min_minutes)
);

-- PLACEHOLDER numbers, not real data. Label as assumptions in UI and README.
insert into public.wait_assumptions values
  ('ward', 60, 240),
  ('hcu', 120, 480),
  ('icu', 120, 600);

-- ========== AUTO-EXPIRE QR LINK ON FINAL STATUS ==========
create function public.set_token_expiry() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('moved_inpatient','discharged','referred') then
    update patients
       set token_expires_at = new.created_at + interval '3 hours'
     where id = new.patient_id;
  end if;
  return new;
end $$;

create trigger status_updates_set_expiry
after insert on public.status_updates
for each row execute function public.set_token_expiry();

-- ========== VIEW: current status per patient ==========
create view public.patient_current with (security_invoker = true) as
select distinct on (s.patient_id)
  s.patient_id,
  s.status,
  s.bed_type,
  s.location,
  s.notes,
  s.created_at as last_updated,
  case when s.status = 'waiting_bed' then
    extract(epoch from now() - (
      select min(w.created_at) from public.status_updates w
      where w.patient_id = s.patient_id and w.status = 'waiting_bed'
    )) / 60
  end as minutes_waiting_for_bed
from public.status_updates s
order by s.patient_id, s.created_at desc;

-- ========== ROW LEVEL SECURITY ==========
-- Helper: role of the logged-in worker (null if not a worker)
create function public.current_worker_role() returns public.worker_role
language sql stable security definer set search_path = public as $$
  select role from workers where id = auth.uid()
$$;

alter table public.workers          enable row level security;
alter table public.patients         enable row level security;
alter table public.status_updates   enable row level security;
alter table public.faq              enable row level security;
alter table public.wait_assumptions enable row level security;

-- Any logged-in worker (nurse or management) can read
create policy workers_read          on public.workers          for select to authenticated using (public.current_worker_role() is not null);
create policy patients_read         on public.patients         for select to authenticated using (public.current_worker_role() is not null);
create policy status_read           on public.status_updates   for select to authenticated using (public.current_worker_role() is not null);
create policy faq_read              on public.faq              for select to authenticated using (public.current_worker_role() is not null);
create policy wait_read             on public.wait_assumptions for select to authenticated using (public.current_worker_role() is not null);

-- Only nurses write; a nurse can only sign updates as themselves
create policy patients_insert_nurse on public.patients       for insert to authenticated
  with check (public.current_worker_role() = 'nurse');
create policy status_insert_nurse   on public.status_updates for insert to authenticated
  with check (public.current_worker_role() = 'nurse' and updated_by = auth.uid());

-- Families (anon) get nothing directly. The family page and chatbot go through
-- a Next.js server route that checks qr_token and uses the service role key.
revoke all on public.workers, public.patients, public.status_updates,
              public.faq, public.wait_assumptions, public.patient_current from anon;
