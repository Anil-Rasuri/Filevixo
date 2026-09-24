const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface RemoveBackgroundResult {
  url: string;
  name: string;
  size: number;
}

export async function removeBackground(
  file: File,
): Promise<RemoveBackgroundResult> {
  if (!file) {
    throw new Error("No image selected.");
  }

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  const isSupportedImage =
    allowedTypes.includes(file.type) ||
    /\.(jpg|jpeg|png|webp)$/i.test(file.name);

  if (!isSupportedImage) {
    throw new Error(
      "Please select a JPG, PNG, or WEBP image.",
    );
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/api/remove-background`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    let message = "Background removal failed.";

    try {
      const data = await response.json();

      if (typeof data?.detail === "string") {
        message = data.detail;
      } else if (typeof data?.message === "string") {
        message = data.message;
      }
    } catch {
      // Keep default error message.
    }

    throw new Error(message);
  }

  const blob = await response.blob();

  if (!blob.size) {
    throw new Error(
      "The server returned an empty image.",
    );
  }

  const url = URL.createObjectURL(blob);

  return {
    url,
    name: "filevixo-background-removed.png",
    size: blob.size,
  };
}