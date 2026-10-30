import { useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { auth } from "../firebase";
import { useAuth } from "../auth/useAuth";
import { homeFor } from "../auth/authContext";
import Brand from "../components/Brand";
import { Button, TextField } from "../components/ui";

function Login() {
  const { user, profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to={homeFor(profile)} replace />;
  }

  function fail(message: string) {
    setError(message);
    setErrorKey((k) => k + 1);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setInfo("");

    if (email.trim() === "" || password === "") {
      fail("Enter your email and password");
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password,
      );
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (
        code === "auth/invalid-credential" ||
        code === "auth/wrong-password" ||
        code === "auth/user-not-found"
      ) {
        fail("Wrong email or password");
      } else if (code === "auth/too-many-requests") {
        fail("Too many attempts. Wait a few minutes and try again.");
      } else if (code === "auth/network-request-failed") {
        fail("Network problem. Check your connection and try again.");
      } else {
        fail("Something went wrong. Please try again.");
        console.error(err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    setError("");
    setInfo("");

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      fail("Type your email above first, then click Forgot password");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      setInfo(
        "If this email is registered with us, a password reset link is on its way. Please check your inbox and your spam folder.",
      );
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/network-request-failed") {
        fail("Network problem. Check your connection and try again.");
      } else {
        fail("Could not send the reset email. Please try again.");
        console.error(err);
      }
    }
  }

  return (
    <div className="min-h-screen bg-white md:grid md:grid-cols-2">
      <div className="flex px-4 py-10 sm:px-10">
        <form
          onSubmit={handleSubmit}
          noValidate
          className="m-auto w-full max-w-sm"
        >
          <Brand />

          <h1 className="mt-10 font-display text-3xl font-semibold text-ink">
            Welcome back
          </h1>
          <p className="mt-2 mb-8 text-[15px] text-muted">
            Sign in to see your next meeting and your assignments.
          </p>

          <div className="space-y-4">
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <TextField
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <div className="mt-1 mb-4 text-right">
            <Button variant="quiet" onClick={handleReset} className="-mr-4">
              Forgot password?
            </Button>
          </div>

          {error && (
            <p
              key={errorKey}
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-control bg-danger-bg px-3 py-2.5 text-[15px] font-semibold text-danger"
            >
              <WarningCircle
                size={20}
                aria-hidden="true"
                className="shrink-0"
              />
              {error}
            </p>
          )}
          {info && (
            <p
              role="status"
              className="mb-4 flex items-start gap-2 rounded-control bg-ok-bg px-3 py-2.5 text-[15px] text-ok"
            >
              <CheckCircle size={20} aria-hidden="true" className="shrink-0" />
              {info}
            </p>
          )}

          <Button type="submit" fullWidth disabled={submitting}>
            {submitting ? "Signing in..." : "Sign in"}
          </Button>

          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-1.5 text-[15px] text-muted">
            New here?
            <Link
              to="/register"
              className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline"
            >
              Register
            </Link>
          </p>
        </form>
      </div>

      <div className="hidden items-center bg-brand p-16 text-white md:flex">
        <div className="max-w-md">
          <div className="mb-8 h-1 w-12 bg-gold" />
          <p className="font-display text-4xl leading-tight font-semibold">
            Your meetings, assignments and attendance in one place.
          </p>
          <p className="mt-6 text-lg text-brand-tint">
            Every new member is approved by a leader before they can enter. You
            will only ever see your own information.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
