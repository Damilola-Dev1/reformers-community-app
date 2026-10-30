import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { settings } from "../config/settings";
import { useAuth } from "../auth/useAuth";
import { phaseOf } from "../utils/deadline";
import Brand from "../components/Brand";
import VerseOfTheDay from "../components/VerseOfTheDay";
import NextMeeting from "../components/NextMeeting";
import MyAttendance from "../components/MyAttendance";
import MemberAnnouncements from "../components/MemberAnnouncements";
import MemberAssignments from "../components/MemberAssignments";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

// Deadline as a timestamp. With no time set, the day counts until 23:59.
function dueMs(dueDate: string, dueTime: string): number | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!day) return null;
  const time = /^(\d{2}):(\d{2})$/.exec(dueTime);
  const hour = time ? Number(time[1]) : 23;
  const minute = time ? Number(time[2]) : 59;
  return new Date(
    Number(day[1]),
    Number(day[2]) - 1,
    Number(day[3]),
    hour,
    minute,
  ).getTime();
}

function MemberHome() {
  const { user, profile } = useAuth();
  const uid = user ? user.uid : "";
  const fullName = profile?.fullName ?? "";
  const firstName = fullName.split(" ")[0];
  const greeting = getGreeting();
  const [dueCount, setDueCount] = useState<number | null>(null);

  useEffect(() => {
    if (!uid) return;

    async function load() {
      try {
        const assignmentsSnap = await getDocs(
          query(
            collection(db, "assignments"),
            where("communityId", "==", settings.communityId),
          ),
        );
        const submissionsSnap = await getDocs(
          query(collection(db, "submissions"), where("memberId", "==", uid)),
        );

        // A submission counts as done unless a leader asked for a revision.
        const done = new Set<string>();
        submissionsSnap.docs.forEach((d) => {
          const status = String(d.data().status ?? "submitted");
          if (status !== "revision")
            done.add(String(d.data().assignmentId ?? ""));
        });

        const now = Date.now();
        let count = 0;
        assignmentsSnap.docs.forEach((d) => {
          const data = d.data();
          const dueDate = String(data.dueDate ?? "");
          const dueTime = String(data.dueTime ?? "");
          const extraHours = Number(data.extraHours ?? 0) || 0;
          const due = dueMs(dueDate, dueTime);
          if (due === null || done.has(d.id)) return;
          if (phaseOf({ dueDate, dueTime, extraHours }, now) !== "open") return;
          if (due - now <= WEEK_MS) count += 1;
        });
        setDueCount(count);
      } catch (err) {
        console.error(err);
      }
    }

    load();
  }, [uid]);

  let subline = "";
  if (dueCount !== null) {
    subline =
      dueCount === 0
        ? "Nothing is due this week."
        : "You have " +
          dueCount +
          (dueCount === 1 ? " assignment" : " assignments") +
          " due this week.";
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between gap-3">
          <Brand />
          <Link
            to="/member/profile"
            aria-label="My profile"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[13px] font-semibold text-brand hover:bg-line"
          >
            {initialsOf(fullName)}
          </Link>
        </div>

        <h1 className="mt-6 font-display text-3xl font-semibold text-ink">
          {firstName ? greeting + ", " + firstName : greeting}
        </h1>
        <p className="mb-6 mt-1 min-h-[22px] text-[15px] text-muted">
          {subline}
        </p>

        <div className="space-y-4">
          <NextMeeting />
          <MemberAssignments limit={3} />
          <MyAttendance />
          <MemberAnnouncements />
          <VerseOfTheDay />
        </div>
      </div>
    </div>
  );
}

export default MemberHome;
