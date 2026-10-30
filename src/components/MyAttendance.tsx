import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { settings } from "../config/settings";
import { useAuth } from "../auth/useAuth";

type Row = {
  id: string;
  title: string;
  date: string;
  status: "present" | "absent";
};

type Props = {
  // On the Attendance page, pass full to show every service.
  full?: boolean;
};

// Reads like: Fri 27 Oct 2026
function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function MyAttendance({ full = false }: Props) {
  const { user } = useAuth();
  const uid = user ? user.uid : "";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const servicesQuery = query(
          collection(db, "services"),
          where("communityId", "==", settings.communityId),
          where("finalized", "==", true),
        );
        const attendanceQuery = query(
          collection(db, "attendance"),
          where("memberId", "==", uid),
        );
        const [servicesSnap, attendanceSnap] = await Promise.all([
          getDocs(servicesQuery),
          getDocs(attendanceQuery),
        ]);

        const statusByService: Record<string, "present" | "absent"> = {};
        attendanceSnap.docs.forEach((d) => {
          const data = d.data();
          statusByService[String(data.serviceId ?? "")] =
            data.status === "present" ? "present" : "absent";
        });

        const found: Row[] = [];
        servicesSnap.docs.forEach((d) => {
          const status = statusByService[d.id];
          if (status) {
            found.push({
              id: d.id,
              title: String(d.data().title ?? ""),
              date: String(d.data().date ?? ""),
              status: status,
            });
          }
        });
        setRows(found);
      } catch (err) {
        console.error(err);
        setError(
          "Could not load your attendance. Check your connection and refresh.",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [uid]);

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => b.date.localeCompare(a.date));
  }, [rows]);

  const stats = useMemo(() => {
    const total = rows.length;
    const present = rows.filter((r) => r.status === "present").length;
    const percent = total === 0 ? 0 : Math.round((present / total) * 100);
    return { total, present, percent };
  }, [rows]);

  const gap = full ? "" : " mt-3";

  return (
    <section className="rounded-panel border border-line bg-white p-4">
      {!full && (
        <h2 className="font-display text-xl font-semibold text-ink">
          My attendance
        </h2>
      )}

      {loading && <p className={"text-[15px] text-muted" + gap}>Loading...</p>}
      {error && (
        <p
          role="alert"
          className={"text-[15px] font-semibold text-danger" + gap}
        >
          {error}
        </p>
      )}

      {!loading && !error && rows.length === 0 && (
        <p className={"text-[15px] text-muted" + gap}>
          No finalised services yet. Your attendance appears here after a leader
          finalises a service.
        </p>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className={full ? "" : "mt-2"}>
          <p className="text-[15px] text-ink">
            {stats.present} of {stats.total}{" "}
            {stats.total === 1 ? "service" : "services"} attended
          </p>
          <div
            aria-hidden="true"
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-tint"
          >
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: stats.percent + "%" }}
            />
          </div>
          <p className="mt-1 text-[13px] text-muted">{stats.percent}% so far</p>

          {full ? (
            <ul className="mt-3 divide-y divide-line border-t border-line">
              {sorted.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink">
                      {r.title}
                    </p>
                    <p className="text-[13px] text-muted">
                      {formatDate(r.date)}
                    </p>
                  </div>
                  <span
                    className={
                      "shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold " +
                      (r.status === "present"
                        ? "bg-ok-bg text-ok"
                        : "border border-line bg-white text-muted")
                    }
                  >
                    {r.status === "present" ? "Present" : "Absent"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Link
              to="/member/attendance"
              className="mt-2 flex min-h-11 items-center border-t border-line text-[15px] font-semibold text-brand hover:text-brand-dark"
            >
              See all services
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

export default MyAttendance;
