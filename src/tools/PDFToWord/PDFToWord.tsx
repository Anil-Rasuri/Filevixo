import { useState } from "react";
import "./PDFToWord.css";

interface PDFToWordProps {
  file: File | null;
  onResult?: (result: {
    url: string;
    name: string;
    size: number;
  }) => void;
  onError?: (message: string) => void;
  onLoading?: (loading: boolean) => void;
}

const PDFToWord = ({
  file,
  onResult,
  onError,
  onLoading,
}: PDFToWordProps) => {
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (!file) {
      const message = "Please select a PDF document first.";
      onError?.(message);
      return;
    }

    setLoading(true);
    onError?.("");
    onLoading?.(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "http://127.0.0.1:8000/api/pdf-to-word",
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        let message = "PDF to Word conversion failed.";

        try {
          const data = await response.json();
          message = data.detail || message;
        } catch {
          // Keep default message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const originalName = file.name.replace(/\.pdf$/i, "");

      onResult?.({
        url,
        name: `${originalName}.docx`,
        size: blob.size,
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to convert the PDF to Word.";

      onError?.(message);
    } finally {
      setLoading(false);
      onLoading?.(false);
    }
  };

  return (
    <div className="pdf-to-word">
      <button
        type="button"
        className="pdf-to-word-button"
        onClick={handleConvert}
        disabled={!file || loading}
      >
        {loading ? (
          <>
            <span className="pdf-to-word-spinner" />
            Converting...
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
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6" />
              <path d="M8 13h8" />
              <path d="M8 17h5" />
            </svg>
            Convert to Word
          </>
        )}
      </button>
    </div>
  );
};

export default PDFToWord;
