import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SyntheticEvent,
} from "react";

import ReactCrop, {
  type Crop,
  type PixelCrop,
} from "react-image-crop";

import "react-image-crop/dist/ReactCrop.css";
import "./CropImage.css";

function getCropOutputFormat(file: File): string {
  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase() || "png";

  if (extension === "jpg" || extension === "jpeg") {
    return extension;
  }

  if (extension === "png" || extension === "webp") {
    return extension;
  }

  // Browser canvas can reliably export these formats.
  // Unsupported source formats fall back to PNG.
  return "png";
}

function createCropFileName(
  originalName: string,
  outputFormat: string,
): string {
  const baseName =
    originalName.replace(/\.[^/.]+$/, "") ||
    "filevixo-image";

  return `${baseName}-cropped.${outputFormat}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function downloadBlob(
  blob: Blob,
  fileName: string,
): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

function loadImageFromFile(
  file: File,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read the selected image."));
    };

    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  outputFormat: string,
  quality = 0.92,
): Promise<Blob> {
  const mimeType =
    outputFormat === "jpg" || outputFormat === "jpeg"
      ? "image/jpeg"
      : outputFormat === "webp"
        ? "image/webp"
        : "image/png";

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob || blob.size <= 0) {
          reject(new Error("Unable to create the cropped image."));
          return;
        }

        resolve(blob);
      },
      mimeType,
      mimeType === "image/png" ? undefined : quality,
    );
  });
}

async function createCroppedBlobWithMaxSize(
  image: HTMLImageElement,
  crop: {
    x: number;
    y: number;
    width: number;
    height: number;
  },
  outputFormat: string,
  maxFileSizeKB: number,
): Promise<Blob> {
  const maxBytes = maxFileSizeKB * 1024;

  let width = Math.max(1, Math.round(crop.width));
  let height = Math.max(1, Math.round(crop.height));
  const x = Math.max(0, Math.round(crop.x));
  const y = Math.max(0, Math.round(crop.y));

  width = Math.min(width, image.naturalWidth - x);
  height = Math.min(height, image.naturalHeight - y);

  if (width <= 0 || height <= 0) {
    throw new Error("Please select a valid crop area.");
  }

  let quality = 0.92;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Your browser could not create the crop canvas.");
    }

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.clearRect(0, 0, width, height);

    context.drawImage(
      image,
      x,
      y,
      width,
      height,
      0,
      0,
      width,
      height,
    );

    const blob = await canvasToBlob(
      canvas,
      outputFormat,
      quality,
    );

    if (blob.size <= maxBytes) {
      return blob;
    }

    // Only resize if the safety limit is actually exceeded.
    // This keeps normal crops fast and preserves their dimensions.
    if (outputFormat === "jpg" || outputFormat === "jpeg" || outputFormat === "webp") {
      quality = Math.max(0.45, quality - 0.12);
    } else {
      width = Math.max(1, Math.floor(width * 0.82));
      height = Math.max(1, Math.floor(height * 0.82));
    }
  }

  throw new Error(
    "The cropped image is larger than the maximum allowed file size.",
  );
}

interface CropImageProps {
  file: File | null;
  onCancel?: () => void;
}

type RatioType =
  | "free"
  | "square"
  | "widescreen"
  | "standard"
  | "photo"
  | "portrait"
  | "vertical"
  | "custom";

interface RatioOption {
  id: RatioType;
  label: string;
  ratio?: number;
}

const RATIO_OPTIONS: RatioOption[] = [
  {
    id: "free",
    label: "Free",
  },
  {
    id: "square",
    label: "Square (1:1)",
    ratio: 1,
  },
  {
    id: "widescreen",
    label: "Widescreen (16:9)",
    ratio: 16 / 9,
  },
  {
    id: "standard",
    label: "Standard (4:3)",
    ratio: 4 / 3,
  },
  {
    id: "photo",
    label: "Photo (3:2)",
    ratio: 3 / 2,
  },
  {
    id: "portrait",
    label: "Portrait (2:3)",
    ratio: 2 / 3,
  },
  {
    id: "vertical",
    label: "Vertical (9:16)",
    ratio: 9 / 16,
  },
  {
    id: "custom",
    label: "Custom",
  },
];

/*
 * Maximum output size.
 * 25 MB is used because your Filevixo image upload
 * currently supports up to 25 MB.
 */
const MAX_FILE_SIZE_KB =
  25 * 1024;

function getInitialCrop(): Crop {
  return {
    unit: "%",
    width: 80,
    height: 80,
    x: 10,
    y: 10,
  };
}

function createAspectCrop(
  image: HTMLImageElement,
  aspect: number,
): Crop {
  const imageWidth =
    image.naturalWidth;

  const imageHeight =
    image.naturalHeight;

  let cropWidth = 80;

  let cropHeight =
    (cropWidth / aspect) *
    (imageWidth / imageHeight);

  if (cropHeight > 80) {
    cropHeight = 80;

    cropWidth =
      (cropHeight *
        aspect *
        imageHeight) /
      imageWidth;
  }

  return {
    unit: "%",
    width: cropWidth,
    height: cropHeight,
    x: (100 - cropWidth) / 2,
    y: (100 - cropHeight) / 2,
  };
}

export default function CropImage({
  file,
  onCancel,
}: CropImageProps) {
  const workspaceRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const imageRef =
    useRef<HTMLImageElement | null>(
      null,
    );

  const objectUrlRef =
    useRef<string | null>(null);

  const [imageUrl, setImageUrl] =
    useState("");

  const [
    imageDimensions,
    setImageDimensions,
  ] = useState({
    width: 0,
    height: 0,
  });

  const [crop, setCrop] =
    useState<Crop>();

  const cropRef =
    useRef<Crop | undefined>(undefined);

  const [
    completedCrop,
    setCompletedCrop,
  ] = useState<PixelCrop | null>(
    null,
  );

  const [
    selectedRatio,
    setSelectedRatio,
  ] = useState<RatioType>("free");

  const [
    customWidth,
    setCustomWidth,
  ] = useState(1);

  const [
    customHeight,
    setCustomHeight,
  ] = useState(1);

  const [
    isProcessing,
    setIsProcessing,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [
    cropFileSize,
    setCropFileSize,
  ] = useState<number | null>(
    null,
  );

  const outputFormat =
    useMemo(() => {
      if (!file) {
        return "jpg" as const;
      }

      return getCropOutputFormat(
        file,
      );
    }, [file]);

  /*
   * Create image object URL.
   */
  useEffect(() => {
    if (!file) {
      setImageUrl("");
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(
        objectUrlRef.current,
      );
    }

    const url =
      URL.createObjectURL(file);

    objectUrlRef.current = url;

    imageRef.current = null;

    setImageUrl(url);

    setError("");
    setCompletedCrop(null);
    setCropFileSize(null);
    setSelectedRatio("free");

    return () => {
      URL.revokeObjectURL(url);

      if (
        objectUrlRef.current ===
        url
      ) {
        objectUrlRef.current =
          null;
      }
    };
  }, [file]);

  /*
   * Automatically scroll to the
   * crop workspace after selecting
   * an image.
   */
  useEffect(() => {
    if (
      !file ||
      !imageUrl ||
      !workspaceRef.current
    ) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        const workspace =
          workspaceRef.current;

        if (!workspace) {
          return;
        }

        const top =
          workspace.getBoundingClientRect()
            .top +
          window.scrollY;

        window.scrollTo({
          top: Math.max(
            0,
            top - 105,
          ),
          behavior: "smooth",
        });
      }, 250);

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [file, imageUrl]);

  /*
   * Image loaded.
   */
  const handleImageLoad =
    useCallback(
      (
        event: SyntheticEvent<HTMLImageElement>,
      ) => {
        const image =
          event.currentTarget;

        imageRef.current = image;

        setImageDimensions({
          width:
            image.naturalWidth,
          height:
            image.naturalHeight,
        });

        const initialCrop =
          getInitialCrop();

        cropRef.current =
          initialCrop;

        setCrop(initialCrop);

        setCompletedCrop(null);
        setCropFileSize(null);
      },
      [],
    );

  /*
   * Change ratio.
   */
  const handleRatioChange = (
    ratioType: RatioType,
  ) => {
    setSelectedRatio(
      ratioType,
    );

    setError("");
    setCropFileSize(null);

    const image =
      imageRef.current;

    if (!image) {
      return;
    }

    if (ratioType === "free") {
      setCrop(
        getInitialCrop(),
      );

      return;
    }

    if (ratioType === "custom") {
      const aspect =
        customWidth /
        customHeight;

      const nextCrop =
        createAspectCrop(
          image,
          aspect,
        );

      cropRef.current =
        nextCrop;

      setCrop(nextCrop);

      return;
    }

    const selected =
      RATIO_OPTIONS.find(
        (option) =>
          option.id ===
          ratioType,
      );

    if (
      !selected?.ratio
    ) {
      return;
    }

    const nextCrop =
      createAspectCrop(
        image,
        selected.ratio,
      );

    cropRef.current =
      nextCrop;

    setCrop(nextCrop);
  };

  /*
   * Custom ratio.
   */
  const handleCustomRatioChange =
    (
      width: number,
      height: number,
    ) => {
      const safeWidth =
        Math.max(
          1,
          Number.isFinite(
            width,
          )
            ? width
            : 1,
        );

      const safeHeight =
        Math.max(
          1,
          Number.isFinite(
            height,
          )
            ? height
            : 1,
        );

      setCustomWidth(
        safeWidth,
      );

      setCustomHeight(
        safeHeight,
      );

      const image =
        imageRef.current;

      if (!image) {
        return;
      }

      const nextCrop =
        createAspectCrop(
          image,
          safeWidth /
            safeHeight,
        );

      cropRef.current =
        nextCrop;

      setCrop(nextCrop);
    };

  /*
   * Crop movement / resize.
   */
  const handleCropChange = (
    newCrop: Crop,
  ) => {
    cropRef.current = newCrop;
    setCrop(newCrop);
    setCropFileSize(null);
  };

  /*
   * Crop completed.
   */
  const handleCropComplete = (
    newCrop: PixelCrop,
  ) => {
    setCompletedCrop(
      newCrop,
    );

    setCropFileSize(null);
  };

  /*
   * Reset crop.
   */
  const handleReset = () => {
    const image =
      imageRef.current;

    if (!image) {
      return;
    }

    setSelectedRatio(
      "free",
    );

    const nextCrop =
      getInitialCrop();

    cropRef.current =
      nextCrop;

    setCrop(nextCrop);

    setCompletedCrop(null);
    setCropFileSize(null);
    setError("");
  };

  /*
   * Cancel.
   */
  const handleCancel = () => {
    setError("");
    setCompletedCrop(null);
    setCropFileSize(null);

    if (onCancel) {
      onCancel();
    }
  };

  /*
   * Apply + Download.
   *
   * Export from the exact crop state currently shown by ReactCrop.
   * ReactCrop keeps the selected crop in either percentage or pixel
   * coordinates depending on the crop unit, so we convert that state
   * directly to the selected file's natural pixel dimensions.
   */
  const handleApplyDownload =
    async () => {
      if (!file || !imageRef.current) {
        setError(
          "Please select an image first.",
        );

        return;
      }

      const currentCrop =
        cropRef.current || crop;

      if (
        !currentCrop ||
        currentCrop.width <= 0 ||
        currentCrop.height <= 0
      ) {
        setError(
          "Please select a valid crop area.",
        );

        return;
      }

      setIsProcessing(true);
      setError("");

      try {
        // Read the exact file selected by UploadBox.
        const sourceImage =
          await loadImageFromFile(file);

        const displayImage =
          imageRef.current;

        const displayedRect =
          displayImage.getBoundingClientRect();

        if (
          displayedRect.width <= 0 ||
          displayedRect.height <= 0
        ) {
          throw new Error(
            "Unable to determine the crop area.",
          );
        }

        let naturalX: number;
        let naturalY: number;
        let naturalWidth: number;
        let naturalHeight: number;

        if (currentCrop.unit === "%") {
          naturalX = Math.round(
            (currentCrop.x / 100) *
              sourceImage.naturalWidth,
          );

          naturalY = Math.round(
            (currentCrop.y / 100) *
              sourceImage.naturalHeight,
          );

          naturalWidth = Math.round(
            (currentCrop.width / 100) *
              sourceImage.naturalWidth,
          );

          naturalHeight = Math.round(
            (currentCrop.height / 100) *
              sourceImage.naturalHeight,
          );
        } else {
          const scaleX =
            sourceImage.naturalWidth /
            displayedRect.width;

          const scaleY =
            sourceImage.naturalHeight /
            displayedRect.height;

          naturalX = Math.round(
            currentCrop.x * scaleX,
          );

          naturalY = Math.round(
            currentCrop.y * scaleY,
          );

          naturalWidth = Math.round(
            currentCrop.width * scaleX,
          );

          naturalHeight = Math.round(
            currentCrop.height * scaleY,
          );
        }

        naturalX = Math.max(
          0,
          Math.min(
            naturalX,
            sourceImage.naturalWidth - 1,
          ),
        );

        naturalY = Math.max(
          0,
          Math.min(
            naturalY,
            sourceImage.naturalHeight - 1,
          ),
        );

        naturalWidth = Math.max(
          1,
          Math.min(
            naturalWidth,
            sourceImage.naturalWidth - naturalX,
          ),
        );

        naturalHeight = Math.max(
          1,
          Math.min(
            naturalHeight,
            sourceImage.naturalHeight - naturalY,
          ),
        );

        const blob =
          await createCroppedBlobWithMaxSize(
            sourceImage,
            {
              x: naturalX,
              y: naturalY,
              width: naturalWidth,
              height: naturalHeight,
            },
            outputFormat,
            MAX_FILE_SIZE_KB,
          );

        sourceImage.src = "";

        setCropFileSize(blob.size);

        const fileName =
          createCropFileName(
            file.name,
            outputFormat,
          );

        downloadBlob(
          blob,
          fileName,
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to crop the image.";

        setError(message);
      } finally {
        setIsProcessing(false);
      }
    };

  /*
   * IMPORTANT:
   *
   * Do NOT render another upload box here.
   *
   * The shared Filevixo UploadBox
   * above this workspace already
   * handles image selection.
   */
  if (!file) {
    return null;
  }

  const selectedAspect =
    selectedRatio ===
    "free"
      ? undefined
      : selectedRatio ===
          "custom"
        ? customWidth /
          customHeight
        : RATIO_OPTIONS.find(
            (option) =>
              option.id ===
              selectedRatio,
          )?.ratio;

  return (
    <section
      ref={workspaceRef}
      className="crop-workspace"
    >
      <div className="crop-workspace-grid">

        {/* =====================================
            LEFT — IMAGE PREVIEW
            ===================================== */}

        <div className="crop-preview-card">
          <div className="crop-preview-inner">
            {imageUrl && (
              <ReactCrop
                crop={crop}
                aspect={
                  selectedAspect
                }
                onChange={
                  handleCropChange
                }
                onComplete={
                  handleCropComplete
                }
                keepSelection
                ruleOfThirds={false}
                minWidth={20}
                minHeight={20}
              >
                <img
                  src={imageUrl}
                  alt="Image to crop"
                  className="crop-source-image"
                  onLoad={
                    handleImageLoad
                  }
                />
              </ReactCrop>
            )}
          </div>
        </div>

        {/* =====================================
            RIGHT — SETTINGS
            ===================================== */}

        <aside className="crop-settings-card">

          <div className="crop-settings-section">
            <h3>Ratio</h3>

            <div className="crop-ratio-grid">
              {RATIO_OPTIONS.map(
                (option) => (
                  <button
                    key={
                      option.id
                    }
                    type="button"
                    className={`crop-ratio-button ${
                      selectedRatio ===
                      option.id
                        ? "active"
                        : ""
                    }`}
                    onClick={() =>
                      handleRatioChange(
                        option.id,
                      )
                    }
                  >
                    {
                      option.label
                    }
                  </button>
                ),
              )}
            </div>
          </div>

          {/* =====================================
              CUSTOM RATIO
              ===================================== */}

          {selectedRatio ===
            "custom" && (
            <div className="crop-custom-ratio">
              <label>
                Custom ratio
              </label>

              <div className="crop-custom-inputs">
                <input
                  type="number"
                  min="1"
                  value={
                    customWidth
                  }
                  onChange={(
                    event,
                  ) =>
                    handleCustomRatioChange(
                      Number(
                        event
                          .target
                          .value,
                      ),
                      customHeight,
                    )
                  }
                />

                <span>:</span>

                <input
                  type="number"
                  min="1"
                  value={
                    customHeight
                  }
                  onChange={(
                    event,
                  ) =>
                    handleCustomRatioChange(
                      customWidth,
                      Number(
                        event
                          .target
                          .value,
                      ),
                    )
                  }
                />
              </div>
            </div>
          )}

          {/* =====================================
              CROP SIZE
              ===================================== */}

          <div className="crop-dimensions-box">
            <div className="crop-dimension-heading">
              <span>
                Crop size
              </span>
            </div>

            <div className="crop-dimension-values">
              <div>
                <strong>
                  {completedCrop
                    ? Math.round(
                        completedCrop.width,
                      )
                    : 0}
                </strong>

                <span>
                  W px
                </span>
              </div>

              <div>
                <strong>
                  {completedCrop
                    ? Math.round(
                        completedCrop.height,
                      )
                    : 0}
                </strong>

                <span>
                  H px
                </span>
              </div>
            </div>
          </div>

          {/* =====================================
              FILE INFO
              ===================================== */}

          <div className="crop-file-info">
            <div className="crop-file-info-row">
              <span>
                Original
              </span>

              <strong>
                {
                  imageDimensions.width
                }{" "}
                ×{" "}
                {
                  imageDimensions.height
                }
              </strong>
            </div>

            <div className="crop-file-info-row">
              <span>
                Format
              </span>

              <strong>
                {outputFormat.toUpperCase()}
              </strong>
            </div>

            {cropFileSize !==
              null && (
              <div className="crop-file-info-row">
                <span>
                  Output
                </span>

                <strong>
                  {formatFileSize(
                    cropFileSize,
                  )}
                </strong>
              </div>
            )}
          </div>

          {/* =====================================
              ERROR
              ===================================== */}

          {error && (
            <div className="crop-error">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                />

                <path d="M12 8v4" />

                <path d="M12 16h.01" />
              </svg>

              <span>
                {error}
              </span>
            </div>
          )}

          {/* =====================================
              ACTION BUTTONS
              ===================================== */}

          <div className="crop-actions">

            <button
              type="button"
              className="crop-secondary-button"
              onClick={
                handleReset
              }
              disabled={
                isProcessing
              }
            >
              Reset
            </button>

            <button
              type="button"
              className="crop-secondary-button"
              onClick={
                handleCancel
              }
              disabled={
                isProcessing
              }
            >
              Start over
            </button>

            <button
              type="button"
              className="crop-primary-button"
              onClick={
                handleApplyDownload
              }
              disabled={
                isProcessing
              }
            >
              {isProcessing ? (
                <>
                  <span className="crop-spinner" />

                  Processing...
                </>
              ) : (
                <>
                  Apply & Download

                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M5 12h14" />

                    <path d="M13 6l6 6-6 6" />
                  </svg>
                </>
              )}
            </button>

          </div>

          <p className="crop-helper-text">
            Drag the crop area to
            move it, then use the
            handles to adjust the
            crop size.
          </p>

        </aside>
      </div>
    </section>
  );
}