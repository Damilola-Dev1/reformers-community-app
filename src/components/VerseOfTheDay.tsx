import { useEffect, useState } from "react";
import { verses } from "../data/verses";

function dayNumber(): number {
  const n = new Date();
  return Math.floor(
    Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()) / 86400000,
  );
}

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

type Shown = {
  text: string;
  reference: string;
};

function VerseOfTheDay() {
  const day = dayNumber();
  const today = verses[day % verses.length];
  const [shown, setShown] = useState<Shown>({
    text: today.text,
    reference: today.reference,
  });

  useEffect(() => {
    let cancelled = false;
    const cacheKey = "votd-" + day;

    async function load() {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as Shown;
          if (parsed.text && parsed.reference && !cancelled) {
            setShown({
              text: clean(parsed.text),
              reference: clean(parsed.reference),
            });
            return;
          }
        }
      } catch {
        // ignore a broken cache and fetch again
      }

      try {
        const url =
          "https://bible-api.com/" +
          today.reference.replace(/ /g, "+") +
          "?translation=kjv";
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        const text = clean(String(data.text ?? ""));
        const reference = clean(String(data.reference ?? ""));
        if (!text || !reference) return;
        const result = { text, reference };
        if (!cancelled) setShown(result);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(result));
        } catch {
          // storage may be unavailable, that is fine
        }
      } catch (err) {
        console.error(err);
      }
    }
    load();

    return () => {
      cancelled = true;
    };
  }, [day, today.reference]);

  return (
    <section className="rounded-panel border border-line bg-white p-4">
      <h2 className="text-[13px] font-semibold text-muted">Verse of the day</h2>
      <div className="mb-3 mt-2 h-0.5 w-10 bg-gold" aria-hidden="true" />
      <div key={shown.text} className="fade-in">
        <p className="font-display text-lg leading-snug text-ink">
          {shown.text}
        </p>
        <p className="mt-2 text-[15px] font-semibold text-muted">
          {shown.reference}
        </p>
      </div>
    </section>
  );
}

export default VerseOfTheDay;
