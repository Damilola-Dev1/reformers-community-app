import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { settings } from "../config/settings";
import { useAuth } from "../auth/useAuth";

type NextService = {
  id: string;
  title: string;
  date: string;
  time: string;
};

type Mark = "none" | "present" | "absent";

const JOIN_MINUTES_BEFORE = 10;

function todayLocal(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + month + "-" + day;
}

function parseLocal(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function startOf(service: NextService): Date | null {
  const day = parseLocal(service.date);
  const match = /^(\d{2}):(\d{2})$/.exec(service.time);
  if (!day || !match) return null;
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Number(match[1]),
    Number(match[2]),
  );
}

function joinIsOpen(service: NextService, nowMs: number): boolean {
  const day = parseLocal(service.date);
  if (!day) return false;
  const start = startOf(service);
  if (!start) {
    return service.date === todayLocal();
  }
  const opensAt = start.getTime() - JOIN_MINUTES_BEFORE * 60000;
  const endOfDay = new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate() + 1,
  ).getTime();
  return nowMs >= opensAt && nowMs < endOfDay;
}

// Reads like: Fri 27 Oct 2026
function formatDate(value: string): string {
  const date = parseLocal(value);
  if (!date) return value;
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return hour12 + ":" + match[2] + " " + suffix;
}

function whenLabel(value: string): string {
  const date = parseLocal(value);
  const today = parseLocal(todayLocal());
  if (!date || !today) return "";
  const days = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return "In " + days + " days";
}

function plural(n: number, word: string): string {
  return n + " " + word + (n === 1 ? "" : "s");
}

function countdownText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return plural(days, "day") + " " + plural(hours, "hour");
  if (hours > 0) return plural(hours, "hour") + " " + plural(minutes, "minute");
  return plural(minutes, "minute") + " " + plural(seconds, "second");
}

