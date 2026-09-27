export interface ConvertImageResult {
  url: string;
  name: string;
  size: number;
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  "http://localhost:8000";

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

const BROWSER_OUTPUT_FORMATS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
];

const FAST_CLIENT_FORMATS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
  "tiff",
  "svg",
  "avif",
  "ico",
];

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
    ALLOWED_INPUT_TYPES.includes(
      mimeType,
    );

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

function getCanvasMimeType(
  format: string,
): string {
  switch (format) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";

    case "png":
      return "image/png";

    case "webp":
      return "image/webp";

    default:
      throw new Error(
        "Unsupported browser image format.",
      );
  }
}

function loadImage(
  file: File,
): Promise<HTMLImageElement> {
  return new Promise(
    (resolve, reject) => {
      const image =
        new Image();

      const objectUrl =
        URL.createObjectURL(file);

      image.onload = () => {
        URL.revokeObjectURL(
          objectUrl,
        );

        resolve(image);
      };

      image.onerror = () => {
        URL.revokeObjectURL(
          objectUrl,
        );

        reject(
          new Error(
            "This image format cannot be processed directly by your browser.",
          ),
        );
      };

      image.src = objectUrl;
    },
  );
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality = 0.92,
): Promise<Blob> {
  return new Promise(
    (resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error(
                "The browser could not create the converted image.",
              ),
            );

            return;
          }

          resolve(blob);
        },
        mimeType,
        quality,
      );
    },
  );
}

async function imageFileToCanvas(
  file: File,
): Promise<HTMLCanvasElement> {
  const image =
    await loadImage(file);

  try {
    const width =
      image.naturalWidth;

    const height =
      image.naturalHeight;

    if (!width || !height) {
      throw new Error(
        "Could not read the image dimensions.",
      );
    }

    const canvas =
      document.createElement(
        "canvas",
      );

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

    context.drawImage(
      image,
      0,
      0,
      width,
      height,
    );

    return canvas;
  } finally {
    image.src = "";
  }
}

function createBlobResult(
  blob: Blob,
  format: string,
): ConvertImageResult {
  if (!blob.size) {
    throw new Error(
      "The browser returned an empty converted image.",
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

/*
 * JPG / JPEG / PNG / WEBP
 *
 * Uses native browser Canvas encoding.
 */
async function convertWithCanvas(
  file: File,
  format: string,
): Promise<ConvertImageResult> {
  const canvas =
    await imageFileToCanvas(file);

  const mimeType =
    getCanvasMimeType(format);

  /*
   * JPEG does not support transparency.
   */
  if (
    format === "jpg" ||
    format === "jpeg"
  ) {
    const context =
      canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Could not access the image canvas.",
      );
    }

    const imageData =
      context.getImageData(
        0,
        0,
        canvas.width,
        canvas.height,
      );

    const hasTransparency =
      (() => {
        for (
          let i = 3;
          i < imageData.data.length;
          i += 4
        ) {
          if (
            imageData.data[i] < 255
          ) {
            return true;
          }
        }

        return false;
      })();

    if (hasTransparency) {
      const jpegCanvas =
        document.createElement(
          "canvas",
        );

      jpegCanvas.width =
        canvas.width;

      jpegCanvas.height =
        canvas.height;

      const jpegContext =
        jpegCanvas.getContext(
          "2d",
        );

      if (!jpegContext) {
        throw new Error(
          "Could not create JPEG canvas.",
        );
      }

      jpegContext.fillStyle =
        "#ffffff";

      jpegContext.fillRect(
        0,
        0,
        jpegCanvas.width,
        jpegCanvas.height,
      );

      jpegContext.drawImage(
        canvas,
        0,
        0,
      );

      const blob =
        await canvasToBlob(
          jpegCanvas,
          mimeType,
          0.92,
        );

      return createBlobResult(
        blob,
        format,
      );
    }
  }

  const blob =
    await canvasToBlob(
      canvas,
      mimeType,
      0.92,
    );

  return createBlobResult(
    blob,
    format,
  );
}

/*
 * BMP encoder.
 *
 * Creates a standard uncompressed
 * 24-bit BMP directly in the browser.
 */
function encodeBmp(
  imageData: ImageData,
): Blob {
  const width =
    imageData.width;

  const height =
    imageData.height;

  const rowSize =
    Math.floor(
      (width * 3 + 3) / 4,
    ) * 4;

  const pixelDataSize =
    rowSize * height;

  const fileSize =
    54 + pixelDataSize;

  const buffer =
    new ArrayBuffer(fileSize);

  const view =
    new DataView(buffer);

  const data =
    imageData.data;

  /*
   * BMP signature.
   */
  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4d);

  view.setUint32(
    2,
    fileSize,
    true,
  );

  view.setUint32(
    10,
    54,
    true,
  );

  /*
   * DIB header.
   */
  view.setUint32(
    14,
    40,
    true,
  );

  view.setInt32(
    18,
    width,
    true,
  );

  /*
   * Negative height means top-down BMP.
   */
  view.setInt32(
    22,
    -height,
    true,
  );

  view.setUint16(
    26,
    1,
    true,
  );

  view.setUint16(
    28,
    24,
    true,
  );

  view.setUint32(
    30,
    0,
    true,
  );

  view.setUint32(
    34,
    pixelDataSize,
    true,
  );

  view.setInt32(
    38,
    2835,
    true,
  );

  view.setInt32(
    42,
    2835,
    true,
  );

  view.setUint32(
    46,
    0,
    true,
  );

  view.setUint32(
    50,
    0,
    true,
  );

  let offset = 54;

  for (
    let y = 0;
    y < height;
    y++
  ) {
    const rowStart =
      y * width * 4;

    for (
      let x = 0;
      x < width;
      x++
    ) {
      const source =
        rowStart + x * 4;

      const red =
        data[source];

      const green =
        data[source + 1];

      const blue =
        data[source + 2];

      view.setUint8(
        offset++,
        blue,
      );

      view.setUint8(
        offset++,
        green,
      );

      view.setUint8(
        offset++,
        red,
      );
    }

    while (
      (offset - 54) %
        rowSize !==
      0
    ) {
      view.setUint8(
        offset++,
        0,
      );
    }
  }

  return new Blob(
    [buffer],
    {
      type: "image/bmp",
    },
  );
}

