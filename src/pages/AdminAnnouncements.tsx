import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { settings } from "../config/settings";

type Announcement = {
  id: string;
  title: string;
  message: string;
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

// Reads like: 28 Oct 2026
function formatWhen(value: Date | null): string {
  if (!value) return "";
  return (
    value.getDate() + " " + MONTHS[value.getMonth()] + " " + value.getFullYear()
  );
}

function shareLink(a: Announcement): string {
  const text = a.title + "\n\n" + a.message + "\n\n" + settings.name;
  return "https://wa.me/?text=" + encodeURIComponent(text);
}

const fieldClass =
  "min-h-11 w-full rounded-control border border-line bg-white px-3 text-[15px] text-ink placeholder:text-muted";

function AdminAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState("");
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const q = query(
          collection(db, "announcements"),
          where("communityId", "==", settings.communityId),
        );
        const snap = await getDocs(q);
        const loaded = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title ?? ""),
            message: String(data.message ?? ""),
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
          "Could not load announcements. Check your connection and try again.",
        );
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
    const cleanMessage = message.trim();
    if (cleanTitle.length < 2) {
      setFormError("Enter a title for the announcement");
      return;
    }
    if (cleanMessage.length < 2) {
      setFormError("Write the announcement message");
      return;
    }

    setSaving(true);
    try {
      const ref = await addDoc(collection(db, "announcements"), {
        communityId: settings.communityId,
        title: cleanTitle,
        message: cleanMessage,
        createdAt: serverTimestamp(),
      });
      setItems((prev) => [
        {
          id: ref.id,
          title: cleanTitle,
          message: cleanMessage,
          createdAt: new Date(),
        },
        ...prev,
      ]);
      setTitle("");
      setMessage("");
    } catch (err) {
      console.error(err);
      setFormError("Could not post the announcement. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setFormError("");
    setDeletingId(id);

    try {
      await deleteDoc(doc(db, "announcements", id));
      setItems((prev) => prev.filter((a) => a.id !== id));
      setConfirmId("");
    } catch (err) {
      console.error(err);
      setFormError("Could not delete the announcement. Please try again.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-[980px]">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Announcements
        </h1>
        <p className="mb-6 mt-1 text-[15px] text-muted">
          Every approved member sees these on their home screen
        </p>

        <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
          <form
            onSubmit={handlePost}
            noValidate
            className="rounded-panel border border-line bg-white p-4"
          >
            <h2 className="mb-3 font-display text-xl font-semibold text-ink">
              New announcement
            </h2>

            <div className="mb-3">
              <label
                htmlFor="annTitle"
                className="mb-1 block text-[15px] font-semibold text-ink"
              >
                Title
              </label>
              <input
                id="annTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Special service this Sunday"
                className={fieldClass}
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="annMessage"
                className="mb-1 block text-[15px] font-semibold text-ink"
              >
                Message
              </label>
              <textarea
                id="annMessage"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="What do members need to know?"
                className={fieldClass + " py-2"}
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

            <button
              type="submit"
              disabled={saving}
              className="min-h-11 rounded-control bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {saving ? "Posting..." : "Post announcement"}
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
                No announcements yet. Write one on the left and members will see
                it on their home screen.
              </p>
            )}

            {items.length > 0 && (
              <ul className="divide-y divide-line overflow-hidden rounded-panel border border-line bg-white">
                {items.map((a) => (
                  <li key={a.id} className="p-4">
                    <p className="text-[17px] font-semibold text-ink">
                      {a.title}
                    </p>
                    <p className="mb-2 text-[13px] text-muted">
                      Posted {formatWhen(a.createdAt)}
                    </p>
                    <p className="whitespace-pre-line text-[15px] text-ink">
                      {a.message}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {confirmId === a.id ? (
                        <>
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
                            className="min-h-11 rounded-control border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:bg-cream"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <a
                            href={shareLink(a)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center rounded-control border border-brand bg-white px-4 text-[15px] font-semibold text-brand hover:bg-brand-tint"
                          >
                            Share to WhatsApp
                          </a>
                          <button
                            type="button"
                            onClick={() => setConfirmId(a.id)}
                            className="min-h-11 rounded-control border border-danger bg-white px-4 text-[15px] font-semibold text-danger hover:bg-danger-bg"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default AdminAnnouncements;
