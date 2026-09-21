import { useState } from "react";

interface WordToPDFProps {
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

const MAX_FILE_SIZE =
  25 * 1024 * 1024;

export default function WordToPDF({
  onResult,
  onError,
}: WordToPDFProps) {
  const [file, setFile] =
    useState<File | null>(null);

  const [loading, setLoading] =
    useState(false);

  const handleFile = (
    selectedFile: File | undefined
  ) => {
    if (!selectedFile) {
      return;
    }

    const isDocx =
      selectedFile.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      selectedFile.name
        .toLowerCase()
        .endsWith(".docx");

    if (!isDocx) {
      onError?.(
        "Please select a .docx Word file."
      );
      return;
    }

    if (
      selectedFile.size >
      MAX_FILE_SIZE
    ) {
      onError?.(
        "File size must be less than 25 MB."
      );
      return;
    }

    setFile(selectedFile);
    onError?.("");
  };

  const convertToPDF = async () => {
    if (!file) {
      return;
    }

    setLoading(true);
    onError?.("");

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          `${API_URL}/api/word-to-pdf`,
          {
            method: "POST",
            body: formData,
          }
        );

      if (!response.ok) {
        const error =
          await response
            .json()
            .catch(() => null);

        throw new Error(
          error?.detail ||
            "Word to PDF conversion failed."
        );
      }

      const blob =
        await response.blob();

      if (!blob.size) {
        throw new Error(
          "The server returned an empty PDF."
        );
      }

      const url =
        URL.createObjectURL(blob);

      const downloadName =
        file.name.replace(
          /\.docx$/i,
          ".pdf"
        );

      const link =
        document.createElement("a");

      link.href = url;
      link.download =
        downloadName;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      onResult?.(
        url,
        downloadName,
        blob.size,
        "Word document converted successfully."
      );

      /*
       * Give the browser time to
       * start the download before
       * releasing the object URL.
       */
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);
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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">

        {/* HEADER */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-8 w-8"
            >
              <path
                d="M6 3h8l4 4v14H6V3Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />

              <path
                d="M14 3v5h5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />

              <path
                d="M9 13h6M9 17h6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">
            Word to PDF
          </h2>

          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            Convert your Word document to PDF
            while preserving formatting.
          </p>
        </div>

        {!file ? (
          /* UPLOAD */
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition hover:border-blue-400 hover:bg-blue-50">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-7 w-7"
              >
                <path
                  d="M6 3h8l4 4v14H6V3Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />

                <path
                  d="M14 3v5h5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />

                <path
                  d="M12 17V11M9.5 13.5 12 11l2.5 2.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <p className="font-semibold text-slate-700">
              Click to upload a Word document
            </p>

            <p className="mt-2 text-sm text-slate-500">
              DOCX only • Maximum 25 MB
            </p>

            <input
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(event) => {
                handleFile(
                  event.target.files?.[0]
                );

                /*
                 * Allows selecting the same
                 * file again after removing it.
                 */
                event.currentTarget.value =
                  "";
              }}
            />
          </label>
        ) : (
          /* SELECTED FILE */
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                  >
                    <path
                      d="M6 3h8l4 4v14H6V3Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />

                    <path
                      d="M14 3v5h5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />

                    <path
                      d="M9 13h6M9 17h6"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-800">
                    {file.name}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {(
                      file.size /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    MB
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  onError?.("");
                }}
                disabled={loading}
                className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove
              </button>
            </div>

            <button
              type="button"
              onClick={convertToPDF}
              disabled={loading}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
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
                      d="M12 3v12"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />

                    <path
                      d="m7 10 5 5 5-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    <path
                      d="M5 21h14"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>

                  Convert to PDF & Download
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}