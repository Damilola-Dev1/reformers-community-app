import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { settings } from "../config/settings";
import { APP_URL, openWhatsAppShare } from "../config/whatsapp";
import { closesAtOf, deadlineOf, formatDeadline } from "../utils/deadline";
import ExtendTime from "../components/ExtendTime";

type Assignment = {
  id: string;
  title: string;
  instructions: string;
  dueDate: string;
  dueTime: string;
  extraHours: number;
  createdAt: Date | null;
};

type SubInfo = {
  assignmentId: string;
  status: string;
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

const fieldClass =
  "min-h-11 w-full rounded-control border border-line bg-white px-3 text-[15px] text-ink placeholder:text-muted";

function todayString(): string {
  const n = new Date();
  return (
    n.getFullYear() +
    "-" +
    String(n.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(n.getDate()).padStart(2, "0")
  );
}

// Reads like: 28 Oct 2026
function formatWhen(value: Date | null): string {
  if (!value) return "";
  return (
    value.getDate() + " " + MONTHS[value.getMonth()] + " " + value.getFullYear()
  );
}

// Long instructions are shortened to 3 lines with a Read more link.
function isLong(text: string): boolean {
  return text.length > 180 || text.split("\n").length > 3;
}

function AdminAssignments() {
  const [items, setItems] = useState<Assignment[]>([]);
  const [subs, setSubs] = useState<SubInfo[]>([]);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [extraHours, setExtraHours] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [expandedId, setExpandedId] = useState("");

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
            instructions: String(data.instructions ?? ""),
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
        setError(
          "Could not load assignments. Check your connection and try again.",
        );
        setLoading(false);
        return;
      }

      try {
        const subQuery = query(
          collection(db, "submissions"),
          where("communityId", "==", settings.communityId),
        );
        const subSnap = await getDocs(subQuery);
        setSubs(
          subSnap.docs.map((d) => ({
            assignmentId: String(d.data().assignmentId ?? ""),
            status: String(d.data().status ?? "submitted"),
          })),
        );

        const memberQuery = query(
          collection(db, "members"),
          where("communityId", "==", settings.communityId),
        );
        const memberSnap = await getDocs(memberQuery);
        setMemberCount(
          memberSnap.docs.filter((d) => d.data().status === "approved").length,
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handlePost(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const cleanTitle = title.trim();
    const cleanInstructions = instructions.trim();
    if (cleanTitle.length < 2) {
      setFormError("Enter a title for the assignment");
      return;
    }
    if (cleanInstructions.length < 2) {
      setFormError("Write the instructions for the assignment");
      return;
    }
    if (dueDate && dueDate < todayString()) {
      setFormError("The due date cannot be in the past");
      return;
    }
    if (dueDate && !/^\d{2}:\d{2}$/.test(dueTime)) {
      setFormError("Choose the due time");
      return;
    }
    const extra = dueDate ? Number(extraHours || "0") : 0;
    if (!Number.isInteger(extra) || extra < 0 || extra > 168) {
      setFormError("Extra time must be a whole number of hours, from 0 to 168");
      return;
    }
    const deadlineInfo = {
      dueDate: dueDate,
      dueTime: dueTime,
      extraHours: extra,
    };
    const deadline = deadlineOf(deadlineInfo);
    if (deadline && deadline.getTime() < Date.now()) {
      setFormError("The due date and time cannot be in the past");
      return;
    }
    const closes = closesAtOf(deadlineInfo);

    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "assignments"), {
        communityId: settings.communityId,
        title: cleanTitle,
        instructions: cleanInstructions,
        dueDate: dueDate,
        dueTime: dueDate ? dueTime : "",
        extraHours: extra,
        closesAt: closes ? Timestamp.fromDate(closes) : null,
        createdAt: serverTimestamp(),
      });
      setItems((prev) => [
        {
          id: ref.id,
          title: cleanTitle,
          instructions: cleanInstructions,
          dueDate: dueDate,
          dueTime: dueDate ? dueTime : "",
          extraHours: extra,
          createdAt: new Date(),
        },
        ...prev,
      ]);
      setTitle("");
      setInstructions("");
      setDueDate("");
      setDueTime("");
      setExtraHours("");
    } catch (err) {
      console.error(err);
      setFormError("Could not post the assignment. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setFormError("");
    setDeletingId(id);

    try {
      await deleteDoc(doc(db, "assignments", id));
      setItems((prev) => prev.filter((a) => a.id !== id));
      setConfirmId("");
    } catch (err) {
      console.error(err);
      setFormError("Could not delete the assignment. Please try again.");
    } finally {
      setDeletingId("");
    }
  }

  function handleNotify() {
    const text =
      "A new assignment has been posted on " +
      settings.name +
      ". Please log in to the app to check it: " +
      APP_URL;
    openWhatsAppShare(text);
  }

  function statsOf(assignmentId: string) {
    const mine = subs.filter((s) => s.assignmentId === assignmentId);
    const approved = mine.filter((s) => s.status === "approved").length;
    const revision = mine.filter((s) => s.status === "revision").length;
    const percent =
      memberCount !== null && memberCount > 0
        ? Math.min(100, Math.round((mine.length / memberCount) * 100))
        : 0;
    return { submitted: mine.length, approved, revision, percent };
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-[980px]">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Assignments
        </h1>
        <p className="mb-6 mt-1 text-[15px] text-muted">
          Post work, review each response and approve it
        </p>

        <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={handlePost}
            noValidate
            className="rounded-panel border border-line bg-white p-4"
          >
            <h2 className="mb-3 font-display text-xl font-semibold text-ink">
              New assignment
            </h2>

            <div className="mb-3">
              <label
                htmlFor="asTitle"
                className="mb-1 block text-[15px] font-semibold text-ink"
              >
                Title
              </label>
              <input
                id="asTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Write on the life of Abraham"
                className={fieldClass}
              />
            </div>

            <div className="mb-3">
              <label
                htmlFor="asInstructions"
                className="mb-1 block text-[15px] font-semibold text-ink"
              >
                Instructions
              </label>
              <textarea
                id="asInstructions"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={5}
                placeholder="What should members read and write?"
                className={fieldClass + " py-2"}
              />
            </div>

            <div className="mb-1 grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <label
                  htmlFor="asDueDate"
                  className="mb-1 block text-[15px] font-semibold text-ink"
                >
                  Due date
                </label>
                <input
                  id="asDueDate"
                  type="date"
                  value={dueDate}
                  min={todayString()}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={fieldClass}
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor="asDueTime"
                  className="mb-1 block text-[15px] font-semibold text-ink"
                >
                  Due time
                </label>
                <input
                  id="asDueTime"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className={fieldClass}
                />
              </div>
            </div>
            <p className="mb-3 text-[13px] text-muted">
              Optional. If you set a due date, choose a due time too.
            </p>

            <div className="mb-4">
              <label
                htmlFor="asExtra"
                className="mb-1 block text-[15px] font-semibold text-ink"
              >
                Extra time after the deadline, in hours (optional)
              </label>
              <input
                id="asExtra"
                type="number"
                min={0}
                max={168}
                value={extraHours}
                onChange={(e) => setExtraHours(e.target.value)}
                placeholder="0"
                className={fieldClass}
              />
              <p className="mt-1 text-[13px] text-muted">
                Applies to everyone. Submissions close after the extra time. You
                can add more extra time later, once the due time has passed.
              </p>
            </div>

            {formError && (
              <p
                role="alert"
                className="mb-3 text-[15px] font-semibold text-danger"
              >
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-control bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {saving ? "Posting..." : "Post assignment"}
            </button>
          </form>

          <section>
            <h2 className="mb-3 font-display text-xl font-semibold text-ink">
              Posted
            </h2>

            {loading && <p className="text-[15px] text-muted">Loading...</p>}
            {error && (
              <p role="alert" className="text-[15px] font-semibold text-danger">
                {error}
              </p>
            )}
            {!loading && !error && items.length === 0 && (
              <p className="text-[15px] text-muted">
                No assignments yet. Fill in the form on the left and members
                will see it on their home screen.
              </p>
            )}

            {items.length > 0 && (
              <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-white">
                {items.map((a) => {
                  const stats = statsOf(a.id);
                  const long = isLong(a.instructions);
                  const expanded = expandedId === a.id;
                  return (
                    <li key={a.id} className="p-4">
                      <p className="text-[17px] font-semibold text-ink">
                        {a.title}
                      </p>
                      <p className="mb-2 text-[13px] text-muted">
                        Posted {formatWhen(a.createdAt)}
                        {a.dueDate
                          ? ". Due " + formatDeadline(a)
                          : ". No due date"}
                        {a.dueDate && a.extraHours > 0
                          ? ". " + a.extraHours + "h extra time"
                          : ""}
                      </p>
                      <p
                        className={
                          "whitespace-pre-line text-[15px] text-ink " +
                          (long && !expanded ? "line-clamp-3" : "")
                        }
                      >
                        {a.instructions}
                      </p>
                      {long && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? "" : a.id)}
                          aria-expanded={expanded}
                          className="inline-flex min-h-11 items-center text-[15px] font-semibold text-brand hover:underline"
                        >
                          {expanded ? "Show less" : "Read more"}
                        </button>
                      )}

                      <div className="mt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[15px] font-semibold text-ink">
                            {loading
                              ? "..."
                              : stats.submitted +
                                (memberCount === null
                                  ? ""
                                  : " of " + memberCount) +
                                " submitted, " +
                                stats.approved +
                                " approved"}
                          </p>
                          {!loading && stats.revision > 0 && (
                            <span className="rounded-full bg-warn-bg px-3 py-1 text-[13px] font-semibold text-warn">
                              {stats.revision} need revision
                            </span>
                          )}
                        </div>
                        <div
                          aria-hidden="true"
                          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-tint"
                        >
                          <div
                            className="h-full rounded-full bg-brand"
                            style={{ width: stats.percent + "%" }}
                          />
                        </div>
                      </div>

                      <ExtendTime
                        assignment={a}
                        onExtended={(h) =>
                          setItems((prev) =>
                            prev.map((x) =>
                              x.id === a.id ? { ...x, extraHours: h } : x,
                            ),
                          )
                        }
                      />

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <Link
                          to={"/admin/assignments/" + a.id}
                          className="inline-flex min-h-11 items-center rounded-control border border-brand bg-white px-4 text-[15px] font-semibold text-brand hover:bg-brand-tint"
                        >
                          View submissions
                        </Link>
                        <button
                          type="button"
                          onClick={handleNotify}
                          className="min-h-11 rounded-control border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:bg-cream"
                        >
                          Notify group on WhatsApp
                        </button>
                        {confirmId !== a.id && (
                          <button
                            type="button"
                            onClick={() => setConfirmId(a.id)}
                            className="inline-flex min-h-11 items-center text-[15px] font-semibold text-danger hover:underline"
                          >
                            Delete
                          </button>
                        )}
                      </div>

                      {confirmId === a.id && (
                        <div className="mt-3 rounded-control bg-danger-bg p-3">
                          <p className="text-[15px] text-ink">
                            Delete {a.title}? This cannot be undone.
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDelete(a.id)}
                              disabled={deletingId === a.id}
                              className="min-h-11 rounded-control bg-danger px-4 text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
                            >
                              {deletingId === a.id
                                ? "Deleting..."
                                : "Yes, delete"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmId("")}
                              disabled={deletingId === a.id}
                              className="min-h-11 rounded-control border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:bg-cream disabled:opacity-60"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default AdminAssignments;