function NextMeeting() {
  const { user } = useAuth();
  const [service, setService] = useState<NextService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [mark, setMark] = useState<Mark>("none");
  const [detailsError, setDetailsError] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");
  const [now, setNow] = useState(Date.now());

  const uid = user ? user.uid : "";

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    async function load() {
      let found: NextService | null = null;

      try {
        const q = query(
          collection(db, "services"),
          where("communityId", "==", settings.communityId),
          where("finalized", "==", false),
        );
        const snap = await getDocs(q);
        const today = todayLocal();
        const upcoming = snap.docs
          .map((d) => ({
            id: d.id,
            title: String(d.data().title ?? ""),
            date: String(d.data().date ?? ""),
            time: String(d.data().time ?? ""),
          }))
          .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date) && s.date >= today)
          .sort((a, b) =>
            (a.date + " " + (a.time || "99:99")).localeCompare(
              b.date + " " + (b.time || "99:99"),
            ),
          );
        found = upcoming.length > 0 ? upcoming[0] : null;
        setService(found);
      } catch (err) {
        console.error(err);
        setError(
          "Could not load the next meeting. Check your connection and refresh.",
        );
        setLoading(false);
        return;
      }

      if (found && uid) {
        try {
          const linkSnap = await getDoc(
            doc(db, "communitySettings", settings.communityId),
          );
          const value = linkSnap.exists() ? linkSnap.data().meetingLink : "";
          setLink(typeof value === "string" ? value : "");

          const markQuery = query(
            collection(db, "attendance"),
            where("memberId", "==", uid),
            where("serviceId", "==", found.id),
          );
          const markSnap = await getDocs(markQuery);
          if (!markSnap.empty) {
            setMark(
              markSnap.docs[0].data().status === "present"
                ? "present"
                : "absent",
            );
          }
        } catch (err) {
          console.error(err);
          setDetailsError(
            "Could not check the meeting link or your attendance. Refresh to try again.",
          );
        }
      }

      setLoading(false);
    }

    load();
  }, [uid]);

  const hasLink = link.startsWith("https://");
  const canJoin = service !== null && joinIsOpen(service, now);
  const start = service ? startOf(service) : null;

  async function handleJoin() {
    if (!service || !uid || !hasLink) return;
    if (!joinIsOpen(service, Date.now())) return;

    setJoinError("");
    setJoining(true);
    const win = window.open("", "_blank");

    try {
      if (mark === "none") {
        await setDoc(doc(db, "attendance", service.id + "_" + uid), {
          communityId: settings.communityId,
          serviceId: service.id,
          memberId: uid,
          status: "present",
          markedBy: "member",
          markedAt: serverTimestamp(),
        });
        setMark("present");
      }
      if (win) {
        win.opener = null;
        win.location.href = link;
      } else {
        window.location.href = link;
      }
    } catch (err) {
      console.error(err);
      if (win) win.close();
      setJoinError(
        "Could not record your attendance, so the link was not opened. Please try again.",
      );
    } finally {
      setJoining(false);
    }
  }

  let countdown = "";
  if (start) {
    const msToStart = start.getTime() - now;
    countdown =
      msToStart > 0
        ? "Starts in " + countdownText(msToStart)
        : "The meeting has started";
  }

  let hint = "";
  if (service && !canJoin) {
    hint = start
      ? "Join opens " +
        JOIN_MINUTES_BEFORE +
        " minutes before the meeting starts."
      : "Join opens on the day of the meeting.";
  } else if (service && !hasLink) {
    hint = "The meeting link has not been set yet. Please check back soon.";
  }

  if (!loading && !error && !service) {
    return (
      <section className="rounded-panel border border-line bg-white p-4">
        <h2 className="font-display text-xl font-semibold text-ink">
          Next meeting
        </h2>
        <p className="mt-3 text-[15px] text-muted">
          No upcoming meeting yet. It will appear here once a leader creates
          one.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-panel bg-brand p-4 text-white">
      <p className="text-[13px] font-semibold text-brand-tint">Next meeting</p>

      {loading && <p className="mt-3 text-[15px]">Loading...</p>}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-control bg-danger-bg px-3 py-2 text-[15px] font-semibold text-danger"
        >
          {error}
        </p>
      )}

      {!loading && !error && service && (
        <div className="mt-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-2xl font-semibold">
                {service.title}
              </p>
              <p className="mt-0.5 text-[15px] text-brand-tint">
                {formatDate(service.date)}
                {service.time ? ", " + formatTime(service.time) : ""}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-brand-tint px-3 py-1 text-[13px] font-semibold text-ink">
              {whenLabel(service.date)}
            </span>
          </div>

          {countdown && (
            <p className="mt-3 text-[15px] font-semibold">{countdown}</p>
          )}

          {mark === "present" && (
            <p className="mt-3 rounded-control bg-ok-bg px-3 py-2 text-[15px] font-semibold text-ok">
              You are marked present.
            </p>
          )}
          {mark === "absent" && (
            <p className="mt-3 rounded-control bg-danger-bg px-3 py-2 text-[15px] font-semibold text-danger">
              You are marked absent for this meeting. Please ask a leader to
              correct it.
            </p>
          )}

          {detailsError && (
            <p
              role="alert"
              className="mt-3 rounded-control bg-danger-bg px-3 py-2 text-[15px] font-semibold text-danger"
            >
              {detailsError}
            </p>
          )}
          {joinError && (
            <p
              role="alert"
              className="mt-3 rounded-control bg-danger-bg px-3 py-2 text-[15px] font-semibold text-danger"
            >
              {joinError}
            </p>
          )}
          {hint && <p className="mt-3 text-[13px] text-brand-tint">{hint}</p>}

          <button
            type="button"
            onClick={handleJoin}
            disabled={joining || !canJoin || !hasLink || detailsError !== ""}
            className="mt-4 min-h-11 w-full rounded-control bg-white px-4 text-[15px] font-semibold text-brand hover:bg-brand-tint disabled:opacity-60"
          >
            {joining
              ? "Joining..."
              : mark === "present"
                ? "Open meeting again"
                : "Join and record attendance"}
          </button>
        </div>
      )}
    </section>
  );
}

export default NextMeeting;
