import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  ArrowRight,
  CaretLeft,
  CaretRight,
  Clock,
  Gift,
} from "@phosphor-icons/react";

import { db } from "../firebase";
import { settings } from "../config/settings";
import { useAuth } from "../auth/useAuth";
import NextMeeting from "../components/NextMeeting";
import MemberGrowthChart from "../components/MemberGrowthChart";

type Person = {
  id: string;
  fullName: string;
  status: "pending" | "approved" | "deactivated";
  gender: string;
  dateOfBirth: string;
  createdAt: Date | null;
};

type AttendanceStats = {
  present: number;
  total: number;
  services: number;
};

type UpcomingBirthday = {
  id: string;
  fullName: string;
  days: number;
  turning: number;
  label: string;
};

type MonthBirthday = {
  id: string;
  fullName: string;
  day: number;
  weekday: string;
  turning: number;
  diff: number;
};

const MONTHS = [
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

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_LIMIT = 6;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Works out the next birthday from a date like 2002-11-25.
function nextBirthday(dateOfBirth: string, today: Date) {
  const parts = dateOfBirth.split("-").map(Number);
  const year = parts[0];
  const month = parts[1];
  const day = parts[2];
  if (!year || !month || !day) return null;

  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  let next = new Date(start.getFullYear(), month - 1, day);
  if (next < start) next = new Date(start.getFullYear() + 1, month - 1, day);

  const days = Math.round((next.getTime() - start.getTime()) / 86400000);
  const label = String(day).padStart(2, "0") + " " + MONTHS[month - 1];
  return { days, turning: next.getFullYear() - year, label };
}

// "Today", "Tomorrow", "in 4 days" or "Passed" for a birthday this month.
function statusText(diff: number): string {
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1) return "in " + diff + " days";
  return "Passed";
}

// "Ada", "Ada and Tunde", "Ada, Tunde and Ngozi", "Ada, Tunde, Ngozi and 2 more"
function joinNames(names: string[], total: number): string {
  const shown = names.slice(0, 3);
  const rest = total - shown.length;
  if (rest > 0) return shown.join(", ") + " and " + rest + " more";
  if (shown.length === 1) return shown[0];
  return shown.slice(0, -1).join(", ") + " and " + shown[shown.length - 1];
}

type StatProps = {
  label: string;
  value: string;
  note: string;
  bar?: number;
  barClass?: string;
  filled?: boolean;
  accent?: boolean;
};

function Stat({
  label,
  value,
  note,
  bar,
  barClass,
  filled,
  accent,
}: StatProps) {
  return (
    <div className={filled ? "bg-brand p-4 text-white" : "bg-white p-4"}>
      <p
        className={
          "text-[13px] font-semibold " +
          (filled ? "text-brand-tint" : "text-muted")
        }
      >
        {label}
      </p>
      <p
        className={
          "mt-1 font-display text-3xl font-semibold " +
          (filled ? "text-white" : accent ? "text-brand" : "text-ink")
        }
      >
        {value}
      </p>
      {bar !== undefined && (
        <div
          aria-hidden="true"
          className={
            "mt-2 h-1.5 w-full overflow-hidden rounded-full " +
            (filled ? "bg-brand-dark" : "bg-brand-tint")
          }
        >
          <div
            className={
              "h-full rounded-full " +
              (filled ? "bg-white" : (barClass ?? "bg-brand"))
            }
            style={{ width: bar + "%" }}
          />
        </div>
      )}
      <p
        className={
          "mt-2 text-[13px] " + (filled ? "text-brand-tint" : "text-muted")
        }
      >
        {note}
      </p>
    </div>
  );
}

