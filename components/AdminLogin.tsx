"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Logo from "@/components/Logo";

const ADMIN_EMAIL = "parthiban.s@rapzterdigital.com";

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export default function AdminLogin() {
  const [mode, setMode] = useState<"sign-in" | "forgot" | "sent">("sign-in");
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setError(data.error || "Could not sign in.");
        return;
      }
      if (data.mustReset) {
        setMode("sent");
        return;
      }
      window.location.assign("/");
    } catch {
      setError("Could not reach the desk. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onForgot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setError(data.error || "Could not send the reset email.");
        return;
      }
      setMode("sent");
    } catch {
      setError("Could not reach the desk. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shell narrow">
      <header className="topbar">
        <Logo />
      </header>
      <main id="main" className="auth-wrap">
        <form className="card form-stack auth-card" onSubmit={mode === "forgot" ? onForgot : onSignIn} noValidate>
          <div>
            <p className="kicker">Review desk</p>
            <h1 className="title">{mode === "forgot" ? "Forgot password" : "Admin sign in"}</h1>
            <p className="lede">
              {mode === "sent"
                ? `A reset link is on its way to ${email}. It expires in 30 minutes. The first sign-in with the temporary password only sends this email.`
                : mode === "forgot"
                  ? "Enter the admin email and we will send a link to choose a new password."
                  : "Clients do not sign in. This gate is only for the review desk."}
            </p>
          </div>
          {mode === "sent" ? null : (
            <>
              <div className="field">
                <label className="field-label" htmlFor="admin-email">
                  Email address
                </label>
                <input
                  id="admin-email"
                  className="control"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
              {mode === "sign-in" ? (
                <div className="field">
                  <label className="field-label" htmlFor="admin-password">
                    Password
                  </label>
                  <input
                    id="admin-password"
                    className="control"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
              ) : null}
              {error ? <p className="field-error">{error}</p> : null}
              <button className="btn primary block" type="submit" disabled={busy}>
                {busy ? "Please wait…" : mode === "forgot" ? "Send reset link" : "Sign in"}
              </button>
            </>
          )}
          {mode === "sent" ? (
            <button className="btn ghost" type="button" onClick={() => { setMode("sign-in"); setError(""); }}>
              Back to sign in
            </button>
          ) : (
            <button
              className="text-btn"
              type="button"
              onClick={() => {
                setMode(mode === "forgot" ? "sign-in" : "forgot");
                setError("");
              }}
            >
              {mode === "forgot" ? "Back to sign in" : "Forgot password"}
            </button>
          )}
        </form>
      </main>
    </div>
  );
}
