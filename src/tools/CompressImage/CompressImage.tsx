import { useEffect, useState } from "react";
import "./CompressImage.css";
import { compressImage } from "./compressImage";

interface CompressImageProps {
  file: File | null;

  onResult?: (result: {
    url: string;
    name: string;
    size: number;
  }) => void;

  onError?: (message: string) => void;

  onLoading?: (loading: boolean) => void;
}

const TARGET_OPTIONS = [
  { label: "100 KB", value: 100 },
  { label: "200 KB", value: 200 },
  { label: "300 KB", value: 300 },
  { label: "500 KB", value: 500 },
  { label: "1 MB", value: 1024 },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CompressImage({
  file,
  onResult,
  onError,
  onLoading,
}: CompressImageProps) {
  const [targetSize, setTargetSize] = useState<number>(100);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setLoading(false);
  }, [file]);

  const handleCompress = async () => {
    if (!file) {
      const message = "Please select an image first.";

      setError(message);
      onError?.(message);

      return;
    }

    setError("");
    setLoading(true);
    onLoading?.(true);

    try {
      const result = await compressImage(file, targetSize);

      onResult?.(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Image compression failed.";

      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
      onLoading?.(false);
    }
  };

  const selectedSize =
    targetSize === 1024
      ? "1 MB"
      : `${targetSize} KB`;

  return (
    <div className="compress-image">
      <div className="compress-image-header">
        <div>
          <h2 className="compress-image-title">
            Compress Image
          </h2>

          <p className="compress-image-description">
            Reduce your image size while keeping the
            best possible quality.
          </p>
        </div>
      </div>

      {file && (
        <div className="compress-file-card">
          <div className="compress-file-icon">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 3.5h8l4 4V20.5H6V3.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />

              <path
                d="M14 3.5v4h4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />

              <path
                d="M8.5 15.5l2.2-2.2 1.7 1.7 1.8-2.1 2.3 2.6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="compress-file-info">
            <span className="compress-file-name">
              {file.name}
            </span>

            <span className="compress-file-size">
              Original size: {formatFileSize(file.size)}
            </span>
          </div>
        </div>
      )}

      <div className="compress-settings">
        <div className="compress-settings-heading">
          <div>
            <h3>Maximum output size</h3>

            <p>
              The generated file will not be accepted
              if it exceeds this limit.
            </p>
          </div>

          <span className="compress-selected-size">
            {selectedSize}
          </span>
        </div>

        <div className="compress-target-options">
          {TARGET_OPTIONS.map((option) => {
            const selected = targetSize === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={[
                  "compress-target-button",
                  selected ? "selected" : "",
                ].join(" ")}
                onClick={() => setTargetSize(option.value)}
                disabled={loading}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          className="compress-error"
          role="alert"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              strokeWidth="2"
            />

            <path
              d="M12 7v6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />

            <circle
              cx="12"
              cy="16.5"
              r="1"
              fill="currentColor"
            />
          </svg>

          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        className="compress-action-button"
        onClick={handleCompress}
        disabled={!file || loading}
      >
        {loading ? (
          <>
            <span className="compress-spinner" />
            Compressing...
          </>
        ) : (
          <>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M5 12h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />

              <path
                d="M12 5v14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            Compress to {selectedSize}
          </>
        )}
      </button>

      <p className="compress-note">
        Maximum output size:{" "}
        <strong>{selectedSize}</strong>
      </p>
    </div>
  );
}