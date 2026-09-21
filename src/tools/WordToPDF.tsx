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

export default function WordToPDF({
  onResult,
  onError,
}: WordToPDFProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFile = (selectedFile: File | undefined) => {
    if (!selectedFile) return;

    if (
      selectedFile.type !==
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      onError?.("Please select a .docx Word file.");
      return;
    }

    if (selectedFile.size > 25 * 1024 * 1024) {
      onError?.("File size must be less than 25 MB.");
      return;
    }

    setFile(selectedFile);
    onError?.("");
  };

  const convertToPDF = async () => {
    if (!file) return;

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "http://127.0.0.1:8000/api/word-to-pdf",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(
          error?.detail || "Word to PDF conversion failed."
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      const downloadName = file.name.replace(
        /\.docx$/i,
        ".pdf"
      );

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
        "Word document converted successfully."
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

  return (
    <div className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-3xl">
            📄
          </div>

          <h2 className="text-2xl font-bold text-slate-900">
            Word to PDF
          </h2>

          <p className="mt-2 text-slate-500">
            Convert your Word document to PDF while preserving formatting.
          </p>
        </div>

        {!file ? (
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center transition hover:border-blue-400 hover:bg-blue-50">
            <div className="mb-3 text-4xl">📄</div>

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
              onChange={(e) =>
                handleFile(e.target.files?.[0])
              }
            />
          </label>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-800">
                  {file.name}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <button
                onClick={() => setFile(null)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Remove
              </button>
            </div>

            <button
              onClick={convertToPDF}
              disabled={loading}
              className="mt-5 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? "Converting..."
                : "Convert to PDF & Download"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}