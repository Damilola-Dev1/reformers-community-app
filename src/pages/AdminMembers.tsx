import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import type { DocumentData } from "firebase/firestore";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "../firebase";
import { settings } from "../config/settings";
import { useAuth } from "../auth/useAuth";
import type { Member } from "../types";
import { Table, Td, Th, Tr } from "../components/ui/Table";

type EditForm = {
  fullName: string;
  phone: string;
  gender: string;
  dateOfBirth: string;
  location: string;
  maritalStatus: string;
  occupation: string;
};

type EditErrors = Partial<Record<keyof EditForm, string>>;
type FilterKey = "all" | "pending" | "approved";

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
  "min-h-11 w-full rounded-control border bg-white px-3 text-[15px] text-ink";
const actionBtn =
  "inline-flex min-h-11 items-center rounded-control border bg-white px-3 text-[13px] font-semibold hover:bg-cream disabled:opacity-60";
const modalBackdrop =
  "fixed inset-0 z-10 flex items-center justify-center bg-ink/40 p-4";

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p !== "");
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

// 2006-01-15 becomes 15 Jan 2006
function formatDob(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value === "" ? "-" : value;
  return match[3] + " " + MONTHS[Number(match[2]) - 1] + " " + match[1];
}

function toMember(id: string, d: DocumentData): Member {
  return {
    id,
    communityId: String(d.communityId ?? ""),
    fullName: String(d.fullName ?? ""),
    email: String(d.email ?? ""),
    phone: String(d.phone ?? ""),
    gender: d.gender as Member["gender"],
    dateOfBirth: String(d.dateOfBirth ?? ""),
    location: String(d.location ?? ""),
    maritalStatus: d.maritalStatus as Member["maritalStatus"],
    occupation: String(d.occupation ?? ""),
    bornAgain: d.bornAgain as Member["bornAgain"],
    holySpirit: d.holySpirit as Member["holySpirit"],
    howHeard: String(d.howHeard ?? ""),
    expectations: String(d.expectations ?? ""),
    walkWithGod: String(d.walkWithGod ?? ""),
    termsAcceptedAt: String(d.termsAcceptedAt ?? ""),
    role: d.role === "admin" ? "admin" : "member",
    status: d.status === "approved" ? "approved" : "pending",
    createdAt:
      d.createdAt && typeof d.createdAt.toDate === "function"
        ? d.createdAt.toDate().toISOString()
        : "",
  };
}

function validateEdit(form: EditForm): EditErrors {
  const found: EditErrors = {};
  if (form.fullName.trim().length < 2) {
    found.fullName = "Enter the full name";
  }
  if (!/^\+?[0-9]{10,15}$/.test(form.phone.trim())) {
    found.phone = "Enter 10 to 15 digits, with an optional + at the start";
  }
  if (form.gender !== "male" && form.gender !== "female") {
    found.gender = "Select a gender";
  }
  if (form.dateOfBirth === "") {
    found.dateOfBirth = "Select a date of birth";
  } else {
    const year = Number(form.dateOfBirth.slice(0, 4));
    const today = new Date().toISOString().slice(0, 10);
    if (year < 1920 || form.dateOfBirth > today) {
      found.dateOfBirth = "Enter a real date of birth";
    }
  }
  if (form.location.trim().length < 2) {
    found.location = "Enter the city and country";
  }
  if (form.maritalStatus === "") {
    found.maritalStatus = "Select a marital status";
  }
  return found;
}

type FieldProps = {
  id: string;
  label: string;
  error?: string;
  children: ReactNode;
};

