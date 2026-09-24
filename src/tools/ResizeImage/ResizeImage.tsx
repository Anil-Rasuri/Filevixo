import { useEffect, useRef, useState } from "react";
import "./ResizeImage.css";
import { resizeImage } from "./resizeImage";

interface ResizeImageProps {
  file: File | null;
  onResult?: (result: {
    url: string;
    name: string;
    size: number;
  }) => void;
  onError?: (message: string) => void;
  onLoading?: (loading: boolean) => void;
}

const PRIMARY_FORMATS = [
  { value: "jpg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WEBP" },
];

const OTHER_FORMATS = [
  { value: "gif", label: "GIF" },
  { value: "bmp", label: "BMP" },
  { value: "tiff", label: "TIFF" },
  { value: "ico", label: "ICO" },
  { value: "avif", label: "AVIF" },
  { value: "heic", label: "HEIC" },
  { value: "heif", label: "HEIF" },
  { value: "svg", label: "SVG" },
];

const FORMAT_OPTIONS = [
  ...PRIMARY_FORMATS,
  ...OTHER_FORMATS,
];

type DimensionUnit = "px" | "in" | "cm" | "mm";
type SizeUnit = "KB" | "MB";

const DIMENSION_UNITS: {
  value: DimensionUnit;
  label: string;
}[] = [
  {
    value: "px",
    label: "Pixels (px)",
  },
  {
    value: "in",
    label: "Inches (in)",
  },
  {
    value: "cm",
    label: "Centimeters (cm)",
  },
  {
    value: "mm",
    label: "Millimeters (mm)",
  },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pixelsToUnit(
  pixels: number,
  unit: DimensionUnit,
  dpi: number,
): number {
  if (unit === "px") {
    return pixels;
  }

  if (unit === "in") {
    return pixels / dpi;
  }

  if (unit === "cm") {
    return (pixels / dpi) * 2.54;
  }

  return (pixels / dpi) * 25.4;
}

function formatDimensionValue(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return value
    .toFixed(2)
    .replace(/\.?0+$/, "");
}

const ResizeImage = ({
  file,
  onResult,
  onError,
  onLoading,
}: ResizeImageProps) => {
  const previewCanvasRef =
    useRef<HTMLCanvasElement | null>(null);

  const previewImageRef =
    useRef<HTMLImageElement | null>(null);

  /*
   * Used to automatically scroll the page
   * to the Preview + Settings workspace
   * after an image is selected.
   */
  const resizeWorkspaceRef =
    useRef<HTMLDivElement | null>(null);

  const [width, setWidth] =
    useState("");

  const [height, setHeight] =
    useState("");

  const [dimensionUnit, setDimensionUnit] =
    useState<DimensionUnit>("px");

  const [dpi, setDpi] =
    useState("96");

  const [outputFormat, setOutputFormat] =
    useState("jpg");

  const [maxFileSize, setMaxFileSize] =
    useState("");

  const [sizeUnit, setSizeUnit] =
    useState<SizeUnit>("KB");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [previewReady, setPreviewReady] =
    useState(false);

  const [originalWidth, setOriginalWidth] =
    useState<number | null>(null);

  const [originalHeight, setOriginalHeight] =
    useState<number | null>(null);

  const [previewWidth, setPreviewWidth] =
    useState<number | null>(null);

  const [previewHeight, setPreviewHeight] =
    useState<number | null>(null);

  /*
   * Convert entered dimensions into
   * actual pixels.
   */
  const dimensionToPixels = (
    value: string,
    unit: DimensionUnit,
    currentDpi: number,
  ): number => {
    const numericValue = Number(value);

    if (
      !Number.isFinite(numericValue) ||
      numericValue <= 0
    ) {
      return 0;
    }

    if (unit === "px") {
      return Math.round(numericValue);
    }

    if (unit === "in") {
      return Math.round(
        numericValue * currentDpi,
      );
    }

    if (unit === "cm") {
      return Math.round(
        (numericValue / 2.54) *
          currentDpi,
      );
    }

    return Math.round(
      (numericValue / 25.4) *
        currentDpi,
    );
  };

  /*
   * Live preview dimensions.
   */
  useEffect(() => {
    const currentDpi = Number(dpi);

    const safeDpi =
      Number.isFinite(currentDpi) &&
      currentDpi > 0
        ? currentDpi
        : 96;

    const widthPixels =
      dimensionToPixels(
        width,
        dimensionUnit,
        safeDpi,
      );

    const heightPixels =
      dimensionToPixels(
        height,
        dimensionUnit,
        safeDpi,
      );

    if (
      widthPixels > 0 &&
      heightPixels > 0 &&
      widthPixels <= 10000 &&
      heightPixels <= 10000
    ) {
      setPreviewWidth(widthPixels);
      setPreviewHeight(heightPixels);
    } else {
      setPreviewWidth(null);
      setPreviewHeight(null);
    }
  }, [
    width,
    height,
    dimensionUnit,
    dpi,
  ]);

  /*
   * Load selected image.
   */
  useEffect(() => {
    setError("");
    setLoading(false);
    setPreviewReady(false);

    if (!file) {
      setWidth("");
      setHeight("");
      setDimensionUnit("px");
      setDpi("96");
      setOutputFormat("jpg");
      setMaxFileSize("");
      setSizeUnit("KB");

      setOriginalWidth(null);
      setOriginalHeight(null);

      setPreviewWidth(null);
      setPreviewHeight(null);

      previewImageRef.current = null;

      return;
    }

    const imageUrl =
      URL.createObjectURL(file);

    const image = new Image();

    image.onload = () => {
      const imageWidth =
        image.naturalWidth;

      const imageHeight =
        image.naturalHeight;

      setOriginalWidth(imageWidth);
      setOriginalHeight(imageHeight);

      setDimensionUnit("px");

      setWidth(
        String(imageWidth),
      );

      setHeight(
        String(imageHeight),
      );

      setDpi("96");

      previewImageRef.current =
        image;

      setPreviewReady(true);

      URL.revokeObjectURL(imageUrl);

      /*
       * IMPORTANT:
       *
       * Do NOT use scrollIntoView().
       *
       * We calculate an exact scroll position
       * so the Preview + Settings section
       * appears near the top of the viewport,
       * like the reference screenshot.
       */
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const workspace =
            resizeWorkspaceRef.current;

          if (!workspace) {
            return;
          }

          const workspaceTop =
            workspace.getBoundingClientRect()
              .top +
            window.scrollY;

          /*
           * This controls where the workspace
           * lands on screen.
           *
           * Navbar + small top spacing.
           */
          const targetTop =
            workspaceTop - 175;

          window.scrollTo({
            top: Math.max(
              0,
              targetTop,
            ),
            behavior: "smooth",
          });
        });
      });
    };

    image.onerror = () => {
      setPreviewReady(false);

      URL.revokeObjectURL(imageUrl);
    };

    image.src = imageUrl;

    return () => {
      URL.revokeObjectURL(imageUrl);
    };
  }, [file]);

  /*
   * Draw live preview.
   *
   * Width and height are completely
   * independent. No aspect-ratio lock.
   */
  useEffect(() => {
    const canvas =
      previewCanvasRef.current;

    const image =
      previewImageRef.current;

    if (
      !canvas ||
      !image ||
      !previewReady ||
      !previewWidth ||
      !previewHeight
    ) {
      return;
    }

    if (
      previewWidth <= 0 ||
      previewHeight <= 0 ||
      previewWidth > 10000 ||
      previewHeight > 10000
    ) {
      return;
    }

    canvas.width =
      Math.round(previewWidth);

    canvas.height =
      Math.round(previewHeight);

    const context =
      canvas.getContext("2d");

    if (!context) {
      return;
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

    context.drawImage(
      image,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  }, [
    previewWidth,
    previewHeight,
    previewReady,
  ]);

  /*
   * Change px/in/cm/mm without changing
   * the actual pixel dimensions.
   */
  const handleDimensionUnitChange = (
    newUnit: DimensionUnit,
  ) => {
    const currentDpi = Number(dpi);

    const safeDpi =
      Number.isFinite(currentDpi) &&
      currentDpi > 0
        ? currentDpi
        : 96;

    const currentWidthPixels =
      dimensionToPixels(
        width,
        dimensionUnit,
        safeDpi,
      );

    const currentHeightPixels =
      dimensionToPixels(
        height,
        dimensionUnit,
        safeDpi,
      );

    if (currentWidthPixels > 0) {
      setWidth(
        formatDimensionValue(
          pixelsToUnit(
            currentWidthPixels,
            newUnit,
            safeDpi,
          ),
        ),
      );
    }

    if (currentHeightPixels > 0) {
      setHeight(
        formatDimensionValue(
          pixelsToUnit(
            currentHeightPixels,
            newUnit,
            safeDpi,
          ),
        ),
      );
    }

    setDimensionUnit(newUnit);
  };

  /*
   * Resize image.
   */
  const handleResize = async () => {
    if (!file) {
      const message =
        "Please select an image first.";

      setError(message);
      onError?.(message);

      return;
    }

    const currentDpi = Number(dpi);

    const safeDpi =
      Number.isFinite(currentDpi) &&
      currentDpi > 0
        ? currentDpi
        : 96;

    const targetWidth =
      dimensionToPixels(
        width,
        dimensionUnit,
        safeDpi,
      );

    const targetHeight =
      dimensionToPixels(
        height,
        dimensionUnit,
        safeDpi,
      );

    if (targetWidth <= 0) {
      const message =
        "Please enter a valid width.";

      setError(message);
      onError?.(message);

      return;
    }

    if (targetHeight <= 0) {
      const message =
        "Please enter a valid height.";

      setError(message);
      onError?.(message);

      return;
    }

    if (
      targetWidth > 10000 ||
      targetHeight > 10000
    ) {
      const message =
        "Maximum allowed dimensions are 10000 × 10000 pixels.";

      setError(message);
      onError?.(message);

      return;
    }

    const targetMaxFileSize =
      maxFileSize.trim() === ""
        ? undefined
        : Number(maxFileSize);

    if (
      targetMaxFileSize !==
        undefined &&
      (
        !Number.isFinite(
          targetMaxFileSize,
        ) ||
        targetMaxFileSize <= 0
      )
    ) {
      const message =
        "Please enter a valid maximum file size.";

      setError(message);
      onError?.(message);

      return;
    }

    setLoading(true);
    setError("");

    onError?.("");
    onLoading?.(true);

    try {
      const result =
        await resizeImage(file, {
          width: targetWidth,
          height: targetHeight,
          outputFormat,
          maxFileSize:
            targetMaxFileSize,
          sizeUnit,
        });

      onResult?.(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to resize the image.";

      setError(message);
      onError?.(message);
    } finally {
      setLoading(false);
      onLoading?.(false);
    }
  };

  return (
    <div className="resize-image">

      <div
        ref={resizeWorkspaceRef}
        className="resize-image-layout"
      >

        {/* ==================================================
            LEFT — PREVIEW
        ================================================== */}

        <div className="resize-preview-panel">

          <div className="resize-preview-heading">
            <div>
              <h3>Preview</h3>

              <p>
                Changes update instantly.
              </p>
            </div>
          </div>

          <div className="resize-preview-area">

            {!file ? (
              <div className="resize-preview-empty">

                <svg
                  width="42"
                  height="42"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                  />

                  <circle
                    cx="8.5"
                    cy="8.5"
                    r="1.5"
                  />

                  <path d="M21 15l-5-5L5 21" />
                </svg>

                <span>
                  Select an image to preview
                </span>

              </div>
            ) : (
              <div className="resize-canvas-wrapper">

                <canvas
                  ref={previewCanvasRef}
                  className="resize-preview-canvas"
                />

              </div>
            )}

          </div>

          {file &&
            originalWidth &&
            originalHeight && (
              <div className="resize-preview-info">

                <div>
                  <span>Original</span>

                  <strong>
                    {originalWidth} ×{" "}
                    {originalHeight}px
                  </strong>
                </div>

                <div>
                  <span>New size</span>

                  <strong>
                    {previewWidth &&
                    previewHeight
                      ? `${previewWidth} × ${previewHeight}px`
                      : "—"}
                  </strong>
                </div>

                <div>
                  <span>File size</span>

                  <strong>
                    {formatFileSize(
                      file.size,
                    )}
                  </strong>
                </div>

              </div>
            )}

        </div>

        {/* ==================================================
            RIGHT — SETTINGS
        ================================================== */}

        <div className="resize-settings">

          <div className="resize-image-header">

            <div>
              <h3>
                Resize Image
              </h3>

              <p>
                Set dimensions, format, DPI and file size.
              </p>
            </div>

          </div>

          {file && (
            <div className="resize-file-info">

              <div className="resize-file-icon">

                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                  />

                  <circle
                    cx="8.5"
                    cy="8.5"
                    r="1.5"
                  />

                  <path d="M21 15l-5-5L5 21" />
                </svg>

              </div>

              <div className="resize-file-details">

                <strong>
                  {file.name}
                </strong>

                <span>
                  {originalWidth} ×{" "}
                  {originalHeight}px
                </span>

              </div>

            </div>
          )}

          {/* DIMENSIONS */}

          <div className="resize-section">

            <div className="resize-section-heading">

              <div>
                <h4>
                  Dimensions
                </h4>

                <p>
                  Width and height are independent.
                </p>
              </div>

              <select
                value={dimensionUnit}
                onChange={(e) =>
                  handleDimensionUnitChange(
                    e.target.value as DimensionUnit,
                  )
                }
                disabled={loading}
                className="resize-dimension-unit"
                aria-label="Dimension unit"
              >
                {DIMENSION_UNITS.map(
                  (unit) => (
                    <option
                      key={unit.value}
                      value={unit.value}
                    >
                      {unit.label}
                    </option>
                  ),
                )}
              </select>

            </div>

            <div className="resize-fields">

              <div className="resize-field">

                <label htmlFor="resize-width">
                  Width
                </label>

                <div className="resize-input-wrapper">

                  <input
                    id="resize-width"
                    type="number"
                    min="0.01"
                    value={width}
                    onChange={(e) =>
                      setWidth(
                        e.target.value,
                      )
                    }
                    placeholder="Width"
                    disabled={loading}
                  />

                  <span>
                    {dimensionUnit}
                  </span>

                </div>

              </div>

              <div className="resize-field">

                <label htmlFor="resize-height">
                  Height
                </label>

                <div className="resize-input-wrapper">

                  <input
                    id="resize-height"
                    type="number"
                    min="0.01"
                    value={height}
                    onChange={(e) =>
                      setHeight(
                        e.target.value,
                      )
                    }
                    placeholder="Height"
                    disabled={loading}
                  />

                  <span>
                    {dimensionUnit}
                  </span>

                </div>

              </div>

            </div>

          </div>

          {/* DPI */}

          <div className="resize-section">

            <div className="resize-section-heading">

              <div>
                <h4>DPI</h4>

                <p>
                  Used when converting inches, cm or mm to pixels.
                </p>
              </div>

            </div>

            <div className="resize-input-wrapper">

              <input
                type="number"
                min="1"
                max="1200"
                value={dpi}
                onChange={(e) =>
                  setDpi(
                    e.target.value,
                  )
                }
                disabled={loading}
              />

              <span>
                DPI
              </span>

            </div>

          </div>

          {/* OUTPUT FORMAT */}

          <div className="resize-section">

            <div className="resize-section-heading">

              <div>
                <h4>
                  Output format
                </h4>

                <p>
                  Choose the output image format.
                </p>
              </div>

              <span className="resize-selected-format">
                {outputFormat.toUpperCase()}
              </span>

            </div>

            <div className="resize-format-options">

              {FORMAT_OPTIONS.map(
                (format, index) => {

                  const selected =
                    outputFormat ===
                    format.value;

                  const isPrimary =
                    index < 4;

                  return (
                    <button
                      key={format.value}
                      type="button"
                      className={[
                        "resize-format-button",
                        isPrimary
                          ? "resize-format-primary"
                          : "resize-format-secondary",
                        selected
                          ? "selected"
                          : "",
                      ].join(" ")}
                      onClick={() =>
                        setOutputFormat(
                          format.value,
                        )
                      }
                      disabled={loading}
                    >
                      {format.label}
                    </button>
                  );
                },
              )}

            </div>

          </div>

          {/* MAX FILE SIZE */}

          <div className="resize-section">

            <div className="resize-section-heading">

              <div>
                <h4>
                  Maximum file size
                </h4>

                <p>
                  Optional output size limit.
                </p>
              </div>

            </div>

            <div className="resize-max-size-row">

              <div className="resize-input-wrapper">

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={maxFileSize}
                  onChange={(e) =>
                    setMaxFileSize(
                      e.target.value,
                    )
                  }
                  placeholder="Maximum size"
                  disabled={loading}
                />

              </div>

              <select
                value={sizeUnit}
                onChange={(e) =>
                  setSizeUnit(
                    e.target.value as SizeUnit,
                  )
                }
                disabled={loading}
                className="resize-unit-select"
              >
                <option value="KB">
                  KB
                </option>

                <option value="MB">
                  MB
                </option>
              </select>

            </div>

          </div>

          {/* ERROR */}

          {error && (
            <div className="resize-error">

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

                <path d="M12 8v5" />
                <path d="M12 16h.01" />
              </svg>

              <span>
                {error}
              </span>

            </div>
          )}

          {/* RESIZE BUTTON */}

          <button
            type="button"
            className="resize-button"
            onClick={handleResize}
            disabled={
              loading || !file
            }
          >
            {loading ? (
              <>
                <span className="resize-spinner" />

                Resizing...
              </>
            ) : (
              <>
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M8 3H3v5" />
                  <path d="M3 3l7 7" />

                  <path d="M16 21h5v-5" />
                  <path d="M21 21l-7-7" />

                  <path d="M21 8V3h-5" />
                  <path d="M21 3l-7 7" />

                  <path d="M3 16v5h5" />
                  <path d="M3 21l7-7" />
                </svg>

                Resize Image
              </>
            )}
          </button>

        </div>

      </div>

    </div>
  );
};

export default ResizeImage;