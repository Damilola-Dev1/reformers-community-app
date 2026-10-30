import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { settings } from "../config/settings";
import { useAuth } from "../auth/useAuth";
import { homeFor } from "../auth/authContext";
import AuthBackground from "../components/AuthBackground";
import Brand from "../components/Brand";
import { Button, Chip } from "../components/ui";

function Pending() {
  const { user, profile, loading, reload } = useAuth();

  useEffect(() => {
    if (user && !profile) {
      reload();
    }
  }, [user, profile, reload]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream text-muted">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profile && profile.status === "approved") {
    return <Navigate to={homeFor(profile)} replace />;
  }

  const firstName = profile?.fullName.split(" ")[0] ?? "";

  return (
    <AuthBackground>
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Brand />
        </div>

        <div className="rounded-panel border border-line bg-white p-5 sm:p-6">
          <Chip tone="warning">Pending approval</Chip>

          <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
            Waiting for approval
          </h1>

          <p className="mt-3 text-[15px] text-ink">
            {firstName ? "Thank you, " + firstName + ". " : "Thank you. "}
            Your registration for {settings.name} has been received. A leader
            needs to approve it before you can see meetings and assignments. You
            can sign in as soon as that is done.
          </p>

          {user.email && (
            <p className="mt-3 text-[13px] text-muted">
              Registered as {user.email}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => reload()} className="sm:flex-1">
              Check again
            </Button>
            <Button
              variant="outline"
              onClick={() => signOut(auth)}
              className="sm:flex-1"
            >
              Log out
            </Button>
          </div>
        </div>
      </div>
    </AuthBackground>
  );
}

export default Pending;
