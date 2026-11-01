import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { ArrowLeft } from "@phosphor-icons/react";
import { db } from "../firebase";
import { settings } from "../config/settings";
import { deadlineOf, formatDeadline } from "../utils/deadline";
import ListSkeleton from "../components/ListSkeleton";

type Assignment = {
  id: string;
  title: string;
  instructions: string;
  dueDate: string;
  dueTime: string;
  extraHours: number;
};

type Sub = {
  id: string;
  memberId: string;
  memberName: string;
  text: string;
  link: string;
  status: string;
  reviewNote: string;
  createdAt: Date | null;
};

type Person = {
  id: string;
  fullName: string;
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

// Reads like: 28 Oct 2026
function formatWhen(value: Date | null): string {
  if (!value) return "";
  return (
    value.getDate() + " " + MONTHS[value.getMonth()] + " " + value.getFullYear()
  );
}

function statusLabel(status: string): string {
  if (status === "approved") return "Approved";
  if (status === "revision") return "Needs revision";
  return "Submitted";
}

function statusClass(status: string): string {
  if (status === "approved") return "bg-ok-bg text-ok";
  if (status === "revision") return "bg-warn-bg text-warn";
  return "bg-brand-tint text-ink";
}

function statusOrder(status: string): number {
  if (status === "submitted") return 0;
  if (status === "revision") return 1;
  return 2;
}

function AdminAssignmentReview() {
  const { id } = useParams();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actingId, setActingId] = useState("");
  const [noteFor, setNoteFor] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    async function load() {
      if (!id) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        const aSnap = await getDoc(doc(db, "assignments", id));
        if (
          !aSnap.exists() ||
          aSnap.data().communityId !== settings.communityId
        ) {
          setNotFound(true);
          return;
        }
        const a = aSnap.data();
        setAssignment({
          id: aSnap.id,
          title: String(a.title ?? ""),
          instructions: String(a.instructions ?? ""),
          dueDate: String(a.dueDate ?? ""),
          dueTime: String(a.dueTime ?? ""),
          extraHours: Number(a.extraHours ?? 0) || 0,
        });

        const subQuery = query(
          collection(db, "submissions"),
          where("communityId", "==", settings.communityId),
          where("assignmentId", "==", id),
        );
        const subSnap = await getDocs(subQuery);
        const loadedSubs = subSnap.docs.map((d) => {
          const s = d.data();
          return {
            id: d.id,
            memberId: String(s.memberId ?? ""),
            memberName: String(s.memberName ?? ""),
            text: String(s.text ?? ""),
            link: String(s.link ?? ""),
            status: String(s.status ?? "submitted"),
            reviewNote: String(s.reviewNote ?? ""),
            createdAt:
              s.createdAt && typeof s.createdAt.toDate === "function"
                ? (s.createdAt.toDate() as Date)
                : null,
          };
        });
        loadedSubs.sort((x, y) => {
          const byStatus = statusOrder(x.status) - statusOrder(y.status);
          if (byStatus !== 0) return byStatus;
          return (y.createdAt?.getTime() ?? 0) - (x.createdAt?.getTime() ?? 0);
        });
        setSubs(loadedSubs);

        const memberQuery = query(
          collection(db, "members"),
          where("communityId", "==", settings.communityId),
        );
        const memberSnap = await getDocs(memberQuery);
        const approved = memberSnap.docs
          .filter((d) => d.data().status === "approved")
          .map((d) => ({
            id: d.id,
            fullName: String(d.data().fullName ?? ""),
          }));
        approved.sort((x, y) => x.fullName.localeCompare(y.fullName));
        setPeople(approved);
      } catch (err) {
        console.error(err);
        setError(
          "Could not load this assignment. Check your connection and try again.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleApprove(s: Sub) {
    setActionError("");
    setActingId(s.id);
    try {
      await updateDoc(doc(db, "submissions", s.id), {
        status: "approved",
        reviewNote: "",
        reviewedAt: serverTimestamp(),
      });
      setSubs((prev) =>
        prev.map((x) =>
          x.id === s.id ? { ...x, status: "approved", reviewNote: "" } : x,
        ),
      );
      setNoteFor("");
      setNote("");
    } catch (err) {
      console.error(err);
      setActionError("Could not approve. Please try again.");
    } finally {
      setActingId("");
    }
  }

  async function handleRevision(s: Sub) {
    setActionError("");
    const cleanNote = note.trim();
    if (cleanNote.length < 2) {
      setActionError("Write a note telling the member what to improve");
      return;
    }
    setActingId(s.id);
    try {
      await updateDoc(doc(db, "submissions", s.id), {
        status: "revision",
        reviewNote: cleanNote,
        reviewedAt: serverTimestamp(),
      });
      setSubs((prev) =>
        prev.map((x) =>
          x.id === s.id
            ? { ...x, status: "revision", reviewNote: cleanNote }
            : x,
        ),
      );
      setNoteFor("");
      setNote("");
    } catch (err) {
      console.error(err);
      setActionError("Could not send the revision request. Please try again.");
    } finally {
      setActingId("");
    }
  }

  function isLate(s: Sub): boolean {
    if (!assignment || !s.createdAt) return false;
    const deadline = deadlineOf(assignment);
    return deadline !== null && s.createdAt.getTime() > deadline.getTime();
  }

  const submittedIds = new Set(subs.map((s) => s.memberId));
  const notSubmitted = people.filter((p) => !submittedIds.has(p.id));
  const percent =
    people.length === 0
      ? 0
      : Math.min(100, Math.round((subs.length / people.length) * 100));

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-[980px]">
        <Link
          to="/admin/assignments"
          className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-dark"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Back to assignments
        </Link>

        {loading && (
          <div className="mt-4">
            <ListSkeleton rows={4} />
          </div>
        )}
        {error && (
          <p
            role="alert"
            className="mt-4 text-[15px] font-semibold text-danger"
          >
            {error}
          </p>
        )}
        {!loading && notFound && (
          <p className="mt-4 text-[15px] text-muted">
            This assignment was not found.
          </p>
        )}

        {assignment && (
          <>
            <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
              {assignment.title}
            </h1>
            <p className="mt-1 text-[15px] text-muted">
              {assignment.dueDate
                ? "Due " + formatDeadline(assignment)
                : "No due date"}
              {assignment.dueDate && assignment.extraHours > 0
                ? ". " + assignment.extraHours + "h extra time"
                : ""}
            </p>

            <div className="mt-3 max-w-md">
              <p className="text-[15px] font-semibold text-ink">
                {subs.length} of {people.length} members submitted
              </p>
              <div
                aria-hidden="true"
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-brand-tint"
              >
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: percent + "%" }}
                />
              </div>
            </div>

            <section className="mt-6 rounded-panel border border-line bg-white p-4">
              <h2 className="mb-2 font-display text-xl font-semibold text-ink">
                Instructions
              </h2>
              <p className="whitespace-pre-line text-[15px] text-ink">
                {assignment.instructions}
              </p>
            </section>

            {actionError && (
              <p
                role="alert"
                className="mt-4 text-[15px] font-semibold text-danger"
              >
                {actionError}
              </p>
            )}

            <h2 className="mb-3 mt-6 font-display text-xl font-semibold text-ink">
              Submissions
            </h2>
            {subs.length === 0 && (
              <p className="text-[15px] text-muted">
                No submissions yet. Responses appear here as members send them.
              </p>
            )}

            {subs.length > 0 && (
              <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-white">
                {subs.map((s) => (
                  <li key={s.id} className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[17px] font-semibold text-ink">
                        {s.memberName || "Member"}
                      </p>
                      <span
                        className={
                          "shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold " +
                          statusClass(s.status)
                        }
                      >
                        {statusLabel(s.status)}
                      </span>
                    </div>
                    <p className="mb-2 text-[13px] text-muted">
                      Sent {formatWhen(s.createdAt)}
                      {isLate(s) ? ". Late (after the deadline)" : ""}
                    </p>
                    <p className="whitespace-pre-line text-[15px] text-ink">
                      {s.text}
                    </p>
                    {s.link && (
                      <p className="mt-3 text-[15px]">
                        <a
                          href={s.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all font-semibold text-brand hover:text-brand-dark"
                        >
                          {s.link}
                        </a>
                      </p>
                    )}

                    {s.status === "revision" && (
                      <div className="mt-3 rounded-panel bg-warn-bg p-3">
                        <p className="mb-1 text-[13px] font-semibold text-warn">
                          Your note to the member
                        </p>
                        <p className="whitespace-pre-line text-[15px] text-ink">
                          {s.reviewNote}
                        </p>
                        <p className="mt-2 text-[13px] text-muted">
                          Waiting for the member to resubmit.
                        </p>
                      </div>
                    )}

                    {s.status !== "revision" && (
                      <div className="mt-3">
                        {noteFor === s.id ? (
                          <div>
                            <label
                              htmlFor={"note-" + s.id}
                              className="mb-1 block text-[15px] font-semibold text-ink"
                            >
                              What should the member improve?
                            </label>
                            <textarea
                              id={"note-" + s.id}
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              rows={3}
                              className="min-h-11 w-full rounded-control border border-line bg-white px-3 py-2 text-[15px] text-ink"
                            />
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRevision(s)}
                                disabled={actingId === s.id}
                                className="min-h-11 rounded-control bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                              >
                                {actingId === s.id
                                  ? "Sending..."
                                  : "Send revision request"}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setNoteFor("");
                                  setNote("");
                                  setActionError("");
                                }}
                                className="min-h-11 rounded-control border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:bg-cream"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2">
                            {s.status !== "approved" && (
                              <button
                                type="button"
                                onClick={() => handleApprove(s)}
                                disabled={actingId === s.id}
                                className="min-h-11 rounded-control border border-ok bg-white px-4 text-[15px] font-semibold text-ok hover:bg-ok-bg disabled:opacity-60"
                              >
                                {actingId === s.id ? "Approving..." : "Approve"}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setNoteFor(s.id);
                                setNote("");
                                setActionError("");
                              }}
                              className="min-h-11 rounded-control border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:bg-cream"
                            >
                              Request revision
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <h2 className="mb-3 mt-6 font-display text-xl font-semibold text-ink">
              Not submitted yet
              {notSubmitted.length > 0 ? " (" + notSubmitted.length + ")" : ""}
            </h2>
            {notSubmitted.length === 0 ? (
              <p className="text-[15px] text-muted">
                Every approved member has submitted.
              </p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-white">
                {notSubmitted.map((p) => (
                  <li key={p.id} className="px-4 py-3 text-[15px] text-ink">
                    {p.fullName}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AdminAssignmentReview;
