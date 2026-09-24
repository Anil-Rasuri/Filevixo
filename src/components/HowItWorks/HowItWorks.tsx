import "./HowItWorks.css";

const steps = [
  {
    number: "01",
    title: "Choose a tool",
    description:
      "Select the file tool you need from our collection of simple online utilities.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 3v18M3 12h18"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Upload your file",
    description:
      "Upload your image or document directly from your device with a simple click.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Get your result",
    description:
      "Let Filevixo process your file and download the finished result in seconds.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 4v12m0 0 4.5-4.5M12 16l-4.5-4.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5 20h14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function HowItWorks() {
  return (
    <section className="how-it-works" id="how-it-works">
      <div className="how-it-works-container">

        <div className="how-it-works-header">
          <div className="how-it-works-eyebrow">
            <span className="how-it-works-eyebrow-line" />
            SIMPLE PROCESS
          </div>

          <h2>
            How <span>Filevixo</span> works
          </h2>

          <p>
            Complete your file tasks in three simple steps.
            No complicated software or technical knowledge required.
          </p>
        </div>

        <div className="how-it-works-steps">
          {steps.map((step, index) => (
            <div className="how-step-wrapper" key={step.number}>

              <article className="how-step">
                <div className="how-step-top">
                  <span className="how-step-number">
                    {step.number}
                  </span>

                  <div className="how-step-icon">
                    {step.icon}
                  </div>
                </div>

                <div className="how-step-content">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
              </article>

              {index < steps.length - 1 && (
                <div className="how-step-connector" aria-hidden="true">
                  <svg viewBox="0 0 40 20" fill="none">
                    <path
                      d="M2 10h30M26 4l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}

            </div>
          ))}
        </div>

        <div className="how-it-works-bottom">
          <div className="how-bottom-icon">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3l7 3v5c0 4.6-2.9 8.6-7 10-4.1-1.4-7-5.4-7-10V6l7-3Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="m9 12 2 2 4-4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div>
            <strong>Simple, fast and built for everyday file tasks.</strong>
            <span>
              Filevixo keeps the process straightforward from upload to download.
            </span>
          </div>
        </div>

      </div>
    </section>
  );
}