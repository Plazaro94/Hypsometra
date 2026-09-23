import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <header className="nav">
        <div className="nav-brand">Hypsometra</div>
        <nav className="nav-links">
          <Link href="/lab">Lab</Link>
          <a
            href="https://github.com/Plazaro94/Hypsometra"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </nav>
      </header>

      <main className="hero">
        <h1 className="hero-brand">Hypsometra</h1>
        <div className="hero-line" aria-hidden />
        <p className="hero-tag">
          Mide el relieve de tu estrategia, no la altura de un pico.
        </p>
        <div className="hero-actions">
          <Link className="btn btn-primary" href="/lab">
            Abrir el lab
          </Link>
          <a
            className="btn"
            href="https://github.com/Plazaro94/Hypsometra"
            target="_blank"
            rel="noreferrer"
          >
            Ver el repo
          </a>
        </div>
      </main>
    </>
  );
}
