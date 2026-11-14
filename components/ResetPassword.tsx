"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Logo from "@/components/Logo";

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export default function ResetPassword({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(token ? "" : "This reset link is missing.");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Those passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        setError(data.error || "Could not save the password.");
        return;
      }
      window.location.assign("/");
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
        <form className="card form-stack auth-card" onSubmit={onSubmit}>
          <div>
            <p className="kicker">Review desk</p>
            <h1 className="title">Choose a new password</h1>
            <p className="lede">Use 10 to 72 characters, with a letter and a number. This replaces the temporary password.</p>
          </div>
          <div className="field">
            <label className="field-label" htmlFor="new-password">
              New password
            </label>
            <input
              id="new-password"
              className="control"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="confirm-password">
              Confirm password
            </label>
            <input
              id="confirm-password"
              className="control"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </div>
          {error ? <p className="field-error">{error}</p> : null}
          <button className="btn primary block" type="submit" disabled={busy || !token}>
            {busy ? "Saving…" : "Save password"}
          </button>
        </form>
      </main>
    </div>
  );
}
