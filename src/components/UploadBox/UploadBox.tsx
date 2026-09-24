import React, { useRef, useState } from "react";
import "./UploadBox.css";

interface UploadBoxProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  onRemove: () => void;
  accept?: string;
  maxSizeMB?: number;
}

const IMAGE_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "tif",
  "tiff",
  "svg",
  "heic",
  "heif",
  "avif",
  "ico",
];

const DOCUMENT_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function UploadBox({
  file,
  onFileSelect,
  onRemove,
  accept = "*/*",
  maxSizeMB = 25,
}: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState("");

  const isImageUpload = accept === "image/*";

  const isWordUpload =
    accept.includes(".doc") ||
    accept.includes(".docx") ||
    accept.includes("word");

  const isPdfUpload =
    accept === ".pdf" ||
    accept.includes("application/pdf");

  const getAcceptedExtensions = () => {
    if (isImageUpload) {
      return IMAGE_EXTENSIONS;
    }

    if (isWordUpload) {
      return ["doc", "docx"];
    }

    if (isPdfUpload) {
      return ["pdf"];
    }

    if (accept.includes("pdf")) {
      return DOCUMENT_EXTENSIONS;
    }

    return [];
  };

  const validateFile = (selectedFile: File): string | null => {
    const maxBytes = maxSizeMB * 1024 * 1024;

    if (selectedFile.size > maxBytes) {
      return `File is too large. Maximum size is ${maxSizeMB} MB.`;
    }

    const extension = selectedFile.name
      .split(".")
      .pop()
      ?.toLowerCase();

    const acceptedExtensions = getAcceptedExtensions();

    if (
      acceptedExtensions.length > 0 &&
      extension &&
      !acceptedExtensions.includes(extension)
    ) {
      if (isImageUpload) {
        return "Please select a valid image file.";
      }

      if (isWordUpload) {
        return "Please select a DOC or DOCX file.";
      }

      if (isPdfUpload) {
        return "Please select a PDF file.";
      }

      return "Please select a supported file.";
    }

    return null;
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];

    if (!selectedFile) return;

    const validationError = validateFile(selectedFile);

    if (validationError) {
      setError(validationError);

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      return;
    }

    setError("");
    onFileSelect(selectedFile);

    // Allow selecting the same file again later.
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleClick = () => {
    setError("");
    inputRef.current?.click();
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  };

  const acceptedText = isImageUpload
    ? "JPG, JPEG, PNG, WEBP, GIF, BMP, TIFF, SVG, HEIC, HEIF, AVIF, ICO"
    : isWordUpload
      ? "DOC, DOCX"
      : isPdfUpload
        ? "PDF"
        : accept.includes("pdf")
          ? "PDF, DOC, DOCX"
          : "Supported files";

  return (
    <div className="upload-wrapper">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="upload-input"
      />

      {/* Clean upload area - selected file is shown separately */}
      <div
        className={`upload-box ${error ? "upload-box-error" : ""}`}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label={
          file ? "Choose another file" : "Choose a file"
        }
      >
        <div className="upload-icon">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 16V4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />

            <path
              d="M7 9L12 4L17 9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            <path
              d="M5 20H19"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h3>
          {file ? "Choose another file" : "Choose a file"}
        </h3>

        <p className="upload-supported">
          {acceptedText}
        </p>

        <p className="upload-size">
          Maximum file size: {maxSizeMB} MB
        </p>

        {error && (
          <div className="upload-error-message">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}