import { useEffect, useRef, useState } from "react";

interface RemoveBackgroundProps {
  selectedFile: File | null;
  loading: boolean;
  onFileSelect: (file: File | undefined) => void;
  onStart: () => void;
  onError: (message: string) => void;
}

export default function RemoveBackground({
  selectedFile,
  loading,
  onFileSelect,
  onStart,
  onError,
}: RemoveBackgroundProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string>("");
  const [dragActive, setDragActive] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);

  const MAX_FILE_SIZE = 25 * 1024 * 1024;

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      setResultUrl("");
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  useEffect(() => {
    return () => {
      if (resultUrl) {
        URL.revokeObjectURL(resultUrl);
      }
    };
  }, [resultUrl]);

  const validateFile = (file: File) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      onError("Please select a JPG, PNG, or WebP image.");
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      onError("Maximum file size is 25 MB.");
      return false;
    }

    return true;
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;

    if (!validateFile(file)) {
      return;
    }

    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl("");
    }

    setSliderPosition(50);
    onError("");
    onFileSelect(file);
  };

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    handleFile(file);

    event.target.value = "";
  };

  const handleDrop = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    setDragActive(false);

    const file = event.dataTransfer.files?.[0];

    handleFile(file);
  };

  const handleRemoveBackground = async () => {
    if (!selectedFile || loading) return;

    onError("");
    onStart();

    try {
      const formData = new FormData();

      formData.append("file", selectedFile);

      const response = await fetch(
        "http://127.0.0.1:8000/api/remove-background",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        let message = "Background removal failed.";

        try {
          const data = await response.json();

          if (data?.detail) {
            message = data.detail;
          }
        } catch {
          // Ignore JSON parsing errors.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("The server returned an empty image.");
      }

      const url = URL.createObjectURL(blob);

      if (resultUrl) {
        URL.revokeObjectURL(resultUrl);
      }

      setResultUrl(url);
      setSliderPosition(50);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while removing the background.";

      onError(message);
    } finally {
      // App controls the loading state.
      // The parent should set loading to false when the request completes.
    }
  };

  const handleDownload = () => {
    if (!resultUrl || !selectedFile) return;

    const originalName = selectedFile.name.replace(
      /\.[^/.]+$/,
      ""
    );

    const link = document.createElement("a");

    link.href = resultUrl;
    link.download = `${originalName}-no-background.png`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
    }

    setResultUrl("");
    setSliderPosition(50);
    onError("");
    onFileSelect(undefined);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mb-3 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
          AI Image Tool
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Remove Background
        </h1>

        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
          Automatically remove the background from your image and
          download a clean transparent PNG.
        </p>
      </div>

      {/* Initial Upload */}
      {!selectedFile && (
        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragActive(false);
          }}
          onDrop={handleDrop}
          className={`rounded-3xl border-2 border-dashed bg-white p-5 shadow-sm transition sm:p-10 ${
            dragActive
              ? "border-emerald-500 bg-emerald-50/50"
              : "border-slate-300 hover:border-emerald-400"
          }`}
        >
          <div className="flex min-h-[300px] flex-col items-center justify-center text-center sm:min-h-[360px]">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-8 w-8"
              >
                <path
                  d="M12 16V4m0 0L7 9m5-5 5 5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                <path
                  d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-slate-950">
              Select an image
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              or drop an image here
            </p>

            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-600 px-7 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.98]"
            >
              Select Image
            </button>

            <p className="mt-4 text-xs text-slate-400">
              JPG, PNG or WebP • Maximum 25 MB
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}

      {/* Uploaded Image */}
      {selectedFile && !resultUrl && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-950">
                  {selectedFile.name}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>

              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
              >
                Change image
              </button>
            </div>
          </div>

          <div className="bg-slate-50 p-4 sm:p-8">
            <div className="mx-auto max-h-[520px] max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="Selected image"
                  className="mx-auto max-h-[520px] w-full object-contain"
                />
              )}
            </div>
          </div>

          <div className="border-t border-slate-200 p-5 sm:p-6">
            <button
              type="button"
              onClick={handleRemoveBackground}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Removing background...
                </>
              ) : (
                <>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                  >
                    <path
                      d="M4 7h16M7 4v16M17 4v16M4 17h16"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>

                  Remove Background
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {selectedFile && resultUrl && (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-slate-950">
                  Background removed
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Drag the slider to compare the original and edited image.
                </p>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="self-start rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 sm:self-auto"
              >
                Start over
              </button>
            </div>
          </div>

          {/* Comparison */}
          <div className="bg-slate-100 p-4 sm:p-8">
            <div
              className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-300 shadow-sm select-none"
              style={{
                backgroundColor: "#ffffff",
                backgroundImage:
                  "linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)",
                backgroundPosition:
                  "0 0, 0 10px, 10px -10px, -10px 0px",
                backgroundSize: "20px 20px",
              }}
            >
              {/* Result */}
              <img
                src={resultUrl}
                alt="Background removed result"
                className="block max-h-[600px] w-full object-contain"
              />

              {/* Original overlay */}
              <div
                className="absolute inset-y-0 left-0 overflow-hidden"
                style={{
                  width: `${sliderPosition}%`,
                }}
              >
                <img
                  src={previewUrl}
                  alt="Original image"
                  className="block h-full w-full max-w-none object-contain"
                  style={{
                    width: "100%",
                  }}
                />
              </div>

              {/* Labels */}
              <div className="pointer-events-none absolute left-4 top-4 rounded-lg bg-black/70 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
                Original
              </div>

              <div className="pointer-events-none absolute right-4 top-4 rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm">
                No background
              </div>

              {/* Slider */}
              <div
                className="pointer-events-none absolute inset-y-0"
                style={{
                  left: `${sliderPosition}%`,
                  transform: "translateX(-50%)",
                }}
              >
                <div className="h-full w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.45)]" />

                <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white shadow-lg">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-5 w-5"
                  >
                    <path
                      d="M8 5 3 12l5 7M16 5l5 7-5 7"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="100"
                value={sliderPosition}
                onChange={(event) =>
                  setSliderPosition(Number(event.target.value))
                }
                aria-label="Compare original and background removed image"
                className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
              />
            </div>
          </div>

          {/* Result actions */}
          <div className="border-t border-slate-200 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={handleDownload}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                >
                  <path
                    d="M12 4v11m0 0 4-4m-4 4-4-4M5 20h14"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>

                Download PNG
              </button>

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex items-center justify-center rounded-xl border border-slate-300 px-6 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Use another image
              </button>
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleInputChange}
              className="hidden"
            />
          </div>
        </div>
      )}
    </div>
  );
}