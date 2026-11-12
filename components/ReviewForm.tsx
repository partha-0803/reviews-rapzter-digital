"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { AreaField, TextField } from "@/components/Fields";
import Logo from "@/components/Logo";
import Stars from "@/components/Stars";
import { formatWhen } from "@/lib/format";
import type { ReviewLink } from "@/lib/types";
import { LIMITS, validateResponse, type ResponseErrors } from "@/lib/validators";

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function receiptCopy(link: ReviewLink) {
  const status = link.response?.emailStatus;
  if (status?.client === "sent") return `A confirmation is on its way to ${link.email}.`;
  if (status?.client === "failed") {
    return `Your review is saved. The confirmation to ${link.email} could not be sent just now, and the team still has your note.`;
  }
  return `Your review is saved with the Rapzter Digital team.`;
}

export default function ReviewForm({ initial }: { initial: ReviewLink }) {
  const [link, setLink] = useState(initial);
  const [form, setForm] = useState({ designation: "", rating: 0, review: "", feedback: "" });
  const [noFeedback, setNoFeedback] = useState(false);
  const [errors, setErrors] = useState<ResponseErrors>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  if (link.status === "submitted" && link.response) {
    const response = link.response;
    return (
      <div className="shell narrow">
        <header className="topbar">
          <Logo />
        </header>
        <main id="main" className="stack">
          <div>
            <p className="kicker">Received</p>
            <h1 className="title">Thank you, {link.pocName}.</h1>
            <p className="lede">{receiptCopy(link)} This link is now closed.</p>
          </div>
          <section className="card receipt">
            <p className="kicker">{link.brandName}</p>
            <div className="rating-row">
              <Stars value={response.rating} readOnly />
            </div>
            <blockquote className="quote">{response.review}</blockquote>
            <div className="feedback-block">
              <b>Feedback</b>
              {response.feedback}
            </div>
            <p className="meta">
              <span>{response.designation}</span>
              <time dateTime={response.submittedAt} suppressHydrationWarning>
                {formatWhen(response.submittedAt)}
              </time>
            </p>
          </section>
        </main>
        <footer className="footer">Rapzter Digital · Enabling Business</footer>
      </div>
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateResponse({ ...form, noFeedback });
    if (!checked.ok) {
      setErrors(checked.errors);
      setFormError("");
      const order = ["designation", "rating", "review", "feedback"] as const;
      const first = order.find((key) => checked.errors[key]);
      if (first) document.getElementById(first)?.focus();
      return;
    }
    setPending(true);
    setFormError("");
    try {
      const response = await fetch(`/api/links/${link.token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...checked.value, noFeedback }),
      });
      const data = await readJson(response);
      if (!response.ok) {
        if (data.link) setLink(data.link as ReviewLink);
        else setFormError(data.error || "Could not submit the review.");
        if (data.errors) setErrors(data.errors as ResponseErrors);
        return;
      }
      setLink(data.link as ReviewLink);
    } catch {
      setFormError("Could not reach the desk. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  const ready =
    form.designation.trim().length >= 2 &&
    form.rating >= 1 &&
    form.review.trim().length >= 10 &&
    (noFeedback || form.feedback.trim().length >= 8);

  return (
    <div className="shell narrow">
      <header className="topbar">
        <Logo />
      </header>
      <main id="main" className="stack">
        <div>
          <p className="kicker">Prepared review</p>
          <h1 className="title">{link.brandName}</h1>
          <p className="lede">
            Hi {link.pocName}. This takes about two minutes. The details below were prepared for you and stay locked.
          </p>
        </div>
        <form className="card form-stack" onSubmit={onSubmit} noValidate>
          <p className="section-label">Locked in</p>
          <div className="locked-grid">
            <div className="locked">
              <span>Point of contact <em>Locked</em></span>
              <strong>{link.pocName}</strong>
            </div>
            <div className="locked">
              <span>Brand <em>Locked</em></span>
              <strong>{link.brandName}</strong>
            </div>
            <div className="locked">
              <span>Service <em>Locked</em></span>
              <strong>{link.service}</strong>
            </div>
            <div className="locked">
              <span>Email <em>Locked</em></span>
              <strong>{link.email}</strong>
            </div>
          </div>
          <p className="hint">Your confirmation is sent to this email address.</p>

          <p className="section-label">Your response</p>
          <TextField
            id="designation"
            label="Designation"
            required
            value={form.designation}
            maxLength={LIMITS.designation}
            autoComplete="organization-title"
            placeholder="Marketing Head"
            error={errors.designation}
            onChange={(designation) => {
              setForm((current) => ({ ...current, designation }));
              setErrors((current) => ({ ...current, designation: undefined }));
            }}
          />
          <div className="field">
            <span className="field-label" id="rating-label">
              Review
              <span className="req">Required</span>
            </span>
            <Stars
              value={form.rating}
              labelledBy="rating-label"
              onChange={(rating) => {
                setForm((current) => ({ ...current, rating }));
                setErrors((current) => ({ ...current, rating: undefined }));
              }}
            />
            {errors.rating ? <p className="field-error">{errors.rating}</p> : null}
          </div>
          <AreaField
            id="review"
            label="Written review"
            required
            value={form.review}
            rows={5}
            maxLength={LIMITS.review}
            placeholder="What stood out about working with us?"
            hint="This can be shared as a testimonial."
            error={errors.review}
            onChange={(review) => {
              setForm((current) => ({ ...current, review }));
              setErrors((current) => ({ ...current, review: undefined }));
            }}
          />
          <AreaField
            id="feedback"
            label="Feedback"
            required={!noFeedback}
            value={form.feedback}
            rows={4}
            maxLength={LIMITS.feedback}
            placeholder="Anything we should keep doing, or do differently?"
            hint={noFeedback ? "Marked as no feedback yet." : "Private notes for the Rapzter Digital team."}
            error={errors.feedback}
            disabled={noFeedback}
            onChange={(feedback) => {
              setForm((current) => ({ ...current, feedback }));
              setErrors((current) => ({ ...current, feedback: undefined }));
            }}
          />
          <label className="check">
            <input
              type="checkbox"
              checked={noFeedback}
              onChange={(event) => {
                const checked = event.target.checked;
                setNoFeedback(checked);
                if (checked) {
                  setForm((current) => ({ ...current, feedback: "" }));
                  setErrors((current) => ({ ...current, feedback: undefined }));
                }
              }}
            />
            <span>Click here if you have no feedback for us, yet</span>
          </label>
          {formError ? <p className="alert">{formError}</p> : null}
          <button className="btn primary block" type="submit" disabled={pending || !ready}>
            {pending ? "Submitting…" : "Submit review"}
          </button>
          <p className="hint center">
            {ready ? "Designation, review, and feedback are ready to send." : "Complete the required fields to submit."}
          </p>
        </form>
      </main>
      <footer className="footer">Rapzter Digital · Enabling Business</footer>
    </div>
  );
}
