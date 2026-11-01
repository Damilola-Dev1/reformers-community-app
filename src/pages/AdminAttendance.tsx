import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { ArrowLeft, LinkSimple } from "@phosphor-icons/react";
import { db } from "../firebase";
import { settings } from "../config/settings";
import { APP_URL, openWhatsAppShare } from "../config/whatsapp";
import AttendanceChart from "../components/AttendanceChart";
import ListSkeleton from "../components/ListSkeleton";

type Service = {
  id: string;
  title: string;
  date: string;
  time: string;
  finalized: boolean;
  createdAt: string;
};

type Status = "present" | "absent";

type Person = {
  id: string;
  fullName: string;
};

type Counts = Record<string, { present: number; total: number }>;

const PAGE_SIZE = 10;

const fieldClass =
  "min-h-11 w-full rounded-control border border-line bg-white px-3 text-[15px] text-ink placeholder:text-muted";

function todayLocal(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + month + "-" + day;
}

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

function formatTime(value: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return "";
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return hour12 + ":" + match[2] + " " + suffix;
}

// Counts the saved marks for every service, so a finalised row can say
// "2 of 8 present". The total is the number of marks saved for that
// service (finalising marks everyone who was left unmarked as absent).
async function fetchCounts(): Promise<Counts> {
  const snap = await getDocs(
    query(
      collection(db, "attendance"),
      where("communityId", "==", settings.communityId),
    ),
  );
  const found: Counts = {};
  snap.docs.forEach((d) => {
    const data = d.data();
    const serviceId = String(data.serviceId ?? "");
    if (serviceId === "") return;
    if (!found[serviceId]) found[serviceId] = { present: 0, total: 0 };
    found[serviceId].total += 1;
    if (data.status === "present") found[serviceId].present += 1;
  });
  return found;
}

function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div>
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className="mt-0.5 font-display text-2xl font-semibold text-ink">
        {value}
      </p>
      {note && <p className="text-[13px] text-muted">{note}</p>}
    </div>
  );
}

function checkMeetingLink(value: string): string {
  if (value === "") return "";
  if (!value.startsWith("https://")) {
    return "The link must start with https://";
  }
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.includes(".")) {
      return "Enter a real web address, for example https://meet.google.com/abc-defg-hij";
    }
  } catch {
    return "Enter a real web address, for example https://meet.google.com/abc-defg-hij";
  }
  return "";
}

