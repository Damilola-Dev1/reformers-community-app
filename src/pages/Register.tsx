import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { WarningCircle } from "@phosphor-icons/react";
import { auth, db } from "../firebase";
import { settings } from "../config/settings";
import AuthBackground from "../components/AuthBackground";
import Brand from "../components/Brand";
import {
  Button,
  SelectField,
  TextAreaField,
  TextField,
} from "../components/ui";
import CheckboxField from "../components/ui/CheckboxField";

type RegisterForm = {
  fullName: string;
  email: string;
  password: string;
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

type FormErrors = Partial<Record<keyof RegisterForm | "terms", string>>;

const titles = ["Account", "About you", "Faith journey", "Agreement"];

function Register() {
  const [step, setStep] = useState(1);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const navigate = useNavigate();
  const [form, setForm] = useState<RegisterForm>({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    gender: "",
    dateOfBirth: "",
    location: "",
    maritalStatus: "",
    occupation: "",
    bornAgain: "",
    holySpirit: "",
    howHeard: "",
    expectations: "",
    walkWithGod: "",
  });

  const totalSteps = titles.length;

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function validateStep(stepNumber: number): FormErrors {
    const found: FormErrors = {};

    if (stepNumber === 1) {
      if (form.fullName.trim().length < 2) {
        found.fullName = "Enter your full name";
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
        found.email = "Enter a valid email address";
      }
      if (!/^\+?[0-9]{10,15}$/.test(form.phone.trim())) {
        found.phone = "Enter 10 to 15 digits, with an optional + at the start";
      }
      if (form.password.length < 8) {
        found.password = "Password must be at least 8 characters";
      }
    }

    if (stepNumber === 2) {
      if (form.gender === "") {
        found.gender = "Select your gender";
      }
      if (form.dateOfBirth === "") {
        found.dateOfBirth = "Select your date of birth";
      } else {
        const year = Number(form.dateOfBirth.slice(0, 4));
        const today = new Date().toISOString().slice(0, 10);
        if (year < 1920 || form.dateOfBirth > today) {
          found.dateOfBirth = "Enter a real date of birth";
        }
      }
      if (form.location.trim().length < 2) {
        found.location = "Enter your city and country";
      }
      if (form.maritalStatus === "") {
        found.maritalStatus = "Select your marital status";
      }
    }

    if (stepNumber === 3) {
      if (form.bornAgain === "") {
        found.bornAgain = "Select an answer";
      }
      if (form.holySpirit === "") {
        found.holySpirit = "Select an answer";
      }
      if (form.howHeard === "") {
        found.howHeard = "Select how you heard about us";
      }
    }

    if (stepNumber === 4) {
      if (!termsAccepted) {
        found.terms = "You must agree to the terms to register";
      }
    }

    return found;
  }

  function goNext() {
    const found = validateStep(step);

    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }

    setErrors({});
    setStep(step + 1);
  }

  function goBack() {
    setErrors({});
    setSubmitError("");
    setStep(step - 1);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (step < totalSteps) {
      goNext();
      return;
    }

    for (let s = 1; s <= totalSteps; s++) {
      const found = validateStep(s);
      if (Object.keys(found).length > 0) {
        setErrors(found);
        setStep(s);
        return;
      }
    }

    setErrors({});
    setSubmitError("");
    setSubmitting(true);

    const memberData = {
      communityId: settings.communityId,
      fullName: form.fullName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      gender: form.gender,
      dateOfBirth: form.dateOfBirth,
      location: form.location.trim(),
      maritalStatus: form.maritalStatus,
      occupation: form.occupation.trim(),
      bornAgain: form.bornAgain,
      holySpirit: form.holySpirit,
      howHeard: form.howHeard,
      expectations: form.expectations.trim(),
      walkWithGod: form.walkWithGod.trim(),
      status: "pending",
      termsAcceptedAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
    };

    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        memberData.email,
        form.password,
      );
      await setDoc(doc(db, "members", cred.user.uid), memberData);
      navigate("/pending");
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-in-use") {
        setSubmitError("This email is already registered. Try signing in.");
      } else if (code === "auth/network-request-failed") {
        setSubmitError("Network problem. Check your connection and try again.");
      } else {
        setSubmitError("Something went wrong. Please try again.");
        console.error(err);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthBackground>
      <div className="w-full max-w-md py-4">
        <div className="mb-6">
          <Brand />
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-panel border border-line bg-white p-5 sm:p-6"
        >
          <h1 className="font-display text-3xl font-semibold text-ink">
            Join {settings.name}
          </h1>
          <p className="mt-2 text-[15px] text-muted">
            A leader approves every account before you can enter.
          </p>

          <div className="mt-6 mb-6">
            <p className="mb-2 text-[15px] font-semibold text-ink">
              Step {step} of {totalSteps}: {titles[step - 1]}
            </p>
            <div aria-hidden="true" className="flex gap-1.5">
              {titles.map((title, index) => (
                <span
                  key={title}
                  className={
                    "h-1.5 flex-1 rounded-full " +
                    (index < step ? "bg-brand" : "bg-line")
                  }
                />
              ))}
            </div>
          </div>

          {step === 1 && (
            <div className="mb-6 space-y-4">
              <TextField
                label="Full name"
                name="fullName"
                value={form.fullName}
                onChange={handleChange}
                error={errors.fullName}
                autoComplete="name"
              />
              <TextField
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                error={errors.email}
                autoComplete="email"
              />
              <TextField
                label="WhatsApp number"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={handleChange}
                error={errors.phone}
                autoComplete="tel"
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                error={errors.password}
                autoComplete="new-password"
              />
            </div>
          )}

          {step === 2 && (
            <div className="mb-6 space-y-4">
              <SelectField
                label="Gender"
                name="gender"
                value={form.gender}
                onChange={handleChange}
                error={errors.gender}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </SelectField>
              <TextField
                label="Date of birth"
                name="dateOfBirth"
                type="date"
                value={form.dateOfBirth}
                onChange={handleChange}
                error={errors.dateOfBirth}
                autoComplete="bday"
              />
              <TextField
                label="Location (city and country)"
                name="location"
                value={form.location}
                onChange={handleChange}
                placeholder="e.g. Lagos, Nigeria"
                error={errors.location}
              />
              <SelectField
                label="Marital status"
                name="maritalStatus"
                value={form.maritalStatus}
                onChange={handleChange}
                error={errors.maritalStatus}
              >
                <option value="">Select one</option>
                <option value="single">Single</option>
                <option value="married">Married</option>
              </SelectField>
              <TextField
                label="Occupation (optional)"
                name="occupation"
                value={form.occupation}
                onChange={handleChange}
              />
            </div>
          )}

          {step === 3 && (
            <div className="mb-6 space-y-4">
              <SelectField
                label="Are you born again?"
                name="bornAgain"
                value={form.bornAgain}
                onChange={handleChange}
                error={errors.bornAgain}
              >
                <option value="">Select one</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </SelectField>
              <SelectField
                label="Have you received the Holy Spirit?"
                name="holySpirit"
                value={form.holySpirit}
                onChange={handleChange}
                error={errors.holySpirit}
              >
                <option value="">Select one</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="not-sure">Not sure</option>
              </SelectField>
              <SelectField
                label="How did you hear about us?"
                name="howHeard"
                value={form.howHeard}
                onChange={handleChange}
                error={errors.howHeard}
              >
                <option value="">Select one</option>
                <option value="friend-or-family">Friend or family</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="social-media">Social media</option>
                <option value="event">Event or gathering</option>
                <option value="other">Other</option>
              </SelectField>
              <TextAreaField
                label={"What are your expectations from " + settings.name + "?"}
                name="expectations"
                value={form.expectations}
                onChange={handleChange}
                rows={3}
              />
              <TextAreaField
                label="Tell us about your walk with God"
                name="walkWithGod"
                value={form.walkWithGod}
                onChange={handleChange}
                rows={3}
              />
            </div>
          )}

          {step === 4 && (
            <div className="mb-6">
              <div className="mb-4 space-y-2 rounded-control border border-line bg-cream p-4 text-[15px] text-ink">
                <p>
                  By joining {settings.name}, you agree that the information you
                  give here is true and that it will be used only to run this
                  community.
                </p>
                <p>
                  Your details are private. The community leaders can see them,
                  and you can see your own, but other members cannot.
                </p>
                <p>
                  Your membership starts after the Admin approves your
                  registration.
                </p>
              </div>

              <CheckboxField
                label="I agree to the terms and conditions"
                checked={termsAccepted}
                onChange={(e) => {
                  setTermsAccepted(e.target.checked);
                  setErrors({});
                }}
                error={errors.terms}
              />
            </div>
          )}

          {submitError && (
            <p
              role="alert"
              className="mb-4 flex items-start gap-2 rounded-control bg-danger-bg px-3 py-2.5 text-[15px] font-semibold text-danger"
            >
              <WarningCircle
                size={20}
                aria-hidden="true"
                className="shrink-0"
              />
              {submitError}
            </p>
          )}

          <div className="flex gap-3">
            {step > 1 && (
              <Button variant="outline" onClick={goBack}>
                Back
              </Button>
            )}

            {step < totalSteps && (
              <Button onClick={goNext} className="flex-1">
                Next
              </Button>
            )}

            {step === totalSteps && (
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? "Creating account..." : "Create account"}
              </Button>
            )}
          </div>

          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-1.5 text-[15px] text-muted">
            Already registered?
            <Link
              to="/login"
              className="inline-flex min-h-11 items-center font-semibold text-brand hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </AuthBackground>
  );
}

export default Register;
