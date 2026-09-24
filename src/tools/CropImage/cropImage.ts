export type CropOutputFormat =
  | "jpg"
  | "jpeg"
  | "png"
  | "webp";

export interface CropCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Create a cropped image from the original image.
 *
 * The crop is exported using the original pixel resolution.
 */
export function createCroppedBlob(
  image: HTMLImageElement,
  crop: CropCoordinates,
  outputFormat: CropOutputFormat,
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (
      crop.width <= 0 ||
      crop.height <= 0
    ) {
      reject(
        new Error("Please select a valid crop area."),
      );
      return;
    }

    const scaleX =
      image.naturalWidth / image.width;

    const scaleY =
      image.naturalHeight / image.height;

    const sourceX = Math.round(
      crop.x * scaleX,
    );

    const sourceY = Math.round(
      crop.y * scaleY,
    );

    const sourceWidth = Math.round(
      crop.width * scaleX,
    );

    const sourceHeight = Math.round(
      crop.height * scaleY,
    );

    const canvas =
      document.createElement("canvas");

    canvas.width = sourceWidth;
    canvas.height = sourceHeight;

    const context =
      canvas.getContext("2d");

    if (!context) {
      reject(
        new Error(
          "Your browser does not support canvas.",
        ),
      );
      return;
    }

    /*
     * JPG/JPEG does not support transparency.
     * Use a white background.
     */
    if (
      outputFormat === "jpg" ||
      outputFormat === "jpeg"
    ) {
      context.fillStyle = "#ffffff";

      context.fillRect(
        0,
        0,
        sourceWidth,
        sourceHeight,
      );
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      sourceWidth,
      sourceHeight,
    );

    let mimeType = "image/jpeg";

    if (outputFormat === "png") {
      mimeType = "image/png";
    }

    if (outputFormat === "webp") {
      mimeType = "image/webp";
    }

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error(
              "Failed to create the cropped image.",
            ),
          );
          return;
        }

        resolve(blob);
      },
      mimeType,
      outputFormat === "png"
        ? undefined
        : quality,
    );
  });
}

/**
 * Crop and try to keep the result below
 * the requested maximum file size.
 *
 * Important:
 * PNG does not support quality-based compression,
 * so its dimensions are never changed.
 */
export async function createCroppedBlobWithMaxSize(
  image: HTMLImageElement,
  crop: CropCoordinates,
  outputFormat: CropOutputFormat,
  maxSizeKB?: number,
): Promise<Blob> {
  const firstBlob =
    await createCroppedBlob(
      image,
      crop,
      outputFormat,
      0.92,
    );

  if (
    !maxSizeKB ||
    maxSizeKB <= 0
  ) {
    return firstBlob;
  }

  const maxBytes =
    maxSizeKB * 1024;

  if (firstBlob.size <= maxBytes) {
    return firstBlob;
  }

  /*
   * PNG cannot be reduced through JPEG-style
   * quality settings.
   */
  if (outputFormat === "png") {
    throw new Error(
      `The cropped PNG is ${formatFileSize(
        firstBlob.size,
      )}, which is larger than the ${maxSizeKB} KB limit.`,
    );
  }

  let low = 0.1;
  let high = 0.92;

  let bestBlob: Blob | null = null;

  /*
   * Binary-search the quality level.
   */
  for (let i = 0; i < 9; i++) {
    const quality =
      (low + high) / 2;

    const blob =
      await createCroppedBlob(
        image,
        crop,
        outputFormat,
        quality,
      );

    if (blob.size <= maxBytes) {
      bestBlob = blob;
      low = quality;
    } else {
      high = quality;
    }
  }

  if (bestBlob) {
    return bestBlob;
  }

  /*
   * Try minimum quality one final time.
   */
  const minimumBlob =
    await createCroppedBlob(
      image,
      crop,
      outputFormat,
      0.1,
    );

  if (minimumBlob.size > maxBytes) {
    throw new Error(
      `The cropped image cannot be reduced below ${formatFileSize(
        minimumBlob.size,
      )} without changing its dimensions.`,
    );
  }

  return minimumBlob;
}

/**
 * Format bytes for display.
 */
export function formatFileSize(
  bytes: number,
): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(2)} MB`;
}

/**
 * Determine output format from the uploaded image.
 */
export function getCropOutputFormat(
  file: File,
): CropOutputFormat {
  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase();

  if (extension === "png") {
    return "png";
  }

  if (extension === "webp") {
    return "webp";
  }

  if (extension === "jpeg") {
    return "jpeg";
  }

  return "jpg";
}

/**
 * Create the downloaded filename.
 */
export function createCropFileName(
  originalName: string,
  outputFormat: CropOutputFormat,
): string {
  const baseName =
    originalName.replace(
      /\.[^/.]+$/,
      "",
    );

  return `${baseName}-cropped.${outputFormat}`;
}

/**
 * Download a Blob.
 */
export function downloadBlob(
  blob: Blob,
  fileName: string,
): void {
  const url =
    URL.createObjectURL(blob);

  const link =
    document.createElement("a");

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);

  link.click();

  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}