function MeetingLinkCard() {
  const [link, setLink] = useState("");
  const [savedLink, setSavedLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(
          doc(db, "communitySettings", settings.communityId),
        );
        if (snap.exists()) {
          const value = snap.data().meetingLink;
          const text = typeof value === "string" ? value : "";
          setLink(text);
          setSavedLink(text);
        }
      } catch (err) {
        console.error(err);
        setLoadError(
          "Could not load the meeting link. Check your connection and refresh.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    setMessage("");
    const clean = link.trim();

    const problem = checkMeetingLink(clean);
    if (problem !== "") {
      setFormError(problem);
      return;
    }

    setSaving(true);
    try {
      await setDoc(
        doc(db, "communitySettings", settings.communityId),
        {
          communityId: settings.communityId,
          meetingLink: clean,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      setLink(clean);
      setSavedLink(clean);
      setMessage(
        clean === "" ? "Meeting link cleared." : "Meeting link saved.",
      );
    } catch (err) {
      console.error(err);
      setFormError("Could not save the meeting link. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      noValidate
      className="rounded-panel border border-line bg-white p-4"
    >
      <h2 className="font-display text-xl font-semibold text-ink">
        Meeting link
      </h2>
      <p className="mb-3 mt-1 text-[13px] text-muted">
        Approved members see it after they tap Join. Change it any time.
      </p>

      {loading && <p className="text-[15px] text-muted">Loading...</p>}
      {loadError && (
        <p role="alert" className="mb-3 text-[15px] font-semibold text-danger">
          {loadError}
        </p>
      )}

      {!loading && !loadError && (
        <div>
          <label
            htmlFor="meetingLink"
            className="mb-1 block text-[15px] font-semibold text-ink"
          >
            Google Meet or WhatsApp link
          </label>
          <div className="relative mb-3">
            <LinkSimple
              size={18}
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              id="meetingLink"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://meet.google.com/abc-defg-hij"
              className={fieldClass + " pl-10"}
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
          {message && (
            <p
              role="status"
              className="mb-3 rounded-control bg-ok-bg px-3 py-2 text-[15px] font-semibold text-ok"
            >
              {message}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-control border border-brand bg-white px-5 text-[15px] font-semibold text-brand hover:bg-brand-tint disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save link"}
            </button>
            {savedLink !== "" && (
              <a
                href={savedLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center text-[15px] font-semibold text-brand hover:text-brand-dark"
              >
                Test link
              </a>
            )}
          </div>
        </div>
      )}
    </form>
  );
}

type DetailProps = {
  service: Service;
  onBack: () => void;
  onFinalizedChange: (id: string, value: boolean) => void;
};

function ServiceDetail({ service, onBack, onFinalizedChange }: DetailProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [marks, setMarks] = useState<Record<string, Status>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [confirm, setConfirm] = useState<"finalize" | "reopen" | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const membersQuery = query(
          collection(db, "members"),
          where("communityId", "==", settings.communityId),
          where("status", "==", "approved"),
        );
        const attendanceQuery = query(
          collection(db, "attendance"),
          where("communityId", "==", settings.communityId),
          where("serviceId", "==", service.id),
        );

        const [memberSnap, attendanceSnap] = await Promise.all([
          getDocs(membersQuery),
          getDocs(attendanceQuery),
        ]);

        setPeople(
          memberSnap.docs.map((d) => ({
            id: d.id,
            fullName: String(d.data().fullName ?? ""),
          })),
        );

        const found: Record<string, Status> = {};
        attendanceSnap.docs.forEach((d) => {
          const data = d.data();
          found[String(data.memberId ?? "")] =
            data.status === "present" ? "present" : "absent";
        });
        setMarks(found);
      } catch (err) {
        console.error(err);
        setError(
          "Could not load this service. Check your connection and try again.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [service.id]);

  const sortedPeople = useMemo(() => {
    return [...people].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [people]);

  const totals = useMemo(() => {
    let present = 0;
    let absent = 0;
    for (const p of people) {
      const m = marks[p.id];
      if (m === "present") present += 1;
      else if (m === "absent") absent += 1;
    }
    const total = people.length;
    const notMarked = total - present - absent;
    const percent = total === 0 ? 0 : Math.round((present / total) * 100);
    return { total, present, absent, notMarked, percent };
  }, [people, marks]);

  function show(n: number): string {
    return loading ? "..." : String(n);
  }

  function handleNotify() {
    const text =
      "A meeting has been scheduled on " +
      settings.name +
      ": " +
      service.title +
      ", " +
      formatDate(service.date) +
      (service.time ? " at " + formatTime(service.time) : "") +
      ". Please log in to the app and tap Join meeting: " +
      APP_URL;
    openWhatsAppShare(text);
  }

  async function mark(memberId: string, status: Status) {
    if (service.finalized) return;
    setActionError("");
    setBusyId(memberId);
    try {
      await setDoc(doc(db, "attendance", service.id + "_" + memberId), {
        communityId: settings.communityId,
        serviceId: service.id,
        memberId: memberId,
        status: status,
        markedBy: "admin",
        markedAt: serverTimestamp(),
      });
      setMarks((prev) => ({ ...prev, [memberId]: status }));
    } catch (err) {
      console.error(err);
      setActionError("Could not save this mark. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    setActionError("");
    setConfirmBusy(true);

    try {
      if (confirm === "finalize") {
        const batch = writeBatch(db);
        const newMarks: Record<string, Status> = {};
        for (const p of people) {
          if (!marks[p.id]) {
            batch.set(doc(db, "attendance", service.id + "_" + p.id), {
              communityId: settings.communityId,
              serviceId: service.id,
              memberId: p.id,
              status: "absent",
              markedBy: "admin",
              markedAt: serverTimestamp(),
            });
            newMarks[p.id] = "absent";
          }
        }
        batch.update(doc(db, "services", service.id), {
          finalized: true,
          finalizedAt: serverTimestamp(),
        });
        await batch.commit();
        setMarks((prev) => ({ ...prev, ...newMarks }));
        onFinalizedChange(service.id, true);
      } else {
        await updateDoc(doc(db, "services", service.id), { finalized: false });
        onFinalizedChange(service.id, false);
      }
      setConfirm(null);
    } catch (err) {
      console.error(err);
      setActionError(
        "Could not complete this action. Nothing was changed. Please try again.",
      );
      setConfirm(null);
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-[980px]">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-dark"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Back to services
        </button>

        <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
          {service.title}
        </h1>
        <p className="mb-4 mt-1 text-[15px] text-muted">
          {formatDate(service.date)}
          {service.time ? ", " + formatTime(service.time) : ""}
        </p>

        {service.finalized ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-panel bg-ok-bg p-4">
            <p className="text-[15px] font-semibold text-ok">
              This service is finalised and locked.
            </p>
            <button
              type="button"
              onClick={() => setConfirm("reopen")}
              className="min-h-11 shrink-0 rounded-control border border-ok bg-white px-4 text-[15px] font-semibold text-ok hover:bg-ok-bg"
            >
              Reopen
            </button>
          </div>
        ) : (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setConfirm("finalize")}
              disabled={loading || error !== ""}
              className="min-h-11 rounded-control bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              Finalise service
            </button>
            <button
              type="button"
              onClick={handleNotify}
              className="min-h-11 rounded-control border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:bg-cream"
            >
              Notify group on WhatsApp
            </button>
          </div>
        )}

        <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-line py-4 md:grid-cols-4">
          <Stat label="Present" value={show(totals.present)} />
          <Stat label="Absent" value={show(totals.absent)} />
          <Stat label="Not marked" value={show(totals.notMarked)} />
          <Stat
            label="Attendance"
            value={loading ? "..." : totals.percent + "%"}
            note={"Out of " + (loading ? "..." : totals.total) + " approved"}
          />
        </div>

        {loading && <ListSkeleton rows={5} />}
        {error && (
          <p role="alert" className="text-[15px] font-semibold text-danger">
            {error}
          </p>
        )}
        {actionError && (
          <p
            role="alert"
            className="mb-3 text-[15px] font-semibold text-danger"
          >
            {actionError}
          </p>
        )}

        {!loading && !error && sortedPeople.length === 0 && (
          <p className="text-[15px] text-muted">
            No approved members yet. Approve members first, then mark
            attendance.
          </p>
        )}

        {sortedPeople.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-white">
            {sortedPeople.map((p) => {
              const current = marks[p.id];
              const busy = busyId === p.id;
              const locked = service.finalized || busy;
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-ink">
                      {p.fullName}
                    </p>
                    <p className="text-[13px] text-muted">
                      {current === "present"
                        ? "Present"
                        : current === "absent"
                          ? "Absent"
                          : "Not marked"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => mark(p.id, "present")}
                      disabled={locked}
                      aria-pressed={current === "present"}
                      className={
                        "min-h-11 rounded-control border px-4 text-[15px] font-semibold disabled:opacity-60 " +
                        (current === "present"
                          ? "border-ok bg-ok-bg text-ok"
                          : "border-line bg-white text-ink hover:bg-cream")
                      }
                    >
                      Present
                    </button>
                    <button
                      type="button"
                      onClick={() => mark(p.id, "absent")}
                      disabled={locked}
                      aria-pressed={current === "absent"}
                      className={
                        "min-h-11 rounded-control border px-4 text-[15px] font-semibold disabled:opacity-60 " +
                        (current === "absent"
                          ? "border-danger bg-danger-bg text-danger"
                          : "border-line bg-white text-ink hover:bg-cream")
                      }
                    >
                      Absent
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {confirm && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-ink/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirmTitle"
            className="w-full max-w-sm rounded-panel border border-line bg-white p-6"
          >
            <h2
              id="confirmTitle"
              className="font-display text-2xl font-semibold text-ink"
            >
              {confirm === "finalize"
                ? "Finalise this service?"
                : "Reopen this service to correct it?"}
            </h2>
            <p className="mb-4 mt-3 text-[15px] text-ink">
              {confirm === "finalize"
                ? totals.notMarked +
                  " unmarked member(s) will be recorded as absent, and all marks will be locked."
                : "The marks will be unlocked so you can correct them. Finalise again when you are done."}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                disabled={confirmBusy}
                className="min-h-11 flex-1 rounded-control border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:bg-cream disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirmBusy}
                className="min-h-11 flex-1 rounded-control bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {confirmBusy
                  ? "Working..."
                  : confirm === "finalize"
                    ? "Finalise"
                    : "Reopen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminAttendance() {
  const [services, setServices] = useState<Service[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [time, setTime] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [openService, setOpenService] = useState<Service | null>(null);
  const [shownCount, setShownCount] = useState(PAGE_SIZE);
  const [confirmId, setConfirmId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const q = query(
          collection(db, "services"),
          where("communityId", "==", settings.communityId),
        );
        const snap = await getDocs(q);
        setServices(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: String(data.title ?? ""),
              date: String(data.date ?? ""),
              time: String(data.time ?? ""),
              finalized: data.finalized === true,
              createdAt:
                data.createdAt && typeof data.createdAt.toDate === "function"
                  ? data.createdAt.toDate().toISOString()
                  : "",
            };
          }),
        );
      } catch (err) {
        console.error(err);
        setError(
          "Could not load services. Check your connection and try again.",
        );
      } finally {
        setLoading(false);
      }

      // The "2 of 8 present" lines are a bonus. If they fail to load,
      // the list still works without them.
      try {
        setCounts(await fetchCounts());
      } catch (err) {
        console.error(err);
      }
    }
    load();
  }, []);

  const sorted = useMemo(() => {
    return [...services].sort((a, b) => {
      if (a.date !== b.date) return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [services]);

  // Only the newest page of services is drawn. "Show more" adds another page.
  const shown = useMemo(
    () => sorted.slice(0, shownCount),
    [sorted, shownCount],
  );

  function handleFinalizedChange(id: string, value: boolean) {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, finalized: value } : s)),
    );
    setOpenService((prev) =>
      prev && prev.id === id ? { ...prev, finalized: value } : prev,
    );
  }

  // Coming back from a service, refresh the "2 of 8 present" numbers.
  function handleBack() {
    setOpenService(null);
    fetchCounts()
      .then(setCounts)
      .catch((err) => console.error(err));
  }

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const cleanTitle = title.trim();
    if (cleanTitle.length < 2) {
      setFormError("Enter a title, for example Sunday Service");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setFormError("Choose the date of the service");
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(time)) {
      setFormError("Choose the start time of the service");
      return;
    }

    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "services"), {
        communityId: settings.communityId,
        title: cleanTitle,
        date: date,
        time: time,
        finalized: false,
        createdAt: serverTimestamp(),
      });
      setServices((prev) => [
        {
          id: ref.id,
          title: cleanTitle,
          date: date,
          time: time,
          finalized: false,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setTitle("");
      setTime("");
    } catch (err) {
      console.error(err);
      setFormError("Could not create the service. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Only for services created by mistake. Finalised services are the
  // permanent record, so they must be reopened first.
  async function handleDeleteService(id: string) {
    const target = services.find((s) => s.id === id);
    if (!target) return;
    if (target.finalized) {
      setListError("A finalised service cannot be deleted. Reopen it first.");
      setConfirmId("");
      return;
    }

    setListError("");
    setDeletingId(id);
    try {
      const marksSnap = await getDocs(
        query(
          collection(db, "attendance"),
          where("communityId", "==", settings.communityId),
          where("serviceId", "==", id),
        ),
      );
      const batch = writeBatch(db);
      marksSnap.docs.forEach((d) => batch.delete(d.ref));
      batch.delete(doc(db, "services", id));
      await batch.commit();
      setServices((prev) => prev.filter((s) => s.id !== id));
      setConfirmId("");
    } catch (err) {
      console.error(err);
      setListError(
        "Could not delete this service. Nothing was changed. Please try again.",
      );
    } finally {
      setDeletingId("");
    }
  }

  if (openService) {
    return (
      <ServiceDetail
        service={openService}
        onBack={handleBack}
        onFinalizedChange={handleFinalizedChange}
      />
    );
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-[980px]">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Attendance
        </h1>
        <p className="mb-6 mt-1 text-[15px] text-muted">
          Create a service, mark who attended, then finalise it to lock the
          record
        </p>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            <h2 className="mb-3 font-display text-xl font-semibold text-ink">
              Services
            </h2>

            {loading && <ListSkeleton rows={5} />}
            {error && (
              <p role="alert" className="text-[15px] font-semibold text-danger">
                {error}
              </p>
            )}
            {listError && (
              <p
                role="alert"
                className="mb-3 text-[15px] font-semibold text-danger"
              >
                {listError}
              </p>
            )}

            {!loading && !error && sorted.length === 0 && (
              <p className="text-[15px] text-muted">
                No services yet. Fill in New service and press Create service.
              </p>
            )}

            {sorted.length > 0 && (
              <>
                <ul
                  aria-label="Services, newest first"
                  className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-white"
                >
                  {shown.map((s) => {
                    const c = counts[s.id];
                    return (
                      <li key={s.id} className="px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="break-words text-[15px] font-semibold text-ink">
                                {s.title}
                              </p>
                              <span
                                className={
                                  "rounded-full px-3 py-1 text-[13px] font-semibold " +
                                  (s.finalized
                                    ? "bg-ok-bg text-ok"
                                    : "bg-brand-tint text-ink")
                                }
                              >
                                {s.finalized ? "Finalised" : "Open"}
                              </span>
                            </div>
                            <p className="mt-1 text-[13px] text-muted">
                              {formatDate(s.date)}
                              {s.time ? ", " + formatTime(s.time) : ""}
                              {s.finalized && c && c.total > 0
                                ? ". " +
                                  c.present +
                                  " of " +
                                  c.total +
                                  " present"
                                : ""}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">
                            <button
                              type="button"
                              onClick={() => setOpenService(s)}
                              className="min-h-11 rounded-control border border-line bg-white px-4 text-[13px] font-semibold text-ink hover:bg-cream"
                            >
                              {s.finalized ? "View" : "Mark attendance"}
                            </button>
                            {!s.finalized && confirmId !== s.id && (
                              <button
                                type="button"
                                onClick={() => {
                                  setListError("");
                                  setConfirmId(s.id);
                                }}
                                className="inline-flex min-h-11 items-center text-[13px] font-semibold text-danger hover:underline"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>

                        {confirmId === s.id && (
                          <div className="mt-3 rounded-control bg-danger-bg p-3">
                            <p className="text-[15px] text-ink">
                              Delete {s.title}? Any marks saved for it are
                              removed too. This cannot be undone.
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleDeleteService(s.id)}
                                disabled={deletingId === s.id}
                                className="min-h-11 rounded-control bg-danger px-4 text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
                              >
                                {deletingId === s.id
                                  ? "Deleting..."
                                  : "Yes, delete"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmId("")}
                                disabled={deletingId === s.id}
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

                <div className="mt-4 flex flex-wrap items-center gap-x-4">
                  <p className="text-[13px] text-muted">
                    Showing {shown.length} of {sorted.length}
                  </p>
                  {sorted.length > shown.length && (
                    <button
                      type="button"
                      onClick={() => setShownCount(shownCount + PAGE_SIZE)}
                      className="min-h-11 rounded-control border border-line bg-white px-5 text-[15px] font-semibold text-ink hover:bg-cream"
                    >
                      Show {Math.min(PAGE_SIZE, sorted.length - shown.length)}{" "}
                      more
                    </button>
                  )}
                </div>
              </>
            )}

            {!loading && !error && (
              <div className="mt-6">
                <AttendanceChart services={services} />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <MeetingLinkCard />

            <form
              onSubmit={handleCreate}
              noValidate
              className="rounded-panel border border-line bg-white p-4"
            >
              <h2 className="mb-3 font-display text-xl font-semibold text-ink">
                New service
              </h2>

              <div className="mb-3">
                <label
                  htmlFor="svcTitle"
                  className="mb-1 block text-[15px] font-semibold text-ink"
                >
                  Title
                </label>
                <input
                  id="svcTitle"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sunday Service"
                  className={fieldClass}
                />
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label
                    htmlFor="svcDate"
                    className="mb-1 block text-[15px] font-semibold text-ink"
                  >
                    Date
                  </label>
                  <input
                    id="svcDate"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={fieldClass}
                  />
                </div>
                <div className="min-w-0">
                  <label
                    htmlFor="svcTime"
                    className="mb-1 block text-[15px] font-semibold text-ink"
                  >
                    Start time
                  </label>
                  <input
                    id="svcTime"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className={fieldClass}
                  />
                </div>
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
                {saving ? "Creating..." : "Create service"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminAttendance;
