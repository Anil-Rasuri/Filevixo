import { useEffect, useRef, useState } from "react";

interface ImagesToPdfProps {
  loading: boolean;
  onStart: () => void;
  onError: (message: string) => void;
  onResult?: (
    downloadUrl: string,
    downloadName: string,
    resultSize: number,
    message: string
  ) => void;
}

type ImagesPerPage = 1 | 2 | 3 | 4 | 6 | 9;
type PageSize = "A4" | "Letter";
type Orientation = "portrait" | "landscape";
type Margin = "small" | "medium" | "large";

interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getMarginPixels = (margin: Margin) => {
  switch (margin) {
    case "small":
      return 30;

    case "large":
      return 90;

    case "medium":
    default:
      return 60;
  }
};

export default function ImagesToPdf({
  loading,
  onStart,
  onError,
  onResult,
}: ImagesToPdfProps) {
  const [images, setImages] = useState<ImageItem[]>([]);

  const [imagesPerPage, setImagesPerPage] =
    useState<ImagesPerPage>(4);

  const [pageSize, setPageSize] = useState<PageSize>("A4");

  const [orientation, setOrientation] =
    useState<Orientation>("portrait");

  const [margin, setMargin] = useState<Margin>("medium");

  const [creating, setCreating] = useState(false);

  const [downloadUrl, setDownloadUrl] = useState("");
  const [downloadName, setDownloadName] = useState(
    "filevixo-images.pdf"
  );
  const [resultSize, setResultSize] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const addMoreInputRef = useRef<HTMLInputElement | null>(null);

  const isBusy = loading || creating;

  useEffect(() => {
    return () => {
      images.forEach((image) => {
        URL.revokeObjectURL(image.previewUrl);
      });

      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, []);

  const validateFile = (file: File) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      return "Only JPG, PNG and WebP images are supported.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return `${file.name} is larger than the 25 MB limit.`;
    }

    return null;
  };

  const addImages = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const newImages: ImageItem[] = [];

    Array.from(files).forEach((file) => {
      const error = validateFile(file);

      if (error) {
        onError(error);
        return;
      }

      const duplicate = images.some(
        (image) =>
          image.file.name === file.name &&
          image.file.size === file.size &&
          image.file.lastModified === file.lastModified
      );

      const duplicateInNewFiles = newImages.some(
        (image) =>
          image.file.name === file.name &&
          image.file.size === file.size &&
          image.file.lastModified === file.lastModified
      );

      if (duplicate || duplicateInNewFiles) {
        return;
      }

      newImages.push({
        id: `${file.name}-${file.lastModified}-${Math.random()}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });

    if (newImages.length > 0) {
      setImages((current) => [...current, ...newImages]);

      // Clear old result when images change.
      clearResult();
    }
  };

  const handleMainFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    addImages(event.target.files);

    event.target.value = "";
  };

  const handleAddMoreChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    addImages(event.target.files);

    event.target.value = "";
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const imageToRemove = current.find(
        (image) => image.id === id
      );

      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
      }

      return current.filter((image) => image.id !== id);
    });

    clearResult();
  };

  const clearAllImages = () => {
    images.forEach((image) => {
      URL.revokeObjectURL(image.previewUrl);
    });

    setImages([]);

    clearResult();
  };

  const clearResult = () => {
    setDownloadUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return "";
    });

    setDownloadName("filevixo-images.pdf");
    setResultSize(null);
  };

  const handleCreatePdf = async () => {
    if (images.length === 0) {
      onError("Please select at least one image.");
      return;
    }

    if (images.length > 100) {
      onError("You can select up to 100 images at a time.");
      return;
    }

    setCreating(true);
    onStart();
    onError("");

    // Remove previous PDF.
    clearResult();

    try {
      const formData = new FormData();

      /*
       * IMPORTANT:
       * Send every image separately using the same "images" key.
       */
      images.forEach((image) => {
        formData.append("images", image.file);
      });

      /*
       * IMPORTANT:
       * Send an actual integer.
       *
       * 1 = one image on each PDF page
       * 2 = two images on each PDF page
       * 3 = three images on each PDF page
       * 4 = four images on each PDF page
       * 6 = six images on each PDF page
       * 9 = nine images on each PDF page
       */
      formData.append(
        "images_per_page",
        String(imagesPerPage)
      );

      formData.append("page_size", pageSize);

      formData.append("orientation", orientation);

      /*
       * IMPORTANT:
       * Backend expects an INTEGER.
       *
       * small  = 30
       * medium = 60
       * large  = 90
       */
      formData.append(
        "margin",
        String(getMarginPixels(margin))
      );

      const response = await fetch(
        "http://127.0.0.1:8000/api/images-to-pdf",
        {
          method: "POST",
          body: formData,
        }
      );

      if (!response.ok) {
        let message = "Failed to create PDF.";

        try {
          const data = await response.json();

          if (data?.detail) {
            message =
              typeof data.detail === "string"
                ? data.detail
                : JSON.stringify(data.detail);
          }
        } catch {
          // Keep default error message.
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      if (!blob || blob.size === 0) {
        throw new Error("The server returned an empty PDF.");
      }

      const url = URL.createObjectURL(blob);

      setDownloadUrl(url);
      setDownloadName("filevixo-images.pdf");
      setResultSize(blob.size);

      if (onResult) {
        onResult(
          url,
          "filevixo-images.pdf",
          blob.size,
          "PDF created successfully."
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while creating the PDF.";

      onError(message);
    } finally {
      setCreating(false);
    }
  };

  const getGridDescription = () => {
    switch (imagesPerPage) {
      case 1:
        return "1 image on each page";

      case 2:
        return "2 images on each page";

      case 3:
        return "3 images on each page";

      case 4:
        return "2 × 2 grid";

      case 6:
        return "2 × 3 grid";

      case 9:
        return "3 × 3 grid";

      default:
        return `${imagesPerPage} images on each page`;
    }
  };

  const totalPages = Math.ceil(
    images.length / imagesPerPage
  );

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">
          PDF Tool
        </p>

        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Images to PDF
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
          Combine multiple images into a single PDF with
          customizable page layouts.
        </p>
      </div>

      {/* Empty upload state */}
      {images.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-8 sm:p-12">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 text-orange-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-8 w-8"
              >
                <path
                  d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 18.5v-13Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <path
                  d="m7 16 3.2-3.5 2.3 2.3 1.8-2 2.7 3.2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="9"
                  cy="8.5"
                  r="1.2"
                  fill="currentColor"
                />
              </svg>
            </div>

            <h3 className="mt-5 text-lg font-bold text-slate-950">
              Select images
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              Upload JPG, PNG or WebP images to create your PDF.
            </p>

            <button
              type="button"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
              className="mt-6 inline-flex items-center justify-center rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Select Images
            </button>

            <p className="mt-3 text-xs text-slate-400">
              Maximum 25 MB per image
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={handleMainFileChange}
            />
          </div>
        </div>
      )}

      {/* Selected images */}
      {images.length > 0 && (
        <div className="space-y-6">
          {/* Add more images */}
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-orange-600">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-7 w-7"
                >
                  <rect
                    x="4"
                    y="4"
                    width="16"
                    height="16"
                    rx="2"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M12 8v8M8 12h8"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-950">
                Add more images
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Add more images without removing your current
                selection.
              </p>

              <button
                type="button"
                disabled={isBusy}
                onClick={() =>
                  addMoreInputRef.current?.click()
                }
                className="mt-5 rounded-xl bg-orange-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add More Images
              </button>

              <p className="mt-3 text-xs text-slate-400">
                JPG, PNG and WebP • Maximum 25 MB per image
              </p>

              <input
                ref={addMoreInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={handleAddMoreChange}
              />
            </div>
          </div>

          {/* Selected images list */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-950">
                  Selected Images
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  {images.length}{" "}
                  {images.length === 1 ? "image" : "images"} selected
                </p>
              </div>

              <button
                type="button"
                disabled={isBusy}
                onClick={clearAllImages}
                className="self-start text-sm font-semibold text-red-600 transition hover:text-red-700 disabled:opacity-50 sm:self-auto"
              >
                Clear all
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {images.map((image, index) => (
                <div
                  key={image.id}
                  className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    <img
                      src={image.previewUrl}
                      alt={image.file.name}
                      className="h-full w-full object-contain"
                    />

                    <div className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/80 text-xs font-bold text-white">
                      {index + 1}
                    </div>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => removeImage(image.id)}
                      aria-label={`Remove ${image.file.name}`}
                      className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white text-red-500 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        fill="none"
                        className="h-4 w-4"
                      >
                        <path
                          d="M5 5l10 10M15 5 5 15"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="p-3">
                    <p
                      className="truncate text-sm font-semibold text-slate-800"
                      title={image.file.name}
                    >
                      {image.file.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      {formatFileSize(image.file.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PDF settings */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-600">
                PDF Settings
              </p>

              <h3 className="mt-2 text-xl font-bold text-slate-950">
                Customize your PDF
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Choose how your images should be arranged on the
                PDF pages.
              </p>
            </div>

            <div className="mt-7 grid gap-7 lg:grid-cols-2">
              {/* Images per page */}
              <div>
                <label className="text-sm font-bold text-slate-900">
                  Images per page
                </label>

                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {[1, 2, 3, 4, 6, 9].map((value) => {
                    const selected =
                      imagesPerPage === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          setImagesPerPage(
                            value as ImagesPerPage
                          )
                        }
                        className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                          selected
                            ? "border-orange-600 bg-orange-600 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-2 text-xs text-slate-400">
                  {getGridDescription()}
                </p>
              </div>

              {/* Page size */}
              <div>
                <label className="text-sm font-bold text-slate-900">
                  Page size
                </label>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(["A4", "Letter"] as PageSize[]).map(
                    (value) => {
                      const selected = pageSize === value;

                      return (
                        <button
                          key={value}
                          type="button"
                          disabled={isBusy}
                          onClick={() => setPageSize(value)}
                          className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                            selected
                              ? "border-orange-600 bg-orange-600 text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          {value}
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              {/* Orientation */}
              <div>
                <label className="text-sm font-bold text-slate-900">
                  Orientation
                </label>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(
                    [
                      ["portrait", "Portrait"],
                      ["landscape", "Landscape"],
                    ] as const
                  ).map(([value, label]) => {
                    const selected =
                      orientation === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          setOrientation(value)
                        }
                        className={`rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                          selected
                            ? "border-orange-600 bg-orange-600 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Margin */}
              <div>
                <label className="text-sm font-bold text-slate-900">
                  Page margin
                </label>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(
                    [
                      ["small", "Small"],
                      ["medium", "Medium"],
                      ["large", "Large"],
                    ] as const
                  ).map(([value, label]) => {
                    const selected = margin === value;

                    return (
                      <button
                        key={value}
                        type="button"
                        disabled={isBusy}
                        onClick={() => setMargin(value)}
                        className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                          selected
                            ? "border-orange-600 bg-orange-600 text-white shadow-sm"
                            : "border-slate-200 bg-white text-slate-700 hover:border-orange-300 hover:bg-orange-50"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Create PDF */}
          <div className="overflow-hidden rounded-2xl bg-slate-950 shadow-xl">
            <div className="flex flex-col gap-6 p-6 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-400">
                  Ready to create
                </p>

                <h3 className="mt-2 text-xl font-bold text-white">
                  {images.length}{" "}
                  {images.length === 1 ? "image" : "images"} → PDF
                </h3>

                <p className="mt-2 text-sm text-slate-400">
                  {pageSize} ·{" "}
                  {orientation === "portrait"
                    ? "Portrait"
                    : "Landscape"}{" "}
                  · {imagesPerPage} images per page · {margin}{" "}
                  margin
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  Expected PDF pages: {totalPages}
                </p>
              </div>

              <button
                type="button"
                disabled={isBusy || images.length === 0}
                onClick={handleCreatePdf}
                className="inline-flex shrink-0 items-center justify-center gap-3 rounded-xl bg-orange-600 px-7 py-3.5 text-sm font-bold text-white shadow-lg transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isBusy ? (
                  <>
                    <svg
                      className="h-5 w-5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeWidth="3"
                        opacity="0.3"
                      />
                      <path
                        d="M21 12a9 9 0 0 0-9-9"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>

                    Creating PDF...
                  </>
                ) : (
                  <>
                    {downloadUrl
                      ? "Create New PDF"
                      : "Create PDF"}

                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      className="h-5 w-5"
                    >
                      <path
                        d="M4 10h11M10 5l5 5-5 5"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Result */}
          {downloadUrl && resultSize !== null && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-bold text-emerald-800">
                    PDF created successfully.
                  </p>

                  <p className="mt-1 text-sm text-emerald-700">
                    Output size:{" "}
                    {formatFileSize(resultSize)}
                  </p>

                  <p className="mt-1 text-xs text-emerald-600">
                    {images.length} images ·{" "}
                    {imagesPerPage} images per page ·{" "}
                    {totalPages} PDF{" "}
                    {totalPages === 1 ? "page" : "pages"}
                  </p>
                </div>

                <a
                  href={downloadUrl}
                  download={downloadName}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700"
                >
                  Download PDF
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}