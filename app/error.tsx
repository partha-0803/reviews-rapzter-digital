"use client";

import Logo from "@/components/Logo";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="shell narrow">
      <header className="topbar">
        <Logo />
      </header>
      <main id="main" className="card">
        <p className="kicker">Something stalled</p>
        <h1 className="title">The desk hit a snag.</h1>
        <p className="lede">Your saved reviews are still on this computer. Try that action again.</p>
        <button className="btn primary" type="button" onClick={() => reset()}>
          Try again
        </button>
      </main>
    </div>
  );
}
