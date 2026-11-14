"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { SelectField, TextField } from "@/components/Fields";
import Logo from "@/components/Logo";
import Stars from "@/components/Stars";
import { formatWhen, formatWhenIst, localDateKey, starGlyphs, testimonialText } from "@/lib/format";
import { reminderWait } from "@/lib/reminders";
import { isPrivateUrl, mailtoHref, reviewUrl, whatsappHref } from "@/lib/share";
import type { EmailStatus, ReviewLink } from "@/lib/types";
import { EMAIL, LIMITS, SERVICES, validateInvite, type InviteErrors } from "@/lib/validators";

type Tab = "create" | "links" | "responses";

const EMPTY_INVITE = { pocName: "", brandName: "", service: "", email: "" };
const PAGE_SIZE = 8;

async function readJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function sessionExpired(response: Response) {
  if (response.status !== 401) return false;
  window.location.assign("/");
  return true;
}

function mailLine(status: EmailStatus) {
  if (status.client === "failed" || status.internal === "failed") {
    return { tone: "bad" as const, text: `Saved. Email did not send.${status.detail ? ` ${status.detail}` : ""}` };
  }
  if (status.client === "sent" && status.internal === "sent") {
    return { tone: "ok" as const, text: "Confirmation sent to the client and the team list." };
  }
  if (status.client === "sent") {
    return { tone: "ok" as const, text: "Confirmation sent to the client. Add team recipients to notify them too." };
  }
  return { tone: "warn" as const, text: "Saved in the desk. Connect Microsoft Graph to send it out." };
}

