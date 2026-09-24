import "./Security.css";

export default function Security() {
  return (
    <section className="security" id="security">
      <div className="security-container">
        <div className="security-content">
          <span className="security-label">
            FILEVIXO SECURITY
          </span>

          <h2>
            Your files should stay
            <br />
            yours.
          </h2>

          <p>
            Filevixo is designed with privacy and security
            in mind. Files are processed securely and are
            not intended to become publicly accessible.
          </p>
        </div>

        <div className="security-points">
          <div className="security-point">
            <div className="security-point-icon">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="5"
                  y="10"
                  width="14"
                  height="10"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="M8 10V7a4 4 0 0 1 8 0v3"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
              </svg>
            </div>

            <div>
              <h3>Secure processing</h3>
              <p>
                Files are handled through controlled
                processing endpoints.
              </p>
            </div>
          </div>

          <div className="security-point">
            <div className="security-point-icon">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M12 3 5 6v5c0 4.6 2.8 8.1 7 10 4.2-1.9 7-5.4 7-10V6l-7-3Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
                <path
                  d="m9 12 2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <h3>Privacy focused</h3>
              <p>
                We design the platform around responsible
                file handling.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}