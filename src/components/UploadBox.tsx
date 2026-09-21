import type { ChangeEvent, DragEvent } from "react";

interface UploadBoxProps {
  selectedFile: File | null;
  onFileSelect: (file: File | undefined) => void;
  onRemove: () => void;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadBox({
  selectedFile,
  onFileSelect,
  onRemove,
}: UploadBoxProps) {
  const validateFile = (file: File) => {
    const isAllowedType = ALLOWED_TYPES.includes(file.type);

    if (!isAllowedType) {
      alert("Please select a JPG, PNG, or WebP image.");
      return false;
    }

    if (file.size === 0) {
      alert("The selected file is empty.");
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert("File size must be 25 MB or less.");
      return false;
    }

    return true;
  };

  const handleFile = (file: File | undefined) => {
    if (!file) {
      return;
    }

    if (!validateFile(file)) {
      return;
    }

    onFileSelect(file);
  };

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    handleFile(file);

    // Clear the input so the same file can be selected again.
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const file = event.dataTransfer.files?.[0];

    handleFile(file);
  };

  const handleDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div className="w-full">
      {!selectedFile ? (
        <label
          htmlFor="filevixo-image-upload"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="flex min-h-[170px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center transition hover:border-blue-400 hover:bg-blue-50/30 sm:min-h-[210px] sm:rounded-2xl sm:px-6 sm:py-8"
        >
          <input
            id="filevixo-image-upload"
            name="file"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            onChange={handleInputChange}
            className="hidden"
          />

          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-600 sm:h-12 sm:w-12">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path
                d="M12 16V5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />

              <path
                d="M8 9l4-4 4 4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              <path
                d="M5 14v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h3 className="mt-3 text-sm font-bold text-slate-900 sm:text-base">
            Click to upload or drag and drop
          </h3>

          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            JPG, PNG or WebP • Maximum 25 MB
          </p>
        </label>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-2xl sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-5 w-5"
                  aria-hidden="true"
                >
                  <path
                    d="M6 3h9l3 3v15H6z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />

                  <path
                    d="M14 3v4h4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">
                  Selected file
                </p>

                <p
                  className="mt-0.5 truncate text-sm font-bold text-slate-900"
                  title={selectedFile.name}
                >
                  {selectedFile.name}
                </p>

                <p className="mt-0.5 text-xs text-slate-500">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onRemove}
              className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}