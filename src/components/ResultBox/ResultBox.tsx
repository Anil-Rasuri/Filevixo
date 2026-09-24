import "./ResultBox.css";

interface ResultBoxProps {
  url: string | null;
  fileName: string;
  fileSize?: number;
  message?: string;
  onDownload?: () => void;
  onReset?: () => void;
}

export default function ResultBox({
  url,
  fileName,
  fileSize,
  message,
  onDownload,
  onReset,
}: ResultBoxProps) {
  if (!url) {
    return null;
  }

  return (
    <div className="result-box">
      <div className="result-success-icon">
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="m5 12 4 4L19 6"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="result-content">
        <span className="result-label">
          Ready
        </span>

        <h3>{message || "Your file is ready."}</h3>

        <p>
          {fileName}
          {typeof fileSize === "number" &&
            ` · ${(fileSize / 1024).toFixed(1)} KB`}
        </p>
      </div>

      <div className="result-actions">
        <button
          type="button"
          className="result-download"
          onClick={onDownload}
        >
          Download
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 4v11"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="m7 11 5 5 5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 20h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <button
          type="button"
          className="result-reset"
          onClick={onReset}
        >
          Start over
        </button>
      </div>
    </div>
  );
}