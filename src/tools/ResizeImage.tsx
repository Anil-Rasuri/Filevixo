import { useEffect, useMemo, useState } from "react";

interface ResizeImageProps {
  selectedFile: File | null;
  loading: boolean;
  onStart: () => void;
  onResult: (
    url: string,
    name: string,
    size: number
  ) => void;
  onError: (message: unknown) => void;
}

type Unit = "px" | "inch" | "cm" | "mm" | "%";
type ResizeMode = "auto" | "scale" | "fixed";
type OutputFormat = "jpg" | "png" | "webp";

const API_URL = "http://127.0.0.1:8000/api/resize-image";

const MAX_DIMENSION = 10000;

function convertToPixels(
  value: number,
  unit: Unit,
  dpi: number,
  originalPixels: number
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (unit === "px") {
    return value;
  }

  if (unit === "%") {
    return (originalPixels * value) / 100;
  }

  if (unit === "inch") {
    return value * dpi;
  }

  if (unit === "cm") {
    return (value / 2.54) * dpi;
  }

  if (unit === "mm") {
    return (value / 25.4) * dpi;
  }

  return value;
}

function pixelsToUnit(
  pixels: number,
  unit: Unit,
  dpi: number,
  originalPixels: number
): number {
  if (!Number.isFinite(pixels)) {
    return 0;
  }

  if (unit === "px") {
    return pixels;
  }

  if (unit === "%") {
    if (!originalPixels) {
      return 100;
    }

    return (pixels / originalPixels) * 100;
  }

  if (unit === "inch") {
    return pixels / dpi;
  }

  if (unit === "cm") {
    return (pixels / dpi) * 2.54;
  }

  if (unit === "mm") {
    return (pixels / dpi) * 25.4;
  }

  return pixels;
}

function cleanNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "";
  }

  if (Math.abs(value - Math.round(value)) < 0.01) {
    return String(Math.round(value));
  }

  return value.toFixed(2).replace(/\.?0+$/, "");
}

function clampDimension(value: number): number {
  return Math.max(1, Math.round(value));
}

