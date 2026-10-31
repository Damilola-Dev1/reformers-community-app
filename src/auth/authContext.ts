import { createContext } from "react";
import type { User } from "firebase/auth";

export type Profile = {
  fullName: string;
  role: "admin" | "member";
  status: "pending" | "approved" | "deactivated";
};

export type AuthValue = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  reload: () => Promise<void>;
};

export const AuthContext = createContext<AuthValue>({
  user: null,
  profile: null,
  loading: true,
  reload: async () => {},
});

export function homeFor(profile: Profile | null): string {
  if (!profile || profile.status !== "approved") return "/pending";
  return profile.role === "admin" ? "/admin" : "/member";
}
