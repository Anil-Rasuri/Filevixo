import { useState } from "react";

interface ConvertImageProps {
  selectedFile: File | null;
  loading: boolean;
  outputFormat: string;
  setOutputFormat: (format: string) => void;
  onResult: (
    url: string,
    name: string,
    size: number
  ) => void;
  onError: (message: string) => void;
}

export default function ConvertImage({
  selectedFile,
  loading,
  outputFormat,
  setOutputFormat,
  onResult,
  onError,
}: ConvertImageProps) {
  const [isConverting, setIsConverting] = useState(false);

  const handleConvert = async () => {
    console.log("CONVERT BUTTON CLICKED");

    if (!selectedFile) {
      onError("Please select an image first.");
      return;
    }

    console.log("Selected file:", selectedFile.name);
    console.log("Converting to:", outputFormat);

    setIsConverting(true);

    try {
      const formData = new FormData();

      formData.append("file", selectedFile);
      formData.append("output_format", outputFormat);

      console.log("Sending request to backend...");

      const response = await fetch(
        "http://127.0.0.1:8000/api/convert-image",
        {
          method: "POST",
          body: formData,
        }
      );

      console.log("Backend response:", response.status);

      if (!response.ok) {
        let message = "Conversion failed.";

        try {
          const data = await response.json();

          if (data.detail) {
            message = data.detail;
          }
        } catch {
          // Keep default message
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      console.log("Conversion successful. Size:", blob.size);

      if (!blob.size) {
        throw new Error("The server returned an empty file.");
      }

      const url = URL.createObjectURL(blob);

      onResult(
        url,
        `filevixo-converted.${outputFormat}`,
        blob.size
      );
    } catch (error) {
      console.error("Conversion error:", error);

      onError(
        error instanceof Error
          ? error.message
          : "Something went wrong during conversion."
      );
    } finally {
      setIsConverting(false);
    }
  };

  const formats = [
    ["jpg", "JPG"],
    ["png", "PNG"],
    ["webp", "WEBP"],
  ];

  const currentlyConverting = isConverting || loading;

  const selectedFormatLabel =
    outputFormat === "jpg"
      ? "JPG"
      : outputFormat === "png"
      ? "PNG"
      : "WEBP";

  return (
    <div className="mt-5 sm:mt-8">
      {/* Convert To */}
      <label className="mb-3 block text-sm font-semibold text-slate-800">
        Convert to
      </label>

      {/* Format Buttons */}
      <div className="grid grid-cols-3 gap-3">
        {formats.map(([value, label]) => {
          const isSelected = outputFormat === value;

          return (
            <button
              key={value}
              type="button"
              onClick={() => {
                if (!currentlyConverting) {
                  setOutputFormat(value);
                }
              }}
              disabled={currentlyConverting}
              className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                isSelected
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Convert Button */}
      <button
        type="button"
        onClick={handleConvert}
        disabled={currentlyConverting}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-blue-500"
      >
        {currentlyConverting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />

            <span>
              Converting to {selectedFormatLabel}...
            </span>
          </>
        ) : (
          "Convert Image"
        )}
      </button>

      {/* Processing Message */}
      {currentlyConverting && (
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-center">
          <p className="text-sm font-medium text-blue-700">
            Converting your image to {selectedFormatLabel}...
          </p>
          <p className="mt-1 text-xs text-blue-500">
            Please wait while Filevixo processes your image.
          </p>
        </div>
      )}
    </div>
  );
}