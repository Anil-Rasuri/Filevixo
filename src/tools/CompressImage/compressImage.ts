export interface CompressImageResult {
  url: string;
  name: string;
  size: number;
}

/**
 * Supported image MIME types.
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

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          "This image format cannot be processed by your browser.",
        ),
      );
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error(
              "The browser could not create the compressed image.",
            ),
          );

          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Compress an image completely inside the browser.
 *
 * No image is uploaded to the Filevixo backend.
 *
 * The browser performs JPEG encoding locally and uses
 * a binary-search quality strategy to get close to the
 * requested maximum file size with as few encodes as possible.
 */
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

  if (!isSupportedImage(file)) {
    throw new Error(
      "Please select an image file such as JPG, JPEG, PNG, WEBP, GIF, BMP, TIFF, SVG, HEIC, HEIF, or AVIF.",
    );
  }

  const targetBytes = targetSizeKb * 1024;

  /*
   * If the original file is already smaller than the target,
   * we still create a JPEG because the compressor promises
   * a compressed JPG output.
   */

  const image = await loadImage(file);

  try {
    const originalWidth = image.naturalWidth;
    const originalHeight = image.naturalHeight;

    if (!originalWidth || !originalHeight) {
      throw new Error("Could not read the image dimensions.");
    }

    /*
     * Keep the original dimensions initially.
     *
     * If quality 10 is still too large, we progressively
     * reduce dimensions so that very large images can still
     * reach small targets such as 100 KB.
     */
    let width = originalWidth;
    let height = originalHeight;

    const canvas = document.createElement("canvas");

    /*
     * Limit extremely large images to a practical browser
     * working size. This also reduces memory usage and
     * improves processing speed.
     */
    const MAX_DIMENSION = 6000;

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale =
        MAX_DIMENSION / Math.max(width, height);

      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Your browser could not create a canvas for compression.",
      );
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    /*
     * Draw white background so transparent PNG/WebP images
     * become valid JPEG images instead of getting black/
     * transparent rendering.
     */
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    context.drawImage(
      image,
      0,
      0,
      width,
      height,
    );

    /*
     * Fast binary search for the highest quality that fits
     * inside the requested target.
     *
     * Maximum 7 JPEG encodes per dimension level.
     */
    const findBestQuality = async (
      currentCanvas: HTMLCanvasElement,
      maximumBytes: number,
    ): Promise<Blob> => {
      let low = 0.10;
      let high = 0.95;

      let bestBlob: Blob | null = null;

      /*
       * Try a high quality first. This often succeeds for
       * images whose target size is relatively generous.
       */
      const highQualityBlob = await canvasToBlob(
        currentCanvas,
        high,
      );

      if (highQualityBlob.size <= maximumBytes) {
        return highQualityBlob;
      }

      /*
       * Very low quality fallback.
       */
      const lowQualityBlob = await canvasToBlob(
        currentCanvas,
        low,
      );

      if (lowQualityBlob.size > maximumBytes) {
        return lowQualityBlob;
      }

      bestBlob = lowQualityBlob;

      /*
       * Binary search.
       *
       * Seven iterations is enough for practical JPEG
       * quality selection while keeping processing fast.
       */
      for (let i = 0; i < 7; i++) {
        const quality = (low + high) / 2;

        const blob = await canvasToBlob(
          currentCanvas,
          quality,
        );

        if (blob.size <= maximumBytes) {
          bestBlob = blob;
          low = quality;
        } else {
          high = quality;
        }
      }

      return bestBlob;
    };

    /*
     * First attempt: preserve dimensions.
     */
    let resultBlob = await findBestQuality(
      canvas,
      targetBytes,
    );

    /*
     * If even very low JPEG quality is too large,
     * reduce dimensions and try again.
     *
     * This is important for targets such as 100 KB.
     */
    let attempts = 0;

    while (
      resultBlob.size > targetBytes &&
      attempts < 5
    ) {
      attempts++;

      const scale = 0.82;

      width = Math.max(
        320,
        Math.round(width * scale),
      );

      height = Math.max(
        320,
        Math.round(height * scale),
      );

      canvas.width = width;
      canvas.height = height;

      const resizedContext =
        canvas.getContext("2d");

      if (!resizedContext) {
        throw new Error(
          "Your browser could not create a canvas for compression.",
        );
      }

      resizedContext.imageSmoothingEnabled = true;
      resizedContext.imageSmoothingQuality = "high";

      resizedContext.fillStyle = "#ffffff";

      resizedContext.fillRect(
        0,
        0,
        width,
        height,
      );

      resizedContext.drawImage(
        image,
        0,
        0,
        width,
        height,
      );

      resultBlob = await findBestQuality(
        canvas,
        targetBytes,
      );
    }

    /*
     * Final safety check.
     */
    if (resultBlob.size > targetBytes) {
      throw new Error(
        `Could not reduce the image to ${targetSizeKb} KB. Try a larger target size.`,
      );
    }

    if (!resultBlob.size) {
      throw new Error(
        "The browser returned an empty compressed image.",
      );
    }

    const url = URL.createObjectURL(resultBlob);

    return {
      url,
      name: "filevixo-compressed.jpg",
      size: resultBlob.size,
    };
  } finally {
    /*
     * Release the decoded image from memory.
     */
    image.src = "";
  }
}

export default compressImage;