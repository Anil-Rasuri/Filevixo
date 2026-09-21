import { useEffect, useRef, useState } from "react";

interface MergePDFProps {
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

export default function MergePDF({
  onResult,
  onError,
}: MergePDFProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_FILES = 20;

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
   * Open the native PDF file picker.
   */
  const openFilePicker = () => {
    if (loading) return;

    fileInputRef.current?.click();
  };

  /*
   * Add selected PDF files.
   */
  const handleFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles = Array.from(selectedFiles);

    if (newFiles.length === 0) {
      return;
    }

    /*
     * Validate file type and size.
     */
    const invalidFile = newFiles.find(
      (file) =>
        file.type !== "application/pdf" ||
        file.size > MAX_FILE_SIZE
    );

    if (invalidFile) {
      onError?.(
        `${invalidFile.name} is invalid. PDF files must be under 25 MB.`
      );
      return;
    }

    /*
     * Prevent more than 20 files.
     */
    if (files.length + newFiles.length > MAX_FILES) {
      onError?.(
        `You can merge a maximum of ${MAX_FILES} PDF files.`
      );
      return;
    }

    /*
     * Prevent duplicate files.
     */
    const uniqueNewFiles = newFiles.filter((newFile) => {
      return !files.some(
        (existingFile) =>
          existingFile.name === newFile.name &&
          existingFile.size === newFile.size &&
          existingFile.lastModified === newFile.lastModified
      );
    });

    if (uniqueNewFiles.length === 0) {
      onError?.("These PDF files are already selected.");
      return;
    }

    setFiles((current) => [
      ...current,
      ...uniqueNewFiles,
    ]);

    onError?.("");

    /*
     * Selecting new files after a previous result
     * should remove the old result state.
     */
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }
  };

  /*
   * Remove one PDF.
   */
  const removeFile = (index: number) => {
    setFiles((current) =>
      current.filter((_, fileIndex) => fileIndex !== index)
    );

    onError?.("");
  };

  /*
   * Move PDF up or down.
   */
  const moveFile = (
    index: number,
    direction: "up" | "down"
  ) => {
    setFiles((current) => {
      const updated = [...current];

      const newIndex =
        direction === "up"
          ? index - 1
          : index + 1;

      if (
        newIndex < 0 ||
        newIndex >= updated.length
      ) {
        return current;
      }

      [
        updated[index],
        updated[newIndex],
      ] = [
        updated[newIndex],
        updated[index],
      ];

      return updated;
    });

    onError?.("");
  };

  /*
   * Clear selected PDFs.
   */
  const clearFiles = () => {
    setFiles([]);

    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }

    onError?.("");
  };

  /*
   * Merge PDFs through FastAPI.
   */
  const mergePDFs = async () => {
    if (files.length < 2) {
      onError?.(
        "Please select at least two PDF files."
      );
      return;
    }

    setLoading(true);
    onError?.("");

    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }

    try {
      const formData = new FormData();

      files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(
        `${API_URL}/api/merge-pdf`,
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
          error?.detail || "PDF merge failed."
        );
      }

      const blob = await response.blob();

      const url = URL.createObjectURL(blob);

      setResultUrl(url);

      onResult?.(
        url,
        "filevixo-merged.pdf",
        blob.size,
        "PDFs merged successfully."
      );
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error.message
          : "PDF merge failed."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * Download merged PDF.
   */
  const downloadPDF = () => {
    if (!resultUrl) return;

    const link = document.createElement("a");

    link.href = resultUrl;
    link.download = "filevixo-merged.pdf";

    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  /*
   * Reset everything and return to
   * the initial full upload state.
   */
  const reset = () => {
    setFiles([]);

    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }

    onError?.("");

    /*
     * Clear native input so the same files
     * can be selected again.
     */
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-8">

        {/* Header */}
        <div className="mb-6 text-center sm:mb-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-orange-600 sm:h-16 sm:w-16 sm:rounded-2xl">
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
                d="M9 13h6M9 17h6"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
            Merge PDF
          </h2>

          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-slate-500 sm:text-sm">
            Combine multiple PDF files into one document.
          </p>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);

            /*
             * Allow selecting the same file again.
             */
            e.target.value = "";
          }}
        />

        {/* FULL UPLOAD BOX */}
        {!resultUrl && (
          <button
            type="button"
            onClick={openFilePicker}
            disabled={loading}
            className="mb-6 flex min-h-[190px] w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-orange-400 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[220px] sm:px-6 sm:py-10"
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600 sm:h-14 sm:w-14 sm:rounded-2xl">
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
              Click to add PDF files
            </p>

            <p className="mt-2 text-xs text-slate-500 sm:text-sm">
              Select multiple PDF files at once
            </p>

            <p className="mt-3 text-[11px] text-slate-400 sm:text-xs">
              PDF only • Maximum 25 MB per file • Up to 20 files
            </p>
          </button>
        )}

        {/* SELECTED FILES */}
        {files.length > 0 && !resultUrl && (
          <div className="mb-6 space-y-3">

            {/* List header */}
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-800 sm:text-base">
                Selected PDFs ({files.length})
              </h3>

              <button
                type="button"
                onClick={clearFiles}
                className="shrink-0 text-xs font-semibold text-red-600 transition hover:text-red-700 sm:text-sm"
              >
                Clear All
              </button>
            </div>

            {/* PDF files */}
            {files.map((file, index) => (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:gap-3 sm:p-4"
              >
                {/* PDF icon */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 sm:h-10 sm:w-10">
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

                {/* File information */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800 sm:text-sm">
                    {file.name}
                  </p>

                  <p className="mt-0.5 text-[10px] text-slate-500 sm:text-xs">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

                {/* Controls */}
                <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">

                  {/* Move up */}
                  <button
                    type="button"
                    onClick={() =>
                      moveFile(index, "up")
                    }
                    disabled={
                      index === 0 || loading
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:opacity-25 sm:h-9 sm:w-9"
                    title="Move up"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      className="h-4 w-4"
                    >
                      <path
                        d="m5 12 5-5 5 5"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {/* Move down */}
                  <button
                    type="button"
                    onClick={() =>
                      moveFile(index, "down")
                    }
                    disabled={
                      index === files.length - 1 ||
                      loading
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-slate-800 disabled:opacity-25 sm:h-9 sm:w-9"
                    title="Move down"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      className="h-4 w-4"
                    >
                      <path
                        d="m5 8 5 5 5-5"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() =>
                      removeFile(index)
                    }
                    disabled={loading}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 sm:h-9 sm:w-9"
                    title="Remove"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      className="h-4 w-4"
                    >
                      <path
                        d="M5 5l10 10M15 5 5 15"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ADD MORE PDFS */}
        {files.length > 0 && !resultUrl && (
          <button
            type="button"
            onClick={openFilePicker}
            disabled={loading || files.length >= MAX_FILES}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-orange-400 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              className="h-4 w-4"
            >
              <path
                d="M10 4v12M4 10h12"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>

            {files.length >= MAX_FILES
              ? "Maximum 20 PDFs selected"
              : "Add More PDFs"}
          </button>
        )}

        {/* MERGE BUTTON */}
        {files.length >= 2 && !resultUrl && (
          <button
            type="button"
            onClick={mergePDFs}
            disabled={loading}
            className="w-full rounded-xl bg-orange-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60 sm:px-6 sm:py-4"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Merging PDFs...
              </span>
            ) : (
              `Merge ${files.length} PDFs`
            )}
          </button>
        )}

        {/* NEED TWO FILES MESSAGE */}
        {files.length === 1 && !resultUrl && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
            <p className="text-xs font-medium text-amber-700 sm:text-sm">
              Add at least one more PDF to merge.
            </p>
          </div>
        )}

        {/* RESULT */}
        {resultUrl && (
          <div className="mt-2">

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center sm:p-6">

              {/* Success icon */}
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
                PDFs merged successfully
              </h3>

              <p className="mt-2 text-xs text-emerald-700 sm:text-sm">
                Your merged PDF is ready.
              </p>
            </div>

            {/* Download */}
            <button
              type="button"
              onClick={downloadPDF}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-600/20 transition hover:bg-orange-700 sm:px-6 sm:py-4"
            >
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

              Download Merged PDF
            </button>

            {/* Merge more */}
            <button
              type="button"
              onClick={reset}
              className="mt-3 w-full rounded-xl px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
            >
              Merge More PDFs
            </button>
          </div>
        )}
      </div>
    </div>
  );
}