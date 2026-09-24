const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";

export interface ConvertImageResult {
  url: string;
  name: string;
  size: number;
}

/*
 * All output formats displayed in Convert Image.
 */
const ALLOWED_OUTPUT_FORMATS = [
  "jpg",
  "png",
  "jpeg",
  "webp",
  "gif",
  "bmp",
  "tiff",
  "svg",
  "heic",
  "heif",
  "avif",
  "ico",
];

/*
 * Supported input image MIME types.
 */
const ALLOWED_INPUT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/tiff",
  "image/svg+xml",
  "image/heic",
  "image/heif",
  "image/avif",
  "image/x-icon",
];

/*
 * Supported input extensions.
 */
const ALLOWED_INPUT_EXTENSIONS = [
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

function isSupportedInputImage(
  file: File,
): boolean {
  const mimeType =
    file.type.toLowerCase();

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase();

  const validMimeType =
    mimeType.startsWith("image/") ||
    ALLOWED_INPUT_TYPES.includes(mimeType);

  const validExtension =
    !!extension &&
    ALLOWED_INPUT_EXTENSIONS.includes(
      extension,
    );

  return (
    validMimeType ||
    validExtension
  );
}

export async function convertImage(
  file: File,
  outputFormat: string,
): Promise<ConvertImageResult> {
  if (!file) {
    throw new Error(
      "No image selected.",
    );
  }

  const format =
    outputFormat.toLowerCase();

  if (
    !ALLOWED_OUTPUT_FORMATS.includes(
      format,
    )
  ) {
    throw new Error(
      "Unsupported output format. Please select a supported image format.",
    );
  }

  if (!isSupportedInputImage(file)) {
    throw new Error(
      "Please select a supported image file.",
    );
  }

  const formData =
    new FormData();

  formData.append(
    "file",
    file,
  );

  formData.append(
    "output_format",
    format,
  );

  const response =
    await fetch(
      `${API_BASE_URL}/api/convert-image`,
      {
        method: "POST",
        body: formData,
      },
    );

  if (!response.ok) {
    let message =
      "Image conversion failed.";

    try {
      const data =
        await response.json();

      if (
        typeof data?.detail ===
        "string"
      ) {
        message =
          data.detail;
      } else if (
        typeof data?.message ===
        "string"
      ) {
        message =
          data.message;
      }
    } catch {
      // Keep default error.
    }

    throw new Error(message);
  }

  const blob =
    await response.blob();

  if (!blob.size) {
    throw new Error(
      "The server returned an empty converted image.",
    );
  }

  const url =
    URL.createObjectURL(blob);

  return {
    url,
    name: `filevixo-converted.${format}`,
    size: blob.size,
  };
}

export default convertImage;