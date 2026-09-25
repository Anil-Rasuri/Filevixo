interface ImagesToPdfRequest {
  files: File[];
  imagesPerPage: 1 | 2 | 3 | 4 | 6 | 9;
  pageSize: string;
  orientation: "portrait" | "landscape";
  margin: string;
}

export async function imagesToPdf({
  files,
  imagesPerPage,
  pageSize,
  orientation,
  margin,
}: ImagesToPdfRequest): Promise<{
  url: string;
  name: string;
  size: number;
}> {
  if (files.length === 0) {
    throw new Error("Please upload at least one image.");
  }

  const formData = new FormData();

  for (const file of files) {
    formData.append("files", file);
  }

  formData.append(
    "images_per_page",
    String(imagesPerPage),
  );

  formData.append("page_size", pageSize);
  formData.append("orientation", orientation);
  formData.append("margin", margin);

  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/api/images-to-pdf`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    let message = "Unable to convert images to PDF.";

    try {
      const data = await response.json();
      message = data.detail || message;
    } catch {
      // Keep default error.
    }

    throw new Error(message);
  }

  const blob = await response.blob();

  if (!blob.size) {
    throw new Error("The PDF file was empty.");
  }

  const url = URL.createObjectURL(blob);

  return {
    url,
    name: "filevixo-images.pdf",
    size: blob.size,
  };
}
