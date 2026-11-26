"use client";

import { useEffect, useState } from "react";
import type { TrackInfo } from "@/lib/track";
import {
  type Lang,
  STATUS_LABEL,
  BED_LABEL,
  LOCATION_LABEL,
  FINAL_STATUSES,
  STALE_MINUTES,
  waitText,
  ago,
} from "@/lib/label";
import { ChatBox } from "./chat-box";

const POLL_MS = 5000;

const T = {
  title: { en: "Patient status", id: "Status pasien" },
  patient: { en: "Patient", id: "Pasien" },
  noUpdate: { en: "No update yet", id: "Belum ada pembaruan" },
  where: { en: "Where", id: "Lokasi" },
  bed: { en: "Bed needed", id: "Tempat tidur" },
  updated: { en: "Last updated", id: "Terakhir diperbarui" },
  wait: { en: "Estimated wait for a bed", id: "Perkiraan waktu tunggu tempat tidur" },
  noEstimate: { en: "No estimate available.", id: "Belum ada perkiraan." },
  assumption: {
    en: "The hours come from assumptions, not measured data.",
    id: "Angka jam berasal dari asumsi, bukan data yang diukur.",
  },
  stale: {
    en: "This update is over an hour old. If you're worried, please ask at the ER nurse station.",
    id: "Pembaruan ini sudah lebih dari satu jam. Jika khawatir, silakan tanyakan di meja perawat IGD.",
  },
  final: {
    en: "This link stops working 3 hours after this status.",
    id: "Tautan ini berhenti berfungsi 3 jam setelah status ini.",
  },
  live: { en: "Updates automatically", id: "Diperbarui otomatis" },
  gone: {
    en: "This link isn't working any more. Please ask the ER front desk.",
    id: "Tautan ini sudah tidak berfungsi. Silakan tanyakan ke meja depan IGD.",
  },
} satisfies Record<string, Record<Lang, string>>;

export function TrackView({ token, initial }: { token: string; initial: TrackInfo }) {
  const [info, setInfo] = useState(initial);
  const [gone, setGone] = useState(false);
  const [lang, setLang] = useState<Lang>("en");

  // Live updates: ask the server every few seconds, only while the page is visible.
  useEffect(() => {
    if (gone) return;
    const id = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/track/${token}/status`, { cache: "no-store" });
        if (res.status === 404) return setGone(true);
        if (res.ok) setInfo(await res.json());
      } catch {
        // offline for a moment: keep showing the last status
      }
    }, POLL_MS);
    return () => clearInterval(id);
  }, [token, gone]);

  const label = info.status ? STATUS_LABEL[info.status] : null;
  const stale = info.minutesSinceUpdate !== null && info.minutesSinceUpdate > STALE_MINUTES;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">LacakPasien</h1>
        <div className="flex rounded-full border border-neutral-300 text-sm dark:border-neutral-700" role="group" aria-label="Language">
          {(["en", "id"] as const).map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              aria-pressed={lang === l}
              className={`rounded-full px-3 py-1 ${lang === l ? "bg-foreground text-background" : ""}`}
            >
              {l === "en" ? "EN" : "ID"}
            </button>
          ))}
        </div>
      </div>

      {gone ? (
        <p className="rounded-xl border border-neutral-300 p-4 dark:border-neutral-700">{T.gone[lang]}</p>
      ) : (
        <>
          <section className="rounded-xl border border-neutral-300 p-4 dark:border-neutral-700">
            <p className="text-sm text-neutral-500">
              {T.patient[lang]}: {info.firstName}
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{label ? label.title[lang] : T.noUpdate[lang]}</h2>
            {label && <p className="mt-1">{label.help[lang]}</p>}

            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              {info.bedType && (
                <>
                  <dt className="text-neutral-500">{T.bed[lang]}</dt>
                  <dd>{BED_LABEL[info.bedType]?.[lang] ?? info.bedType}</dd>
                </>
              )}
              {info.location && !FINAL_STATUSES.includes(info.status ?? "") && (
                <>
                  <dt className="text-neutral-500">{T.where[lang]}</dt>
                  <dd>{LOCATION_LABEL[info.location]?.[lang] ?? info.location}</dd>
                </>
              )}
              <dt className="text-neutral-500">{T.updated[lang]}</dt>
              <dd>{info.minutesSinceUpdate === null ? "-" : ago(info.minutesSinceUpdate, lang)}</dd>
            </dl>

            {stale && (
              <p className="mt-3 rounded-lg bg-amber-100 p-2 text-sm text-amber-900">{T.stale[lang]}</p>
            )}
            {FINAL_STATUSES.includes(info.status ?? "") && (
              <p className="mt-3 text-sm text-neutral-500">{T.final[lang]}</p>
            )}
            <p className="mt-3 text-xs text-neutral-500">● {T.live[lang]}</p>
          </section>

          {info.status === "waiting_bed" && (
            <section className="rounded-xl border border-neutral-300 p-4 dark:border-neutral-700">
              <h2 className="font-semibold">{T.wait[lang]}</h2>
              <p className="mt-1">{waitText(info.wait, lang) ?? T.noEstimate[lang]}</p>
              <p className="mt-2 text-xs text-neutral-500">{T.assumption[lang]}</p>
            </section>
          )}

          <ChatBox token={token} lang={lang} />
        </>
      )}
    </div>
  );
}
