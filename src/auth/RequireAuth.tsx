import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./useAuth";
import PageLoading from "../components/PageLoading";

type Props = {
  children: ReactNode;
  adminOnly?: boolean;
};

function RequireAuth({ children, adminOnly = false }: Props) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <PageLoading />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile || profile.status !== "approved") {
    return <Navigate to="/pending" replace />;
  }

  if (adminOnly && profile.role !== "admin") {
    return <Navigate to="/member" replace />;
  }

  return <>{children}</>;
}

export default RequireAuth;
