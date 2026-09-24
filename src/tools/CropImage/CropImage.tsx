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

import {
  createCropFileName,
  createCroppedBlobWithMaxSize,
  downloadBlob,
  formatFileSize,
  getCropOutputFormat,
} from "./cropImage";

import "./CropImage.css";

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

        setCrop(
          getInitialCrop(),
        );

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

      setCrop(
        createAspectCrop(
          image,
          aspect,
        ),
      );

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

    setCrop(
      createAspectCrop(
        image,
        selected.ratio,
      ),
    );
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

      setCrop(
        createAspectCrop(
          image,
          safeWidth /
            safeHeight,
        ),
      );
    };

  /*
   * Crop movement / resize.
   */
  const handleCropChange = (
    newCrop: Crop,
  ) => {
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

    setCrop(
      getInitialCrop(),
    );

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
   */
  const handleApplyDownload =
    async () => {
      if (
        !file ||
        !imageRef.current
      ) {
        setError(
          "Please select an image first.",
        );

        return;
      }

      if (
        !completedCrop ||
        completedCrop.width <=
          0 ||
        completedCrop.height <=
          0
      ) {
        setError(
          "Please select a valid crop area.",
        );

        return;
      }

      setIsProcessing(true);
      setError("");

      try {
        const blob =
          await createCroppedBlobWithMaxSize(
            imageRef.current,
            {
              x: completedCrop.x,
              y: completedCrop.y,
              width:
                completedCrop.width,
              height:
                completedCrop.height,
            },
            outputFormat,
            MAX_FILE_SIZE_KB,
          );

        setCropFileSize(
          blob.size,
        );

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
        setIsProcessing(
          false,
        );
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
              Cancel
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