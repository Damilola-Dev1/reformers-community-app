import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ArrowLeft } from "@phosphor-icons/react";
import { auth, db } from "../firebase";
import { settings } from "../config/settings";
import { useAuth } from "../auth/useAuth";

type Details = {
  fullName: string;
  email: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  location: string;
  maritalStatus: string;
  occupation: string;
  bornAgain: string;
  holySpirit: string;
  howHeard: string;
  expectations: string;
  walkWithGod: string;
};

type EditForm = {
  fullName: string;
  phone: string;
  location: string;
  maritalStatus: string;
  occupation: string;
};

type EditErrors = Partial<Record<keyof EditForm, string>>;

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

const baseField =
  "min-h-11 w-full rounded-control border bg-white px-3 text-[15px] text-ink placeholder:text-muted";

function validate(form: EditForm): EditErrors {
  const found: EditErrors = {};

  if (form.fullName.trim().length < 2) {
    found.fullName = "Enter your full name";
  }

  if (!/^[+]?[0-9]{10,15}$/.test(form.phone.trim())) {
    found.phone = "Enter 10 to 15 digits, with an optional + at the start";
  }

  if (form.location.trim().length < 2) {
    found.location = "Enter your city and country";
  }

  if (form.maritalStatus === "") {
    found.maritalStatus = "Select your marital status";
  }

  return found;
}

// 2000-01-15 becomes 15 Jan 2000
function formatDob(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return match[3] + " " + MONTHS[Number(match[2]) - 1] + " " + match[1];
}

function capitalise(value: string): string {
  return value === "" ? "" : value.charAt(0).toUpperCase() + value.slice(1);
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line py-3 last:border-b-0">
      <p className="text-[13px] font-semibold text-muted">{label}</p>
      <p className="mt-0.5 whitespace-pre-line text-[15px] text-ink">
        {value === "" ? "-" : value}
      </p>
    </div>
  );
}

