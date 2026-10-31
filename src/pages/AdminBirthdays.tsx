import { useEffect, useMemo, useState } from "react";

import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { settings } from "../config/settings";

type Person = {
  id: string;
  fullName: string;
  phone: string;
  dateOfBirth: string;
};

type Upcoming = Person & {
  daysUntil: number;
  turning: number;
  month: number;
  day: number;
};

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function nextBirthday(dateOfBirth: string, todayStart: Date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;

  const birthYear = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const thisYear = todayStart.getFullYear();
  for (const year of [thisYear, thisYear + 1]) {
    const useDay = month === 2 && day === 29 && !isLeapYear(year) ? 28 : day;
    const date = new Date(year, month - 1, useDay);

    if (date.getTime() >= todayStart.getTime()) {
      const daysUntil = Math.round(
        (date.getTime() - todayStart.getTime()) / 86400000,
      );
      return { daysUntil, turning: year - birthYear, month, day: useDay };
    }
  }

  return null;
}

function whatsappLink(phone: string, fullName: string): string {
  let digits = phone.trim();
  if (digits.startsWith("+")) {
    digits = digits.slice(1);
  } else if (digits.startsWith("0")) {
    digits = "234" + digits.slice(1);
  }
  digits = digits.replace(/[^0-9]/g, "");

  const firstName = fullName.split(" ")[0];
  const text =
    "Happy birthday, " +
    firstName +
    "! Everyone at " +
    settings.name +
    " is celebrating you today.";
  return "https://wa.me/" + digits + "?text=" + encodeURIComponent(text);
}

function inDays(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return "in " + days + " days";
}

function AdminBirthdays() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const q = query(
          collection(db, "members"),
          where("communityId", "==", settings.communityId),
          where("status", "==", "approved"),
        );
        const snap = await getDocs(q);
        setPeople(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              fullName: String(data.fullName ?? ""),
              phone: String(data.phone ?? ""),
              dateOfBirth: String(data.dateOfBirth ?? ""),
            };
          }),
        );
      } catch (err) {
        console.error(err);
        setError(
          "Could not load birthdays. Check your connection and try again.",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const result = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const upcoming: Upcoming[] = [];

    let skipped = 0;
    for (const p of people) {
      const next = nextBirthday(p.dateOfBirth, todayStart);
      if (next === null) {
        skipped += 1;
      } else {
        upcoming.push({ ...p, ...next });
      }
    }

    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

    const today = upcoming.filter((u) => u.daysUntil === 0);
    const later = upcoming.filter((u) => u.daysUntil > 0);

    return {
      skipped,
      today,
      thisWeek: upcoming.filter((u) => u.daysUntil >= 1 && u.daysUntil <= 7),
      later: upcoming.filter((u) => u.daysUntil > 7),
      total: upcoming.length,
      nextDays: later.length > 0 ? later[0].daysUntil : null,
    };
  }, [people]);

  let subline = "Approved members, soonest first";
  if (!loading && !error && result.total > 0) {
    if (result.today.length > 0) {
      subline =
        result.today.length === 1
          ? "1 birthday today."
          : result.today.length + " birthdays today.";
    } else if (result.nextDays !== null) {
      subline =
        "No birthdays today. The next one is " +
        (result.nextDays === 1
          ? "tomorrow."
          : "in " + result.nextDays + " days.");
    }
  }

  function renderGroup(title: string, items: Upcoming[], highlight: boolean) {
    if (items.length === 0) return null;

    return (
      <section className="mb-6">
        <h2 className="mb-3 font-display text-xl font-semibold text-ink">
          {title}
        </h2>
        <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-white">
          {items.map((u) => (
            <li
              key={u.id}
              className={
                "flex items-center gap-4 px-4 py-3 " +
                (highlight ? "bg-brand-tint" : "")
              }
            >
              <div className="w-12 shrink-0 text-center">
                <p className="font-display text-2xl font-semibold leading-none text-ink">
                  {u.day}
                </p>
                <p className="mt-1 text-[13px] font-semibold text-muted">
                  {monthNames[u.month - 1]}
                </p>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-ink">
                  {u.fullName}
                </p>
                <p className="text-[13px] text-muted">
                  turning {u.turning}, {inDays(u.daysUntil)}
                </p>
              </div>

              <a
                href={whatsappLink(u.phone, u.fullName)}
                target="_blank"
                rel="noreferrer"
                aria-label={"Send greeting to " + u.fullName + " on WhatsApp"}
                className="inline-flex min-h-11 shrink-0 items-center rounded-control border border-brand bg-white px-4 text-[15px] font-semibold text-brand hover:bg-brand-tint"
              >
                Send greeting
              </a>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-[980px]">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Birthdays
        </h1>
        <p className="mb-6 mt-1 text-[15px] text-muted">{subline}</p>

        {loading && <p className="text-[15px] text-muted">Loading...</p>}
        {error && (
          <p role="alert" className="text-[15px] font-semibold text-danger">
            {error}
          </p>
        )}

        {!loading && !error && result.total === 0 && (
          <p className="text-[15px] text-muted">
            No birthdays to show yet. Birthdays appear here once members are
            approved and have a date of birth.
          </p>
        )}

        {!loading && !error && (
          <div>
            {renderGroup("Today", result.today, true)}
            {renderGroup("This week", result.thisWeek, false)}
            {renderGroup("Coming up", result.later, false)}
          </div>
        )}

        {!loading && !error && result.skipped > 0 && (
          <p className="text-[13px] text-muted">
            {result.skipped} approved member(s) have no valid date of birth and
            are not listed.
          </p>
        )}
      </div>
    </div>
  );
}

export default AdminBirthdays;
