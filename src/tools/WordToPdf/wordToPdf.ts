const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface WordToPDFResult {
  url: string;
  name: string;
  size: number;
}

export async function wordToPdf(
  file: File,
): Promise<WordToPDFResult> {
  if (!file) {
    throw new Error("No Word file selected.");
  }

  const fileName = file.name.toLowerCase();

  const isWordFile =
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type === "application/msword" ||
    fileName.endsWith(".docx") ||
    fileName.endsWith(".doc");

  if (!isWordFile) {
    throw new Error("Please select a valid Word document.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/api/word-to-pdf`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    let message = "Word to PDF conversion failed.";

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
    name: "filevixo-converted.pdf",
    size: blob.size,
  };
}