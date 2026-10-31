import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import type { DocumentData } from "firebase/firestore";
import { useSearchParams } from "react-router-dom";
import { MagnifyingGlass } from "@phosphor-icons/react";
import {
  collection,
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
import ListSkeleton from "../components/ListSkeleton";

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
type FilterKey = "all" | "pending" | "approved" | "deactivated";

const PAGE_SIZE = 25;

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
const linkBtn =
  "inline-flex min-h-11 items-center text-[13px] font-semibold hover:underline disabled:opacity-60";
const approveBtn =
  "inline-flex min-h-11 items-center rounded-control bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-dark disabled:opacity-60";
const editBtn =
  "inline-flex min-h-11 items-center rounded-control border border-line bg-white px-4 text-[13px] font-semibold text-ink hover:bg-cream";
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

// Shows only the first two names, so "Ibigbami Ifeoluwa Odunayo"
// becomes "Ibigbami Ifeoluwa". The full name is still stored.
function shortName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p !== "");
  return parts.slice(0, 2).join(" ");
}

// 2006-01-15 becomes 15 Jan 2006
function formatDob(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value === "" ? "-" : value;
  return match[3] + " " + MONTHS[Number(match[2]) - 1] + " " + match[1];
}

// Lets a long email wrap neatly before the @ sign, never mid-word.
function EmailText({ email }: { email: string }) {
  const at = email.indexOf("@");
  if (at < 1) return <>{email}</>;
  return (
    <>
      {email.slice(0, at)}
      <wbr />
      {email.slice(at)}
    </>
  );
}

// Status chip (and Admin chip), used by both the table and the phone list.
function StatusChips({ member }: { member: Member }) {
  let chipClass = "bg-ok-bg text-ok";
  let chipLabel = "Approved";
  if (member.status === "pending") {
    chipClass = "bg-warn-bg text-warn";
    chipLabel = "Pending";
  } else if (member.status === "deactivated") {
    chipClass = "bg-line text-muted";
    chipLabel = "Deactivated";
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <span
        className={
          "rounded-full px-3 py-1 text-[13px] font-semibold " + chipClass
        }
      >
        {chipLabel}
      </span>
      {member.role === "admin" && (
        <span className="rounded-full bg-brand-tint px-3 py-1 text-[13px] font-semibold text-brand">
          Admin
        </span>
      )}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  return (
    <div
      aria-hidden="true"
      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[13px] font-semibold text-brand"
    >
      {getInitials(name)}
    </div>
  );
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
    status:
      d.status === "approved"
        ? "approved"
        : d.status === "deactivated"
          ? "deactivated"
          : "pending",
    createdAt:
      d.createdAt && typeof d.createdAt.toDate === "function"
        ? d.createdAt.toDate().toISOString()
        : "",
  };
}

