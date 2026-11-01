import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { settings } from "../config/settings";
import { formatDeadline, phaseOf } from "../utils/deadline";
import ListSkeleton from "./ListSkeleton";

type Assignment = {
  id: string;
  title: string;
  dueDate: string;
  dueTime: string;
  extraHours: number;
  createdAt: Date | null;
};

type Props = {
  // On Home, pass a number to show a short list with a link to the full page.
  // Leave it out on the Assignments page to show everything.
  limit?: number;
};

function tagLabel(status: string | undefined, closed: boolean): string {
  if (status === "approved") return "Approved";
  if (status === "revision") return "Needs revision";
  if (status === "submitted") return "Submitted";
  if (closed) return "Closed";
  return "Not submitted";
}

function tagClass(status: string | undefined, closed: boolean): string {
  if (status === "approved") return "bg-ok-bg text-ok";
  if (status === "revision") return "bg-warn-bg text-warn";
  if (status === "submitted") return "bg-brand-tint text-ink";
  if (closed) return "bg-danger-bg text-danger";
  return "bg-warn-bg text-warn";
}

function MemberAssignments({ limit }: Props) {
  const [items, setItems] = useState<Assignment[]>([]);
  const [statuses, setStatuses] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const q = query(
          collection(db, "assignments"),
          where("communityId", "==", settings.communityId),
        );
        const snap = await getDocs(q);
        const loaded = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title ?? ""),
            dueDate: String(data.dueDate ?? ""),
            dueTime: String(data.dueTime ?? ""),
            extraHours: Number(data.extraHours ?? 0) || 0,
            createdAt:
              data.createdAt && typeof data.createdAt.toDate === "function"
                ? (data.createdAt.toDate() as Date)
                : null,
          };
        });
        loaded.sort(
          (a, b) =>
            (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0),
        );
        setItems(loaded);
      } catch (err) {
        console.error(err);
        setError("Could not load assignments.");
        setLoading(false);
        return;
      }

      try {
        const uid = auth.currentUser?.uid ?? "";
        const subQuery = query(
          collection(db, "submissions"),
          where("memberId", "==", uid),
        );
        const subSnap = await getDocs(subQuery);
        const map = new Map<string, string>();
        subSnap.docs.forEach((d) => {
          map.set(
            String(d.data().assignmentId ?? ""),
            String(d.data().status ?? "submitted"),
          );
        });
        setStatuses(map);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const now = Date.now();
  const compact = limit !== undefined;
  const shown = compact ? items.slice(0, limit) : items;
  const gap = compact ? " mt-3" : "";

  return (
    <section className="rounded-panel border border-line bg-white p-4">
      {compact && (
        <h2 className="font-display text-xl font-semibold text-ink">
          Assignments
        </h2>
      )}

      {loading && (
        <div className={compact ? "mt-3 border-t border-line" : ""}>
          <ListSkeleton rows={compact ? 2 : 4} bare />
        </div>
      )}
      {error && (
        <p
          role="alert"
          className={"text-[15px] font-semibold text-danger" + gap}
        >
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className={"text-[15px] text-muted" + gap}>
          No assignments yet. When a leader posts one, it appears here.
        </p>
      )}

      {shown.length > 0 && (
        <ul
          className={
            "divide-y divide-line" +
            (compact ? " mt-3 border-t border-line" : "")
          }
        >
          {shown.map((a) => {
            const status = statuses.get(a.id);
            const phase = phaseOf(a, now);
            const closed = phase === "closed" && status === undefined;
            const overdue =
              phase !== "open" &&
              (status === undefined || status === "revision");
            return (
              <li key={a.id}>
                <Link
                  to={"/member/assignments/" + a.id}
                  className="flex min-h-11 items-center justify-between gap-3 py-3 hover:bg-cream"
                >
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-ink">
                      {a.title}
                    </p>
                    <p
                      className={
                        "text-[13px] " +
                        (overdue ? "font-semibold text-danger" : "text-muted")
                      }
                    >
                      {a.dueDate
                        ? (overdue ? "Overdue: was due " : "Due ") +
                          formatDeadline(a)
                        : "No due date"}
                    </p>
                    {phase === "extra" && status === undefined && (
                      <p className="text-[13px] font-semibold text-warn">
                        Extra time is running
                      </p>
                    )}
                  </div>
                  <span
                    className={
                      "shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold " +
                      tagClass(status, closed)
                    }
                  >
                    {tagLabel(status, closed)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {compact && items.length > 0 && (
        <Link
          to="/member/assignments"
          className="flex min-h-11 items-center border-t border-line text-[15px] font-semibold text-brand hover:text-brand-dark"
        >
          See all assignments
        </Link>
      )}
    </section>
  );
}

export default MemberAssignments;
