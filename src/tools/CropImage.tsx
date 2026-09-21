import { useEffect, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PercentCrop,
} from "react-image-crop";

import "react-image-crop/dist/ReactCrop.css";

interface CropImageProps {
  selectedFile: File | null;
  loading: boolean;
  onStart: () => void;
  onResult: (
    url: string,
    name: string,
    size: number
  ) => void;
  onError: (message: string) => void;
}

type Preset = {
  label: string;
  ratio: number | null;
};

const presets: Preset[] = [
  {
    label: "Free",
    ratio: null,
  },
  {
    label: "Square (1:1)",
    ratio: 1,
  },
  {
    label: "Widescreen (16:9)",
    ratio: 16 / 9,
  },
  {
    label: "Standard (4:3)",
    ratio: 4 / 3,
  },
  {
    label: "Photo (3:2)",
    ratio: 3 / 2,
  },
  {
    label: "Portrait (2:3)",
    ratio: 2 / 3,
  },
  {
    label: "Vertical (9:16)",
    ratio: 9 / 16,
  },
  {
    label: "Custom",
    ratio: null,
  },
];

function createFreeCrop(
  width: number,
  height: number
): Crop {
  return centerCrop(
    {
      unit: "%",
      width: 80,
      height: 80,
    },
    width,
    height
  );
}

function createRatioCrop(
  width: number,
  height: number,
  ratio: number
): Crop {
  const crop = makeAspectCrop(
    {
      unit: "%",
      width: 80,
    },
    ratio,
    width,
    height
  );

  return centerCrop(
    crop,
    width,
    height
  );
}

function getAspectRatio(
  selectedPreset: string,
  customWidth: string,
  customHeight: string
): number | undefined {
  if (selectedPreset === "Custom") {
    const width = Number(customWidth);
    const height = Number(customHeight);

    if (
      !width ||
      !height ||
      width <= 0 ||
      height <= 0
    ) {
      return undefined;
    }

    return width / height;
  }

  const preset = presets.find(
    (item) => item.label === selectedPreset
  );

  return preset?.ratio ?? undefined;
}

function cropToPixels(
  crop: Crop,
  image: HTMLImageElement
) {
  if (!image.width || !image.height) {
    return null;
  }

  let x = crop.x ?? 0;
  let y = crop.y ?? 0;
  let width = crop.width ?? 0;
  let height = crop.height ?? 0;

  if (crop.unit === "%") {
    x = (x / 100) * image.width;
    y = (y / 100) * image.height;
    width = (width / 100) * image.width;
    height = (height / 100) * image.height;
  }

  const scaleX =
    image.naturalWidth / image.width;

  const scaleY =
    image.naturalHeight / image.height;

  return {
    x: Math.round(x * scaleX),
    y: Math.round(y * scaleY),
    width: Math.round(width * scaleX),
    height: Math.round(height * scaleY),
  };
}

