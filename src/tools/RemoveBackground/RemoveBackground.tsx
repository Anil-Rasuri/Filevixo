import { useEffect, useState } from "react";
import "./RemoveBackground.css";
import { removeBackground } from "./removeBackground";

interface RemoveBackgroundProps {
  file: File | null;
  onResult?: (result: {
    url: string;
    name: string;
    size: number;
  }) => void;
  onError?: (message: string) => void;
  onLoading?: (loading: boolean) => void;
}

const RemoveBackground = ({
  file,
  onResult,
  onError,
  onLoading,
}: RemoveBackgroundProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    let active = true;

    const reader = new FileReader();

    reader.onload = () => {
      if (active && typeof reader.result === "string") {
        setPreviewUrl(reader.result);
      }
    };

    reader.onerror = () => {
      if (active) {
        setPreviewUrl(null);
      }
    };

    reader.readAsDataURL(file);

    return () => {
      active = false;
      reader.abort();
    };
  }, [file]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getFileExtension = (filename: string): string => {
    const extension = filename.split(".").pop();

    return extension ? extension.toUpperCase() : "IMAGE";
  };

  const handleRemoveBackground = async () => {
    if (!file) {
      const message = "Please select an image first.";

      setError(message);
      onError?.(message);

      return;
    }

    setLoading(true);
    setError("");
    onError?.("");
    onLoading?.(true);

    try {
      const result = await removeBackground(file);

      onResult?.(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to remove the image background.";

      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
      onLoading?.(false);
    }
  };

  return (
    <div className="remove-background">
      {file && (
        <div className="remove-background-file">
          <div className="remove-background-preview">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                draggable={false}
              />
            ) : (
              <div className="remove-background-image-placeholder">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                  />
                  <circle
                    cx="8.5"
                    cy="8.5"
                    r="1.5"
                  />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              </div>
            )}
          </div>

          <div className="remove-background-file-details">
            <div className="remove-background-file-name">
              {file.name}
            </div>

            <div className="remove-background-file-meta">
              Image · {formatFileSize(file.size)}
            </div>
          </div>

          <div className="remove-background-file-type">
            {getFileExtension(file.name)}
          </div>
        </div>
      )}

      {error && (
        <div className="remove-background-error">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5" />
            <path d="M12 16h.01" />
          </svg>

          <span>{error}</span>
        </div>
      )}

      <button
        type="button"
        className="remove-background-button"
        onClick={handleRemoveBackground}
        disabled={loading || !file}
      >
        {loading ? (
          <>
            <span className="remove-background-spinner" />
            Removing Background...
          </>
        ) : (
          <>
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
              <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16z" />
            </svg>

            Remove Background
          </>
        )}
      </button>
    </div>
  );
};

export default RemoveBackground;