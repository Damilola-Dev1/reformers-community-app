import { useEffect, useState } from "react";
import type { SyntheticEvent } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import {
  Cake,
  CalendarCheck,
  ClipboardText,
  DownloadSimple,
  List,
  Megaphone,
  SignOut,
  SquaresFour,
  Users,
  X,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { auth, db } from "../firebase";
import { settings } from "../config/settings";

type LinkItem = {
  to: string;
  label: string;
  end: boolean;
  icon: Icon;
};

const links: LinkItem[] = [
  { to: "/admin", label: "Dashboard", end: true, icon: SquaresFour },
  { to: "/admin/members", label: "Members", end: false, icon: Users },
  { to: "/admin/birthdays", label: "Birthdays", end: false, icon: Cake },
  {
    to: "/admin/attendance",
    label: "Attendance",
    end: false,
    icon: CalendarCheck,
  },
  {
    to: "/admin/announcements",
    label: "Announcements",
    end: false,
    icon: Megaphone,
  },
  {
    to: "/admin/assignments",
    label: "Assignments",
    end: false,
    icon: ClipboardText,
  },
  { to: "/admin/exports", label: "Exports", end: false, icon: DownloadSimple },
];

// Same look in the sidebar and in the phone drawer. 44px tall touch target.
function linkClass(isActive: boolean): string {
  return (
    "flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] font-semibold whitespace-nowrap transition-colors duration-150 " +
    (isActive ? "bg-brand text-white" : "text-ink hover:bg-brand-tint")
  );
}

function hideBroken(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <img
        src={settings.logo}
        alt=""
        onError={hideBroken}
        className="h-12 w-auto shrink-0 object-contain"
      />
      <p className="font-display text-base font-semibold leading-tight text-ink">
        {settings.name}
      </p>
    </div>
  );
}

type NavItemProps = {
  item: LinkItem;
  pending: number;
  onClick?: () => void;
};

// One sidebar link. Members shows how many people are waiting for approval.
function NavItem({ item, pending, onClick }: NavItemProps) {
  const showBadge = item.to === "/admin/members" && pending > 0;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onClick}
      aria-label={
        showBadge
          ? item.label + ", " + pending + " waiting for approval"
          : undefined
      }
      className={({ isActive }) => linkClass(isActive)}
    >
      {({ isActive }) => (
        <>
          <item.icon size={20} aria-hidden="true" className="shrink-0" />
          {item.label}
          {showBadge && (
            <span
              aria-hidden="true"
              className={
                "ml-auto min-w-6 rounded-full px-2 py-0.5 text-center text-[13px] font-semibold " +
                (isActive ? "bg-white text-brand" : "bg-brand text-white")
              }
            >
              {pending > 99 ? "99+" : pending}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function AdminLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(0);
  const { pathname } = useLocation();

  // Count people waiting for approval. Runs again on every page change,
  // so the number drops as soon as someone is approved.
  useEffect(() => {
    let cancelled = false;
    async function loadPending() {
      try {
        const q = query(
          collection(db, "members"),
          where("communityId", "==", settings.communityId),
          where("status", "==", "pending"),
        );
        const snap = await getDocs(q);
        if (!cancelled) setPending(snap.size);
      } catch (err) {
        console.error(err);
      }
    }
    loadPending();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return (
    <div className="min-h-screen bg-cream md:flex">
      <aside className="hidden border-r border-line bg-white p-4 md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col">
        <div className="mb-6">
          <Brand />
        </div>

        <nav aria-label="Admin" className="flex flex-col gap-1">
          {links.map((l) => (
            <NavItem key={l.to} item={l} pending={pending} />
          ))}
        </nav>

        <button
          type="button"
          onClick={() => signOut(auth)}
          className="mt-auto flex min-h-11 items-center gap-3 rounded-control px-3 text-[15px] font-semibold text-muted transition-colors duration-150 hover:bg-brand-tint hover:text-ink"
        >
          <SignOut size={20} aria-hidden="true" className="shrink-0" />
          Log out
        </button>
      </aside>

      <div className="sticky top-0 z-20 border-b border-line bg-white md:hidden">
        <div className="flex items-center gap-3 px-3 py-2">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label={
              pending > 0
                ? "Open menu, " + pending + " waiting for approval"
                : "Open menu"
            }
            className="relative flex size-11 shrink-0 items-center justify-center rounded-control border border-line text-ink transition-colors duration-150 hover:bg-brand-tint"
          >
            <List size={22} aria-hidden="true" />
            {pending > 0 && (
              <span
                aria-hidden="true"
                className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-brand px-1.5 text-center text-[13px] font-semibold leading-5 text-white"
              >
                {pending > 9 ? "9+" : pending}
              </span>
            )}
          </button>
          <p className="min-w-0 truncate font-display text-base font-semibold text-ink">
            {settings.name}
          </p>
        </div>
      </div>

      {menuOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Admin menu"
        >
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setMenuOpen(false)}
          />

          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-line bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-line p-4">
              <Brand />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="flex size-11 shrink-0 items-center justify-center rounded-control text-ink transition-colors duration-150 hover:bg-brand-tint"
              >
                <X size={22} aria-hidden="true" />
              </button>
            </div>

            <nav
              aria-label="Admin"
              className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
            >
              {links.map((l) => (
                <NavItem
                  key={l.to}
                  item={l}
                  pending={pending}
                  onClick={() => setMenuOpen(false)}
                />
              ))}
            </nav>

            <div className="border-t border-line p-3">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  signOut(auth);
                }}
                className="flex min-h-11 w-full items-center gap-3 rounded-control border border-line px-3 text-[15px] font-semibold text-ink transition-colors duration-150 hover:bg-brand-tint"
              >
                <SignOut size={20} aria-hidden="true" className="shrink-0" />
                Log out
              </button>
            </div>
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1">
        <div className="max-w-[980px] px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;