export default function CropImage({
  selectedFile,
  loading,
  onStart,
  onResult,
  onError,
}: CropImageProps) {
  const imageRef =
    useRef<HTMLImageElement | null>(null);

  const [imageUrl, setImageUrl] =
    useState("");

  const [crop, setCrop] =
    useState<Crop | undefined>();

  const [completedCrop, setCompletedCrop] =
    useState<PercentCrop | null>(null);

  const [selectedPreset, setSelectedPreset] =
    useState("Photo (3:2)");

  const [customWidth, setCustomWidth] =
    useState("3");

  const [customHeight, setCustomHeight] =
    useState("2");

  /*
   * ---------------------------------------------------------
   * CREATE IMAGE URL
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (!selectedFile) {
      setImageUrl("");
      setCrop(undefined);
      setCompletedCrop(null);
      return;
    }

    const url =
      URL.createObjectURL(selectedFile);

    setImageUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  /*
   * ---------------------------------------------------------
   * IMAGE LOAD
   * ---------------------------------------------------------
   */

  const handleImageLoad = (
    event: React.SyntheticEvent<HTMLImageElement>
  ) => {
    const image = event.currentTarget;

    imageRef.current = image;

    const ratio = getAspectRatio(
      selectedPreset,
      customWidth,
      customHeight
    );

    let newCrop: Crop;

    if (ratio) {
      newCrop = createRatioCrop(
        image.width,
        image.height,
        ratio
      );
    } else {
      newCrop = createFreeCrop(
        image.width,
        image.height
      );
    }

    setCrop(newCrop);

    setCompletedCrop(
      newCrop as PercentCrop
    );
  };

  /*
   * ---------------------------------------------------------
   * CREATE NEW CROP
   * ---------------------------------------------------------
   */

  const applyPresetToImage = (
    preset: Preset
  ) => {
    const image =
      imageRef.current;

    if (!image) {
      return;
    }

    let newCrop: Crop;

    /*
     * FREE
     */

    if (
      preset.label === "Free"
    ) {
      newCrop = createFreeCrop(
        image.width,
        image.height
      );
    }

    /*
     * CUSTOM
     */

    else if (
      preset.label === "Custom"
    ) {
      const width =
        Number(customWidth);

      const height =
        Number(customHeight);

      if (
        !width ||
        !height ||
        width <= 0 ||
        height <= 0
      ) {
        setCrop(undefined);
        setCompletedCrop(null);
        return;
      }

      const ratio =
        width / height;

      newCrop =
        createRatioCrop(
          image.width,
          image.height,
          ratio
        );
    }

    /*
     * NORMAL PRESET
     */

    else {
      const ratio =
        preset.ratio;

      if (!ratio) {
        newCrop = createFreeCrop(
          image.width,
          image.height
        );
      } else {
        newCrop =
          createRatioCrop(
            image.width,
            image.height,
            ratio
          );
      }
    }

    /*
     * IMPORTANT:
     * Update BOTH states immediately.
     */

    setCrop(newCrop);

    setCompletedCrop(
      newCrop as PercentCrop
    );
  };

  /*
   * ---------------------------------------------------------
   * PRESET CHANGE
   * ---------------------------------------------------------
   */

  const handlePresetChange = (
    preset: Preset
  ) => {
    setSelectedPreset(
      preset.label
    );

    /*
     * Let React update selectedPreset
     * first, then apply the crop.
     */

    requestAnimationFrame(() => {
      applyPresetToImage(
        preset
      );
    });
  };

  /*
   * ---------------------------------------------------------
   * CUSTOM RATIO
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (
      selectedPreset !== "Custom"
    ) {
      return;
    }

    const image =
      imageRef.current;

    if (!image) {
      return;
    }

    const width =
      Number(customWidth);

    const height =
      Number(customHeight);

    if (
      !width ||
      !height ||
      width <= 0 ||
      height <= 0
    ) {
      return;
    }

    const ratio =
      width / height;

    const newCrop =
      createRatioCrop(
        image.width,
        image.height,
        ratio
      );

    setCrop(newCrop);

    setCompletedCrop(
      newCrop as PercentCrop
    );
  }, [
    customWidth,
    customHeight,
    selectedPreset,
  ]);

  /*
   * ---------------------------------------------------------
   * RESET
   * ---------------------------------------------------------
   */

  const handleReset = () => {
    const image =
      imageRef.current;

    if (!image) {
      return;
    }

    const preset =
      presets.find(
        (item) =>
          item.label ===
          "Photo (3:2)"
      );

    setSelectedPreset(
      "Photo (3:2)"
    );

    setCustomWidth("3");
    setCustomHeight("2");

    const newCrop =
      createRatioCrop(
        image.width,
        image.height,
        preset?.ratio ?? 3 / 2
      );

    setCrop(newCrop);

    setCompletedCrop(
      newCrop as PercentCrop
    );
  };

  /*
   * ---------------------------------------------------------
   * APPLY CROP
   * ---------------------------------------------------------
   */

  const handleApply = async () => {
    if (!selectedFile) {
      onError(
        "Please select an image first."
      );
      return;
    }

    const image =
      imageRef.current;

    if (!image) {
      onError(
        "Image is not ready."
      );
      return;
    }

    if (!crop) {
      onError(
        "Please select a crop area."
      );
      return;
    }

    const pixelCrop =
      cropToPixels(
        crop,
        image
      );

    if (!pixelCrop) {
      onError(
        "Could not determine crop area."
      );
      return;
    }

    if (
      pixelCrop.width <= 0 ||
      pixelCrop.height <= 0
    ) {
      onError(
        "Please select a valid crop area."
      );
      return;
    }

    onStart();

    try {
      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        pixelCrop.width;

      canvas.height =
        pixelCrop.height;

      const context =
        canvas.getContext(
          "2d"
        );

      if (!context) {
        throw new Error(
          "Could not create image canvas."
        );
      }

      context.imageSmoothingEnabled =
        true;

      context.imageSmoothingQuality =
        "high";

      context.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      const blob =
        await new Promise<Blob | null>(
          (resolve) => {
            canvas.toBlob(
              resolve,
              "image/jpeg",
              0.95
            );
          }
        );

      if (!blob) {
        throw new Error(
          "Could not create cropped image."
        );
      }

      const baseName =
        selectedFile.name.replace(
          /\.[^/.]+$/,
          ""
        );

      const fileName =
        `${baseName}-cropped.jpg`;

      const url =
        URL.createObjectURL(
          blob
        );

      /*
       * Direct download.
       */

      const link =
        document.createElement(
          "a"
        );

      link.href = url;
      link.download =
        fileName;

      document.body.appendChild(
        link
      );

      link.click();

      link.remove();

      /*
       * Tell App that processing
       * finished.
       */

      onResult(
        url,
        fileName,
        blob.size
      );

      /*
       * Give browser enough time
       * to start the download.
       */

      setTimeout(() => {
        URL.revokeObjectURL(
          url
        );
      }, 10000);
    } catch (error) {
      onError(
        error instanceof Error
          ? error.message
          : "Something went wrong while cropping."
      );
    }
  };

  /*
   * ---------------------------------------------------------
   * NO FILE
   * ---------------------------------------------------------
   */

  if (
    !selectedFile ||
    !imageUrl
  ) {
    return null;
  }

  const currentAspect =
    getAspectRatio(
      selectedPreset,
      customWidth,
      customHeight
    );

  /*
   * ---------------------------------------------------------
   * UI
   * ---------------------------------------------------------
   */

  return (
    <div className="mt-5 sm:mt-6">

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_320px]">

        {/* =================================================
            IMAGE PREVIEW
        ================================================= */}

        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3 sm:p-4">

          <div className="flex min-h-[360px] items-center justify-center overflow-hidden rounded-xl bg-slate-950 p-2 sm:min-h-[420px]">

            <ReactCrop
              crop={crop}
              onChange={(
                newCrop,
                percentCrop
              ) => {
                setCrop(
                  percentCrop
                );
              }}
              onComplete={(
                _,
                percentCrop
              ) => {
                setCompletedCrop(
                  percentCrop
                );
              }}
              aspect={
                currentAspect
              }
              keepSelection
              ruleOfThirds
            >

              <img
                src={imageUrl}
                alt="Crop preview"
                onLoad={
                  handleImageLoad
                }
                className="block max-h-[420px] max-w-full object-contain"
              />

            </ReactCrop>

          </div>

        </div>

        {/* =================================================
            SETTINGS
        ================================================= */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">

          <div className="mb-4">

            <h3 className="text-base font-bold text-slate-950">
              Crop Image
            </h3>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Select a ratio or use a custom crop.
            </p>

          </div>

          {/* =================================================
              ASPECT RATIO
          ================================================= */}

          <div>

            <label className="mb-2 block text-xs font-semibold text-slate-700">
              Aspect Ratio
            </label>

            <div className="grid grid-cols-2 gap-2">

              {presets.map(
                (preset) => {
                  const active =
                    selectedPreset ===
                    preset.label;

                  return (
                    <button
                      key={
                        preset.label
                      }
                      type="button"
                      onClick={() =>
                        handlePresetChange(
                          preset
                        )
                      }
                      disabled={
                        loading
                      }
                      className={`rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition ${
                        active
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-600"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {
                        preset.label
                      }
                    </button>
                  );
                }
              )}

            </div>

          </div>

          {/* =================================================
              CUSTOM
          ================================================= */}

          {selectedPreset ===
            "Custom" && (
            <div className="mt-4">

              <label className="mb-2 block text-xs font-semibold text-slate-700">
                Custom Ratio
              </label>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">

                <input
                  type="number"
                  min="1"
                  value={
                    customWidth
                  }
                  onChange={(e) =>
                    setCustomWidth(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                <span className="text-sm font-semibold text-slate-400">
                  :
                </span>

                <input
                  type="number"
                  min="1"
                  value={
                    customHeight
                  }
                  onChange={(e) =>
                    setCustomHeight(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

              </div>

            </div>
          )}

          {/* =================================================
              BUTTONS
          ================================================= */}

          <div className="mt-6 grid grid-cols-2 gap-3">

            <button
              type="button"
              onClick={
                handleReset
              }
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={
                handleApply
              }
              disabled={
                loading ||
                !completedCrop
              }
              className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">

                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />

                  Cropping...

                </span>
              ) : (
                "Apply & Download"
              )}
            </button>

          </div>

          <p className="mt-4 text-center text-[11px] leading-5 text-slate-400">
            Adjust the crop box, then click Apply & Download.
          </p>

        </div>

      </div>

    </div>
  );
}