// Pending first, then approved, then deactivated.
function statusRank(status: Member["status"]): number {
  if (status === "pending") return 0;
  if (status === "approved") return 1;
  return 2;
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
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<FilterKey>(
    searchParams.get("filter") === "pending" ? "pending" : "all",
  );
  const [shownCount, setShownCount] = useState(PAGE_SIZE);

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

  const [statusTarget, setStatusTarget] = useState<Member | null>(null);
  const [statusError, setStatusError] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);

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
      if (a.status !== b.status) {
        return statusRank(a.status) - statusRank(b.status);
      }
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

  // Only the first page of results is drawn. "Show more" adds another page.
  const shown = useMemo(
    () => visible.slice(0, shownCount),
    [visible, shownCount],
  );

  const pendingCount = useMemo(
    () => members.filter((m) => m.status === "pending").length,
    [members],
  );
  const approvedCount = useMemo(
    () => members.filter((m) => m.status === "approved").length,
    [members],
  );
  const deactivatedCount = useMemo(
    () => members.filter((m) => m.status === "deactivated").length,
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
    { key: "deactivated", label: "Deactivated", count: deactivatedCount },
  ];

  // Admins and your own account cannot be deactivated or reactivated here.
  function canChangeStatus(m: Member): boolean {
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

  function handleSearchChange(value: string) {
    setSearch(value);
    setShownCount(PAGE_SIZE);
  }

  function handleFilterChange(key: FilterKey) {
    setFilter(key);
    setShownCount(PAGE_SIZE);
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

  function openStatus(m: Member) {
    setStatusTarget(m);
    setStatusError("");
  }

  function closeStatus() {
    setStatusTarget(null);
    setStatusError("");
  }

  // Deactivated members become approved again. Everyone else becomes deactivated.
  async function handleStatusChange() {
    if (!statusTarget) return;

    if (!canChangeStatus(statusTarget)) {
      setStatusError(
        "This account is protected. Your own account and admin accounts cannot be deactivated here.",
      );
      return;
    }

    const memberId = statusTarget.id;
    const newStatus: Member["status"] =
      statusTarget.status === "deactivated" ? "approved" : "deactivated";
    setStatusError("");
    setStatusBusy(true);

    try {
      await updateDoc(doc(db, "members", memberId), { status: newStatus });
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, status: newStatus } : m)),
      );
      closeStatus();
    } catch (err) {
      console.error(err);
      setStatusError("Could not change this member. Please try again.");
    } finally {
      setStatusBusy(false);
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

  // From inside the Edit window: close it, then open the confirmation.
  function startRoleFromEdit() {
    if (!editing) return;
    const target = editing;
    closeEdit();
    openRole(target);
  }

  function startStatusFromEdit() {
    if (!editing) return;
    const target = editing;
    closeEdit();
    openStatus(target);
  }

  // Row actions, shared by the table (laptop) and the list (phone).
  // Only the everyday actions are here. Admin role and Deactivate live
  // inside the Edit window.
  function renderActions(m: Member) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {m.status === "pending" && (
          <button
            type="button"
            onClick={() => handleApprove(m.id)}
            disabled={busyId === m.id}
            className={approveBtn}
          >
            {busyId === m.id ? "Approving..." : "Approve"}
          </button>
        )}
        <button type="button" onClick={() => openEdit(m)} className={editBtn}>
          Edit
        </button>
      </div>
    );
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
        <div className="relative mb-3">
          <MagnifyingGlass
            size={18}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            id="memberSearch"
            type="search"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by name, email or phone"
            className={baseField + " border-line pl-10 placeholder:text-muted"}
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-x-6">
          {filterOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              aria-pressed={filter === option.key}
              onClick={() => handleFilterChange(option.key)}
              className={
                "min-h-11 border-b-2 text-[15px] font-semibold " +
                (filter === option.key
                  ? "border-brand text-ink"
                  : "border-transparent text-muted hover:text-ink")
              }
            >
              {option.label} {option.count}
            </button>
          ))}
        </div>

        {loading && <ListSkeleton rows={6} />}
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
          <>
            <div className="overflow-hidden rounded-panel border border-line bg-white">
              {/* Laptop and tablet: the table */}
              <div className="hidden md:block">
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
                    {shown.map((m) => (
                      <Tr key={m.id} tinted={m.status === "pending"}>
                        <Td>
                          <div className="flex items-center gap-3">
                            <Avatar name={m.fullName} />
                            <span className="font-semibold" title={m.fullName}>
                              {shortName(m.fullName)}
                            </span>
                          </div>
                        </Td>
                        <Td>
                          <p>
                            <EmailText email={m.email} />
                          </p>
                          <p className="text-[13px] text-muted">
                            {m.phone || "-"}
                          </p>
                        </Td>
                        <Td className="whitespace-nowrap">
                          {formatDob(m.dateOfBirth)}
                        </Td>
                        <Td>
                          <StatusChips member={m} />
                        </Td>
                        <Td>{renderActions(m)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Phone: one ruled row per member, no sideways sliding */}
              <ul
                aria-label="Members, with pending requests first"
                className="divide-y divide-line md:hidden"
              >
                {shown.map((m) => (
                  <li
                    key={m.id}
                    className={
                      "px-4 py-4 " +
                      (m.status === "pending" ? "bg-brand-tint" : "")
                    }
                  >
                    <div className="flex items-center gap-3">
                      <Avatar name={m.fullName} />
                      <div className="min-w-0 flex-1">
                        <p
                          className="break-words text-[15px] font-semibold text-ink"
                          title={m.fullName}
                        >
                          {shortName(m.fullName)}
                        </p>
                        <div className="mt-1">
                          <StatusChips member={m} />
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 break-words text-[15px] text-ink">
                      <EmailText email={m.email} />
                    </p>
                    <p className="text-[13px] text-muted">{m.phone || "-"}</p>
                    <p className="mt-1 text-[13px] text-muted">
                      Birthday: {formatDob(m.dateOfBirth)}
                    </p>
                    <div className="mt-3">{renderActions(m)}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4">
              <p className="text-[13px] text-muted">
                Showing {shown.length} of {visible.length}
              </p>
              {visible.length > shown.length && (
                <button
                  type="button"
                  onClick={() => setShownCount(shownCount + PAGE_SIZE)}
                  className="min-h-11 rounded-control border border-line bg-white px-5 text-[15px] font-semibold text-ink hover:bg-cream"
                >
                  Show {Math.min(PAGE_SIZE, visible.length - shown.length)} more
                </button>
              )}
            </div>
          </>
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

            {(canChangeRole(editing) || canChangeStatus(editing)) && (
              <div className="mt-6 border-t border-line pt-4">
                {canChangeRole(editing) && (
                  <div className="mb-2">
                    <p className="text-[15px] font-semibold text-ink">
                      Admin access
                    </p>
                    <p className="text-[13px] text-muted">
                      {editing.role === "admin"
                        ? "This member can see and change everything in the admin area."
                        : "This member is a normal member."}
                    </p>
                    <button
                      type="button"
                      onClick={startRoleFromEdit}
                      className={linkBtn + " text-brand"}
                    >
                      {editing.role === "admin" ? "Remove admin" : "Make admin"}
                    </button>
                  </div>
                )}
                {canChangeStatus(editing) && (
                  <div>
                    <p className="text-[15px] font-semibold text-ink">
                      Membership
                    </p>
                    <p className="text-[13px] text-muted">
                      {editing.status === "deactivated"
                        ? "This member cannot sign in to the community area."
                        : "Deactivating stops this member signing in. Their records are kept."}
                    </p>
                    <button
                      type="button"
                      onClick={startStatusFromEdit}
                      className={
                        linkBtn +
                        (editing.status === "deactivated"
                          ? " text-brand"
                          : " text-danger")
                      }
                    >
                      {editing.status === "deactivated"
                        ? "Reactivate this member"
                        : "Deactivate this member"}
                    </button>
                  </div>
                )}
                <p className="mt-1 text-[13px] text-muted">
                  Unsaved changes above are not kept when you choose one of
                  these.
                </p>
              </div>
            )}
          </form>
        </div>
      )}

      {statusTarget && (
        <div className={modalBackdrop}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="statusTitle"
            className="w-full max-w-sm rounded-panel border border-line bg-white p-6"
          >
            <h2
              id="statusTitle"
              className="font-display text-2xl font-semibold text-ink"
            >
              {statusTarget.status === "deactivated"
                ? "Reactivate this member?"
                : "Deactivate this member?"}
            </h2>
            <p className="mb-4 mt-3 text-[15px] text-ink">
              {statusTarget.status === "deactivated"
                ? statusTarget.fullName +
                  " (" +
                  statusTarget.email +
                  ") will be approved again and can sign in to " +
                  settings.name +
                  "."
                : statusTarget.fullName +
                  " (" +
                  statusTarget.email +
                  ") will no longer be able to see meetings, assignments or announcements in " +
                  settings.name +
                  ". Their records are kept, and you can reactivate them at any time."}
            </p>

            {statusError && (
              <p
                role="alert"
                className="mb-3 text-[15px] font-semibold text-danger"
              >
                {statusError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeStatus}
                disabled={statusBusy}
                className="min-h-11 flex-1 rounded-control border border-line bg-white px-4 text-[15px] font-semibold text-ink hover:bg-cream disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusChange}
                disabled={statusBusy}
                className="min-h-11 flex-1 rounded-control bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
              >
                {statusBusy
                  ? "Saving..."
                  : statusTarget.status === "deactivated"
                    ? "Yes, reactivate"
                    : "Yes, deactivate"}
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
