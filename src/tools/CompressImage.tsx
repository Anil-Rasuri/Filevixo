import { useState } from "react";

interface CompressImageProps {
  selectedFile: File | null;
  loading: boolean;
  onStart: () => void;
  onResult: (
    url: string,
    name: string,
    size: number
  ) => void;
  onError: (message: string) => void;
}

export default function CompressImage({
  selectedFile,
  loading,
  onStart,
  onResult,
  onError,
}: CompressImageProps) {
  const [selectedTarget, setSelectedTarget] = useState(500);

  const API_URL =
    import.meta.env.VITE_API_URL ??
    "http://127.0.0.1:8000";

  const sizes: [number, string][] = [
    [100, "100 KB"],
    [200, "200 KB"],
    [300, "300 KB"],
    [500, "500 KB"],
    [1024, "1 MB"],
  ];

  const handleCompress = async () => {
    if (!selectedFile) {
      onError("Please select an image first.");
      return;
    }

    // Tell App that actual processing has started.
    onStart();

    try {
      const formData = new FormData();

      formData.append("file", selectedFile);
      formData.append(
        "target_kb",
        String(selectedTarget)
      );

      const response = await fetch(
        `${API_URL}/api/compress-image`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        let message = "Compression failed.";

        try {
          const data = await response.json();

          if (typeof data.detail === "string") {
            message = data.detail;
          }
        } catch {
          // Keep default message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error(
          "The server returned an empty file."
        );
      }

      const url = URL.createObjectURL(blob);

      onResult(
        url,
        "filevixo-compressed.jpg",
        blob.size
      );
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Something went wrong."
      );
    }
  };

  return (
    <div className="mt-6 border-t border-slate-100 pt-6 sm:mt-8 sm:pt-8">
      {/* Target size heading */}
      <div className="mb-3">
        <p className="text-sm font-bold text-slate-950">
          Target file size
        </p>

        <p className="mt-1 text-xs text-slate-500">
          Choose the maximum size you want for the compressed image.
        </p>
      </div>

      {/* Target size buttons */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {sizes.map(([size, label]) => {
          const isSelected =
            selectedTarget === size;

          return (
            <button
              key={size}
              type="button"
              onClick={() => setSelectedTarget(size)}
              disabled={loading}
              className={`min-h-[46px] rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                isSelected
                  ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/20"
                  : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              } ${
                loading
                  ? "cursor-not-allowed opacity-50"
                  : ""
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Selected target information */}
      <div className="mt-4 flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
        <div>
          <p className="text-xs font-medium text-blue-700">
            Selected target
          </p>

          <p className="mt-0.5 text-sm font-bold text-blue-950">
            {selectedTarget === 1024
              ? "1 MB"
              : `${selectedTarget} KB`}
          </p>
        </div>

        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-4 w-4"
          >
            <path
              d="M5 12.5 9.5 17 19 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Compress button */}
      <button
        type="button"
        onClick={handleCompress}
        disabled={loading || !selectedFile}
        className="mt-4 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:mt-5"
      >
        {loading ? (
          <>
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                strokeWidth="2"
                strokeOpacity="0.3"
              />

              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            Compressing...
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

            Compress to{" "}
            {selectedTarget === 1024
              ? "1 MB"
              : `${selectedTarget} KB`}
          </>
        )}
      </button>

      {/* No automatic processing message here */}
      {!selectedFile && (
        <p className="mt-3 text-center text-xs text-slate-400">
          Upload an image above to start.
        </p>
      )}
    </div>
  );
}