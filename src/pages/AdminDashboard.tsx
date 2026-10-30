import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { ArrowRight } from "@phosphor-icons/react";

import { db } from "../firebase";
import { settings } from "../config/settings";
import { useAuth } from "../auth/useAuth";
import NextMeeting from "../components/NextMeeting";
import MemberGrowthChart from "../components/MemberGrowthChart";

type Person = {
  id: string;
  fullName: string;
  status: "pending" | "approved";
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

function daysText(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return days + " days";
}

type StatProps = {
  label: string;
  value: string;
  note: string;
};

function Stat({ label, value, note }: StatProps) {
  return (
    <div className="bg-cream p-4">
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold text-ink">
        {value}
      </p>
      <p className="mt-1 text-[13px] text-muted">{note}</p>
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
            status: data.status === "approved" ? "approved" : "pending",
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

  const stats = useMemo(() => {
    const approved = people.filter((p) => p.status === "approved");
    const pendingPeople = people.filter((p) => p.status === "pending");

    return {
      totalMembers: approved.length,
      pending: pendingPeople.length,
      firstPendingName: pendingPeople[0]?.fullName ?? "",
      totalRegistered: people.length,
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
      (stats.firstPendingName || "One person") + " is waiting for approval.";
  } else if (stats.pending > 1) {
    pendingText = stats.pending + " people are waiting for approval.";
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-[980px]">
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
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-panel border border-line bg-white px-4 py-3">
            <p className="text-[15px] text-ink">{pendingText}</p>
            <Link
              to="/admin/members"
              className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-dark"
            >
              Review {stats.pending === 1 ? "request" : "requests"}
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-px border-y border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
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
          />
          <Stat label="Men" value={show(stats.males)} note="Approved" />
          <Stat label="Women" value={show(stats.females)} note="Approved" />
          <Stat
            label="Attendance"
            value={attendanceCard.value}
            note={attendanceCard.note}
          />
        </div>

        {syncedAt && !error && (
          <p className="mt-2 text-[13px] text-muted">
            Updated at {formatTime(syncedAt)}
          </p>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-panel border border-line bg-white p-4">
            <MemberGrowthChart members={growthMembers} loading={loading} />
          </div>

          <section className="rounded-panel border border-line bg-white p-4">
            <h2 className="font-display text-xl font-semibold text-ink">
              Birthdays coming up
            </h2>
            {loading ? (
              <p className="mt-3 text-[15px] text-muted">Loading...</p>
            ) : upcoming.length === 0 ? (
              <p className="mt-3 text-[15px] text-muted">
                No birthdays yet. They appear here once approved members have a
                date of birth saved.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {upcoming.slice(0, 5).map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-[15px] font-semibold text-ink">
                        {b.fullName || "Unnamed member"}
                      </p>
                      <p className="text-[13px] text-muted">
                        {b.label}, turning {b.turning}
                      </p>
                    </div>
                    <p className="shrink-0 text-[13px] font-semibold text-muted">
                      {daysText(b.days)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Link
              to="/admin/birthdays"
              className="mt-2 inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-dark"
            >
              All birthdays
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
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
