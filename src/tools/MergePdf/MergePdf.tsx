import { useState } from "react";
import "./MergePdf.css";
import { mergePdf } from "./mergePdf";

interface MergePDFProps {
  file: File | null;
  onResult?: (result: {
    url: string;
    name: string;
    size: number;
  }) => void;
  onError?: (message: string) => void;
  onLoading?: (loading: boolean) => void;
}

const MergePDF = ({
  file,
  onResult,
  onError,
  onLoading,
}: MergePDFProps) => {
  const [files, setFiles] = useState<File[]>(file ? [file] : []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles = Array.from(selectedFiles);

    const invalidFiles = newFiles.filter(
      (item) =>
        item.type !== "application/pdf" &&
        !item.name.toLowerCase().endsWith(".pdf"),
    );

    if (invalidFiles.length > 0) {
      const message = "Only PDF files can be added.";
      setError(message);
      onError?.(message);
      return;
    }

    setFiles((current) => [...current, ...newFiles]);
    setError("");
    onError?.("");
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index));
  };

  const moveFile = (index: number, direction: "up" | "down") => {
    setFiles((current) => {
      const newFiles = [...current];

      const newIndex =
        direction === "up" ? index - 1 : index + 1;

      if (newIndex < 0 || newIndex >= newFiles.length) {
        return current;
      }

      [newFiles[index], newFiles[newIndex]] = [
        newFiles[newIndex],
        newFiles[index],
      ];

      return newFiles;
    });
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      const message = "Please select at least two PDF files.";
      setError(message);
      onError?.(message);
      return;
    }

    setLoading(true);
    setError("");
    onError?.("");
    onLoading?.(true);

    try {
      const result = await mergePdf(files);

      onResult?.(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to merge the PDF files.";

      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
      onLoading?.(false);
    }
  };

  return (
    <div className="merge-pdf">
      <div className="merge-pdf-header">
        <div>
          <h3>Merge PDF</h3>
          <p>Combine multiple PDF files into one document.</p>
        </div>
      </div>

      <label className="merge-pdf-upload">
        <input
          type="file"
          accept=".pdf,application/pdf"
          multiple
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
          disabled={loading}
        />

        <div className="merge-pdf-upload-icon">
          <svg
            width="25"
            height="25"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path d="M12 16V4" />
            <path d="M7 9l5-5 5 5" />
            <path d="M5 20h14" />
          </svg>
        </div>

        <strong>Add PDF files</strong>
        <span>Choose two or more PDF documents</span>
      </label>

      {files.length > 0 && (
        <div className="merge-pdf-list">
          <div className="merge-pdf-list-header">
            <span>
              Selected files
              <strong>{files.length}</strong>
            </span>

            {files.length > 1 && (
              <span className="merge-pdf-order-label">
                Drag order with arrows
              </span>
            )}
          </div>

          <div className="merge-pdf-items">
            {files.map((pdfFile, index) => (
              <div className="merge-pdf-item" key={`${pdfFile.name}-${index}`}>
                <div className="merge-pdf-number">
                  {index + 1}
                </div>

                <div className="merge-pdf-file-icon">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" />
                    <path d="M8 13h8" />
                    <path d="M8 17h6" />
                  </svg>
                </div>

                <div className="merge-pdf-file-details">
                  <strong>{pdfFile.name}</strong>
                  <span>
                    {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>

                <div className="merge-pdf-actions">
                  <button
                    type="button"
                    title="Move up"
                    aria-label={`Move ${pdfFile.name} up`}
                    onClick={() => moveFile(index, "up")}
                    disabled={index === 0 || loading}
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 19V5" />
                      <path d="M6 11l6-6 6 6" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    title="Move down"
                    aria-label={`Move ${pdfFile.name} down`}
                    onClick={() => moveFile(index, "down")}
                    disabled={
                      index === files.length - 1 || loading
                    }
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 5v14" />
                      <path d="M18 13l-6 6-6-6" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    className="merge-pdf-remove"
                    title="Remove"
                    aria-label={`Remove ${pdfFile.name}`}
                    onClick={() => removeFile(index)}
                    disabled={loading}
                  >
                    <svg
                      width="17"
                      height="17"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M4 7h16" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                      <path d="M6 7l1 14h10l1-14" />
                      <path d="M9 7V4h6v3" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="merge-pdf-error">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
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
        className="merge-pdf-button"
        onClick={handleMerge}
        disabled={loading || files.length < 2}
      >
        {loading ? (
          <>
            <span className="merge-pdf-spinner" />
            Merging PDFs...
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
            >
              <path d="M7 3h10" />
              <path d="M7 3v4" />
              <path d="M17 3v4" />
              <rect x="5" y="7" width="14" height="14" rx="2" />
              <path d="M9 12h6" />
              <path d="M9 16h6" />
            </svg>
            Merge PDF Files
          </>
        )}
      </button>
    </div>
  );
};

export default MergePDF;