/*
 * GIF encoder.
 *
 * Uses gifenc only when GIF is requested,
 * keeping it out of the initial bundle.
 */
async function convertToGif(
  file: File,
): Promise<ConvertImageResult> {
  const { GIFEncoder, quantize, applyPalette } =
    await import("gifenc");

  const canvas =
    await imageFileToCanvas(file);

  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Could not access the image canvas.",
    );
  }

  const imageData =
    context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );

  const palette =
    quantize(
      imageData.data,
      256,
    );

  const index =
    applyPalette(
      imageData.data,
      palette,
    );

  const gif =
    GIFEncoder();

  gif.writeFrame(
    index,
    canvas.width,
    canvas.height,
    {
      palette,
    },
  );

  gif.finish();

  const bytes =
    gif.bytes();

  const blob =
    new Blob(
      [bytes],
      {
        type: "image/gif",
      },
    );

  return createBlobResult(
    blob,
    "gif",
  );
}

/*
 * TIFF encoder.
 *
 * UTIF performs the binary TIFF encoding
 * directly in the browser.
 */
async function convertToTiff(
  file: File,
): Promise<ConvertImageResult> {
  const UTIF =
    await import("utif");

  const canvas =
    await imageFileToCanvas(file);

  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Could not access the image canvas.",
    );
  }

  const imageData =
    context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );

  const buffer =
    UTIF.encodeImage(
      imageData.data,
      canvas.width,
      canvas.height,
    );

  const blob =
    new Blob(
      [buffer],
      {
        type: "image/tiff",
      },
    );

  return createBlobResult(
    blob,
    "tiff",
  );
}

/*
 * ICO encoder.
 *
 * ICO can contain PNG images.
 * We create a PNG representation
 * and package it as an ICO.
 */
async function convertToIco(
  file: File,
): Promise<ConvertImageResult> {
  const { encodeIco } =
    await import("icojs");

  const canvas =
    await imageFileToCanvas(file);

  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Could not access the image canvas.",
    );
  }

  /*
   * ICO icons are normally square.
   * Create a square canvas while preserving
   * the original image.
   */
  const maxSize = Math.min(
    256,
    Math.max(
      canvas.width,
      canvas.height,
    ),
  );

  const iconSize =
    Math.max(
      16,
      Math.min(
        256,
        maxSize,
      ),
    );

  const iconCanvas =
    document.createElement(
      "canvas",
    );

  iconCanvas.width =
    iconSize;

  iconCanvas.height =
    iconSize;

  const iconContext =
    iconCanvas.getContext(
      "2d",
    );

  if (!iconContext) {
    throw new Error(
      "Could not create the ICO canvas.",
    );
  }

  iconContext.clearRect(
    0,
    0,
    iconSize,
    iconSize,
  );

  const scale =
    Math.min(
      iconSize / canvas.width,
      iconSize / canvas.height,
    );

  const drawWidth =
    canvas.width * scale;

  const drawHeight =
    canvas.height * scale;

  const x =
    (iconSize - drawWidth) / 2;

  const y =
    (iconSize - drawHeight) / 2;

  iconContext.drawImage(
    canvas,
    x,
    y,
    drawWidth,
    drawHeight,
  );

  const pngBlob =
    await canvasToBlob(
      iconCanvas,
      "image/png",
      1,
    );

  const pngBuffer =
    await pngBlob.arrayBuffer();

  const icoBuffer =
    await encodeIco([
      {
        buffer: pngBuffer,
      },
    ]);

  const blob =
    new Blob(
      [icoBuffer],
      {
        type: "image/x-icon",
      },
    );

  return createBlobResult(
    blob,
    "ico",
  );
}

