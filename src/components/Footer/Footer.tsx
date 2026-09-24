import "./Footer.css";

export default function Footer() {
  return (
    <footer className="footer" id="footer">
      <div className="footer-container">

        {/* =========================
            FOOTER MAIN
           ========================= */}

        <div className="footer-main">

          {/* BRAND */}
          <div className="footer-brand">

            <div className="footer-logo-wrap">
              <img
                src="/logo.png"
                alt="Filevixo"
                className="footer-logo"
              />
            </div>

            <p className="footer-description">
              Simple, fast and reliable online tools for
              compressing, converting, resizing, editing
              and managing your files.
            </p>

            <p className="footer-tagline">
              Built for everyday file tasks.
            </p>

          </div>


          {/* IMAGE TOOLS */}
          <div className="footer-column">

            <h3>Image Tools</h3>

            <a href="#tools">Compress Image</a>
            <a href="#tools">Convert Image</a>
            <a href="#tools">Resize Image</a>
            <a href="#tools">Crop Image</a>

          </div>


          {/* DOCUMENT & PDF */}
          <div className="footer-column">

            <h3>File Tools</h3>

            <a href="#tools">Word to PDF</a>
            <a href="#tools">PDF to Word</a>
            <a href="#tools">Images to PDF</a>
            <a href="#tools">Merge PDF</a>

          </div>


          {/* COMPANY */}
          <div className="footer-column">

            <h3>Filevixo</h3>

            <a href="#how-it-works">How It Works</a>
            <a href="#security">Security</a>
            <a href="#security">Privacy</a>
            <a href="#footer">Contact</a>

          </div>

        </div>


        {/* =========================
            CONTACT CARD
           ========================= */}

        <div className="footer-contact-section">

          <div className="footer-contact-content">

            <span className="footer-contact-label">
              BUSINESS CONTACT
            </span>

            <h3>
              Have a question or business enquiry?
            </h3>

            <p>
              For business enquiries, partnerships or
              other questions, contact us by email.
            </p>

          </div>

          <a
            href="mailto:anilrasuri17@gmail.com"
            className="footer-email"
          >
            <span className="footer-email-icon">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 6h16v12H4V6Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />

                <path
                  d="m4 7 8 6 8-6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>

            <span>
              anilrasuri17@gmail.com
            </span>

            <span className="footer-email-arrow">
              →
            </span>

          </a>

        </div>


        {/* =========================
            BOTTOM
           ========================= */}

        <div className="footer-bottom">

          <div className="footer-copyright">
            © {new Date().getFullYear()} Filevixo.
            All rights reserved.
          </div>

          <div className="footer-bottom-links">

            <a href="#security">
              Privacy
            </a>

            <a href="#security">
              Security
            </a>

            <a href="#tools">
              Tools
            </a>

            <a href="#how-it-works">
              How It Works
            </a>

          </div>

        </div>

      </div>
    </footer>
  );
}