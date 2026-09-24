const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface MergePdfResult {
  url: string;
  name: string;
  size: number;
}

export async function mergePdf(
  files: File[],
): Promise<MergePdfResult> {
  if (!files || files.length < 2) {
    throw new Error("Please select at least two PDF files.");
  }

  const invalidFile = files.find(
    (file) =>
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf"),
  );

  if (invalidFile) {
    throw new Error(
      `"${invalidFile.name}" is not a valid PDF file.`,
    );
  }

  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch(
    `${API_BASE_URL}/api/merge-pdf`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    let message = "PDF merging failed.";

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
    throw new Error("The server returned an empty PDF.");
  }

  const url = URL.createObjectURL(blob);

  return {
    url,
    name: "filevixo-merged.pdf",
    size: blob.size,
  };
}