export default function ResizeImage({
  selectedFile,
  loading,
  onStart,
  onResult,
  onError,
}: ResizeImageProps) {
  const [previewUrl, setPreviewUrl] = useState("");

  const [originalWidth, setOriginalWidth] = useState(0);
  const [originalHeight, setOriginalHeight] = useState(0);

  const [resizeMode, setResizeMode] =
    useState<ResizeMode>("fixed");

  const [lockAspect, setLockAspect] =
    useState(false);

  const [unit, setUnit] =
    useState<Unit>("px");

  const [width, setWidth] =
    useState("");

  const [height, setHeight] =
    useState("");

  const [dpi, setDpi] =
    useState("96");

  const [outputFormat, setOutputFormat] =
    useState<OutputFormat>("jpg");

  const [maxFileSize, setMaxFileSize] =
    useState("");

  const [lastEdited, setLastEdited] =
    useState<"width" | "height">("width");

  const [error, setError] =
    useState("");

  /*
   * LOAD IMAGE
   */

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl("");
      setOriginalWidth(0);
      setOriginalHeight(0);
      setWidth("");
      setHeight("");
      setResizeMode("fixed");
      setLockAspect(false);
      setUnit("px");
      setDpi("96");
      setOutputFormat("jpg");
      setMaxFileSize("");
      setError("");

      return;
    }

    setResizeMode("fixed");
    setLockAspect(false);
    setUnit("px");
    setDpi("96");
    setOutputFormat("jpg");
    setMaxFileSize("");
    setLastEdited("width");
    setError("");

    const objectUrl =
      URL.createObjectURL(selectedFile);

    setPreviewUrl(objectUrl);

    const image = new Image();

    image.onload = () => {
      const imageWidth =
        image.naturalWidth;

      const imageHeight =
        image.naturalHeight;

      setOriginalWidth(imageWidth);
      setOriginalHeight(imageHeight);

      setWidth(String(imageWidth));
      setHeight(String(imageHeight));
    };

    image.onerror = () => {
      setError(
        "Unable to read this image."
      );
    };

    image.src = objectUrl;

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  /*
   * CURRENT OUTPUT PIXELS
   */

  const outputPixels = useMemo(() => {
    const widthNumber = Number(width);
    const heightNumber = Number(height);
    const dpiNumber = Number(dpi) || 96;

    return {
      width: convertToPixels(
        widthNumber,
        unit,
        dpiNumber,
        originalWidth
      ),

      height: convertToPixels(
        heightNumber,
        unit,
        dpiNumber,
        originalHeight
      ),
    };
  }, [
    width,
    height,
    unit,
    dpi,
    originalWidth,
    originalHeight,
  ]);

  /*
   * PREVIEW
   */

  const previewSize = useMemo(() => {
    if (
      !outputPixels.width ||
      !outputPixels.height
    ) {
      return {
        width: 0,
        height: 0,
      };
    }

    const maxWidth = 610;
    const maxHeight = 420;

    const scale = Math.min(
      maxWidth / outputPixels.width,
      maxHeight / outputPixels.height,
      1
    );

    return {
      width: Math.max(
        1,
        Math.round(
          outputPixels.width * scale
        )
      ),

      height: Math.max(
        1,
        Math.round(
          outputPixels.height * scale
        )
      ),
    };
  }, [outputPixels]);

  /*
   * WIDTH CHANGE
   */

  const handleWidthChange = (
    value: string
  ) => {
    setLastEdited("width");
    setWidth(value);

    if (
      !lockAspect ||
      !originalWidth ||
      !originalHeight
    ) {
      return;
    }

    const numericValue = Number(value);

    if (
      !Number.isFinite(numericValue) ||
      numericValue <= 0
    ) {
      return;
    }

    const dpiNumber =
      Number(dpi) || 96;

    const widthPixels =
      convertToPixels(
        numericValue,
        unit,
        dpiNumber,
        originalWidth
      );

    const heightPixels =
      (widthPixels / originalWidth) *
      originalHeight;

    const newHeight =
      pixelsToUnit(
        heightPixels,
        unit,
        dpiNumber,
        originalHeight
      );

    setHeight(
      cleanNumber(newHeight)
    );
  };

  /*
   * HEIGHT CHANGE
   */

  const handleHeightChange = (
    value: string
  ) => {
    setLastEdited("height");
    setHeight(value);

    if (
      !lockAspect ||
      !originalWidth ||
      !originalHeight
    ) {
      return;
    }

    const numericValue = Number(value);

    if (
      !Number.isFinite(numericValue) ||
      numericValue <= 0
    ) {
      return;
    }

    const dpiNumber =
      Number(dpi) || 96;

    const heightPixels =
      convertToPixels(
        numericValue,
        unit,
        dpiNumber,
        originalHeight
      );

    const widthPixels =
      (heightPixels / originalHeight) *
      originalWidth;

    const newWidth =
      pixelsToUnit(
        widthPixels,
        unit,
        dpiNumber,
        originalWidth
      );

    setWidth(
      cleanNumber(newWidth)
    );
  };

  /*
   * UNIT CHANGE
   *
   * Convert the CURRENT dimensions to pixels first,
   * then convert those pixels into the new unit.
   */

  const handleUnitChange = (
    newUnit: Unit
  ) => {
    if (
      !originalWidth ||
      !originalHeight
    ) {
      setUnit(newUnit);
      return;
    }

    const dpiNumber =
      Number(dpi) || 96;

    const currentWidthPixels =
      convertToPixels(
        Number(width),
        unit,
        dpiNumber,
        originalWidth
      );

    const currentHeightPixels =
      convertToPixels(
        Number(height),
        unit,
        dpiNumber,
        originalHeight
      );

    const newWidth =
      pixelsToUnit(
        currentWidthPixels,
        newUnit,
        dpiNumber,
        originalWidth
      );

    const newHeight =
      pixelsToUnit(
        currentHeightPixels,
        newUnit,
        dpiNumber,
        originalHeight
      );

    setUnit(newUnit);

    setWidth(
      cleanNumber(newWidth)
    );

    setHeight(
      cleanNumber(newHeight)
    );
  };

  /*
   * DPI CHANGE
   *
   * Physical units depend on DPI.
   * Pixels and percentage do not.
   */

  const handleDpiChange = (
    value: string
  ) => {
    const oldDpi =
      Number(dpi) || 96;

    const newDpi =
      Number(value);

    if (
      !Number.isFinite(newDpi) ||
      newDpi <= 0
    ) {
      setDpi(value);
      return;
    }

    if (
      !originalWidth ||
      !originalHeight
    ) {
      setDpi(value);
      return;
    }

    /*
     * If using physical units, preserve
     * the current pixel dimensions when DPI changes.
     */

    if (
      unit === "inch" ||
      unit === "cm" ||
      unit === "mm"
    ) {
      const currentWidthPixels =
        convertToPixels(
          Number(width),
          unit,
          oldDpi,
          originalWidth
        );

      const currentHeightPixels =
        convertToPixels(
          Number(height),
          unit,
          oldDpi,
          originalHeight
        );

      const newWidth =
        pixelsToUnit(
          currentWidthPixels,
          unit,
          newDpi,
          originalWidth
        );

      const newHeight =
        pixelsToUnit(
          currentHeightPixels,
          unit,
          newDpi,
          originalHeight
        );

      setDpi(value);

      setWidth(
        cleanNumber(newWidth)
      );

      setHeight(
        cleanNumber(newHeight)
      );

      return;
    }

    setDpi(value);
  };

  /*
   * ASPECT RATIO
   */

  const toggleAspectRatio = () => {
    const next =
      !lockAspect;

    setLockAspect(next);

    if (
      !next ||
      !originalWidth ||
      !originalHeight
    ) {
      return;
    }

    const dpiNumber =
      Number(dpi) || 96;

    if (lastEdited === "width") {
      const widthPixels =
        convertToPixels(
          Number(width),
          unit,
          dpiNumber,
          originalWidth
        );

      const heightPixels =
        (widthPixels / originalWidth) *
        originalHeight;

      setHeight(
        cleanNumber(
          pixelsToUnit(
            heightPixels,
            unit,
            dpiNumber,
            originalHeight
          )
        )
      );
    } else {
      const heightPixels =
        convertToPixels(
          Number(height),
          unit,
          dpiNumber,
          originalHeight
        );

      const widthPixels =
        (heightPixels / originalHeight) *
        originalWidth;

      setWidth(
        cleanNumber(
          pixelsToUnit(
            widthPixels,
            unit,
            dpiNumber,
            originalWidth
          )
        )
      );
    }
  };

  /*
   * RESIZE MODE
   */

  const changeResizeMode = (
    mode: ResizeMode
  ) => {
    setResizeMode(mode);

    if (mode === "fixed") {
      setLockAspect(false);
      return;
    }

    if (
      (mode === "auto" ||
        mode === "scale") &&
      !lockAspect &&
      originalWidth &&
      originalHeight
    ) {
      setLockAspect(true);

      const dpiNumber =
        Number(dpi) || 96;

      const widthPixels =
        convertToPixels(
          Number(width),
          unit,
          dpiNumber,
          originalWidth
        );

      const heightPixels =
        (widthPixels / originalWidth) *
        originalHeight;

      setHeight(
        cleanNumber(
          pixelsToUnit(
            heightPixels,
            unit,
            dpiNumber,
            originalHeight
          )
        )
      );
    }
  };

  /*
   * RESIZE
   */

  const handleResize = async () => {
    setError("");

    if (!selectedFile) {
      onError(
        "Please select an image first."
      );
      return;
    }

    const widthNumber =
      Number(width);

    const heightNumber =
      Number(height);

    const dpiNumber =
      Number(dpi);

    if (
      !Number.isFinite(widthNumber) ||
      widthNumber <= 0
    ) {
      setError(
        "Please enter a valid width."
      );
      return;
    }

    if (
      !Number.isFinite(heightNumber) ||
      heightNumber <= 0
    ) {
      setError(
        "Please enter a valid height."
      );
      return;
    }

    if (
      !Number.isFinite(dpiNumber) ||
      dpiNumber < 1 ||
      dpiNumber > 1200
    ) {
      setError(
        "DPI must be between 1 and 1200."
      );
      return;
    }

    /*
     * IMPORTANT:
     *
     * Always convert the selected unit
     * into actual pixel dimensions before
     * sending to the backend.
     */

    const widthPixels =
      clampDimension(
        convertToPixels(
          widthNumber,
          unit,
          dpiNumber,
          originalWidth
        )
      );

    const heightPixels =
      clampDimension(
        convertToPixels(
          heightNumber,
          unit,
          dpiNumber,
          originalHeight
        )
      );

    if (
      widthPixels < 1 ||
      heightPixels < 1
    ) {
      setError(
        "Output dimensions must be at least 1 pixel."
      );
      return;
    }

    if (
      widthPixels > MAX_DIMENSION ||
      heightPixels > MAX_DIMENSION
    ) {
      setError(
        `Maximum output dimension is ${MAX_DIMENSION}px.`
      );
      return;
    }

    if (maxFileSize.trim()) {
      const maxKB =
        Number(maxFileSize);

      if (
        !Number.isFinite(maxKB) ||
        maxKB <= 0
      ) {
        setError(
          "Please enter a valid maximum file size."
        );
        return;
      }
    }

    onStart();

    try {
      const formData =
        new FormData();

      formData.append(
        "file",
        selectedFile
      );

      /*
       * SEND PIXELS TO BACKEND
       */

      formData.append(
        "width",
        String(widthPixels)
      );

      formData.append(
        "height",
        String(heightPixels)
      );

      formData.append(
        "maintain_aspect",
        String(lockAspect)
      );

      /*
       * Keep unit information for
       * compatibility with the backend.
       */

      formData.append(
        "unit",
        "px"
      );

      formData.append(
        "output_format",
        outputFormat
      );

      formData.append(
        "dpi",
        String(dpiNumber)
      );

      formData.append(
        "export_mode",
        resizeMode
      );

      if (maxFileSize.trim()) {
        formData.append(
          "max_file_size_kb",
          String(
            Number(maxFileSize)
          )
        );
      }

      const response =
        await fetch(API_URL, {
          method: "POST",
          body: formData,
        });

      if (!response.ok) {
        let message =
          "Resize failed.";

        try {
          const data =
            await response.json();

          if (
            typeof data.detail ===
            "string"
          ) {
            message =
              data.detail;
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
          "The server returned an empty file."
        );
      }

      const url =
        URL.createObjectURL(blob);

      onResult(
        url,
        `filevixo-resized.${outputFormat}`,
        blob.size
      );
    } catch (error) {
      onError(error);
    }
  };

  const outputWidth =
    Math.round(
      outputPixels.width
    );

  const outputHeight =
    Math.round(
      outputPixels.height
    );

  return (
    <div className="mt-5 sm:mt-6">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_390px]">
          {/* PREVIEW */}

          <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-950">
                  Preview
                </h2>

                <p className="mt-0.5 text-xs text-slate-500">
                  Review your resized image
                </p>
              </div>

              {outputWidth > 0 &&
                outputHeight > 0 && (
                  <div className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                    {outputWidth} ×{" "}
                    {outputHeight} px
                  </div>
                )}
            </div>

            <div className="flex h-[420px] items-center justify-center overflow-hidden bg-slate-50 p-6 sm:h-[460px] lg:h-[500px]">
              {previewUrl &&
              previewSize.width > 0 ? (
                <div
                  className="overflow-hidden rounded-lg border-4 border-white bg-white shadow-xl"
                  style={{
                    width:
                      previewSize.width,
                    height:
                      previewSize.height,
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }}
                >
                  <img
                    src={previewUrl}
                    alt="Resize preview"
                    className="h-full w-full object-fill"
                  />
                </div>
              ) : (
                <div className="text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-white shadow-sm">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-7 w-7 text-slate-400"
                    >
                      <rect
                        x="3"
                        y="4"
                        width="18"
                        height="16"
                        rx="2"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />

                      <circle
                        cx="8"
                        cy="9"
                        r="1.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />

                      <path
                        d="m4 17 5-5 3 3 2-2 6 5"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <p className="mt-3 text-sm font-semibold text-slate-600">
                    Upload an image
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    Your preview will appear here
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 border-t border-slate-200">
              <div className="px-5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Original
                </p>

                <p className="mt-1 text-sm font-bold text-slate-900">
                  {originalWidth
                    ? `${originalWidth} × ${originalHeight}`
                    : "—"}
                </p>

                <p className="text-[11px] text-slate-500">
                  pixels
                </p>
              </div>

              <div className="border-l border-slate-200 px-5 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Output
                </p>

                <p className="mt-1 text-sm font-bold text-slate-900">
                  {outputWidth > 0 &&
                  outputHeight > 0
                    ? `${outputWidth} × ${outputHeight}`
                    : "—"}
                </p>

                <p className="text-[11px] text-slate-500">
                  pixels
                </p>
              </div>
            </div>
          </div>

          {/* SETTINGS */}

          <div className="bg-white">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-bold text-slate-950">
                Resize settings
              </h2>

              <p className="mt-0.5 text-xs text-slate-500">
                Set the exact output you need
              </p>
            </div>

            <div className="space-y-4 p-5">
              {/* DIMENSIONS */}

              <div>
                <div className="mb-2.5">
                  <p className="text-xs font-bold text-slate-800">
                    Dimensions
                  </p>
                </div>

                <div className="grid grid-cols-5 rounded-lg bg-slate-100 p-1">
                  {(
                    [
                      "px",
                      "inch",
                      "cm",
                      "mm",
                      "%",
                    ] as Unit[]
                  ).map((item) => (
                    <button
                      key={item}
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        handleUnitChange(
                          item
                        )
                      }
                      className={`rounded-md py-2 text-[11px] font-bold transition ${
                        unit === item
                          ? "bg-white text-blue-600 shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                      Width {unit}
                    </label>

                    <input
                      type="number"
                      min="1"
                      value={width}
                      onChange={(event) =>
                        handleWidthChange(
                          event.target.value
                        )
                      }
                      disabled={loading}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                      Height {unit}
                    </label>

                    <input
                      type="number"
                      min="1"
                      value={height}
                      onChange={(event) =>
                        handleHeightChange(
                          event.target.value
                        )
                      }
                      disabled={loading}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                {/* ASPECT RATIO */}

                <button
                  type="button"
                  onClick={
                    toggleAspectRatio
                  }
                  disabled={loading}
                  className="mt-2.5 flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-800">
                      Lock aspect ratio
                    </p>

                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {lockAspect
                        ? "Width and height stay proportional"
                        : "Width and height can change independently"}
                    </p>
                  </div>

                  <span
                    className={`relative h-5 w-9 rounded-full transition ${
                      lockAspect
                        ? "bg-blue-600"
                        : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${
                        lockAspect
                          ? "left-[18px]"
                          : "left-0.5"
                      }`}
                    />
                  </span>
                </button>
              </div>

              {/* RESIZE MODE */}

              <div>
                <p className="mb-2 text-xs font-bold text-slate-800">
                  Resize mode
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      [
                        "auto",
                        "Auto",
                        "Proportional",
                      ],
                      [
                        "scale",
                        "Scale",
                        "Resize proportionally",
                      ],
                      [
                        "fixed",
                        "Fixed",
                        "Exact dimensions",
                      ],
                    ] as [
                      ResizeMode,
                      string,
                      string
                    ][]
                  ).map(
                    ([
                      value,
                      title,
                      description,
                    ]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          changeResizeMode(
                            value
                          )
                        }
                        disabled={loading}
                        className={`rounded-lg border px-2 py-2.5 text-left transition ${
                          resizeMode ===
                          value
                            ? "border-blue-500 bg-blue-50"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-900">
                          {title}
                        </p>

                        <p className="mt-0.5 text-[9px] leading-3 text-slate-500">
                          {description}
                        </p>
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* OUTPUT */}

              <div>
                <p className="mb-2 text-xs font-bold text-slate-800">
                  Output
                </p>

                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["jpg", "JPG"],
                      ["png", "PNG"],
                      ["webp", "WebP"],
                    ] as [
                      OutputFormat,
                      string
                    ][]
                  ).map(
                    ([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setOutputFormat(
                            value
                          )
                        }
                        disabled={loading}
                        className={`rounded-lg border py-2.5 text-xs font-bold transition ${
                          outputFormat ===
                          value
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                      DPI
                    </label>

                    <input
                      type="number"
                      min="1"
                      max="1200"
                      value={dpi}
                      onChange={(event) =>
                        handleDpiChange(
                          event.target.value
                        )
                      }
                      disabled={loading}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-slate-600">
                      Max file size
                    </label>

                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        value={
                          maxFileSize
                        }
                        onChange={(event) =>
                          setMaxFileSize(
                            event.target.value
                          )
                        }
                        disabled={loading}
                        placeholder="Optional"
                        className="w-full rounded-lg border border-slate-200 px-3 py-2.5 pr-10 text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />

                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                        KB
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ERROR */}

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-xs font-medium text-red-700">
                    {error}
                  </p>
                </div>
              )}

              {/* ACTION */}

              <button
                type="button"
                onClick={handleResize}
                disabled={
                  loading ||
                  !selectedFile ||
                  !width ||
                  !height
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Resizing...
                  </>
                ) : (
                  "Resize Image"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}