function MemberProfile() {
  const { user, reload } = useAuth();
  const uid = user ? user.uid : "";

  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm>({
    fullName: "",
    phone: "",
    location: "",
    maritalStatus: "",
    occupation: "",
  });
  const [errors, setErrors] = useState<EditErrors>({});
  const [saveError, setSaveError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const snap = await getDoc(doc(db, "members", uid));
        if (snap.exists()) {
          const d = snap.data();
          setDetails({
            fullName: String(d.fullName ?? ""),
            email: String(d.email ?? ""),
            phone: String(d.phone ?? ""),
            gender: String(d.gender ?? ""),
            dateOfBirth: String(d.dateOfBirth ?? ""),
            location: String(d.location ?? ""),
            maritalStatus: String(d.maritalStatus ?? ""),
            occupation: String(d.occupation ?? ""),
            bornAgain: String(d.bornAgain ?? ""),
            holySpirit: String(d.holySpirit ?? ""),
            howHeard: String(d.howHeard ?? ""),
            expectations: String(d.expectations ?? ""),
            walkWithGod: String(d.walkWithGod ?? ""),
          });
        } else {
          setError("Your profile could not be found.");
        }
      } catch (err) {
        console.error(err);
        setError(
          "Could not load your profile. Check your connection and refresh.",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [uid]);

  function openEdit() {
    if (!details) return;
    setForm({
      fullName: details.fullName,
      phone: details.phone,
      location: details.location,
      maritalStatus: details.maritalStatus,
      occupation: details.occupation,
    });
    setErrors({});
    setSaveError("");
    setMessage("");
    setEditing(true);
  }

  function closeEdit() {
    setEditing(false);
    setErrors({});
    setSaveError("");
  }

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function fieldClass(name: keyof EditForm) {
    return errors[name]
      ? baseField + " border-danger"
      : baseField + " border-line";
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!details || !uid) return;

    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setErrors({});
    setSaveError("");
    setSaving(true);

    const changes = {
      fullName: form.fullName.trim(),
      phone: form.phone.trim(),
      location: form.location.trim(),
      maritalStatus: form.maritalStatus,
      occupation: form.occupation.trim(),
    };

    try {
      await updateDoc(doc(db, "members", uid), changes);
      setDetails({ ...details, ...changes });
      await reload();
      setEditing(false);
      setMessage("Your profile has been updated.");
    } catch (err) {
      console.error(err);
      setSaveError("Could not save your changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/member"
          className="inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-brand hover:text-brand-dark"
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Back to home
        </Link>

        <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
          My profile
        </h1>
        <p className="mb-6 mt-1 text-[15px] text-muted">
          Only you and the leaders can see this information. Other members
          cannot.
        </p>

        {loading && <p className="text-[15px] text-muted">Loading...</p>}
        {error && (
          <p role="alert" className="text-[15px] font-semibold text-danger">
            {error}
          </p>
        )}
        {message && (
          <p className="mb-4 rounded-control bg-ok-bg px-3 py-2 text-[15px] font-semibold text-ok">
            {message}
          </p>
        )}

        {!loading && !error && details && !editing && (
          <div className="rounded-panel border border-line bg-white p-4">
            <div className="flex items-center gap-3 border-b border-line pb-4">
              <div
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[15px] font-semibold text-brand"
              >
                {initialsOf(details.fullName)}
              </div>
              <div className="min-w-0">
                <p className="text-[17px] font-semibold text-ink">
                  {details.fullName}
                </p>
                <p className="text-[13px] text-muted">
                  Member of {settings.name}
                </p>
              </div>
            </div>

            <Row label="Email" value={details.email} />
            <Row label="WhatsApp number" value={details.phone} />
            <Row label="Date of birth" value={formatDob(details.dateOfBirth)} />
            <Row label="Gender" value={capitalise(details.gender)} />
            <Row label="Location" value={details.location} />
            <Row
              label="Marital status"
              value={capitalise(details.maritalStatus)}
            />
            <Row label="Occupation" value={details.occupation} />
            <Row label="Born again" value={details.bornAgain} />
            <Row label="Received the Holy Spirit" value={details.holySpirit} />
            <Row label="How you heard about us" value={details.howHeard} />
            <Row label="Your expectations" value={details.expectations} />
            <Row label="Your walk with God" value={details.walkWithGod} />

            <button
              type="button"
              onClick={openEdit}
              className="mt-4 min-h-11 rounded-control bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-dark"
            >
              Edit my details
            </button>
            <p className="mt-3 text-[13px] text-muted">
              To change your email, gender or date of birth, please ask a
              leader.
            </p>

            <button
              type="button"
              onClick={() => signOut(auth)}
              className="mt-4 min-h-11 w-full rounded-control border border-line bg-white px-5 text-[15px] font-semibold text-brand hover:bg-cream"
            >
              Log out
            </button>
          </div>
        )}

        {!loading && !error && details && editing && (
          <form
            onSubmit={handleSave}
            noValidate
            className="rounded-panel border border-line bg-white p-4"
          >
            <div className="mb-4">
              <label
                htmlFor="fullName"
                className="mb-1 block text-[15px] font-semibold text-ink"
              >
                Full name
              </label>
              <input
                id="fullName"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                className={fieldClass("fullName")}
              />
              {errors.fullName && (
                <p
                  role="alert"
                  className="mt-1 text-[13px] font-semibold text-danger"
                >
                  {errors.fullName}
                </p>
              )}
            </div>

            <div className="mb-4">
              <label
                htmlFor="phone"
                className="mb-1 block text-[15px] font-semibold text-ink"
              >
                WhatsApp number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                className={fieldClass("phone")}
              />
              {errors.phone && (
                <p
                  role="alert"
                  className="mt-1 text-[13px] font-semibold text-danger"
                >
                  {errors.phone}
                </p>
              )}
            </div>

            <div className="mb-4">
              <label
                htmlFor="location"
                className="mb-1 block text-[15px] font-semibold text-ink"
              >
                Location (city and country)
              </label>
              <input
                id="location"
                name="location"
                value={form.location}
                onChange={handleChange}
                className={fieldClass("location")}
              />
              {errors.location && (
                <p
                  role="alert"
                  className="mt-1 text-[13px] font-semibold text-danger"
                >
                  {errors.location}
                </p>
              )}
            </div>

            <div className="mb-4">
              <label
                htmlFor="maritalStatus"
                className="mb-1 block text-[15px] font-semibold text-ink"
              >
                Marital status
              </label>
              <select
                id="maritalStatus"
                name="maritalStatus"
                value={form.maritalStatus}
                onChange={handleChange}
                className={fieldClass("maritalStatus")}
              >
                <option value="">Select one</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
              </select>
              {errors.maritalStatus && (
                <p
                  role="alert"
                  className="mt-1 text-[13px] font-semibold text-danger"
                >
                  {errors.maritalStatus}
                </p>
              )}
            </div>

            <div className="mb-6">
              <label
                htmlFor="occupation"
                className="mb-1 block text-[15px] font-semibold text-ink"
              >
                Occupation (optional)
              </label>
              <input
                id="occupation"
                name="occupation"
                value={form.occupation}
                onChange={handleChange}
                className={fieldClass("occupation")}
              />
            </div>

            {saveError && (
              <p
                role="alert"
                className="mb-3 text-[15px] font-semibold text-danger"
              >
                {saveError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeEdit}
                disabled={saving}
                className="min-h-11 rounded-control border border-line bg-white px-5 text-[15px] font-semibold text-ink hover:bg-cream disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="min-h-11 flex-1 rounded-control bg-brand px-5 text-[15px] font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default MemberProfile;
