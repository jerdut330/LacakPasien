// Family-facing words for the DB enums, in English and Bahasa Indonesia.
// Plain module: used by server and client code. Keep in sync with lib/option.ts.
// Never words that say how sick someone is: the app doesn't diagnose.

import type { WaitEstimate } from "@/lib/wait";

export type Lang = "en" | "id";

type Text = { en: string; id: string };

export const STATUS_LABEL: Record<string, { title: Text; help: Text }> = {
  registered: {
    title: { en: "Registered", id: "Sudah terdaftar" },
    help: { en: "Your family member has arrived and is registered at the ER.", id: "Keluarga Anda sudah tiba dan terdaftar di IGD." },
  },
  in_triage: {
    title: { en: "Being checked by the triage nurse", id: "Sedang diperiksa perawat triase" },
    help: {
      en: "A nurse checks how urgent each case is. The most urgent patients are seen first, not the ones who arrived first.",
      id: "Perawat memeriksa seberapa mendesak setiap kasus. Pasien paling mendesak dilayani lebih dulu, bukan yang datang lebih dulu.",
    },
  },
  waiting_doctor: {
    title: { en: "Waiting for the doctor", id: "Menunggu dokter" },
    help: { en: "Waiting to be seen by a doctor.", id: "Menunggu diperiksa oleh dokter." },
  },
  being_treated: {
    title: { en: "Being treated", id: "Sedang ditangani" },
    help: { en: "The ER team is examining or treating your family member.", id: "Tim IGD sedang memeriksa atau menangani keluarga Anda." },
  },
  waiting_results: {
    title: { en: "Waiting for test results", id: "Menunggu hasil pemeriksaan" },
    help: { en: "Waiting for lab or scan results. The doctor will explain them.", id: "Menunggu hasil lab atau pemindaian. Dokter akan menjelaskannya." },
  },
  waiting_bed: {
    title: { en: "Waiting for a hospital bed", id: "Menunggu tempat tidur rawat inap" },
    help: {
      en: "The doctor has decided to admit your family member. They stay in the ER, cared for by the ER team, until a bed is free.",
      id: "Dokter memutuskan keluarga Anda perlu dirawat inap. Selama menunggu tempat tidur, pasien tetap dirawat oleh tim IGD.",
    },
  },
  bed_assigned: {
    title: { en: "Bed is ready", id: "Tempat tidur sudah siap" },
    help: { en: "A bed is ready. The move will happen soon.", id: "Tempat tidur sudah siap. Pemindahan akan segera dilakukan." },
  },
  transferring: {
    title: { en: "Moving to the ward", id: "Sedang dipindahkan" },
    help: { en: "Your family member is being moved to their bed now.", id: "Keluarga Anda sedang dipindahkan ke tempat tidurnya." },
  },
  moved_inpatient: {
    title: { en: "Moved to the hospital ward", id: "Sudah pindah ke ruang rawat inap" },
    help: { en: "Your family member has left the ER. Ask at the ward's nurse station for news.", id: "Keluarga Anda sudah keluar dari IGD. Tanyakan kabar di meja perawat ruang rawat." },
  },
  discharged: {
    title: { en: "Can go home", id: "Boleh pulang" },
    help: { en: "Please check with the nurse at the ER nurse station before you leave.", id: "Silakan cek ke perawat di meja perawat IGD sebelum pulang." },
  },
  referred: {
    title: { en: "Referred to another hospital", id: "Dirujuk ke rumah sakit lain" },
    help: { en: "The staff will explain the details and arrange the transfer.", id: "Petugas akan menjelaskan detailnya dan mengatur pemindahan." },
  },
  speak_to_staff: {
    title: { en: "Please speak with the staff", id: "Silakan bicara dengan petugas" },
    help: { en: "Please go to the ER nurse station.", id: "Silakan datang ke meja perawat IGD." },
  },
};

export const BED_LABEL: Record<string, Text> = {
  ward: { en: "ward bed", id: "tempat tidur bangsal" },
  hcu: { en: "HCU bed (high-care, one level below ICU)", id: "tempat tidur HCU (perawatan ketat, satu tingkat di bawah ICU)" },
  icu: { en: "ICU bed (intensive care)", id: "tempat tidur ICU (perawatan intensif)" },
};

// "resus" is shown as the treatment area: the room name alone would tell the
// family how serious things are, which this app never does.
export const LOCATION_LABEL: Record<string, Text> = {
  waiting_area: { en: "Waiting area", id: "Ruang tunggu" },
  triage: { en: "Triage", id: "Triase" },
  resus: { en: "Treatment area", id: "Ruang tindakan" },
  treatment: { en: "Treatment area", id: "Ruang tindakan" },
  observation: { en: "Observation area", id: "Ruang observasi" },
  radiology_ct: { en: "Radiology (X-ray / CT)", id: "Radiologi (rontgen / CT)" },
  lab: { en: "Lab", id: "Laboratorium" },
  moving: { en: "Being moved", id: "Sedang dipindahkan" },
};

// The wait estimate (worked out in lib/wait.ts) as one sentence.
export function waitText(w: WaitEstimate, lang: Lang): string | null {
  if (!w) return null;
  const short = BED_SHORT[w.bedType] ?? w.bedType;
  const bed = lang === "en" ? `${short === "ward" ? "a" : "an"} ${short} bed` : `tempat tidur ${short}`;
  const n = w.patientsAhead;
  const ahead =
    lang === "en"
      ? n === 0
        ? `No one else has been waiting longer for ${bed}`
        : `${n} other patient${n === 1 ? " has" : "s have"} been waiting longer for ${bed}`
      : n === 0
        ? `Tidak ada pasien lain yang menunggu ${bed} lebih lama`
        : `${n} pasien lain sudah menunggu ${bed} lebih lama`;

  if (w.kind === "longer_than_usual") {
    return lang === "en"
      ? `Already waiting longer than the usual range for ${bed}, so no estimate; please ask the staff. ${ahead}.`
      : `Sudah menunggu lebih lama dari biasanya untuk ${bed}, jadi tidak ada perkiraan; silakan tanyakan ke petugas. ${ahead}.`;
  }
  const t = (m: number) => formatMinutes(m, lang);
  const range =
    lang === "en"
      ? w.minLeft === 0 ? `Up to ${t(w.maxLeft)} more` : `About ${t(w.minLeft)} to ${t(w.maxLeft)} more`
      : w.minLeft === 0 ? `Paling lama ${t(w.maxLeft)} lagi` : `Sekitar ${t(w.minLeft)} sampai ${t(w.maxLeft)} lagi`;
  const note = lang === "en" ? "estimate based on assumptions, not measured" : "perkiraan berdasarkan asumsi, bukan hasil pengukuran";
  return `${range} (${note}). ${ahead}.`;
}

const BED_SHORT: Record<string, string> = { ward: "ward", hcu: "HCU", icu: "ICU" };

function formatMinutes(m: number, lang: Lang): string {
  if (m < 60) return lang === "en" ? `${m} min` : `${m} menit`;
  const h = (m / 60).toFixed(1).replace(/\.0$/, "");
  return lang === "en" ? `${h} h` : `${h.replace(".", ",")} jam`;
}

export const FINAL_STATUSES = ["moved_inpatient", "discharged", "referred"];

// An update older than this gets a warning on the family page.
export const STALE_MINUTES = 60;