function Field({ id, label, error, children }: FieldProps) {
  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="mb-1 block text-[15px] font-semibold text-ink"
      >
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1 text-[13px] font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function AdminMembers() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const [editing, setEditing] = useState<Member | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    fullName: "",
    phone: "",
    gender: "",
    dateOfBirth: "",
    location: "",
    maritalStatus: "",
    occupation: "",
  });
  const [editErrors, setEditErrors] = useState<EditErrors>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<Member | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [roleTarget, setRoleTarget] = useState<Member | null>(null);
  const [roleError, setRoleError] = useState("");
  const [roleBusy, setRoleBusy] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const q = query(
          collection(db, "members"),
          where("communityId", "==", settings.communityId),
        );
        const snap = await getDocs(q);
        setMembers(snap.docs.map((d) => toMember(d.id, d.data())));
      } catch (err) {
        console.error(err);
        setError(
          "Could not load members. Check your connection and try again.",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const sorted = useMemo(() => {
    return [...members].sort((a, b) => {
      if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [members]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sorted.filter((m) => {
      if (filter !== "all" && m.status !== filter) return false;
      if (term === "") return true;
      return (
        m.fullName.toLowerCase().includes(term) ||
        m.email.toLowerCase().includes(term) ||
        m.phone.includes(term)
      );
    });
  }, [sorted, search, filter]);

  const pendingCount = useMemo(
    () => members.filter((m) => m.status === "pending").length,
    [members],
  );
  const approvedCount = useMemo(
    () => members.filter((m) => m.status === "approved").length,
    [members],
  );
  const adminCount = useMemo(
    () =>
      members.filter((m) => m.role === "admin" && m.status === "approved")
        .length,
    [members],
  );

  const filterOptions: { key: FilterKey; label: string; count: number }[] = [
    { key: "all", label: "All", count: members.length },
    { key: "pending", label: "Pending", count: pendingCount },
    { key: "approved", label: "Approved", count: approvedCount },
  ];

  function canDelete(m: Member): boolean {
    return m.id !== user?.uid && m.role !== "admin";
  }

  function canChangeRole(m: Member): boolean {
    if (m.status !== "approved") return false;
    if (m.role === "admin") {
      if (m.id === user?.uid) return false;
      if (adminCount <= 1) return false;
    }
    return true;
  }

  async function handleApprove(id: string) {
    setActionError("");
    setBusyId(id);
    try {
      await updateDoc(doc(db, "members", id), { status: "approved" });
      setMembers((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, status: "approved" as const } : m,
        ),
      );
    } catch (err) {
      console.error(err);
      setActionError("Could not approve this member. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  function openEdit(m: Member) {
    setEditing(m);
    setEditForm({
      fullName: m.fullName,
      phone: m.phone,
      gender: m.gender ?? "",
      dateOfBirth: m.dateOfBirth,
      location: m.location,
      maritalStatus: m.maritalStatus ?? "",
      occupation: m.occupation,
    });
    setEditErrors({});
    setSaveError("");
  }

  function closeEdit() {
    setEditing(null);
    setEditErrors({});
    setSaveError("");
  }

  function handleEditChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  }

  function editFieldClass(name: keyof EditForm) {
    return editErrors[name]
      ? baseField + " border-danger"
      : baseField + " border-line";
  }

  async function handleSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;

    const found = validateEdit(editForm);
    if (Object.keys(found).length > 0) {
      setEditErrors(found);
      return;
    }

    setEditErrors({});
    setSaveError("");
    setSaving(true);

    const changes = {
      fullName: editForm.fullName.trim(),
      phone: editForm.phone.trim(),
      gender: editForm.gender as Member["gender"],
      dateOfBirth: editForm.dateOfBirth,
      location: editForm.location.trim(),
      maritalStatus: editForm.maritalStatus as Member["maritalStatus"],
      occupation: editForm.occupation.trim(),
    };
    const memberId = editing.id;

    try {
      await updateDoc(doc(db, "members", memberId), changes);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, ...changes } : m)),
      );
      closeEdit();
    } catch (err) {
      console.error(err);
      setSaveError("Could not save the changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function openDelete(m: Member) {
    setDeleting(m);
    setDeleteError("");
  }

  function closeDelete() {
    setDeleting(null);
    setDeleteError("");
  }

  async function handleDelete() {
    if (!deleting) return;

    if (!canDelete(deleting)) {
      setDeleteError("This account is protected and cannot be deleted here.");
      return;
    }

    const memberId = deleting.id;
    setDeleteError("");
    setDeleteBusy(true);

    try {
      await deleteDoc(doc(db, "members", memberId));
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      closeDelete();
    } catch (err) {
      console.error(err);
      setDeleteError("Could not delete this member. Please try again.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function openRole(m: Member) {
    setRoleTarget(m);
    setRoleError("");
  }

  function closeRole() {
    setRoleTarget(null);
    setRoleError("");
  }

  async function handleRoleChange() {
    if (!roleTarget) return;

    if (!canChangeRole(roleTarget)) {
      setRoleError(
        "This change is not allowed. The last admin, or your own admin role, cannot be removed.",
      );
      return;
    }

    const memberId = roleTarget.id;
    const newRole: Member["role"] =
      roleTarget.role === "admin" ? "member" : "admin";
    setRoleError("");
    setRoleBusy(true);

    try {
      await updateDoc(doc(db, "members", memberId), { role: newRole });
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m)),
      );
      closeRole();
    } catch (err) {
      console.error(err);
      setRoleError("Could not change the role. Please try again.");
    } finally {
      setRoleBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream p-4 md:p-8">
      <div className="mx-auto max-w-[980px]">
        <h1 className="font-display text-3xl font-semibold text-ink">
          Members
        </h1>
        <p className="mb-4 mt-1 text-[15px] text-muted">
          {members.length} registered, {pendingCount} waiting for approval
        </p>

        <label htmlFor="memberSearch" className="sr-only">
          Search by name, email or phone
        </label>
        <input
          id="memberSearch"
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or phone"
          className={baseField + " mb-3 border-line placeholder:text-muted"}
        />

        <div className="mb-4 flex flex-wrap gap-2">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={filter === option.key}
              onClick={() => setFilter(option.key)}
              className={
                "min-h-11 rounded-full border px-4 text-[15px] font-semibold text-ink " +
                (filter === option.key
                  ? "border-brand bg-brand-tint"
                  : "border-line bg-white hover:bg-cream")
              }
            >
              {option.label} {option.count}
            </button>
          ))}
        </div>

        {loading && <p className="text-[15px] text-muted">Loading...</p>}
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

        {!loading && !error && members.length === 0 && (
          <p className="text-[15px] text-muted">
            No members yet. Share your registration link and new members will
            appear here for approval.
          </p>
        )}

        {!loading && !error && members.length > 0 && visible.length === 0 && (
          <p className="text-[15px] text-muted">
            No members match your search. Clear the search or pick All.
          </p>
        )}

        {!loading && !error && visible.length > 0 && (
          <div className="overflow-hidden rounded-panel border border-line bg-white">
            <Table caption="Members, with pending requests first">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Contact</Th>
                  <Th>Birthday</Th>
                  <Th>Status</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((m) => (
                  <Tr key={m.id} tinted={m.status === "pending"}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div
                          aria-hidden="true"
                          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[13px] font-semibold text-brand"
                        >
                          {getInitials(m.fullName)}
                        </div>
                        <span className="font-semibold">{m.fullName}</span>
                      </div>
                    </Td>
                    <Td>
                      <p className="break-all">{m.email}</p>
                      <p className="text-[13px] text-muted">{m.phone || "-"}</p>
                    </Td>
                    <Td>{formatDob(m.dateOfBirth)}</Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        <span
                          className={
                            "rounded-full px-3 py-1 text-[13px] font-semibold " +
                            (m.status === "pending"
                              ? "bg-warn-bg text-warn"
                              : "bg-ok-bg text-ok")
                          }
                        >
                          {m.status === "pending" ? "Pending" : "Approved"}
                        </span>
                        {m.role === "admin" && (
                          <span className="rounded-full bg-brand-tint px-3 py-1 text-[13px] font-semibold text-brand">
                            Admin
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-2">
                        {m.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => handleApprove(m.id)}
                            disabled={busyId === m.id}
                            className={actionBtn + " border-brand text-brand"}
                          >
                            {busyId === m.id ? "Approving..." : "Approve"}
                          </button>
                        )}
                        {canChangeRole(m) && (
                          <button
                            type="button"
                            onClick={() => openRole(m)}
                            className={actionBtn + " border-line text-ink"}
                          >
                            {m.role === "admin" ? "Remove admin" : "Make admin"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          className={actionBtn + " border-line text-ink"}
                        >
                          Edit
                        </button>
                        {canDelete(m) && (
                          <button
                            type="button"
                            onClick={() => openDelete(m)}
                            className={actionBtn + " border-danger text-danger"}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      {editing && (
        <div className={modalBackdrop}>
          <form
            onSubmit={handleSave}
            noValidate
            role="dialog"
            aria-modal="true"
            aria-labelledby="editTitle"
            className="max-h-full w-full max-w-md overflow-y-auto rounded-panel border border-line bg-white p-6"
          >
            <h2
              id="editTitle"
              className="font-display text-2xl font-semibold text-ink"
            >
              Edit member
            </h2>
            <p className="mb-4 mt-1 text-[13px] text-muted">
              {editing.email} (email cannot be changed here)
            </p>

            <Field id="fullName" label="Full name" error={editErrors.fullName}>
              <input
                id="fullName"
                name="fullName"
                value={editForm.fullName}
                onChange={handleEditChange}
                className={editFieldClass("fullName")}
              />
            </Field>

            <Field id="phone" label="WhatsApp number" error={editErrors.phone}>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={editForm.phone}
                onChange={handleEditChange}
                className={editFieldClass("phone")}
              />
            </Field>

            <Field id="gender" label="Gender" error={editErrors.gender}>
              <select
                id="gender"
                name="gender"
                value={editForm.gender}
                onChange={handleEditChange}
                className={editFieldClass("gender")}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>

            <Field
              id="dateOfBirth"
              label="Date of birth"
              error={editErrors.dateOfBirth}
            >
              <input
                id="dateOfBirth"
                name="dateOfBirth"
                type="date"
                value={editForm.dateOfBirth}
                onChange={handleEditChange}
                className={editFieldClass("dateOfBirth")}
              />
            </Field>

            <Field
              id="location"
              label="Location (city and country)"
              error={editErrors.location}
            >
              <input
                id="location"
                name="location"
                value={editForm.location}
                onChange={handleEditChange}
                className={editFieldClass("location")}
              />
            </Field>

            <Field
              id="maritalStatus"
              label="Marital status"
              error={editErrors.maritalStatus}
            >
              <select
                id="maritalStatus"
                name="maritalStatus"
                value={editForm.maritalStatus}
                onChange={handleEditChange}
                className={editFieldClass("maritalStatus")}
              >
                <option value="">Select one</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
                <option value="divorced">Divorced</option>
                <option value="widowed">Widowed</option>
              </select>
            </Field>

            <Field id="occupation" label="Occupation (optional)">
              <input
                id="occupation"
                name="occupation"
                value={editForm.occupation}
                onChange={handleEditChange}
                className={editFieldClass("occupation")}
              />
            </Field>

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
                className="min-h-11 rounded-control border border-line bg-white px-5 text-[15px] font-semibold text-ink hover:bg-cream"
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
        </div>
      )}

      {deleting && (
        <div className={modalBackdrop}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="deleteTitle"
            className="w-full max-w-sm rounded-panel border border-line bg-white p-6"
          >
            <h2
              id="deleteTitle"
              className="font-display text-2xl font-semibold text-ink"
            >
              Delete this member?
            </h2>
            <p className="mt-3 text-[15px] text-ink">
              {deleting.fullName} ({deleting.email}) will be removed from{" "}
              {settings.name}. This cannot be undone.
            </p>
            <p className="mb-4 mt-2 text-[13px] text-muted">
              Their login account is not removed by this button. To remove it
              too, delete it in the Firebase console under Authentication.
            </p>

            {deleteError && (
              <p
                role="alert"
                className="mb-3 text-[15px] font-semibold text-danger"
              >
                {deleteError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleteBusy}
                className="min-h-11 flex-1 rounded-control border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:bg-cream disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteBusy}
                className="min-h-11 flex-1 rounded-control bg-danger px-4 text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {deleteBusy ? "Deleting..." : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {roleTarget && (
        <div className={modalBackdrop}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="roleTitle"
            className="w-full max-w-sm rounded-panel border border-line bg-white p-6"
          >
            <h2
              id="roleTitle"
              className="font-display text-2xl font-semibold text-ink"
            >
              {roleTarget.role === "admin"
                ? "Remove admin role?"
                : "Make this member an admin?"}
            </h2>
            <p className="mb-4 mt-3 text-[15px] text-ink">
              {roleTarget.role === "admin"
                ? roleTarget.fullName +
                  " (" +
                  roleTarget.email +
                  ") will become a normal member and will lose access to the admin area."
                : roleTarget.fullName +
                  " (" +
                  roleTarget.email +
                  ") will be able to see and change everything in the admin area."}
            </p>

            {roleError && (
              <p
                role="alert"
                className="mb-3 text-[15px] font-semibold text-danger"
              >
                {roleError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeRole}
                disabled={roleBusy}
                className="min-h-11 flex-1 rounded-control border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:bg-cream disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRoleChange}
                disabled={roleBusy}
                className="min-h-11 flex-1 rounded-control bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {roleBusy
                  ? "Saving..."
                  : roleTarget.role === "admin"
                    ? "Yes, remove admin"
                    : "Yes, make admin"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminMembers;
