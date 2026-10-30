import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  CheckSquare,
  FileText,
  House,
  UserCircle,
} from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";

type Tab = {
  to: string;
  label: string;
  icon: Icon;
  active: boolean;
};

function MemberLayout() {
  const { pathname } = useLocation();

  const tabs: Tab[] = [
    {
      to: "/member",
      label: "Home",
      icon: House,
      active: pathname === "/member" || pathname === "/member/",
    },
    {
      to: "/member/assignments",
      label: "Assignments",
      icon: FileText,
      active: pathname.startsWith("/member/assignments"),
    },
    {
      to: "/member/attendance",
      label: "Attendance",
      icon: CheckSquare,
      active: pathname === "/member/attendance",
    },
    {
      to: "/member/profile",
      label: "Profile",
      icon: UserCircle,
      active: pathname === "/member/profile",
    },
  ];

  return (
    <div className="min-h-screen bg-cream pb-24">
      <Outlet />

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-white"
      >
        <div className="mx-auto flex max-w-3xl">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              aria-current={t.active ? "page" : undefined}
              className={
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[13px] font-semibold transition-colors duration-150 " +
                (t.active ? "text-brand" : "text-muted hover:text-ink")
              }
            >
              <t.icon size={24} aria-hidden="true" />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

export default MemberLayout;
