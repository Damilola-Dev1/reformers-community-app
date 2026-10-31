import { useEffect, useState } from "react";
import { doc, Timestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  closesAtOf,
  deadlineOf,
  formatClosing,
  formatDeadline,
  phaseOf,
} from "../utils/deadline";

type Props = {
  assignment: {
    id: string;
    dueDate: string;
    dueTime: string;
    extraHours: number;
  };
  onExtended: (newExtraHours: number) => void;
};

function ExtendTime({ assignment, onExtended }: Props) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());

  // Re-check the time every 15 seconds so the button unlocks by itself
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // No due date means there is nothing to extend
  if (!assignment.dueDate || !deadlineOf(assignment)) return null;

  const deadlinePassed = phaseOf(assignment, now) !== "open";

  async function handleSave() {
    setError("");
    if (phaseOf(assignment, Date.now()) === "open") {
      setError("You can add extra time only after the due time has passed");
      return;
    }
    const add = Number(hours);
    if (!Number.isInteger(add) || add < 1) {
      setError("Enter a whole number of hours, at least 1");
      return;
    }
    const newTotal = assignment.extraHours + add;
    if (newTotal > 168) {
      setError("Total extra time cannot be more than 168 hours");
      return;
    }
    const closes = closesAtOf({ ...assignment, extraHours: newTotal });
    if (!closes) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "assignments", assignment.id), {
        extraHours: newTotal,
        closesAt: Timestamp.fromDate(closes),
      });
      onExtended(newTotal);
      setOpen(false);
      setHours("");
    } catch (err) {
      console.error(err);
      setError("Could not add extra time. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-3">
        <button
          type="button"
          disabled={!deadlinePassed}
          onClick={() => setOpen(true)}
          className="min-h-11 rounded-control border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:bg-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          Add extra time
        </button>
        {!deadlinePassed && (
          <p className="mt-1 text-[13px] text-muted">
            Available after the due time ({formatDeadline(assignment)}).
          </p>
        )}
      </div>
    );
  }

  const addNow = Number(hours);
  const preview =
    Number.isInteger(addNow) &&
    addNow >= 1 &&
    assignment.extraHours + addNow <= 168
      ? formatClosing({
          ...assignment,
          extraHours: assignment.extraHours + addNow,
        })
      : "";

  return (
    <div className="mt-3 rounded-panel border border-line bg-cream p-3">
      <label
        htmlFor={"extend-" + assignment.id}
        className="mb-1 block text-[15px] font-semibold text-ink"
      >
        Hours to add
      </label>
      <input
        id={"extend-" + assignment.id}
        type="number"
        min={1}
        max={168}
        value={hours}
        onChange={(e) => setHours(e.target.value)}
        className="min-h-11 w-28 rounded-control border border-line bg-white px-3 text-[15px] text-ink"
      />
      {preview && (
        <p className="mt-1 text-[13px] text-muted">
          Submissions will close {preview}.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-1 text-[15px] font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="min-h-11 rounded-control border border-brand bg-white px-4 text-[15px] font-semibold text-brand hover:bg-brand-tint disabled:opacity-60"
        >
          {saving ? "Saving..." : "Add time"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 px-2 text-[15px] font-semibold text-muted hover:text-ink"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default ExtendTime;
