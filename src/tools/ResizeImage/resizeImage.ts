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

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";

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

const BROWSER_FORMATS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
];

const MIN_OUTPUT_KB = 50;
const ALLOWED_MAX_SIZES_KB = [100, 200];
const MAX_DIMENSION = 10000;

function getMimeType(format: string): string {
  switch (format) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";

    case "png":
      return "image/png";

    case "webp":
      return "image/webp";

    default:
      return "image/jpeg";
  }
}

function loadImage(
  file: File,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    const objectUrl =
      URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);

      reject(
        new Error(
          "This image could not be processed by your browser.",
        ),
      );
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(
            new Error(
              "The browser could not create the resized image.",
            ),
          );

          return;
        }

        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

/*
 * Find the highest possible quality that stays
 * within the selected maximum file size.
 */
async function findBestQuality(
  canvas: HTMLCanvasElement,
  mimeType: string,
  maximumBytes: number,
): Promise<Blob> {
  if (mimeType === "image/png") {
    return canvasToBlob(
      canvas,
      mimeType,
    );
  }

  let low = 0.05;
  let high = 0.98;

  const highBlob =
    await canvasToBlob(
      canvas,
      mimeType,
      high,
    );

  if (highBlob.size <= maximumBytes) {
    return highBlob;
  }

  const lowBlob =
    await canvasToBlob(
      canvas,
      mimeType,
      low,
    );

  if (lowBlob.size > maximumBytes) {
    return lowBlob;
  }

  let bestBlob = lowBlob;

  for (let i = 0; i < 8; i++) {
    const quality =
      (low + high) / 2;

    const blob =
      await canvasToBlob(
        canvas,
        mimeType,
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
}

/*
 * Try to produce an output above the 50 KB minimum.
 *
 * We increase JPEG/WebP quality first.
 * If the image is still too small, we slightly
 * increase the canvas dimensions while staying
 * inside the user's requested dimensions.
 */
async function findMinimumSizeBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  minimumBytes: number,
  maximumBytes: number,
): Promise<Blob> {
  if (mimeType === "image/png") {
    const pngBlob =
      await canvasToBlob(
        canvas,
        mimeType,
      );

    return pngBlob;
  }

  let low = 0.05;
  let high = 1;

  let bestAboveMinimum: Blob | null =
    null;

  /*
   * First find a quality that gives us
   * something above 50 KB.
   */
  for (let i = 0; i < 10; i++) {
    const quality =
      (low + high) / 2;

    const blob =
      await canvasToBlob(
        canvas,
        mimeType,
        quality,
      );

    if (
      blob.size >= minimumBytes &&
      blob.size <= maximumBytes
    ) {
      bestAboveMinimum = blob;
      low = quality;
    } else if (
      blob.size < minimumBytes
    ) {
      low = quality;
    } else {
      high = quality;
    }
  }

  /*
   * If quality adjustment found a valid result,
   * use the largest valid one.
   */
  if (bestAboveMinimum) {
    return bestAboveMinimum;
  }

  /*
   * Check maximum quality directly.
   */
  const maximumQualityBlob =
    await canvasToBlob(
      canvas,
      mimeType,
      1,
    );

  if (
    maximumQualityBlob.size >=
      minimumBytes &&
    maximumQualityBlob.size <=
      maximumBytes
  ) {
    return maximumQualityBlob;
  }

  return maximumQualityBlob;
}

async function resizeInBrowser(
  file: File,
  options: ResizeImageOptions,
): Promise<ResizeImageResult> {
  const outputFormat =
    options.outputFormat.toLowerCase();

  const mimeType =
    getMimeType(outputFormat);

  const image =
    await loadImage(file);

  try {
    let width =
      Math.round(options.width);

    let height =
      Math.round(options.height);

    const minimumBytes =
      MIN_OUTPUT_KB * 1024;

    const maximumBytes =
      options.maxFileSize * 1024;

    const canvas =
      document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const drawImage = () => {
      const context =
        canvas.getContext("2d");

      if (!context) {
        throw new Error(
          "Your browser could not create a canvas.",
        );
      }

      context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height,
      );

      context.imageSmoothingEnabled =
        true;

      context.imageSmoothingQuality =
        "high";

      if (
        outputFormat === "jpg" ||
        outputFormat === "jpeg"
      ) {
        context.fillStyle =
          "#ffffff";

        context.fillRect(
          0,
          0,
          canvas.width,
          canvas.height,
        );
      }

      context.drawImage(
        image,
        0,
        0,
        canvas.width,
        canvas.height,
      );
    };

    drawImage();

    /*
     * Start with the highest quality.
     *
     * This is important because a small image
     * can naturally be less than 50 KB.
     */
    let resultBlob =
      await canvasToBlob(
        canvas,
        mimeType,
        1,
      );

    /*
     * If the result is above the maximum,
     * reduce JPEG/WebP quality.
     */
    if (
      resultBlob.size >
      maximumBytes
    ) {
      resultBlob =
        await findBestQuality(
          canvas,
          mimeType,
          maximumBytes,
        );
    }

    /*
     * If the result is below 50 KB, try to
     * increase quality first.
     */
    if (
      resultBlob.size <
      minimumBytes &&
      mimeType !== "image/png"
    ) {
      resultBlob =
        await findMinimumSizeBlob(
          canvas,
          mimeType,
          minimumBytes,
          maximumBytes,
        );
    }

    /*
     * If quality cannot reach 50 KB,
     * slightly increase the actual output
     * dimensions while staying reasonable.
     *
     * This is mainly for very small images.
     */
    let attempts = 0;

    while (
      resultBlob.size <
        minimumBytes &&
      attempts < 5 &&
      mimeType !== "image/png"
    ) {
      attempts++;

      width = Math.min(
        MAX_DIMENSION,
        Math.round(width * 1.15),
      );

      height = Math.min(
        MAX_DIMENSION,
        Math.round(height * 1.15),
      );

      canvas.width = width;
      canvas.height = height;

      drawImage();

      resultBlob =
        await findMinimumSizeBlob(
          canvas,
          mimeType,
          minimumBytes,
          maximumBytes,
        );

      /*
       * If increasing dimensions pushed the
       * image above the maximum, go back to
       * quality-based compression.
       */
      if (
        resultBlob.size >
        maximumBytes
      ) {
        resultBlob =
          await findBestQuality(
            canvas,
            mimeType,
            maximumBytes,
          );
      }
    }

    /*
     * Final validation.
     */
    if (
      resultBlob.size <=
      minimumBytes
    ) {
      throw new Error(
        `The resized image is ${(resultBlob.size / 1024).toFixed(1)} KB. The output must be above 50 KB. Try increasing the dimensions.`,
      );
    }

    if (
      resultBlob.size >
      maximumBytes
    ) {
      throw new Error(
        `The resized image is ${(resultBlob.size / 1024).toFixed(1)} KB, which is above your ${options.maxFileSize} KB limit.`,
      );
    }

    if (!resultBlob.size) {
      throw new Error(
        "The browser returned an empty image.",
      );
    }

    const url =
      URL.createObjectURL(
        resultBlob,
      );

    return {
      url,
      name: `filevixo-resized.${outputFormat}`,
      size: resultBlob.size,
    };
  } finally {
    image.src = "";
  }
}

