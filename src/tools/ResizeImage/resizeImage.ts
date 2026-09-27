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
 * Add harmless trailing bytes when an encoded image
 * is smaller than the required minimum.
 *
 * This does NOT change:
 * - width
 * - height
 * - image pixels
 * - image quality
 *
 * It only makes the returned file larger than 50 KB.
 */
function padBlobToMinimumSize(
  blob: Blob,
  minimumBytes: number,
): Blob {
  if (blob.size > minimumBytes) {
    return blob;
  }

  const paddingSize =
    minimumBytes -
    blob.size +
    1024;

  const padding =
    new Uint8Array(paddingSize);

  return new Blob(
    [blob, padding],
    {
      type: blob.type,
    },
  );
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
 * Try to produce an output above the 50 KB minimum
 * by changing quality only.
 *
 * Dimensions are NOT changed here.
 */
async function findMinimumSizeBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  minimumBytes: number,
  maximumBytes: number,
): Promise<Blob> {
  if (mimeType === "image/png") {
    return canvasToBlob(
      canvas,
      mimeType,
    );
  }

  let low = 0.05;
  let high = 1;

  let bestAboveMinimum: Blob | null =
    null;

  for (let i = 0; i < 8; i++) {
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

  if (bestAboveMinimum) {
    return bestAboveMinimum;
  }

  const maximumQualityBlob =
    await canvasToBlob(
      canvas,
      mimeType,
      1,
    );

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
    const width =
      Math.round(options.width);

    const height =
      Math.round(options.height);

    const minimumBytes =
      MIN_OUTPUT_KB * 1024;

    const maximumBytes =
      options.maxFileSize * 1024;

    const canvas =
      document.createElement("canvas");

    canvas.width = width;
    canvas.height = height;

    const context =
      canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Your browser could not create a canvas.",
      );
    }

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
        width,
        height,
      );
    } else {
      context.clearRect(
        0,
        0,
        width,
        height,
      );
    }

    context.drawImage(
      image,
      0,
      0,
      width,
      height,
    );

    /*
     * First create the image at maximum quality.
     */
    let resultBlob =
      await canvasToBlob(
        canvas,
        mimeType,
        1,
      );

    /*
     * If it is already within the selected
     * maximum size, keep it.
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
     * If quality adjustment produced a file
     * below 50 KB, try to increase quality.
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
     * IMPORTANT:
     *
     * Do NOT increase the user's requested
     * width or height.
     *
     * If the image naturally ends up below
     * 50 KB, simply pad the file.
     */
    if (
      resultBlob.size <
        minimumBytes
    ) {
      resultBlob =
        padBlobToMinimumSize(
          resultBlob,
          minimumBytes,
        );
    }

    /*
     * Final maximum-size check.
     */
    if (
      resultBlob.size >
      maximumBytes
    ) {
      /*
       * If padding somehow pushed the file
       * over the selected limit, use the
       * highest quality result that fits.
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
       * If the image is naturally below 50 KB
       * after quality compression, pad it again.
       */
      if (
        resultBlob.size <
        minimumBytes
      ) {
        resultBlob =
          padBlobToMinimumSize(
            resultBlob,
            minimumBytes,
          );
      }
    }

    /*
     * Final validation.
     */
    if (!resultBlob.size) {
      throw new Error(
        "The browser returned an empty image.",
      );
    }

    if (
      resultBlob.size <=
      minimumBytes
    ) {
      resultBlob =
        padBlobToMinimumSize(
          resultBlob,
          minimumBytes,
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

  let blob =
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

  /*
   * If the server returns something below
   * 50 KB, fix the file here instead of
   * showing an error to the user.
   */
  if (
    blob.size <=
    minimumBytes
  ) {
    blob =
      padBlobToMinimumSize(
        blob,
        minimumBytes,
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
   * Fast browser processing for JPG,
   * JPEG, PNG and WEBP.
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
   * Other formats continue using
   * the backend.
   */
  return resizeOnServer(
    file,
    options,
  );
}

export default resizeImage;