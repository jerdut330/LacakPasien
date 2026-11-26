-- LacakPasien: type mode. A nurse types one sentence, the LLM extracts the fields,
-- the nurse confirms. Those rows are saved with source = 'typed'.
-- Run once, after 004. (Postgres can't remove an enum value, so don't run it twice.)

alter type public.update_source add value if not exists 'typed';
