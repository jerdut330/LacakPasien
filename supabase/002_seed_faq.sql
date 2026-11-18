-- LacakPasien FAQ seed: 19 topics x 2 languages = 38 rows.
-- Written for a FICTIONAL hospital. All details (hours, locations) are made up for the demo.
-- Run once. To redo: delete from public.faq; then run again.

insert into public.faq (topic, language, question, answer) values
-- visiting
('visiting','en','How many family members can wait in the ER?',
 'One family member may stay with the patient inside the ER. Others can wait in the family waiting area near the ER entrance.'),
('visiting','id','Berapa anggota keluarga yang boleh menunggu di IGD?',
 'Satu anggota keluarga boleh mendampingi pasien di dalam IGD. Keluarga lain dapat menunggu di ruang tunggu keluarga dekat pintu masuk IGD.'),

-- bed_wait
('bed_wait','en','What does "waiting for a bed" mean?',
 'The doctor has decided the patient needs to stay in the hospital. Staff are waiting for a free bed of the right type (ward, HCU or ICU). The patient is still cared for in the ER while waiting.'),
('bed_wait','id','Apa arti "menunggu kamar/tempat tidur"?',
 'Dokter sudah memutuskan pasien perlu dirawat inap. Petugas sedang menunggu tempat tidur yang sesuai (bangsal, HCU, atau ICU). Selama menunggu, pasien tetap dirawat di IGD.'),

-- hcu
('hcu','en','What is an HCU bed?',
 'HCU (High Care Unit) is a high-care, step-down bed, one level below ICU. It is for patients who need closer monitoring than a regular ward.'),
('hcu','id','Apa itu tempat tidur HCU?',
 'HCU (High Care Unit) adalah ruang perawatan dengan pemantauan lebih ketat, satu tingkat di bawah ICU. Ruang ini untuk pasien yang perlu dipantau lebih dekat daripada di bangsal biasa.'),

-- icu
('icu','en','What is an ICU bed?',
 'ICU (Intensive Care Unit) is the unit with the most intensive monitoring and care in the hospital.'),
('icu','id','Apa itu tempat tidur ICU?',
 'ICU (Intensive Care Unit) adalah ruang dengan pemantauan dan perawatan paling intensif di rumah sakit.'),

-- ward
('ward','en','What is a ward bed?',
 'A ward bed is a regular inpatient room for patients who are stable enough not to need HCU or ICU monitoring.'),
('ward','id','Apa itu tempat tidur bangsal?',
 'Tempat tidur bangsal adalah kamar rawat inap biasa untuk pasien yang cukup stabil dan tidak memerlukan pemantauan HCU atau ICU.'),

-- triage_order
('triage_order','en','Why are other patients seen before us?',
 'The ER treats patients by urgency (triage), not by arrival time. A patient who arrived later may be seen first if their condition is more urgent.'),
('triage_order','id','Mengapa pasien lain dilayani lebih dulu?',
 'IGD melayani pasien berdasarkan tingkat kegawatan (triase), bukan urutan kedatangan. Pasien yang datang belakangan bisa dilayani lebih dulu jika kondisinya lebih gawat.'),

-- wait_estimate
('wait_estimate','en','How is the wait-time estimate calculated?',
 'It is a rough range based on how many patients are waiting for the same bed type and assumed typical waiting times. It is not a promise. The real wait can be shorter or longer.'),
('wait_estimate','id','Bagaimana perkiraan waktu tunggu dihitung?',
 'Perkiraan ini berupa rentang kasar berdasarkan jumlah pasien yang menunggu jenis tempat tidur yang sama dan asumsi waktu tunggu yang umum. Ini bukan janji. Waktu tunggu sebenarnya bisa lebih cepat atau lebih lama.'),

-- update_frequency
('update_frequency','en','How often is the status updated?',
 'Nurses update the status when something changes. The page shows when the last update was made. If nothing has changed for a long time, you can ask at the ER nurse station.'),
('update_frequency','id','Seberapa sering status diperbarui?',
 'Perawat memperbarui status ketika ada perubahan. Halaman ini menampilkan kapan pembaruan terakhir dibuat. Jika lama tidak ada perubahan, Anda dapat bertanya di meja perawat IGD.'),

-- speak_to_staff
('speak_to_staff','en','What does "please speak with the staff" mean?',
 'The staff would like to talk with you in person. Please go to the ER nurse station. This does not necessarily mean something is wrong.'),
