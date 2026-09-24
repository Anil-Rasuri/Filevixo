import { useState } from "react";
import "./WordToPDF.css";
import { wordToPdf } from "./wordToPdf";

interface WordToPDFProps {
  file: File | null;
  onResult?: (result: {
    url: string;
    name: string;
    size: number;
  }) => void;
  onError?: (message: string) => void;
  onLoading?: (loading: boolean) => void;
}

const WordToPDF = ({
  file,
  onResult,
  onError,
  onLoading,
}: WordToPDFProps) => {
  const [loading, setLoading] = useState(false);

  const handleConvert = async () => {
    if (!file) {
      const message = "Please select a Word document first.";
      onError?.(message);
      return;
    }

    setLoading(true);
    onError?.("");
    onLoading?.(true);

    try {
      const result = await wordToPdf(file);
      onResult?.(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to convert the Word document to PDF.";

      onError?.(message);
    } finally {
      setLoading(false);
      onLoading?.(false);
    }
  };

  return (
    <div className="word-to-pdf">
      <button
        type="button"
        className="word-to-pdf-button"
        onClick={handleConvert}
        disabled={!file || loading}
      >
        {loading ? (
          <>
            <span className="word-to-pdf-spinner" />
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
            Convert to PDF
          </>
        )}
      </button>
    </div>
  );
};

export default WordToPDF;
