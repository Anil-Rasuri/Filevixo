import { useEffect, useState } from "react";
import "./ConvertImage.css";
import { convertImage } from "./convertImage";

interface ConvertImageProps {
  file: File | null;
  outputFormat: string;
  setOutputFormat: (format: string) => void;

  onResult?: (result: {
    url: string;
    name: string;
    size: number;
  }) => void;

  onError?: (message: string) => void;
  onLoading?: (loading: boolean) => void;
}

/*
 * The first four formats are the main/highlighted formats.
 */
const PRIMARY_FORMATS = [
  { value: "jpg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WEBP" },
];

/*
 * Additional supported image formats.
 */
const OTHER_FORMATS = [
  { value: "gif", label: "GIF" },
  { value: "bmp", label: "BMP" },
  { value: "tiff", label: "TIFF" },
  { value: "svg", label: "SVG" },
  { value: "heic", label: "HEIC" },
  { value: "heif", label: "HEIF" },
  { value: "avif", label: "AVIF" },
  { value: "ico", label: "ICO" },
];

const FORMAT_OPTIONS = [
  ...PRIMARY_FORMATS,
  ...OTHER_FORMATS,
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

export default function ConvertImage({
  file,
  outputFormat,
  setOutputFormat,
  onResult,
  onError,
  onLoading,
}: ConvertImageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    setLoading(false);

    if (!file) {
      setOutputFormat("");
      return;
    }

    const currentExtension = file.name
      .split(".")
      .pop()
      ?.toLowerCase();

    /*
     * Keep the current format selected when possible.
     * JPEG files use JPEG as the default output.
     */
    const matchingFormat = FORMAT_OPTIONS.find(
      (format) => format.value === currentExtension,
    );

    if (matchingFormat) {
      setOutputFormat(matchingFormat.value);
    } else {
      setOutputFormat("jpg");
    }
  }, [file, setOutputFormat]);

  const handleConvert = async () => {
    if (!file) {
      const message = "Please select an image first.";

      setError(message);
      onError?.(message);

      return;
    }

    if (!outputFormat) {
      const message = "Please select an output format.";

      setError(message);
      onError?.(message);

      return;
    }

    setError("");
    setLoading(true);
    onLoading?.(true);
    onError?.("");

    try {
      const result = await convertImage(
        file,
        outputFormat,
      );

      onResult?.(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Image conversion failed.";

      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
      onLoading?.(false);
    }
  };

  const currentExtension =
    file?.name
      .split(".")
      .pop()
      ?.toUpperCase() || "";

  return (
    <div className="convert-image">
      <div className="convert-image-header">
        <h2 className="convert-image-title">
          Convert Image
        </h2>

        <p className="convert-image-description">
          Convert your image to different image formats.
        </p>
      </div>

      {file && (
        <div className="convert-file-card">
          <div className="convert-file-icon">
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

          <div className="convert-file-info">
            <span className="convert-file-name">
              {file.name}
            </span>

            <span className="convert-file-size">
              {currentExtension} ·{" "}
              {formatFileSize(file.size)}
            </span>
          </div>
        </div>
      )}

      <div className="convert-settings">
        <div className="convert-settings-heading">
          <div>
            <h3>Output format</h3>

            <p>
              Choose the format for your converted image.
            </p>
          </div>

          {outputFormat && (
            <span className="convert-selected-format">
              {outputFormat.toUpperCase()}
            </span>
          )}
        </div>

        <div className="convert-format-options">
          {FORMAT_OPTIONS.map((format, index) => {
            const selected =
              outputFormat === format.value;

            const isPrimary = index < 4;

            const currentExtension =
              file?.name
                .split(".")
                .pop()
                ?.toLowerCase();

            const sameFormat =
              currentExtension === format.value ||
              (
                currentExtension === "jpg" &&
                format.value === "jpeg"
              ) ||
              (
                currentExtension === "jpeg" &&
                format.value === "jpg"
              );

            return (
              <button
                key={format.value}
                type="button"
                className={[
                  "convert-format-button",
                  isPrimary
                    ? "convert-format-primary"
                    : "convert-format-secondary",
                  selected ? "selected" : "",
                ].join(" ")}
                onClick={() =>
                  setOutputFormat(format.value)
                }
                disabled={loading}
              >
                <span className="convert-format-name">
                  {format.label}
                </span>

                {sameFormat && (
                  <span className="convert-current-badge">
                    Current
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div
          className="convert-error"
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
        className="convert-action-button"
        onClick={handleConvert}
        disabled={
          !file ||
          !outputFormat ||
          loading
        }
      >
        {loading ? (
          <>
            <span className="convert-spinner" />

            Converting...
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
                d="M15 7l5 5-5 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            Convert to{" "}
            {outputFormat
              ? outputFormat.toUpperCase()
              : "Format"}
          </>
        )}
      </button>
    </div>
  );
}