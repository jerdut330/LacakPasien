-- LacakPasien patient seed: 200 FAKE patients with realistic status histories.
-- Requirements: run 001 first, and create at least one nurse in public.workers.
-- Arrivals are spread over the last 48 hours (half in the last 12 hours), so some patients
-- are finished and some are still in progress at the moment you run this.
-- Seed rows use source = 'manual' with no transcript/llm_output, so they never mix
-- into your voice-accuracy numbers.
-- To reset: truncate public.patients cascade;   (also deletes all status_updates)

create or replace function public._seed_step(
  p_patient uuid, p_status public.patient_status, p_bed public.bed_type,
  p_loc public.er_location, p_at timestamptz, p_nurse uuid, p_note text default null
) returns boolean language plpgsql as $$
begin
  if p_at > now() then
    return false;              -- this step is in the future: patient is still at the previous step
  end if;
  insert into public.status_updates
    (patient_id, status, bed_type, location, notes, source, updated_by, created_at)
  values (p_patient, p_status, p_bed, p_loc, p_note, 'manual', p_nurse, p_at);
  return true;
end $$;

do $$
declare
  n_patients constant int := 200;
  nurse_ids uuid[];
  first_names text[] := array['Andi','Budi','Citra','Dewi','Eko','Fajar','Gita','Hendra','Indah','Joko',
    'Kartika','Lukman','Maya','Nanda','Oki','Putri','Rina','Sari','Taufik','Utami','Vina','Wahyu','Yusuf','Zahra',
    'Agus','Bayu','Dimas','Fitri','Hana','Irfan','Lestari','Rizki','Siti','Teguh','Wulan'];
  last_names text[] := array['Saputra','Wijaya','Pratama','Santoso','Lestari','Hidayat','Nugroho','Kusuma',
    'Siregar','Simanjuntak','Wibowo','Rahmawati','Setiawan','Gunawan','Halim','Purba','Sitompul','Harahap',
    'Utomo','Firmansyah'];
  i int;
  pid uuid;
  arrive timestamptz;
  t timestamptz;
  r float;
  path text;
  bed public.bed_type;
  wmin int; wmax int;
  nurse uuid;
begin
  select array_agg(id) into nurse_ids from public.workers where role = 'nurse';
  if nurse_ids is null then
    raise exception 'No nurse found. Create a nurse in Authentication -> Users and insert them into public.workers first.';
  end if;

  for i in 1..n_patients loop
    nurse  := nurse_ids[1 + floor(random() * array_length(nurse_ids, 1))::int];
    -- half arrive in the last 12 hours (many still in the ER), half 12-48 hours ago (mostly finished)
    if random() < 0.5 then
      arrive := now() - random() * interval '12 hours';
    else
      arrive := now() - interval '12 hours' - random() * interval '36 hours';
    end if;

    insert into public.patients (name, arrived_at)
    values (first_names[1 + floor(random() * array_length(first_names, 1))::int] || ' ' ||
            last_names[1 + floor(random() * array_length(last_names, 1))::int],
            arrive)
    returning id into pid;

    -- pathway: 45% admitted, 40% discharged, 8% referred, 7% "speak with staff"
    r := random();
    path := case when r < 0.45 then 'admit' when r < 0.85 then 'discharge'
                 when r < 0.93 then 'refer' else 'staff' end;

    -- bed type: 60% ward, 25% HCU, 15% ICU (referrals: 80% HCU, 20% ICU)
    r := random();
    bed := case when path = 'refer' then (case when r < 0.8 then 'hcu' else 'icu' end)::public.bed_type
                when r < 0.60 then 'ward' when r < 0.85 then 'hcu' else 'icu' end;
    select min_minutes, max_minutes into wmin, wmax from public.wait_assumptions where bed_type = bed;

    -- common start
    t := arrive;
    if not public._seed_step(pid, 'registered', null, 'waiting_area', t, nurse) then continue; end if;
    t := t + make_interval(mins => 3 + floor(random() * 15)::int);
    if not public._seed_step(pid, 'in_triage', null, 'triage', t, nurse) then continue; end if;
    t := t + make_interval(mins => 5 + floor(random() * 15)::int);
    if not public._seed_step(pid, 'waiting_doctor', null, 'waiting_area', t, nurse) then continue; end if;
    t := t + make_interval(mins => 10 + floor(random() * 50)::int);
    if not public._seed_step(pid, 'being_treated', null,
         (case when random() < 0.1 then 'resus' else 'treatment' end)::public.er_location, t, nurse) then continue; end if;

    if path = 'staff' then
      t := t + make_interval(mins => 20 + floor(random() * 60)::int);
      perform public._seed_step(pid, 'speak_to_staff', null, 'treatment', t, nurse);
      continue;
    end if;

    -- tests: always for admit/refer, 60% for discharge
    if path <> 'discharge' or random() < 0.6 then
      t := t + make_interval(mins => 20 + floor(random() * 70)::int);
      if random() < 0.5 then
        if not public._seed_step(pid, 'waiting_results', null, 'radiology_ct', t, nurse, 'Waiting for CT result') then continue; end if;
      else
        if not public._seed_step(pid, 'waiting_results', null, 'lab', t, nurse, 'Waiting for lab result') then continue; end if;
      end if;
      t := t + make_interval(mins => 30 + floor(random() * 90)::int);
    else
      t := t + make_interval(mins => 20 + floor(random() * 60)::int);
    end if;

    if path = 'discharge' then
      perform public._seed_step(pid, 'discharged', null, null, t, nurse);
      continue;
    end if;

    -- waiting for a bed (admit and refer)
    if not public._seed_step(pid, 'waiting_bed', bed, 'observation', t, nurse) then continue; end if;
    -- bed wait: from wait_assumptions, sometimes up to 30% beyond max (long boarding cases)
    t := t + make_interval(mins => wmin + floor(random() * (wmax * 1.3 - wmin))::int);

    if path = 'refer' then
      perform public._seed_step(pid, 'referred', bed, 'observation', t, nurse, 'No bed available, referral arranged');
      continue;
    end if;

    if not public._seed_step(pid, 'bed_assigned', bed, 'observation', t, nurse) then continue; end if;
    t := t + make_interval(mins => 15 + floor(random() * 30)::int);
    if not public._seed_step(pid, 'transferring', bed, 'moving', t, nurse) then continue; end if;
    t := t + make_interval(mins => 10 + floor(random() * 20)::int);
    perform public._seed_step(pid, 'moved_inpatient', bed, null, t, nurse);
  end loop;
end $$;

drop function public._seed_step(uuid, public.patient_status, public.bed_type, public.er_location, timestamptz, uuid, text);

-- Quick check: how many patients are at each current status
select status, bed_type, count(*) from public.patient_current group by 1, 2 order by 1, 2;
