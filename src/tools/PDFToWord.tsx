import { useEffect, useRef, useState } from "react";

interface PDFToWordProps {
  onResult?: (
    url: string,
    name: string,
    size: number,
    message: string
  ) => void;
  onError?: (message: string) => void;
}

const API_URL =
  import.meta.env.VITE_API_URL ??
  "http://127.0.0.1:8000";

export default function PDFToWord({
  onResult,
  onError,
}: PDFToWordProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  /*
   * Clean object URL when component unmounts.
   */
  useEffect(() => {
    return () => {
      if (resultUrl) {
        URL.revokeObjectURL(resultUrl);
      }
    };
  }, [resultUrl]);

  /*
   * Handle PDF selection.
   */
  const handleFile = (
    selectedFile: File | undefined
  ) => {
    if (!selectedFile) return;

    if (selectedFile.type !== "application/pdf") {
      onError?.("Please select a PDF file.");
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      onError?.(
        "File size must be less than 25 MB."
      );
      return;
    }

    /*
     * Remove old result if a new PDF is selected.
     */
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }

    setFile(selectedFile);
    onError?.("");
  };

  /*
   * Open file picker.
   */
  const openFilePicker = () => {
    if (loading) return;

    fileInputRef.current?.click();
  };

  /*
   * Convert PDF to Word.
   */
  const convertToWord = async () => {
    if (!file) {
      onError?.("Please select a PDF file first.");
      return;
    }

    setLoading(true);
    onError?.("");

    try {
      const formData = new FormData();

      formData.append("file", file);

      const response = await fetch(
        `${API_URL}/api/pdf-to-word`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => null);

        throw new Error(
          error?.detail ||
            "PDF to Word conversion failed."
        );
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);

      /*
       * Correctly replace .pdf with .docx.
       */
      const downloadName = file.name.replace(
        /\.pdf$/i,
        ".docx"
      );

      setResultUrl(url);

      /*
       * Download automatically.
       */
      const link = document.createElement("a");

      link.href = url;
      link.download = downloadName;

      document.body.appendChild(link);
      link.click();
      link.remove();

      onResult?.(
        url,
        downloadName,
        blob.size,
        "PDF converted to Word successfully."
      );
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error.message
          : "Conversion failed."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * Remove selected PDF.
   */
  const removeFile = () => {
    setFile(null);

    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }

    onError?.("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /*
   * Reset tool completely.
   */
  const reset = () => {
    removeFile();
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-8">

        {/* Header */}
        <div className="mb-6 text-center sm:mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-600 sm:h-16 sm:w-16 sm:rounded-2xl">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6 sm:h-8 sm:w-8"
            >
              <path
                d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />

              <path
                d="M14 3v5h5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />

              <path
                d="M8 13h8M8 17h6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            PDF to Word
          </h2>

          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500 sm:text-sm">
            Convert your PDF into an editable Word document.
          </p>
        </div>

        {/* Hidden input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);

            /*
             * Allow selecting the same PDF again.
             */
            e.target.value = "";
          }}
        />

        {/* Upload */}
        {!file && !resultUrl && (
          <button
            type="button"
            onClick={openFilePicker}
            disabled={loading}
            className="flex min-h-[190px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-violet-400 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[220px] sm:px-6 sm:py-10"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-600 sm:h-14 sm:w-14 sm:rounded-2xl">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6 sm:h-7 sm:w-7"
              >
                <path
                  d="M12 16V4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />

                <path
                  d="m7 9 5-5 5 5"
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
            </div>

            <p className="text-sm font-semibold text-slate-800 sm:text-base">
              Click to upload a PDF
            </p>

            <p className="mt-2 text-xs text-slate-500 sm:text-sm">
              Select one PDF file
            </p>

            <p className="mt-3 text-[11px] text-slate-400 sm:text-xs">
              PDF only • Maximum 25 MB
            </p>
          </button>
        )}

        {/* Selected file */}
        {file && !resultUrl && (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="flex items-center gap-3">

              {/* PDF icon */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 sm:h-12 sm:w-12">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5 sm:h-6 sm:w-6"
                >
                  <path
                    d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M14 3v5h5"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M8 15h2.5a1.5 1.5 0 0 0 0-3H8v5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* File details */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-800">
                  {file.name}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={removeFile}
                disabled={loading}
                className="shrink-0 rounded-lg px-2.5 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-40 sm:px-3 sm:text-sm"
              >
                Remove
              </button>
            </div>

            {/* Convert */}
            <button
              type="button"
              onClick={convertToWord}
              disabled={loading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-6 sm:py-4"
            >
              {loading ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Converting...
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                  >
                    <path
                      d="M12 4v11"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />

                    <path
                      d="m7 11 5 5 5-5"
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

                  Convert to Word & Download
                </>
              )}
            </button>
          </div>
        )}

        {/* Success */}
        {resultUrl && (
          <div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center sm:p-6">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-6 w-6"
                >
                  <path
                    d="m5 12 4 4L19 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <h3 className="text-base font-bold text-emerald-800 sm:text-lg">
                PDF converted successfully
              </h3>

              <p className="mt-2 text-xs text-emerald-700 sm:text-sm">
                Your Word document has been downloaded.
              </p>
            </div>

            {/* Convert another */}
            <button
              type="button"
              onClick={reset}
              className="mt-4 w-full rounded-xl px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
            >
              Convert Another PDF
            </button>
          </div>
        )}
      </div>
    </div>
  );
}