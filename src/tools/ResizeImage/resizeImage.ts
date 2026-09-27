const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";

export type ResizeSizeUnit = "KB";

export interface ResizeImageOptions {
  width: number;
  height: number;
  outputFormat: string;
  maxFileSize: number;
  sizeUnit?: ResizeSizeUnit;
}

export interface ResizeImageResult {
  url: string;
  name: string;
  size: number;
}

const ALLOWED_FORMATS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "tiff",
  "ico",
  "avif",
  "heic",
  "heif",
  "svg",
];

const MIN_OUTPUT_KB = 50;
const ALLOWED_MAX_SIZES_KB = [100, 200];

export async function resizeImage(
  file: File,
  options: ResizeImageOptions,
): Promise<ResizeImageResult> {
  if (!file) {
    throw new Error("No image selected.");
  }

  if (
    !Number.isFinite(options.width) ||
    options.width <= 0
  ) {
    throw new Error("Invalid width.");
  }

  if (
    !Number.isFinite(options.height) ||
    options.height <= 0
  ) {
    throw new Error("Invalid height.");
  }

  if (
    options.width > 10000 ||
    options.height > 10000
  ) {
    throw new Error(
      "Maximum allowed dimensions are 10000 × 10000 pixels.",
    );
  }

  const outputFormat =
    options.outputFormat.toLowerCase();

  if (!ALLOWED_FORMATS.includes(outputFormat)) {
    throw new Error(
      `Unsupported output format: ${outputFormat}`,
    );
  }

  const maxSizeKB = Number(options.maxFileSize);

  if (!ALLOWED_MAX_SIZES_KB.includes(maxSizeKB)) {
    throw new Error(
      "Maximum file size must be either 100 KB or 200 KB.",
    );
  }

  const formData = new FormData();

  formData.append("file", file);
  formData.append(
    "width",
    String(Math.round(options.width)),
  );
  formData.append(
    "height",
    String(Math.round(options.height)),
  );
  formData.append("output_format", outputFormat);
  formData.append("unit", "px");
  formData.append("maintain_aspect", "false");
  formData.append("max_size_kb", String(maxSizeKB));

  const response = await fetch(
    `${API_BASE_URL}/api/resize-image`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    let message = "Image resizing failed.";

    try {
      const data = await response.json();

      if (typeof data?.detail === "string") {
        message = data.detail;
      } else if (typeof data?.message === "string") {
        message = data.message;
      }
    } catch {
      // Keep default error.
    }

    throw new Error(message);
  }

  const blob = await response.blob();

  if (!blob.size) {
    throw new Error(
      "The server returned an empty image.",
    );
  }

  const minBytes = MIN_OUTPUT_KB * 1024;
  const maxBytes = maxSizeKB * 1024;

  if (blob.size < minBytes) {
    throw new Error(
      `The resized image is ${(blob.size / 1024).toFixed(1)} KB, which is below the 50 KB minimum.`,
    );
  }

  if (blob.size > maxBytes) {
    throw new Error(
      `The resized image is ${(blob.size / 1024).toFixed(1)} KB, which is above your ${maxSizeKB} KB limit.`,
    );
  }

  const url = URL.createObjectURL(blob);

  return {
    url,
    name: `filevixo-resized.${outputFormat}`,
    size: blob.size,
  };
}
