-- LacakPasien FAQ fixes, found by the chatbot hand check on 2026-11-26
-- (tests/results/chatbot-2026-11-26T09-54-00-948Z-review.md).
-- Run once, after 002. Safe to run again: updates are idempotent and inserts skip existing questions.

-- 1. speak_to_staff: remove "does not necessarily mean something is wrong".
--    The app must not say whether it is or isn't bad news (test C06).
update public.faq set answer =
  'The staff would like to talk with you in person. Please go to the ER nurse station.'
where topic = 'speak_to_staff' and language = 'en';

update public.faq set answer =
  'Petugas ingin berbicara langsung dengan Anda. Silakan datang ke meja perawat IGD.'
where topic = 'speak_to_staff' and language = 'id';

-- 2. bpjs: whole sentences, so a reply never starts mid-sentence (test T03).
update public.faq set answer =
  'BPJS paperwork is done at the registration desk next to the ER entrance. Please bring the patient''s ID card (KTP) and BPJS card, or show the Mobile JKN app.'
where topic = 'bpjs' and language = 'en';

update public.faq set answer =
  'Administrasi BPJS diurus di meja pendaftaran di samping pintu masuk IGD. Silakan bawa KTP pasien dan kartu BPJS, atau tunjukkan aplikasi Mobile JKN.'
where topic = 'bpjs' and language = 'id';

-- 3. New FAQ rows: what BPJS is / coverage (tests T03, C07), and what "discharged" means (test C09).
insert into public.faq (topic, language, question, answer)
select v.topic, v.language, v.question, v.answer
from (values
  ('bpjs','en','What is BPJS, and will it cover this?',
   'BPJS is Indonesia''s national health insurance. Whether it covers this ER visit or a hospital stay depends on the patient''s membership and the type of care. Please ask the registration (admin) desk next to the ER entrance about this patient''s coverage.'),
  ('bpjs','id','Apa itu BPJS, dan apakah biayanya ditanggung?',
   'BPJS adalah asuransi kesehatan nasional Indonesia. Apakah kunjungan IGD atau rawat inap ini ditanggung tergantung pada kepesertaan pasien dan jenis perawatannya. Silakan tanyakan cakupan untuk pasien ini di meja pendaftaran (administrasi) di samping pintu masuk IGD.'),
  ('discharge','en','What does "discharged" mean?',
   'The ER team has decided the patient can go home. Before you leave, please check with the nurse at the ER nurse station for any papers or follow-up appointments.'),
  ('discharge','id','Apa arti "boleh pulang"?',
   'Tim IGD sudah memutuskan pasien boleh pulang. Sebelum pulang, silakan cek dulu ke perawat di meja perawat IGD untuk surat-surat atau jadwal kontrol.')
) as v(topic, language, question, answer)
where not exists (select 1 from public.faq f where f.question = v.question);
