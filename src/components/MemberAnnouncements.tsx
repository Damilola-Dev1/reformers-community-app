import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
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

// Reads like: 12 Oct 2026
function formatWhen(value: Date | null): string {
  if (!value) return "";
  return (
    value.getDate() + " " + MONTHS[value.getMonth()] + " " + value.getFullYear()
  );
}

function MemberAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        setItems(loaded.slice(0, 5));
      } catch (err) {
        console.error(err);
        setError("Could not load announcements.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <section className="rounded-panel border border-line bg-white p-4">
      <h2 className="font-display text-xl font-semibold text-ink">
        Announcements
      </h2>

      {loading && <p className="mt-3 text-[15px] text-muted">Loading...</p>}
      {error && (
        <p role="alert" className="mt-3 text-[15px] font-semibold text-danger">
          {error}
        </p>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="mt-3 text-[15px] text-muted">
          No announcements yet. When a leader posts one, it appears here.
        </p>
      )}

      {items.length > 0 && (
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {items.map((a) => (
            <li key={a.id} className="py-3">
              <p className="text-[15px] font-semibold text-ink">{a.title}</p>
              <p className="mb-1 text-[13px] text-muted">
                {formatWhen(a.createdAt)}
              </p>
              <p className="whitespace-pre-line text-[15px] text-ink">
                {a.message}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default MemberAnnouncements;
