const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000";

export interface PDFToWordResult {
  url: string;
  name: string;
  size: number;
}

export async function pdfToWord(
  file: File,
): Promise<PDFToWordResult> {
  if (!file) {
    throw new Error("No PDF file selected.");
  }

  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    throw new Error("Please select a valid PDF file.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/api/pdf-to-word`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!response.ok) {
    let message = "PDF to Word conversion failed.";

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
    throw new Error("The server returned an empty Word document.");
  }

  const url = URL.createObjectURL(blob);

  return {
    url,
    name: "filevixo-converted.docx",
    size: blob.size,
  };
}