async function resizeOnServer(
  file: File,
  options: ResizeImageOptions,
): Promise<ResizeImageResult> {
  const outputFormat =
    options.outputFormat.toLowerCase();

  const maxSizeKB =
    Number(options.maxFileSize);

  const formData =
    new FormData();

  formData.append(
    "file",
    file,
  );

  formData.append(
    "width",
    String(
      Math.round(options.width),
    ),
  );

  formData.append(
    "height",
    String(
      Math.round(options.height),
    ),
  );

  formData.append(
    "output_format",
    outputFormat,
  );

  formData.append(
    "unit",
    "px",
  );

  formData.append(
    "maintain_aspect",
    "false",
  );

  formData.append(
    "max_size_kb",
    String(maxSizeKB),
  );

  const response =
    await fetch(
      `${API_BASE_URL}/api/resize-image`,
      {
        method: "POST",
        body: formData,
      },
    );

  if (!response.ok) {
    let message =
      "Image resizing failed.";

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
      "The server returned an empty image.",
    );
  }

  const minimumBytes =
    MIN_OUTPUT_KB * 1024;

  const maximumBytes =
    maxSizeKB * 1024;

  if (
    blob.size <=
    minimumBytes
  ) {
    throw new Error(
      `The resized image is ${(blob.size / 1024).toFixed(1)} KB. The output must be above 50 KB.`,
    );
  }

  if (
    blob.size >
    maximumBytes
  ) {
    throw new Error(
      `The resized image is ${(blob.size / 1024).toFixed(1)} KB, which is above your ${maxSizeKB} KB limit.`,
    );
  }

  const url =
    URL.createObjectURL(blob);

  return {
    url,
    name: `filevixo-resized.${outputFormat}`,
    size: blob.size,
  };
}

export async function resizeImage(
  file: File,
  options: ResizeImageOptions,
): Promise<ResizeImageResult> {
  if (!file) {
    throw new Error(
      "No image selected.",
    );
  }

  if (
    !Number.isFinite(
      options.width,
    ) ||
    options.width <= 0
  ) {
    throw new Error(
      "Invalid width.",
    );
  }

  if (
    !Number.isFinite(
      options.height,
    ) ||
    options.height <= 0
  ) {
    throw new Error(
      "Invalid height.",
    );
  }

  if (
    options.width >
      MAX_DIMENSION ||
    options.height >
      MAX_DIMENSION
  ) {
    throw new Error(
      "Maximum allowed dimensions are 10000 × 10000 pixels.",
    );
  }

  const outputFormat =
    options.outputFormat.toLowerCase();

  if (
    !ALLOWED_FORMATS.includes(
      outputFormat,
    )
  ) {
    throw new Error(
      `Unsupported output format: ${outputFormat}`,
    );
  }

  const maxSizeKB =
    Number(options.maxFileSize);

  if (
    !ALLOWED_MAX_SIZES_KB.includes(
      maxSizeKB,
    )
  ) {
    throw new Error(
      "Maximum file size must be either 100 KB or 200 KB.",
    );
  }

  /*
   * Fast browser processing for the formats
   * browsers can reliably encode.
   */
  if (
    BROWSER_FORMATS.includes(
      outputFormat,
    )
  ) {
    return resizeInBrowser(
      file,
      options,
    );
  }

  /*
   * Other formats continue using the backend.
   */
  return resizeOnServer(
    file,
    options,
  );
}

export default resizeImage;