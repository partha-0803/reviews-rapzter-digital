import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="shell narrow">
      <header className="topbar">
        <Logo />
      </header>
      <main id="main" className="card">
        <p className="kicker">Unavailable</p>
        <h1 className="title">This review link is not active.</h1>
        <p className="lede">Ask the Rapzter Digital team for a fresh link.</p>
      </main>
    </div>
  );
}