('speak_to_staff','id','Apa arti "silakan berbicara dengan petugas"?',
 'Petugas ingin berbicara langsung dengan Anda. Silakan datang ke meja perawat IGD. Ini tidak selalu berarti ada masalah.'),

-- referral
('referral','en','What does "being referred to another hospital" mean?',
 'The patient will be moved to another hospital that can provide the needed care or has a suitable bed available. Staff will explain the details and arrange the transfer.'),
('referral','id','Apa arti "dirujuk ke rumah sakit lain"?',
 'Pasien akan dipindahkan ke rumah sakit lain yang dapat memberikan perawatan yang dibutuhkan atau memiliki tempat tidur yang sesuai. Petugas akan menjelaskan detailnya dan mengatur pemindahan.'),

-- medical_questions
('medical_questions','en','Can I ask about the diagnosis or treatment here?',
 'This page cannot answer medical questions. Please ask the doctor or nurse on duty.'),
('medical_questions','id','Bisakah saya bertanya tentang diagnosis atau pengobatan di sini?',
 'Halaman ini tidak dapat menjawab pertanyaan medis. Silakan tanyakan kepada dokter atau perawat yang bertugas.'),

-- bpjs
('bpjs','en','Where do I handle BPJS (national health insurance) paperwork?',
 'At the registration desk next to the ER entrance. Please bring the patient''s ID card (KTP) and BPJS card, or show the Mobile JKN app.'),
('bpjs','id','Di mana saya mengurus administrasi BPJS?',
 'Di meja pendaftaran di samping pintu masuk IGD. Silakan bawa KTP pasien dan kartu BPJS, atau tunjukkan aplikasi Mobile JKN.'),

-- pharmacy
('pharmacy','en','Where is the pharmacy?',
 'The 24-hour pharmacy is on the ground floor, to the left of the main lobby.'),
('pharmacy','id','Di mana apotek?',
 'Apotek 24 jam berada di lantai dasar, di sebelah kiri lobi utama.'),

-- parking
('parking','en','Where can I park?',
 'Visitor parking is in the basement and the front lot. The ER drop-off area is for short stops only.'),
('parking','id','Di mana saya bisa parkir?',
 'Parkir pengunjung tersedia di basement dan halaman depan. Area turun penumpang IGD hanya untuk berhenti sebentar.'),

-- food
('food','en','Where can I buy food or drinks?',
 'The canteen on the ground floor is open 06:00-21:00. Vending machines near the ER waiting area are available 24 hours.'),
('food','id','Di mana saya bisa membeli makanan atau minuman?',
 'Kantin di lantai dasar buka pukul 06.00-21.00. Mesin minuman otomatis di dekat ruang tunggu IGD tersedia 24 jam.'),

-- prayer
('prayer','en','Is there a prayer room?',
 'Yes, a prayer room (mushola) is on the ground floor next to the canteen.'),
('prayer','id','Apakah ada mushola?',
 'Ya, mushola berada di lantai dasar di samping kantin.'),

-- what_to_bring
('what_to_bring','en','What should I bring for the patient?',
 'The patient''s ID card (KTP), insurance or BPJS card, a list of medicines they currently take, and a phone charger. Staff will tell you if anything else is needed.'),
('what_to_bring','id','Apa yang perlu saya bawa untuk pasien?',
 'KTP pasien, kartu asuransi atau BPJS, daftar obat yang sedang diminum, dan pengisi daya ponsel. Petugas akan memberi tahu jika ada hal lain yang diperlukan.'),

-- link_expiry
('link_expiry','en','Why did this tracking page stop working?',
 'The tracking link ends 3 hours after the patient''s final status (moved to a ward/HCU/ICU, discharged, or referred). For further information, please ask the staff.'),
('link_expiry','id','Mengapa halaman pelacakan ini tidak bisa dibuka lagi?',
 'Tautan pelacakan berakhir 3 jam setelah status akhir pasien (dipindahkan ke bangsal/HCU/ICU, pulang, atau dirujuk). Untuk informasi lebih lanjut, silakan tanyakan kepada petugas.'),

-- lost_qr
('lost_qr','en','I lost the QR code. What should I do?',
 'Ask at the ER nurse station. Staff can show the QR code again after confirming you are the patient''s family.'),
('lost_qr','id','QR code saya hilang. Apa yang harus saya lakukan?',
 'Tanyakan di meja perawat IGD. Petugas dapat menampilkan QR code lagi setelah memastikan Anda adalah keluarga pasien.');