/*
 * AVIF encoder.
 *
 * @jsquash/avif uses WebAssembly and
 * is loaded only when AVIF is selected.
 */
async function convertToAvif(
  file: File,
): Promise<ConvertImageResult> {
  const { encode } =
    await import(
      "@jsquash/avif"
    );

  const canvas =
    await imageFileToCanvas(file);

  const context =
    canvas.getContext("2d");

  if (!context) {
    throw new Error(
      "Could not access the image canvas.",
    );
  }

  const imageData =
    context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height,
    );

  const encoded =
    await encode(
      imageData,
      {
        speed: 8,
      },
    );

  const blob =
    new Blob(
      [encoded],
      {
        type: "image/avif",
      },
    );

  return createBlobResult(
    blob,
    "avif",
  );
}

/*
 * SVG output.
 *
 * A raster image is embedded inside an SVG.
 * This is intentionally a wrapper, not a
 * vector tracing operation.
 */
async function convertToSvg(
  file: File,
): Promise<ConvertImageResult> {
  const canvas =
    await imageFileToCanvas(file);

  const pngBlob =
    await canvasToBlob(
      canvas,
      "image/png",
      1,
    );

  const pngBuffer =
    await pngBlob.arrayBuffer();

  const bytes =
    new Uint8Array(
      pngBuffer,
    );

  let binary = "";

  const chunkSize =
    0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {
    binary += String.fromCharCode(
      ...bytes.subarray(
        i,
        Math.min(
          i + chunkSize,
          bytes.length,
        ),
      ),
    );
  }

  const base64 =
    btoa(binary);

  const svg = `
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="${canvas.width}"
  height="${canvas.height}"
  viewBox="0 0 ${canvas.width} ${canvas.height}"
>
  <image
    href="data:image/png;base64,${base64}"
    width="${canvas.width}"
    height="${canvas.height}"
  />
</svg>`.trim();

  const blob =
    new Blob(
      [svg],
      {
        type: "image/svg+xml",
      },
    );

  return createBlobResult(
    blob,
    "svg",
  );
}

/*
 * Backend fallback.
 *
 * HEIC and HEIF remain here for now.
 * We will handle those separately because
 * their browser-side codecs are heavier.
 */
async function convertOnServer(
  file: File,
  format: string,
): Promise<ConvertImageResult> {
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
    outputFormat
      .toLowerCase()
      .trim();

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

  /*
   * Existing very-fast Canvas formats.
   */
  if (
    BROWSER_OUTPUT_FORMATS.includes(
      format,
    )
  ) {
    return convertWithCanvas(
      file,
      format,
    );
  }

  /*
   * New client-side Step 1 formats.
   */
  if (
    FAST_CLIENT_FORMATS.includes(
      format,
    )
  ) {
    switch (format) {
      case "gif":
        return convertToGif(file);

      case "bmp": {
        const canvas =
          await imageFileToCanvas(
            file,
          );

        const context =
          canvas.getContext(
            "2d",
          );

        if (!context) {
          throw new Error(
            "Could not access the image canvas.",
          );
        }

        const imageData =
          context.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          );

        const blob =
          encodeBmp(imageData);

        return createBlobResult(
          blob,
          "bmp",
        );
      }

      case "tiff":
        return convertToTiff(
          file,
        );

      case "svg":
        return convertToSvg(
          file,
        );

      case "ico":
        return convertToIco(
          file,
        );

      case "avif":
        return convertToAvif(
          file,
        );

      default:
        break;
    }
  }

  /*
   * HEIC / HEIF stay on the backend
   * for this step.
   */
  return convertOnServer(
    file,
    format,
  );
}

export default convertImage;