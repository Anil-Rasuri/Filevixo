import "./Navbar.css";

interface NavbarProps {
  activeSection: "home" | "tools" | "how-it-works";
  onHomeClick: () => void;
  onToolsClick: () => void;
  onHowItWorksClick: () => void;
}

export default function Navbar({
  activeSection,
  onHomeClick,
  onToolsClick,
  onHowItWorksClick,
}: NavbarProps) {
  return (
    <header className="navbar">
      <div className="navbar-inner">

        {/* BRAND */}

        <button
          type="button"
          className="navbar-brand"
          onClick={onHomeClick}
          aria-label="Filevixo home"
        >
          <img
            src="/logo.png"
            alt="Filevixo"
            className="navbar-logo"
          />
        </button>

        {/* NAVIGATION */}

        <nav
          className="navbar-nav"
          aria-label="Main navigation"
        >
          <button
            type="button"
            className={`navbar-link ${
              activeSection === "home"
                ? "active"
                : ""
            }`}
            onClick={onHomeClick}
          >
            Home
          </button>

          <button
            type="button"
            className={`navbar-link ${
              activeSection === "tools"
                ? "active"
                : ""
            }`}
            onClick={onToolsClick}
          >
            Tools
          </button>

          <button
            type="button"
            className={`navbar-link ${
              activeSection === "how-it-works"
                ? "active"
                : ""
            }`}
            onClick={onHowItWorksClick}
          >
            How it works
          </button>
        </nav>

        {/* CTA */}

        <button
          type="button"
          className="navbar-cta"
          onClick={onToolsClick}
        >
          Get started

          <svg
            viewBox="0 0 20 20"
            aria-hidden="true"
          >
            <path
              d="M4 10h11M10.5 5.5 15 10l-4.5 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

      </div>
    </header>
  );
}