function AdminDashboard() {
  const { profile } = useAuth();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attendance, setAttendance] = useState<AttendanceStats | null>(null);
  const [attendanceError, setAttendanceError] = useState(false);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const [cursor, setCursor] = useState(() => {
    const n = new Date();
    return { year: n.getFullYear(), month: n.getMonth() };
  });

  useEffect(() => {
    async function load() {
      let approvedIds = new Set<string>();

      try {
        const q = query(
          collection(db, "members"),
          where("communityId", "==", settings.communityId),
        );
        const snap = await getDocs(q);
        const loaded = snap.docs.map((d) => {
          const data = d.data();
          const created =
            data.createdAt && typeof data.createdAt.toDate === "function"
              ? (data.createdAt.toDate() as Date)
              : null;
          return {
            id: d.id,
            fullName: String(data.fullName ?? ""),
            status:
              data.status === "approved"
                ? "approved"
                : data.status === "deactivated"
                  ? "deactivated"
                  : "pending",
            gender: String(data.gender ?? ""),
            dateOfBirth: String(data.dateOfBirth ?? ""),
            createdAt: created,
          } as Person;
        });
        setPeople(loaded);
        approvedIds = new Set(
          loaded.filter((p) => p.status === "approved").map((p) => p.id),
        );
      } catch (err) {
        console.error(err);
        setError(
          "Could not load the numbers. Check your connection and try again.",
        );
        setLoading(false);
        return;
      }

      try {
        const servicesQuery = query(
          collection(db, "services"),
          where("communityId", "==", settings.communityId),
          where("finalized", "==", true),
        );
        const servicesSnap = await getDocs(servicesQuery);
        const finalizedIds = new Set(servicesSnap.docs.map((d) => d.id));

        if (finalizedIds.size === 0) {
          setAttendance({ present: 0, total: 0, services: 0 });
        } else {
          const attendanceQuery = query(
            collection(db, "attendance"),
            where("communityId", "==", settings.communityId),
          );
          const attendanceSnap = await getDocs(attendanceQuery);

          let present = 0;
          let total = 0;
          attendanceSnap.docs.forEach((d) => {
            const data = d.data();
            if (
              finalizedIds.has(String(data.serviceId ?? "")) &&
              approvedIds.has(String(data.memberId ?? ""))
            ) {
              total += 1;
              if (data.status === "present") present += 1;
            }
          });
          setAttendance({ present, total, services: finalizedIds.size });
        }
      } catch (err) {
        console.error(err);
        setAttendanceError(true);
      } finally {
        setSyncedAt(new Date());
        setLoading(false);
      }
    }

    load();
  }, []);

  const upcoming = useMemo(() => {
    const today = new Date();
    const list: UpcomingBirthday[] = [];
    people.forEach((p) => {
      if (p.status !== "approved") return;
      const next = nextBirthday(p.dateOfBirth, today);
      if (!next) return;
      list.push({ id: p.id, fullName: p.fullName, ...next });
    });
    list.sort((a, b) => a.days - b.days);
    return list;
  }, [people]);

  // Everyone celebrating in the month shown in the Birthdays panel.
  const month = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const isThisMonth =
      cursor.year === now.getFullYear() && cursor.month === now.getMonth();
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const list: MonthBirthday[] = [];

    people.forEach((p) => {
      if (p.status !== "approved") return;
      const parts = p.dateOfBirth.split("-").map(Number);
      const birthYear = parts[0];
      const birthMonth = parts[1];
      const birthDay = parts[2];
      if (!birthYear || !birthMonth || !birthDay) return;
      if (birthMonth - 1 !== cursor.month) return;

      const day = Math.min(birthDay, daysInMonth);
      const date = new Date(cursor.year, cursor.month, day);
      const diff = Math.round(
        (date.getTime() - todayStart.getTime()) / 86400000,
      );
      list.push({
        id: p.id,
        fullName: p.fullName,
        day: day,
        weekday: date.toLocaleDateString("en-GB", { weekday: "short" }),
        turning: cursor.year - birthYear,
        diff: diff,
      });
    });

    list.sort((a, b) => a.day - b.day || a.fullName.localeCompare(b.fullName));

    const title =
      "Birthdays in " +
      MONTH_NAMES[cursor.month] +
      (cursor.year !== now.getFullYear() ? " " + cursor.year : "");

    return { list, isThisMonth, title };
  }, [people, cursor]);

  function moveMonth(step: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + step, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function backToThisMonth() {
    const n = new Date();
    setCursor({ year: n.getFullYear(), month: n.getMonth() });
  }

  const stats = useMemo(() => {
    const approved = people.filter((p) => p.status === "approved");
    // Oldest request first, so the person who has waited longest is named first.
    const pendingPeople = people
      .filter((p) => p.status === "pending")
      .sort(
        (a, b) =>
          (a.createdAt ? a.createdAt.getTime() : Number.MAX_SAFE_INTEGER) -
          (b.createdAt ? b.createdAt.getTime() : Number.MAX_SAFE_INTEGER),
      );

    return {
      totalMembers: approved.length,
      pending: pendingPeople.length,
      pendingNames: pendingPeople.map((p) => p.fullName || "A new member"),
      // Approved and pending only. Deactivated people are not counted.
      totalRegistered: approved.length + pendingPeople.length,
      males: approved.filter((p) => p.gender === "male").length,
      females: approved.filter((p) => p.gender === "female").length,
      birthdaysToday: upcoming.filter((b) => b.days === 0).length,
    };
  }, [people, upcoming]);

  const birthdayNote = useMemo(() => {
    if (upcoming.length === 0) return "No birthdays saved";
    const next = upcoming.find((b) => b.days > 0);
    if (stats.birthdaysToday > 0) return "Today";
    return next ? "Next in " + next.days + " days" : "";
  }, [upcoming, stats.birthdaysToday]);

  const attendanceCard = useMemo(() => {
    if (loading) return { value: "...", note: "" };
    if (attendanceError)
      return { value: "-", note: "Could not load attendance" };
    if (!attendance || attendance.total === 0) {
      return { value: "-", note: "Finalise a service to see this" };
    }

    const percent = Math.round((attendance.present / attendance.total) * 100);
    const word = attendance.services === 1 ? "service" : "services";
    return {
      value: percent + "%",
      note: attendance.services + " finalised " + word,
    };
  }, [loading, attendanceError, attendance]);

  const attendancePercent =
    attendance && attendance.total > 0
      ? Math.round((attendance.present / attendance.total) * 100)
      : 0;
  const genderTotal = stats.males + stats.females;
  const menShare =
    genderTotal === 0 ? 0 : Math.round((stats.males / genderTotal) * 100);
  const womenShare = genderTotal === 0 ? 0 : 100 - menShare;

  const growthMembers = useMemo(() => {
    const list: { date: Date; gender: string }[] = [];
    people.forEach((p) => {
      if (p.status === "approved" && p.createdAt) {
        list.push({ date: p.createdAt, gender: p.gender });
      }
    });
    return list;
  }, [people]);

  const firstName = profile?.fullName.split(" ")[0] ?? "";
  const greeting = getGreeting();

  function show(n: number): string {
    return loading ? "..." : String(n);
  }

  let summary = "";
  if (!loading && !error) {
    summary =
      stats.totalMembers +
      (stats.totalMembers === 1 ? " approved member." : " approved members.");
    if (stats.pending === 1) summary += " One person is waiting for approval.";
    if (stats.pending > 1)
      summary += " " + stats.pending + " people are waiting for approval.";
  }

  let pendingText = "";
  if (stats.pending === 1) {
    pendingText =
      joinNames(stats.pendingNames, 1) + " is waiting for approval.";
  } else if (stats.pending > 1) {
    pendingText =
      stats.pending +
      " people are waiting for approval: " +
      joinNames(stats.pendingNames, stats.pending) +
      ".";
  }

  const shownMonth = month.list.slice(0, MONTH_LIMIT);
  const hiddenMonth = month.list.length - shownMonth.length;
  const monthName = MONTH_NAMES[cursor.month];

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-[980px]">
        <div aria-hidden="true" className="mb-3 h-0.5 w-10 bg-gold" />
        <h1 className="font-display text-3xl font-semibold text-ink">
          {firstName ? greeting + ", " + firstName : greeting}
        </h1>
        <p className="mt-1 text-[15px] text-muted">
          {loading
            ? "Loading the numbers..."
            : summary || "Here is the overview of " + settings.name}
        </p>

        {error && (
          <p
            role="alert"
            className="mt-4 text-[15px] font-semibold text-danger"
          >
            {error}
          </p>
        )}

        {!loading && stats.pending > 0 && (
          <section
            aria-label="Pending requests"
            className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-panel bg-warn-bg px-4 py-3"
          >
            <p className="flex items-start gap-2 text-[15px] text-ink">
              <Clock
                size={20}
                aria-hidden="true"
                className="mt-0.5 shrink-0 text-warn"
              />
              <span>
                <span className="font-semibold text-warn">Pending. </span>
                {pendingText}
              </span>
            </p>
            <Link
              to="/admin/members?filter=pending"
              className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-dark"
            >
              Review {stats.pending === 1 ? "request" : "requests"}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </section>
        )}

        <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
          <Stat
            label="Members"
            value={show(stats.totalMembers)}
            note="Approved"
          />
          <Stat
            label="Registered"
            value={show(stats.totalRegistered)}
            note="Approved and pending"
          />
          <Stat
            label="Birthdays today"
            value={show(stats.birthdaysToday)}
            note={loading ? "" : birthdayNote}
            accent={!loading && stats.birthdaysToday > 0}
          />
          <Stat
            label="Men"
            value={show(stats.males)}
            note={loading ? "" : menShare + "% of members"}
            bar={loading ? undefined : menShare}
          />
          <Stat
            label="Women"
            value={show(stats.females)}
            note={loading ? "" : womenShare + "% of members"}
            bar={loading ? undefined : womenShare}
            barClass="bg-teal"
          />
          <Stat
            label="Attendance"
            value={attendanceCard.value}
            note={attendanceCard.note}
            filled
            bar={
              loading ||
              attendanceError ||
              !attendance ||
              attendance.total === 0
                ? undefined
                : attendancePercent
            }
          />
        </div>

        {syncedAt && !error && (
          <p className="mt-2 text-[13px] text-muted">
            Updated at {formatTime(syncedAt)}
          </p>
        )}

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-panel border border-line bg-white p-4">
            <MemberGrowthChart members={growthMembers} loading={loading} />
          </div>

          <section className="rounded-panel border border-line bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-tint text-brand"
                >
                  <Gift size={20} />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-xl font-semibold leading-tight text-ink">
                    {month.title}
                  </h2>
                  {!loading && (
                    <p className="text-[13px] text-muted">
                      {month.list.length === 0
                        ? "No one is celebrating"
                        : month.list.length === 1
                          ? "1 person celebrating"
                          : month.list.length + " people celebrating"}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => moveMonth(-1)}
                  aria-label="Previous month"
                  className="flex size-11 items-center justify-center rounded-control border border-line bg-white text-ink transition-colors duration-150 hover:bg-brand-tint"
                >
                  <CaretLeft size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => moveMonth(1)}
                  aria-label="Next month"
                  className="flex size-11 items-center justify-center rounded-control border border-line bg-white text-ink transition-colors duration-150 hover:bg-brand-tint"
                >
                  <CaretRight size={18} aria-hidden="true" />
                </button>
              </div>
            </div>

            {loading ? (
              <p className="mt-3 text-[15px] text-muted">Loading...</p>
            ) : month.list.length === 0 ? (
              <p className="mt-3 text-[15px] text-muted">
                No birthdays in {monthName}. Use the arrows to look at other
                months.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line border-t border-line">
                {shownMonth.map((b) => {
                  const today = month.isThisMonth && b.diff === 0;
                  return (
                    <li key={b.id} className="flex items-center gap-3 py-3">
                      <div
                        aria-hidden="true"
                        className={
                          "flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-control " +
                          (today
                            ? "bg-brand text-white"
                            : "bg-brand-tint text-brand")
                        }
                      >
                        <span className="font-display text-xl font-semibold leading-none">
                          {b.day}
                        </span>
                        <span className="mt-1 text-[13px] font-semibold leading-none">
                          {b.weekday}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-ink">
                          {b.fullName || "Unnamed member"}
                        </p>
                        <p className="text-[13px] text-muted">
                          {b.day} {MONTHS[cursor.month]}, turning {b.turning}
                        </p>
                      </div>

                      {month.isThisMonth && (
                        <span
                          className={
                            "shrink-0 text-[13px] font-semibold " +
                            (today
                              ? "rounded-full bg-brand px-3 py-1 text-white"
                              : "text-muted")
                          }
                        >
                          {statusText(b.diff)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {!loading && hiddenMonth > 0 && (
              <p className="border-t border-line pt-3 text-[13px] text-muted">
                and {hiddenMonth} more in {monthName}
              </p>
            )}

            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-4">
              <Link
                to="/admin/birthdays"
                className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-dark"
              >
                All birthdays
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
              {!month.isThisMonth && (
                <button
                  type="button"
                  onClick={backToThisMonth}
                  className="min-h-11 text-[15px] font-semibold text-brand hover:text-brand-dark"
                >
                  This month
                </button>
              )}
            </div>
          </section>
        </div>

        <div className="mt-6">
          <NextMeeting />
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;
