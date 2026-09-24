import { useEffect, useMemo, useRef, useState } from "react";
import "./ImagesToPdf.css";
import { imagesToPdf } from "./imagesToPdf";

interface ImagesToPdfProps {
  file: File | null;
  onResult?: (result: {
    url: string;
    name: string;
    size: number;
  }) => void;
  onError?: (message: string) => void;
  onLoading?: (loading: boolean) => void;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024;
const MAX_IMAGES = 50;

const IMAGES_PER_PAGE = [1, 2, 3, 4, 6, 9] as const;

type ImagesPerPage = (typeof IMAGES_PER_PAGE)[number];
type Orientation = "auto" | "portrait" | "landscape";

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const getExtension = (name: string) =>
  name.split(".").pop()?.toLowerCase() || "";

const isSupportedImage = (file: File) => {
  const extension = getExtension(file.name);
  return [
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
  ].includes(extension);
};

const getImageOrientation = (file: File): Promise<"portrait" | "landscape"> => {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const orientation =
        image.naturalWidth >= image.naturalHeight
          ? "landscape"
          : "portrait";

      URL.revokeObjectURL(url);
      resolve(orientation);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve("portrait");
    };

    image.src = url;
  });
};

const ImagesToPdf = ({
  file,
  onResult,
  onError,
  onLoading,
}: ImagesToPdfProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagesPerPage, setImagesPerPage] =
    useState<ImagesPerPage>(1);
  const [pageSize, setPageSize] = useState("A4");
  const [orientation, setOrientation] =
    useState<Orientation>("auto");
  const [margin, setMargin] = useState("medium");
  const [loading, setLoading] = useState(false);

  /*
   * The old App passed one generic file into this tool.
   * If a file exists and this component has not received any
   * images yet, use it once so existing state does not disappear.
   */
  useEffect(() => {
    if (file && selectedImages.length === 0) {
      setSelectedImages([file]);
    }
  }, [file]);

  useEffect(() => {
    return () => {
      // Nothing to revoke here because previews are generated
      // from the files only when they are rendered.
    };
  }, []);

  const totalSize = useMemo(
    () => selectedImages.reduce((total, image) => total + image.size, 0),
    [selectedImages],
  );

  const previews = useMemo(
    () =>
      selectedImages.map((image) => ({
        file: image,
        url: URL.createObjectURL(image),
      })),
    [selectedImages],
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => {
        URL.revokeObjectURL(preview.url);
      });
    };
  }, [previews]);

  const showError = (message: string) => {
    onError?.(message);
  };

  const openFilePicker = () => {
    inputRef.current?.click();
  };

  const addImages = (files: FileList | null) => {
    if (!files) return;

    const incoming = Array.from(files);
    const errors: string[] = [];

    const validIncoming = incoming.filter((newFile) => {
      if (!isSupportedImage(newFile)) {
        errors.push(`${newFile.name} is not a supported image.`);
        return false;
      }

      if (newFile.size > MAX_FILE_SIZE) {
        errors.push(
          `${newFile.name} is larger than the 25 MB per-image limit.`,
        );
        return false;
      }

      return true;
    });

    const existingKeys = new Set(
      selectedImages.map(
        (image) => `${image.name}-${image.size}-${image.lastModified}`,
      ),
    );

    const uniqueIncoming = validIncoming.filter((newFile) => {
      const key = `${newFile.name}-${newFile.size}-${newFile.lastModified}`;

      if (existingKeys.has(key)) {
        return false;
      }

      existingKeys.add(key);
      return true;
    });

    if (selectedImages.length + uniqueIncoming.length > MAX_IMAGES) {
      errors.push(`You can select up to ${MAX_IMAGES} images at once.`);
      uniqueIncoming.splice(
        MAX_IMAGES - selectedImages.length,
      );
    }

    const incomingSize = uniqueIncoming.reduce(
      (total, image) => total + image.size,
      0,
    );

    if (totalSize + incomingSize > MAX_TOTAL_SIZE) {
      errors.push("The total image upload size cannot exceed 50 MB.");
      return showError(errors.join(" "));
    }

    if (errors.length > 0) {
      showError(errors.join(" "));
    } else {
      showError("");
    }

    if (uniqueIncoming.length > 0) {
      setSelectedImages((current) => [
        ...current,
        ...uniqueIncoming,
      ]);
    }

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages((current) =>
      current.filter((_, imageIndex) => imageIndex !== index),
    );

    showError("");
  };

  const clearImages = () => {
    setSelectedImages([]);
    showError("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleConvert = async () => {
    if (selectedImages.length === 0) {
      showError("Please upload at least one image.");
      return;
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      showError("The total image upload size cannot exceed 50 MB.");
      return;
    }

    setLoading(true);
    onLoading?.(true);
    showError("");

    try {
      let resolvedOrientation: "portrait" | "landscape";

      if (orientation === "auto") {
        resolvedOrientation = await getImageOrientation(
          selectedImages[0],
        );
      } else {
        resolvedOrientation = orientation;
      }

      const result = await imagesToPdf({
        files: selectedImages,
        imagesPerPage,
        pageSize,
        orientation: resolvedOrientation,
        margin,
      });

      onResult?.(result);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to convert images to PDF.";

      showError(message);
      onError?.(message);
    } finally {
      setLoading(false);
      onLoading?.(false);
    }
  };

  return (
    <div className="images-to-pdf">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.tif,.tiff,.svg,.heic,.heif,.avif,.ico"
        className="images-to-pdf-input"
        onChange={(event) => addImages(event.target.files)}
      />

      <div className="images-to-pdf-header">
        <div>
          <span className="images-to-pdf-label">
            PDF TOOL
          </span>
          <h2>Images to PDF</h2>
          <p>
            Convert multiple images into one PDF document.
          </p>
        </div>
      </div>

      <button
        type="button"
        className="images-to-pdf-upload"
        onClick={openFilePicker}
        disabled={loading}
      >
        <span className="images-to-pdf-upload-icon">
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 16V4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="m7 9 5-5 5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 20h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>

        <strong>
          {selectedImages.length > 0
            ? "Add more images"
            : "Choose images"}
        </strong>

        <span>
          Select multiple images at once
        </span>

        <small>
          JPG, JPEG, PNG, WEBP, GIF, BMP, TIFF, SVG, HEIC, HEIF, AVIF, ICO · 25 MB each
        </small>
      </button>

      {selectedImages.length > 0 && (
        <div className="images-to-pdf-selected">
          <div className="images-to-pdf-selected-header">
            <div>
              <strong>
                Selected images
              </strong>
              <span>
                {selectedImages.length} image
                {selectedImages.length === 1 ? "" : "s"} · {formatFileSize(totalSize)}
              </span>
            </div>

            <button
              type="button"
              onClick={clearImages}
              disabled={loading}
            >
              Remove all
            </button>
          </div>

          <div className="images-to-pdf-grid">
            {previews.map((preview, index) => (
              <div
                className="images-to-pdf-image-card"
                key={`${preview.file.name}-${preview.file.lastModified}-${index}`}
              >
                <div className="images-to-pdf-thumbnail">
                  <img
                    src={preview.url}
                    alt={preview.file.name}
                  />

                  <button
                    type="button"
                    className="images-to-pdf-remove"
                    onClick={() => removeImage(index)}
                    disabled={loading}
                    aria-label={`Remove ${preview.file.name}`}
                  >
                    ×
                  </button>

                  <span className="images-to-pdf-order">
                    {index + 1}
                  </span>
                </div>

                <div className="images-to-pdf-image-name">
                  {preview.file.name}
                </div>

                <div className="images-to-pdf-image-size">
                  {formatFileSize(preview.file.size)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="images-to-pdf-settings">
        <div className="images-to-pdf-setting images-to-pdf-pages-setting">
          <label>Images per page</label>

          <div className="images-to-pdf-page-options">
            {IMAGES_PER_PAGE.map((value) => (
              <button
                key={value}
                type="button"
                className={
                  imagesPerPage === value
                    ? "active"
                    : ""
                }
                onClick={() => setImagesPerPage(value)}
                disabled={loading}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="images-to-pdf-settings-row">
          <div className="images-to-pdf-setting">
            <label htmlFor="images-to-pdf-page-size">
              Page size
            </label>

            <select
              id="images-to-pdf-page-size"
              value={pageSize}
              onChange={(event) =>
                setPageSize(event.target.value)
              }
              disabled={loading}
            >
              <option value="A4">A4</option>
              <option value="Letter">Letter</option>
            </select>
          </div>

          <div className="images-to-pdf-setting">
            <label htmlFor="images-to-pdf-orientation">
              Orientation
            </label>

            <select
              id="images-to-pdf-orientation"
              value={orientation}
              onChange={(event) =>
                setOrientation(
                  event.target.value as Orientation,
                )
              }
              disabled={loading}
            >
              <option value="auto">Auto</option>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>

          <div className="images-to-pdf-setting">
            <label htmlFor="images-to-pdf-margin">
              Margin
            </label>

            <select
              id="images-to-pdf-margin"
              value={margin}
              onChange={(event) =>
                setMargin(event.target.value)
              }
              disabled={loading}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="images-to-pdf-convert"
        onClick={handleConvert}
        disabled={loading || selectedImages.length === 0}
      >
        {loading ? (
          <>
            <span className="images-to-pdf-spinner" />
            Creating PDF...
          </>
        ) : (
          <>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 3.5h8l4 4V20.5H6V3.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="M14 3.5v4h4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
            Convert to PDF
          </>
        )}
      </button>
    </div>
  );
};

export default ImagesToPdf;
