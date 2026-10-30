import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { ArrowLeft } from "@phosphor-icons/react";
import { auth, db } from "../firebase";
import { settings } from "../config/settings";
import { useAuth } from "../auth/useAuth";
import { formatClosing, formatDeadline, phaseOf } from "../utils/deadline";

type Assignment = {
  id: string;
  title: string;
  instructions: string;
  dueDate: string;
  dueTime: string;
  extraHours: number;
};

type Submission = {
  text: string;
  link: string;
  status: string;
  reviewNote: string;
  createdAt: Date | null;
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

// Reads like: 12 Oct 2026
function formatWhen(value: Date | null): string {
  if (!value) return "";
  return (
    value.getDate() + " " + MONTHS[value.getMonth()] + " " + value.getFullYear()
  );
}

const fieldClass =
  "w-full rounded-control border border-line bg-white px-3 text-[15px] text-ink placeholder:text-muted";

function MemberAssignmentDetail() {
  const { id } = useParams();
  const { profile } = useAuth();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [link, setLink] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        const uid = auth.currentUser?.uid ?? "";
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

        const sSnap = await getDoc(doc(db, "submissions", id + "_" + uid));
        if (sSnap.exists()) {
          const s = sSnap.data();
          const loaded: Submission = {
            text: String(s.text ?? ""),
            link: String(s.link ?? ""),
            status: String(s.status ?? "submitted"),
            reviewNote: String(s.reviewNote ?? ""),
            createdAt:
              s.createdAt && typeof s.createdAt.toDate === "function"
                ? (s.createdAt.toDate() as Date)
                : null,
          };
          setSubmission(loaded);
          if (loaded.status === "revision") {
            setText(loaded.text);
            setLink(loaded.link);
          }
        }
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");

    const uid = auth.currentUser?.uid;
    if (!uid || !id) {
      setFormError("Please log in again and retry");
      return;
    }

    const cleanText = text.trim();
    const cleanLink = link.trim();
    if (cleanText.length < 2) {
      setFormError("Write your answer before submitting");
      return;
    }
    if (cleanLink !== "" && !/^https?:\/\/\S+$/i.test(cleanLink)) {
      setFormError("The link must start with http:// or https://");
      return;
    }

    const resubmitting =
      submission !== null && submission.status === "revision";

    if (
      !resubmitting &&
      assignment &&
      phaseOf(assignment, Date.now()) === "closed"
    ) {
      setFormError("Submissions for this assignment are closed");
      return;
    }

    setSaving(true);
    try {
      if (resubmitting) {
        await updateDoc(doc(db, "submissions", id + "_" + uid), {
          text: cleanText,
          link: cleanLink,
          status: "submitted",
          updatedAt: serverTimestamp(),
        });
        setSubmission({
          text: cleanText,
          link: cleanLink,
          status: "submitted",
          reviewNote: "",
          createdAt: submission ? submission.createdAt : new Date(),
        });
      } else {
        await setDoc(doc(db, "submissions", id + "_" + uid), {
          communityId: settings.communityId,
          assignmentId: id,
          memberId: uid,
          memberName: profile?.fullName ?? "",
          text: cleanText,
          link: cleanLink,
          status: "submitted",
          createdAt: serverTimestamp(),
        });
        setSubmission({
          text: cleanText,
          link: cleanLink,
          status: "submitted",
          reviewNote: "",
          createdAt: new Date(),
        });
      }
    } catch (err) {
      console.error(err);
      setFormError("Could not submit. Refresh the page and try again.");
    } finally {
      setSaving(false);
    }
  }

  const phase = assignment ? phaseOf(assignment, Date.now()) : "open";
  const closed = phase === "closed";
  const needsRevision = submission !== null && submission.status === "revision";
  const approved = submission !== null && submission.status === "approved";

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/member/assignments"
          className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-dark"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Back to assignments
        </Link>

        {loading && <p className="mt-4 text-[15px] text-muted">Loading...</p>}
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

            {assignment.dueDate && (
              <div className="mt-1">
                <p
                  className={
                    "text-[15px] " +
                    (phase === "open" || approved
                      ? "text-muted"
                      : "font-semibold text-danger")
                  }
                >
                  {phase === "open" || approved ? "Due " : "Overdue: was due "}
                  {formatDeadline(assignment)}
                </p>
                {assignment.extraHours > 0 && (
                  <p className="mt-1 text-[13px] text-muted">
                    {"Extra time of " +
                      assignment.extraHours +
                      "h applies to everyone. Submissions close " +
                      formatClosing(assignment) +
                      "."}
                  </p>
                )}
              </div>
            )}

            <section className="mt-4 rounded-panel border border-line bg-white p-4">
              <h2 className="mb-2 font-display text-xl font-semibold text-ink">
                Instructions
              </h2>
              <p className="whitespace-pre-line text-[15px] text-ink">
                {assignment.instructions}
              </p>
            </section>

            {phase === "extra" && !submission && (
              <div className="mt-4 rounded-panel bg-warn-bg p-4">
                <p className="mb-1 text-[15px] font-semibold text-warn">
                  Extra time is running
                </p>
                <p className="text-[15px] text-ink">
                  The deadline has passed, but you can still submit until{" "}
                  {formatClosing(assignment)}.
                </p>
              </div>
            )}

            {closed && !submission && (
              <div className="mt-4 rounded-panel bg-danger-bg p-4">
                <p className="mb-1 text-[15px] font-semibold text-danger">
                  Submissions are closed
                </p>
                <p className="text-[15px] text-ink">
                  The deadline and extra time for this assignment have passed.
                  Please speak to a leader if you need help.
                </p>
              </div>
            )}

            {submission && !needsRevision && (
              <section className="mt-4 rounded-panel border border-line bg-white p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="font-display text-xl font-semibold text-ink">
                    Your submission
                  </h2>
                  <span
                    className={
                      "rounded-full px-3 py-1 text-[13px] font-semibold " +
                      (approved ? "bg-ok-bg text-ok" : "bg-brand-tint text-ink")
                    }
                  >
                    {approved ? "Approved" : "Submitted"}
                  </span>
                </div>
                <p className="mb-2 text-[13px] text-muted">
                  Sent {formatWhen(submission.createdAt)}
                </p>
                <p className="whitespace-pre-line text-[15px] text-ink">
                  {submission.text}
                </p>
                {submission.link && (
                  <p className="mt-3 text-[15px]">
                    <a
                      href={submission.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all font-semibold text-brand hover:text-brand-dark"
                    >
                      {submission.link}
                    </a>
                  </p>
                )}
              </section>
            )}

            {needsRevision && submission && (
              <div className="mt-4 rounded-panel bg-warn-bg p-4">
                <p className="mb-1 text-[15px] font-semibold text-warn">
                  Revision requested
                </p>
                <p className="whitespace-pre-line text-[15px] text-ink">
                  {submission.reviewNote}
                </p>
              </div>
            )}

            {((!submission && !closed) || needsRevision) && (
              <form
                onSubmit={handleSubmit}
                noValidate
                className="mt-4 rounded-panel border border-line bg-white p-4"
              >
                <h2 className="mb-3 font-display text-xl font-semibold text-ink">
                  {needsRevision ? "Update your answer" : "Your answer"}
                </h2>

                <div className="mb-3">
                  <label
                    htmlFor="answer"
                    className="mb-1 block text-[15px] font-semibold text-ink"
                  >
                    Answer
                  </label>
                  <textarea
                    id="answer"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={6}
                    className={fieldClass + " py-2"}
                  />
                </div>

                <div className="mb-4">
                  <label
                    htmlFor="answerLink"
                    className="mb-1 block text-[15px] font-semibold text-ink"
                  >
                    Link (optional)
                  </label>
                  <input
                    id="answerLink"
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="e.g. a Google Doc link"
                    className={fieldClass + " min-h-11"}
                  />
                </div>

                {formError && (
                  <p
                    role="alert"
                    className="mb-3 text-[15px] font-semibold text-danger"
                  >
                    {formError}
                  </p>
                )}

                <p className="mb-3 text-[13px] text-muted">
                  {needsRevision
                    ? "Submitting sends your updated answer back for review."
                    : "You cannot edit your answer after you submit it."}
                </p>

                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-11 rounded-control bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
                >
                  {saving
                    ? "Submitting..."
                    : needsRevision
                      ? "Resubmit"
                      : "Submit response"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default MemberAssignmentDetail;