export default function AdminDesk({ email }: { email: string }) {
  const [tab, setTab] = useState<Tab>("create");
  const [links, setLinks] = useState<ReviewLink[]>([]);
  const [notifyEmails, setNotifyEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [mailConfigured, setMailConfigured] = useState(false);
  const [storage, setStorage] = useState<"local" | "postgres">("local");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [invite, setInvite] = useState(EMPTY_INVITE);
  const [inviteErrors, setInviteErrors] = useState<InviteErrors>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [openToken, setOpenToken] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");
  const [confirmToken, setConfirmToken] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (initial = false) => {
    if (initial) setLoading(true);
    else setRefreshing(true);
    setLoadError("");
    try {
      const response = await fetch("/api/links", { cache: "no-store" });
      const data = await readJson(response);
      if (sessionExpired(response)) return;
      if (!response.ok) throw new Error(data.error || "Could not open the desk.");
      setLinks(data.links ?? []);
      setNotifyEmails(data.notifyEmails ?? []);
      setCcEmails(data.ccEmails ?? []);
      setMailConfigured(Boolean(data.mailConfigured));
      setStorage(data.storage === "postgres" ? "postgres" : "local");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not open the desk.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setCopied(null), copied ? 1600 : 0);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    void load(true);
  }, [load]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  async function copyText(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
    } catch {
      setFormError("Select the link and copy it manually.");
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const checked = validateInvite(invite);
    if (!checked.ok) {
      setInviteErrors(checked.errors);
      setFormError("");
      const first = (["pocName", "brandName", "service", "email"] as const).find((key) => checked.errors[key]);
      if (first) document.getElementById(first)?.focus();
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.value),
      });
      const data = await readJson(response);
      if (sessionExpired(response)) return;
      if (!response.ok) {
        setFormError(data.error || "Could not create the link.");
        if (data.errors) setInviteErrors(data.errors);
        return;
      }
      const link = data.link as ReviewLink;
      setLinks((current) => [link, ...current.filter((item) => item.token !== link.token)]);
      setFreshToken(link.token);
      setInvite(EMPTY_INVITE);
      setInviteErrors({});
    } catch {
      setFormError("Could not reach the desk. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveRecipients(list: string[]) {
    setSettingsMsg("");
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notifyEmails: list }),
    });
    const data = await readJson(response);
    if (sessionExpired(response)) return;
    if (!response.ok) {
      setSettingsMsg(data.error || "Could not save recipients.");
      return;
    }
    setNotifyEmails(data.notifyEmails ?? list);
    setSettingsMsg("Recipients saved.");
  }

  async function addRecipient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = recipient.trim().toLowerCase();
    if (!EMAIL.test(email)) {
      setSettingsMsg("Enter a valid email address.");
      return;
    }
    if (notifyEmails.includes(email)) {
      setSettingsMsg("That address is already on the list.");
      return;
    }
    await saveRecipients([...notifyEmails, email]);
    setRecipient("");
  }

  async function withdraw(token: string) {
    setBusy(`delete:${token}`);
    try {
      const response = await fetch(`/api/links/${token}`, { method: "DELETE" });
      const data = await readJson(response);
      if (sessionExpired(response)) return;
      if (!response.ok) {
        setFormError(data.error || "Could not withdraw the link.");
        return;
      }
      setLinks((current) => current.filter((item) => item.token !== token));
      if (freshToken === token) setFreshToken(null);
      if (openToken === token) setOpenToken(null);
      setConfirmToken(null);
    } catch {
      setFormError("Could not withdraw the link.");
    } finally {
      setBusy(null);
    }
  }

  async function resend(token: string) {
    setBusy(`send:${token}`);
    try {
      const response = await fetch(`/api/links/${token}/resend`, { method: "POST" });
      const data = await readJson(response);
      if (sessionExpired(response)) return;
      if (!response.ok) {
        setFormError(data.error || "Could not resend email.");
        return;
      }
      const link = data.link as ReviewLink;
      setLinks((current) => current.map((item) => (item.token === link.token ? link : item)));
    } catch {
      setFormError("Could not resend email.");
    } finally {
      setBusy(null);
    }
  }

  async function remind(token: string) {
    setBusy(`remind:${token}`);
    setFormError("");
    try {
      const response = await fetch(`/api/links/${token}/remind`, { method: "POST" });
      const data = await readJson(response);
      if (sessionExpired(response)) return;
      if (data.link) {
        const link = data.link as ReviewLink;
        setLinks((current) => current.map((item) => (item.token === link.token ? link : item)));
      }
      if (!response.ok) setFormError(data.error || "Could not send the reminder.");
    } catch {
      setFormError("Could not send the reminder.");
    } finally {
      setBusy(null);
    }
  }

  const received = links.filter((link) => link.status === "submitted");
  const awaiting = links.length - received.length;
  const fresh = links.find((link) => link.token === freshToken);
  const freshUrl = fresh ? reviewUrl(fresh.token) : "";
  const brands = [...new Set(received.map((link) => link.brandName))].sort((a, b) => a.localeCompare(b));
  const activeBrand = brands.includes(brandFilter) ? brandFilter : "all";
  const filtered = received
    .filter((link) => {
      if (!link.response) return false;
      if (activeBrand !== "all" && link.brandName !== activeBrand) return false;
      const day = localDateKey(link.response.submittedAt);
      if (fromDate && day < fromDate) return false;
      if (toDate && day > toDate) return false;
      return true;
    })
    .sort((a, b) => (b.response?.submittedAt ?? "").localeCompare(a.response?.submittedAt ?? ""));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const opened = filtered.find((link) => link.token === openToken) ?? null;

  return (
    <div className="shell">
      <header className="topbar">
        <Logo />
        <div className="top-actions">
          <div className="tabs" role="tablist" aria-label="Review desk">
            <button
              className={tab === "create" ? "tab active" : "tab"}
              type="button"
              role="tab"
              aria-selected={tab === "create"}
              onClick={() => {
                setTab("create");
                setFormError("");
              }}
            >
              Create link
            </button>
            <button
              className={tab === "links" ? "tab active" : "tab"}
              type="button"
              role="tab"
              aria-selected={tab === "links"}
              onClick={() => {
                setTab("links");
                setFormError("");
              }}
            >
              Created links
              <span className="tab-count">{links.length}</span>
            </button>
            <button
              className={tab === "responses" ? "tab active" : "tab"}
              type="button"
              role="tab"
              aria-selected={tab === "responses"}
              onClick={() => {
                setTab("responses");
                setFormError("");
              }}
            >
              Responses
              <span className="tab-count">{received.length}</span>
            </button>
          </div>
          <span className="who">{email}</span>
          <button className="btn small ghost" type="button" onClick={() => void load(false)} disabled={loading || refreshing}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          <button className="btn small ghost" type="button" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <main id="main">
        {loading ? <p className="lede">Opening the desk…</p> : null}
        {loadError ? (
          <p className="alert">
            {loadError}{" "}
            <button className="btn small ghost" type="button" onClick={() => void load(true)}>
              Try again
            </button>
          </p>
        ) : null}
        {!loading && !loadError ? (
          <>
            <section className="stats" aria-label="Desk summary">
              <article className="stat">
                <b>{links.length}</b>
                <span>Links</span>
              </article>
              <article className="stat">
                <b>{awaiting}</b>
                <span>Awaiting</span>
              </article>
              <article className="stat accent">
                <b>{received.length}</b>
                <span>Received</span>
              </article>
            </section>
            {tab === "create" ? (
              <div className="desk-grid">
                <form className="card form-stack" onSubmit={onCreate} noValidate>
                  <div>
                    <p className="kicker">New link</p>
                    <h1 className="title">Invite a review</h1>
                    <p className="lede">
                      Fill what you already know. Your client completes designation, review, and feedback. No sign-in.
                    </p>
                  </div>
                  {fresh ? (
                    <div className="banner">
                      <strong>Link ready for {fresh.brandName}</strong>
                      <input
                        className="control url-field"
                        readOnly
                        value={freshUrl}
                        aria-label="Review link"
                        onFocus={(event) => event.currentTarget.select()}
                      />
                      {isPrivateUrl(freshUrl) ? (
                        <p className="warn-note">
                          This address only opens on this network. To send it on WhatsApp or email outside the office, host the desk on a public web address and create the link there.
                        </p>
                      ) : null}
                      <div className="actions">
                        <button className="btn small primary" type="button" onClick={() => void copyText(fresh.token, freshUrl)}>
                          {copied === fresh.token ? "Copied" : "Copy link"}
                        </button>
                        <a className="btn small ghost" href={whatsappHref(freshUrl, fresh)} target="_blank" rel="noreferrer">
                          WhatsApp
                        </a>
                        <a className="btn small ghost" href={mailtoHref(freshUrl, fresh)}>
                          Email link
                        </a>
                        <a className="btn small ghost" href={`/r/${fresh.token}`} target="_blank" rel="noreferrer">
                          Preview
                        </a>
                      </div>
                    </div>
                  ) : null}
                  <TextField
                    id="pocName"
                    label="Point of contact"
                    value={invite.pocName}
                    maxLength={LIMITS.pocName}
                    autoComplete="name"
                    placeholder="Ananya Shah"
                    error={inviteErrors.pocName}
                    onChange={(pocName) => {
                      setInvite((current) => ({ ...current, pocName }));
                      setInviteErrors((current) => ({ ...current, pocName: undefined }));
                    }}
                  />
                  <TextField
                    id="brandName"
                    label="Brand name"
                    value={invite.brandName}
                    maxLength={LIMITS.brandName}
                    autoComplete="organization"
                    placeholder="Northwind Foods"
                    error={inviteErrors.brandName}
                    onChange={(brandName) => {
                      setInvite((current) => ({ ...current, brandName }));
                      setInviteErrors((current) => ({ ...current, brandName: undefined }));
                    }}
                  />
                  <SelectField
                    id="service"
                    label="Service provided"
                    value={invite.service}
                    placeholder="Select a service"
                    options={SERVICES}
                    error={inviteErrors.service}
                    onChange={(service) => {
                      setInvite((current) => ({ ...current, service }));
                      setInviteErrors((current) => ({ ...current, service: undefined }));
                    }}
                  />
                  <TextField
                    id="email"
                    label="Email address"
                    type="email"
                    value={invite.email}
                    maxLength={LIMITS.email}
                    autoComplete="email"
                    placeholder="ananya@brand.com"
                    hint="The confirmation email goes here after they submit."
                    error={inviteErrors.email}
                    onChange={(email) => {
                      setInvite((current) => ({ ...current, email }));
                      setInviteErrors((current) => ({ ...current, email: undefined }));
                    }}
                  />
                  {formError ? <p className="alert">{formError}</p> : null}
                  <button className="btn primary" type="submit" disabled={saving}>
                    {saving ? "Generating…" : "Generate link"}
                  </button>
                </form>
                <div className="stack">
                  <DeliveryCard
                    mailConfigured={mailConfigured}
                    storage={storage}
                    ccEmails={ccEmails}
                    notifyEmails={notifyEmails}
                    recipient={recipient}
                    settingsMsg={settingsMsg}
                    onRecipient={setRecipient}
                    onAdd={addRecipient}
                    onRemove={(email) => void saveRecipients(notifyEmails.filter((item) => item !== email))}
                  />
                  <PendingSlideshow
                    links={links}
                    freshToken={freshToken}
                    copied={copied}
                    confirmToken={confirmToken}
                    busy={busy}
                    onCopy={(id, text) => void copyText(id, text)}
                    onConfirm={setConfirmToken}
                    onWithdraw={(token) => void withdraw(token)}
                  />
                </div>
              </div>
            ) : null}
            {tab === "links" ? (
              <CreatedLinks
                links={links}
                copied={copied}
                confirmToken={confirmToken}
                busy={busy}
                mailConfigured={mailConfigured}
                formError={formError}
                onCopy={(id, text) => void copyText(id, text)}
                onRemind={(token) => void remind(token)}
                onConfirm={setConfirmToken}
                onWithdraw={(token) => void withdraw(token)}
              />
            ) : null}
            {tab === "responses" ? (
              <section className="stack">
                <div>
                  <p className="kicker">Record</p>
                  <h1 className="title">Submitted reviews</h1>
                  <p className="lede">Every response that comes back through a link, with the details you prepared.</p>
                </div>
                <div className="filters">
                  <label className="field">
                    <span className="field-label">Brand name</span>
                    <select
                      className="control"
                      value={activeBrand}
                      aria-label="Filter by brand name"
                      onChange={(event) => {
                        setBrandFilter(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">All brands</option>
                      {brands.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">From</span>
                    <input
                      className="control"
                      type="date"
                      value={fromDate}
                      aria-label="From date"
                      onChange={(event) => {
                        setFromDate(event.target.value);
                        setPage(1);
                      }}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">To</span>
                    <input
                      className="control"
                      type="date"
                      value={toDate}
                      aria-label="To date"
                      onChange={(event) => {
                        setToDate(event.target.value);
                        setPage(1);
                      }}
                    />
                  </label>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => {
                      setBrandFilter("all");
                      setFromDate("");
                      setToDate("");
                      setPage(1);
                    }}
                  >
                    Clear
                  </button>
                </div>
                {formError ? <p className="alert">{formError}</p> : null}
                {filtered.length === 0 ? (
                  <p className="empty">
                    {received.length === 0
                      ? `Nothing submitted yet.${awaiting ? ` ${awaiting} link${awaiting === 1 ? "" : "s"} still waiting.` : ""}`
                      : "No review matches those filters."}
                  </p>
                ) : (
                  <>
                    <div className="table-wrap">
                      <table className="responses">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Brand</th>
                            <th>Contact</th>
                            <th>Service</th>
                            <th>Rating</th>
                            <th>Review</th>
                            <th>Feedback</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visible.map((link) => {
                            const response = link.response!;
                            return (
                              <tr key={link.token}>
                                <td>
                                  <time dateTime={response.submittedAt}>{formatWhen(response.submittedAt)}</time>
                                </td>
                                <td>{link.brandName}</td>
                                <td>
                                  {link.pocName}
                                  <br />
                                  <span className="hint">{response.designation}</span>
                                </td>
                                <td>{link.service}</td>
                                <td>{starGlyphs(response.rating)}</td>
                                <td className="clip">{response.review}</td>
                                <td className="clip">{response.feedback}</td>
                                <td>
                                  <div className="actions">
                                    <button className="btn small ghost" type="button" onClick={() => setOpenToken(openToken === link.token ? null : link.token)}>
                                      {openToken === link.token ? "Hide" : "Open"}
                                    </button>
                                    <button className="btn small ghost" type="button" onClick={() => void copyText(`quote-${link.token}`, testimonialText(link))}>
                                      {copied === `quote-${link.token}` ? "Copied" : "Copy"}
                                    </button>
                                    {confirmToken === link.token ? (
                                      <button className="btn small danger" type="button" disabled={busy === `delete:${link.token}`} onClick={() => void withdraw(link.token)}>
                                        Confirm delete
                                      </button>
                                    ) : (
                                      <button className="btn small ghost" type="button" onClick={() => setConfirmToken(link.token)}>
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="pager">
                      <p className="hint">
                        {filtered.length} review{filtered.length === 1 ? "" : "s"} · page {currentPage} of {pageCount}
                      </p>
                      <div className="actions">
                        <button className="btn small ghost" type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                          Previous
                        </button>
                        <button className="btn small ghost" type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>
                          Next
                        </button>
                      </div>
                    </div>
                    {opened?.response ? (
                      <article className="card detail">
                        <div className="card-top">
                          <div>
                            <h2 className="h3">{opened.brandName}</h2>
                            <p className="hint">{opened.service}</p>
                          </div>
                          <Stars value={opened.response.rating} readOnly />
                        </div>
                        <blockquote className="quote">{opened.response.review}</blockquote>
                        <div className="feedback-block">
                          <b>Feedback</b>
                          {opened.response.feedback}
                        </div>
                        <p className="meta">
                          <span>
                            {opened.pocName} · {opened.response.designation}
                          </span>
                          <a href={`mailto:${opened.email}`}>{opened.email}</a>
                          <time dateTime={opened.response.submittedAt}>{formatWhen(opened.response.submittedAt)}</time>
                        </p>
                        <p className={`status ${mailLine(opened.response.emailStatus).tone}`}>{mailLine(opened.response.emailStatus).text}</p>
                        <div className="actions">
                          <button className="btn small ghost" type="button" disabled={!mailConfigured || busy === `send:${opened.token}`} onClick={() => void resend(opened.token)}>
                            {busy === `send:${opened.token}` ? "Sending…" : "Resend emails"}
                          </button>
                        </div>
                      </article>
                    ) : null}
                  </>
                )}
              </section>
            ) : null}
          </>
        ) : null}
      </main>
      <footer className="footer">Rapzter Digital · Enabling Business</footer>
    </div>
  );
}

function DeliveryCard({
  mailConfigured,
  storage,
  ccEmails,
  notifyEmails,
  recipient,
  settingsMsg,
  onRecipient,
  onAdd,
  onRemove,
}: {
  mailConfigured: boolean;
  storage: "local" | "postgres";
  ccEmails: string[];
  notifyEmails: string[];
  recipient: string;
  settingsMsg: string;
  onRecipient: (value: string) => void;
  onAdd: (event: FormEvent<HTMLFormElement>) => void;
  onRemove: (email: string) => void;
}) {
  const extras = notifyEmails.filter((email) => !ccEmails.includes(email));
  return (
    <section className="card stack">
      <div>
        <p className="kicker">Email delivery</p>
        <h2 className="h3">{mailConfigured ? "Microsoft Graph is connected" : "Connect Microsoft Graph"}</h2>
        <p className="hint">
          {mailConfigured
            ? "On submit, the client gets a confirmation and EMAIL_CC plus the addresses below get the full review."
            : "Reviews still save here. Add the Azure mail variables to .env.local, then restart."}
        </p>
        <p className="hint">
          {storage === "postgres"
            ? "Records are stored in the Postgres database from DATABASE_URL. Invites, submitted reviews, and the team notification list all live in that one database."
            : "Records are stored in a local SQLite file. Set DATABASE_URL to a Postgres connection string to keep them in Postgres."}
        </p>
      </div>
      {ccEmails.length === 0 && extras.length === 0 ? <p className="empty">No team inboxes yet.</p> : null}
      {ccEmails.length > 0 || extras.length > 0 ? (
        <div className="chips">
          {ccEmails.map((email) => (
            <span key={email} className="chip">
              {email}
            </span>
          ))}
          {extras.map((email) => (
            <span key={email} className="chip">
              {email}
              <button type="button" aria-label={`Remove ${email}`} onClick={() => onRemove(email)}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <form className="inline-add" onSubmit={onAdd}>
        <input
          className="control"
          type="email"
          value={recipient}
          placeholder="team@rapzter.com"
          aria-label="Team email address"
          onChange={(event) => onRecipient(event.target.value)}
        />
        <button className="btn ghost" type="submit">
          Add
        </button>
      </form>
      {settingsMsg ? <p className={settingsMsg === "Recipients saved." ? "note good" : "field-error"}>{settingsMsg}</p> : null}
      {mailConfigured ? null : (
        <details className="setup">
          <summary>How to connect email</summary>
          <p className="hint">
            Put these in .env.local. The Azure app needs application permission Mail.Send, with admin consent. GRAPH_SENDER_EMAIL is the mailbox that sends.
          </p>
          <pre className="codeblock">{`EMAIL_TRANSPORT=graph
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
GRAPH_SENDER_EMAIL=reviews@yourdomain.com
EMAIL_CC=team@yourdomain.com`}</pre>
        </details>
      )}
    </section>
  );
}

function PendingSlideshow({
  links,
  freshToken,
  copied,
  confirmToken,
  busy,
  onCopy,
  onConfirm,
  onWithdraw,
}: {
  links: ReviewLink[];
  freshToken: string | null;
  copied: string | null;
  confirmToken: string | null;
  busy: string | null;
  onCopy: (id: string, text: string) => void;
  onConfirm: (token: string | null) => void;
  onWithdraw: (token: string) => void;
}) {
  const pending = links.filter((link) => link.status === "pending");
  const slides = pending.slice(0, 3);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const newest = slides[0]?.token ?? "";
  const safeIndex = slides.length === 0 ? 0 : index % slides.length;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [newest]);

  useEffect(() => {
    if (slides.length < 2 || paused || reduceMotion) return;
    const id = window.setTimeout(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 5000);
    return () => window.clearTimeout(id);
  }, [slides.length, paused, reduceMotion, safeIndex]);

  const current = slides[safeIndex];

  return (
    <section className="card stack" aria-roledescription="carousel" aria-label="Latest pending links" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="card-top">
        <h2 className="h3">Latest pending</h2>
        <span className="hint">{pending.length}</span>
      </div>
      {pending.length > slides.length ? <p className="hint">Showing the 3 latest. Every link is under Created links.</p> : null}
      {!current ? <p className="empty">Pending links will show here, three at a time.</p> : null}
      {current ? (
        <article key={current.token} className={current.token === freshToken ? "link-card fresh slide-card" : "link-card slide-card"}>
          <div className="card-top">
            <h3 className="h3">{current.brandName}</h3>
            <span className="pill wait">Pending</span>
          </div>
          <p className="hint">
            {current.pocName} · {current.email}
          </p>
          <p className="hint">{current.service}</p>
          <p className="meta">
            <time dateTime={current.createdAt}>{formatWhen(current.createdAt)}</time>
          </p>
          <div className="actions">
            <button className="btn small ghost" type="button" onClick={() => onCopy(current.token, reviewUrl(current.token))}>
              {copied === current.token ? "Copied" : "Copy link"}
            </button>
            <a className="btn small ghost" href={whatsappHref(reviewUrl(current.token), current)} target="_blank" rel="noreferrer">
              WhatsApp
            </a>
            <a className="btn small ghost" href={mailtoHref(reviewUrl(current.token), current)}>
              Email link
            </a>
            <a className="btn small ghost" href={`/r/${current.token}`} target="_blank" rel="noreferrer">
              Preview
            </a>
            {confirmToken === current.token ? (
              <div className="confirm">
                <span>Delete this record?</span>
                <button className="btn small danger" type="button" disabled={busy === `delete:${current.token}`} onClick={() => onWithdraw(current.token)}>
                  Delete
                </button>
                <button className="btn small ghost" type="button" onClick={() => onConfirm(null)}>
                  Keep
                </button>
              </div>
            ) : (
              <button className="btn small ghost" type="button" onClick={() => onConfirm(current.token)}>
                Delete
              </button>
            )}
          </div>
        </article>
      ) : null}
      {slides.length > 1 ? (
        <div className="slide-nav">
          <button className="btn small ghost" type="button" onClick={() => setIndex((safeIndex - 1 + slides.length) % slides.length)}>
            Previous
          </button>
          <div className="dots" role="tablist" aria-label="Pending links">
            {slides.map((link, dot) => (
              <button
                key={link.token}
                className={dot === safeIndex ? "dot active" : "dot"}
                type="button"
                role="tab"
                aria-label={`${link.brandName}, ${dot + 1} of ${slides.length}`}
                aria-selected={dot === safeIndex}
                onClick={() => setIndex(dot)}
              />
            ))}
          </div>
          <button className="btn small ghost" type="button" onClick={() => setIndex((safeIndex + 1) % slides.length)}>
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}

function CreatedLinks({
  links,
  copied,
  confirmToken,
  busy,
  mailConfigured,
  formError,
  onCopy,
  onRemind,
  onConfirm,
  onWithdraw,
}: {
  links: ReviewLink[];
  copied: string | null;
  confirmToken: string | null;
  busy: string | null;
  mailConfigured: boolean;
  formError: string;
  onCopy: (id: string, text: string) => void;
  onRemind: (token: string) => void;
  onConfirm: (token: string | null) => void;
  onWithdraw: (token: string) => void;
}) {
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(() => Date.now());
  const ordered = [...links].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pageCount = Math.max(1, Math.ceil(ordered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = ordered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="stack">
      <div>
        <p className="kicker">Links</p>
        <h1 className="title">Created links</h1>
        <p className="lede">Every review link from this desk, with a reminder when the client has not submitted yet.</p>
      </div>
      {formError ? <p className="alert">{formError}</p> : null}
      {ordered.length === 0 ? <p className="empty">Generated links will collect here.</p> : null}
      {ordered.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="responses links">
              <thead>
                <tr>
                  <th>Brand name</th>
                  <th>Point of contact</th>
                  <th>Service provided</th>
                  <th>Email address</th>
                  <th>Link</th>
                  <th>Status</th>
                  <th>Send reminder</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((link) => {
                  const url = reviewUrl(link.token);
                  const submitted = link.status === "submitted";
                  const cooling = Boolean(reminderWait(link.lastReminderAt, now));
                  const sending = busy === `remind:${link.token}`;
                  return (
                    <tr key={link.token}>
                      <td>{link.brandName}</td>
                      <td>{link.pocName}</td>
                      <td>{link.service}</td>
                      <td>{link.email}</td>
                      <td>
                        <span className="link-url" title={url}>
                          {url}
                        </span>
                        <div className="actions">
                          <button className="btn small ghost" type="button" onClick={() => onCopy(`link-${link.token}`, url)}>
                            {copied === `link-${link.token}` ? "Copied" : "Copy"}
                          </button>
                          {confirmToken === link.token ? (
                            <>
                              <button className="btn small danger" type="button" disabled={busy === `delete:${link.token}`} onClick={() => onWithdraw(link.token)}>
                                Delete
                              </button>
                              <button className="btn small ghost" type="button" onClick={() => onConfirm(null)}>
                                Keep
                              </button>
                            </>
                          ) : (
                            <button className="btn small ghost" type="button" onClick={() => onConfirm(link.token)}>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={submitted ? "pill done" : "pill wait"}>{submitted ? "Submitted" : "Pending"}</span>
                      </td>
                      <td>
                        <div className="reminder">
                          <button
                            className="btn small primary"
                            type="button"
                            disabled={submitted || cooling || !mailConfigured || sending}
                            onClick={() => onRemind(link.token)}
                          >
                            {sending ? "Sending…" : "Send email"}
                          </button>
                          {link.lastReminderAt ? (
                            <p className="reminder-note">
                              Last reminder sent on <time dateTime={link.lastReminderAt}>{formatWhenIst(link.lastReminderAt)}</time>
                            </p>
                          ) : null}
                          {submitted ? <p className="reminder-note">Review submitted</p> : null}
                          {!submitted && !mailConfigured ? <p className="reminder-note">Connect Microsoft Graph to send this.</p> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <p className="hint">
              {ordered.length} link{ordered.length === 1 ? "" : "s"} · page {currentPage} of {pageCount}
            </p>
            <div className="actions">
              <button className="btn small ghost" type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                Previous
              </button>
              <button className="btn small ghost" type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>
                Next
              </button>
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
