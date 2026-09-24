const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface CompressImageResult {
  url: string;
  name: string;
  size: number;
}

/**
 * Supported image MIME types.
 *
 * The browser may report slightly different MIME types
 * depending on the image and operating system.
 */
const ALLOWED_IMAGE_TYPES = [
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

/**
 * Supported image extensions.
 *
 * This is also used as a fallback because some browsers
 * may return an empty or unreliable file.type.
 */
const ALLOWED_IMAGE_EXTENSIONS = [
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

function isSupportedImage(file: File): boolean {
  const mimeType = file.type.toLowerCase();

  const extension = file.name
    .split(".")
    .pop()
    ?.toLowerCase();

  const validMimeType =
    mimeType.length > 0 &&
    ALLOWED_IMAGE_TYPES.includes(mimeType);

  const validExtension =
    !!extension &&
    ALLOWED_IMAGE_EXTENSIONS.includes(extension);

  return validMimeType || validExtension;
}

export async function compressImage(
  file: File,
  targetSizeKb: number,
): Promise<CompressImageResult> {
  if (!file) {
    throw new Error("No image selected.");
  }

  if (!targetSizeKb || targetSizeKb <= 0) {
    throw new Error("Please select a valid target size.");
  }

  /*
   * Image-only validation.
   *
   * Documents such as PDF, DOC and DOCX are rejected.
   */
  if (!isSupportedImage(file)) {
    throw new Error(
      "Please select an image file such as JPG, JPEG, PNG, WEBP, GIF, BMP, TIFF, SVG, HEIC, HEIF, or AVIF.",
    );
  }

  const formData = new FormData();

  formData.append("file", file);

  formData.append(
    "target_size_kb",
    String(targetSizeKb),
  );

  const response = await fetch(
    `${API_BASE_URL}/api/compress-image`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    let message = "Image compression failed.";

    try {
      const data = await response.json();

      if (typeof data?.detail === "string") {
        message = data.detail;
      } else if (typeof data?.message === "string") {
        message = data.message;
      }
    } catch {
      // Keep default error message.
    }

    throw new Error(message);
  }

  const blob = await response.blob();

  if (!blob.size) {
    throw new Error(
      "The server returned an empty compressed image.",
    );
  }

  /*
   * Final client-side safety check.
   *
   * The backend should guarantee the target size,
   * but we also verify the returned file here.
   */
  const maximumBytes = targetSizeKb * 1024;

  if (blob.size > maximumBytes) {
    throw new Error(
      `The server returned a file larger than the selected target size. ` +
        `Target: ${targetSizeKb} KB, received: ` +
        `${(blob.size / 1024).toFixed(1)} KB.`,
    );
  }

  const url = URL.createObjectURL(blob);

  return {
    url,
    name: "filevixo-compressed.jpg",
    size: blob.size,
  };
}

export default compressImage;