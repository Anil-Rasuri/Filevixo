import { useEffect, useRef, useState } from "react";

import Navbar from "./components/Navbar";
import UploadBox from "./components/UploadBox";
import ResultBox from "./components/ResultBox";
import ToolCard from "./components/ToolCard";

import CompressImage from "./tools/CompressImage";
import ConvertImage from "./tools/ConvertImage";
import ResizeImage from "./tools/ResizeImage";
import CropImage from "./tools/CropImage";
import ImagesToPdf from "./tools/ImagesToPdf";
import WordToPDF from "./tools/WordToPDF";
import PDFToWord from "./tools/PDFToWord";
import RemoveBackground from "./tools/RemoveBackground";
import MergePDF from "./tools/MergePDF";

type ToolMode =
  | "compress"
  | "convert"
  | "resize"
  | "crop"
  | "images-to-pdf"
  | "word-to-pdf"
  | "pdf-to-word"
  | "remove-background"
  | "merge-pdf";

function App() {
  const [mode, setMode] =
    useState<ToolMode>("compress");

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [outputFormat, setOutputFormat] =
    useState("png");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [downloadUrl, setDownloadUrl] =
    useState("");

  const [downloadName, setDownloadName] =
    useState("");

  const [resultSize, setResultSize] =
    useState<number | null>(null);

  const [resultMessage, setResultMessage] =
    useState("");

  const resultRef =
    useRef<HTMLDivElement | null>(null);

  const downloadUrlRef =
    useRef("");

  useEffect(() => {
    downloadUrlRef.current = downloadUrl;
  }, [downloadUrl]);

  useEffect(() => {
    return () => {
      if (downloadUrlRef.current) {
        URL.revokeObjectURL(
          downloadUrlRef.current
        );
      }
    };
  }, []);

  const clearResult = () => {
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(
        downloadUrlRef.current
      );

      downloadUrlRef.current = "";
    }

    setDownloadUrl("");
    setDownloadName("");
    setResultSize(null);
    setResultMessage("");
  };

  const resetWorkspace = () => {
    clearResult();

    setSelectedFile(null);
    setLoading(false);
    setError("");
  };

  const handleFileSelect = (
    file: File | undefined
  ) => {
    if (!file) {
      return;
    }

    clearResult();

    setError("");
    setLoading(false);

    const allowedImageTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedImageTypes.includes(file.type)) {
      setSelectedFile(null);

      setError(
        "Please select a JPG, PNG or WebP image."
      );

      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setSelectedFile(null);

      setError(
        "File size must be 25 MB or less."
      );

      return;
    }

    setSelectedFile(file);
  };

  const handleRemoveFile = () => {
    resetWorkspace();
  };

  const chooseTool = (
    nextMode: ToolMode
  ) => {
    resetWorkspace();

    setMode(nextMode);

    setTimeout(() => {
      const workspace =
        document.getElementById(
          "workspace"
        );

      if (!workspace) {
        return;
      }

      const navbarOffset = 76;

      const top =
        workspace.getBoundingClientRect()
          .top +
        window.scrollY -
        navbarOffset;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth",
      });
    }, 50);
  };

  const handleStart = () => {
    clearResult();

    setLoading(true);
    setError("");
  };

  const handleResult = (
    url: string,
    name: string,
    size: number,
    message?: string
  ) => {
    setDownloadUrl(url);
    setDownloadName(name);
    setResultSize(size);

    setResultMessage(
      message ||
        "File processed successfully."
    );

    setLoading(false);
    setError("");

    setTimeout(() => {
      resultRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);
  };

  const handleError = (
    message: string
  ) => {
    setError(message);
    setLoading(false);
  };

  const getToolTitle = () => {
    switch (mode) {
      case "compress":
        return "Compress Image";

      case "convert":
        return "Convert Image";

      case "resize":
        return "Resize Image";

      case "crop":
        return "Crop Image";

      case "images-to-pdf":
        return "Images to PDF";

      case "word-to-pdf":
        return "Word to PDF";

      case "pdf-to-word":
        return "PDF to Word";

      case "remove-background":
        return "Remove Background";

      case "merge-pdf":
        return "Merge PDF";

      default:
        return "File Tool";
    }
  };

  const isImageTool =
    mode === "compress" ||
    mode === "convert" ||
    mode === "resize" ||
    mode === "crop";

  const compressIcon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 sm:h-6 sm:w-6"
    >
      <path
        d="M4 7h16M4 12h16M4 17h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="M8 5v4M16 10v4M10 15v4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );

  const convertIcon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 sm:h-6 sm:w-6"
    >
      <path
        d="M7 7h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="m14 4 3 3-3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M17 17H7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="m10 14-3 3 3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const resizeIcon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 sm:h-6 sm:w-6"
    >
      <path
        d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M8 5 5 8M16 5l3 3M8 19l-3-3M16 19l3-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );

  const cropIcon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 sm:h-6 sm:w-6"
    >
      <path
        d="M7 3v14a4 4 0 0 0 4 4h10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      <path
        d="M3 7h14a4 4 0 0 1 4 4v10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );

  const wordPdfIcon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 sm:h-6 sm:w-6"
    >
      <path
        d="M6 3h8l4 4v14H6V3z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />

      <path
        d="M14 3v5h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />

      <path
        d="M9 12h6M9 16h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );

  const pdfWordIcon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 sm:h-6 sm:w-6"
    >
      <path
        d="M6 3h8l4 4v14H6V3z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />

      <path
        d="M14 3v5h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />

      <path
        d="M8.5 13h7M8.5 17h7"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );

  const backgroundIcon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 sm:h-6 sm:w-6"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="M7 17 10 13l2.5 3 2-2.5L18 17"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle
        cx="9"
        cy="8"
        r="1.5"
        fill="currentColor"
      />
    </svg>
  );

  const imagesPdfIcon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 sm:h-6 sm:w-6"
    >
      <rect
        x="4"
        y="3"
        width="12"
        height="16"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.7"
      />

      <path
        d="M8 15l2.5-3 2 2 1.5-2 2 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M8 8h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      <path
        d="M16 8h4v12H8v-1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const mergePdfIcon = (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className="h-5 w-5 sm:h-6 sm:w-6"
    >
      <path
        d="M5 4h9l3 3v13H5V4z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />

      <path
        d="M14 4v4h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />

      <path
        d="M8 13h6M8 16h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />

      <path
        d="M18 12v6M15 15h6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      <Navbar />

      <main>

        <section className="px-4 pb-9 pt-9 sm:px-6 sm:pb-12 sm:pt-12">
          <div className="mx-auto max-w-5xl text-center">

            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-600">
              Filevixo
            </p>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              File tools, made simple.
            </h1>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:mt-4 sm:text-base">
              Choose a tool and get started instantly.
            </p>

          </div>
        </section>

        <section
          id="tools"
          className="px-4 pb-10 sm:px-6 sm:pb-14"
        >
          <div className="mx-auto max-w-7xl">

            <div className="mb-7">

              <div className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
                  Image Tools
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950 sm:text-xl">
                  Work with images
                </h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                <ToolCard
                  title="Compress Image"
                  description="Reduce image file size while maintaining good quality."
                  category="Image Tools"
                  color="blue"
                  icon={compressIcon}
                  onClick={() =>
                    chooseTool("compress")
                  }
                />

                <ToolCard
                  title="Convert Image"
                  description="Convert images between JPG, PNG and WebP."
                  category="Image Tools"
                  color="blue"
                  icon={convertIcon}
                  onClick={() =>
                    chooseTool("convert")
                  }
                />

                <ToolCard
                  title="Resize Image"
                  description="Resize images to your required dimensions."
                  category="Image Tools"
                  color="blue"
                  icon={resizeIcon}
                  onClick={() =>
                    chooseTool("resize")
                  }
                />

                <ToolCard
                  title="Crop Image"
                  description="Crop images using flexible aspect ratios."
                  category="Image Tools"
                  color="blue"
                  icon={cropIcon}
                  onClick={() =>
                    chooseTool("crop")
                  }
                />

              </div>
            </div>

            <div className="mb-7">

              <div className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-600">
                  Document Conversion
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950 sm:text-xl">
                  Convert documents
                </h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">

                <ToolCard
                  title="Word to PDF"
                  description="Convert Word documents into PDF files."
                  category="Document Conversion"
                  color="violet"
                  icon={wordPdfIcon}
                  onClick={() =>
                    chooseTool("word-to-pdf")
                  }
                />

                <ToolCard
                  title="PDF to Word"
                  description="Convert PDF documents into editable Word files."
                  category="Document Conversion"
                  color="violet"
                  icon={pdfWordIcon}
                  onClick={() =>
                    chooseTool("pdf-to-word")
                  }
                />

              </div>
            </div>

            <div className="mb-7">

              <div className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-600">
                  Image AI
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950 sm:text-xl">
                  AI-powered image tools
                </h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">

                <ToolCard
                  title="Remove Background"
                  description="Remove image backgrounds and create transparent PNGs."
                  category="Image AI"
                  color="emerald"
                  icon={backgroundIcon}
                  onClick={() =>
                    chooseTool(
                      "remove-background"
                    )
                  }
                />

              </div>
            </div>

            <div>

              <div className="mb-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-600">
                  PDF Tools
                </p>

                <h2 className="mt-1 text-lg font-bold text-slate-950 sm:text-xl">
                  Manage PDF files
                </h2>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">

                <ToolCard
                  title="Images to PDF"
                  description="Combine images into a single PDF document."
                  category="PDF Tools"
                  color="orange"
                  icon={imagesPdfIcon}
                  onClick={() =>
                    chooseTool(
                      "images-to-pdf"
                    )
                  }
                />

                <ToolCard
                  title="Merge PDF"
                  description="Combine multiple PDF files into one document."
                  category="PDF Tools"
                  color="orange"
                  icon={mergePdfIcon}
                  onClick={() =>
                    chooseTool("merge-pdf")
                  }
                />

              </div>
            </div>

          </div>
        </section>

        <section
          id="workspace"
          className={`
            scroll-mt-20
            border-y
            border-slate-200
            bg-white
            px-4
            sm:px-6
            ${
              mode === "remove-background"
                ? "py-3 sm:py-5"
                : "py-6 sm:py-8"
            }
          `}
        >
          <div className="mx-auto max-w-4xl">

            {mode !== "remove-background" && (
              <div className="mb-4 text-center sm:mb-5">

                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
                  Workspace
                </p>

                <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                  {getToolTitle()}
                </h2>

              </div>
            )}

            {isImageTool && (
              <div className="mb-3">
                <UploadBox
                  selectedFile={selectedFile}
                  onFileSelect={
                    handleFileSelect
                  }
                  onRemove={
                    handleRemoveFile
                  }
                />
              </div>
            )}

            {mode === "compress" && (
              <CompressImage
                selectedFile={selectedFile}
                loading={loading}
                onStart={handleStart}
                onResult={(
                  url,
                  name,
                  size
                ) =>
                  handleResult(
                    url,
                    name,
                    size,
                    "Image compressed successfully."
                  )
                }
                onError={handleError}
              />
            )}

            {mode === "convert" && (
              <ConvertImage
                selectedFile={selectedFile}
                loading={loading}
                outputFormat={
                  outputFormat
                }
                setOutputFormat={
                  setOutputFormat
                }
                onResult={(
                  url,
                  name,
                  size
                ) =>
                  handleResult(
                    url,
                    name,
                    size,
                    "Image converted successfully."
                  )
                }
                onError={handleError}
              />
            )}

            {mode === "resize" && (
              <ResizeImage
                selectedFile={selectedFile}
                loading={loading}
                onStart={handleStart}
                onResult={(
                  url,
                  name,
                  size
                ) =>
                  handleResult(
                    url,
                    name,
                    size,
                    "Image resized successfully."
                  )
                }
                onError={handleError}
              />
            )}

            {mode === "crop" && (
              <CropImage
                selectedFile={selectedFile}
                loading={loading}
                onStart={handleStart}
                onResult={(
                  url,
                  name,
                  size
                ) =>
                  handleResult(
                    url,
                    name,
                    size,
                    "Image cropped successfully."
                  )
                }
                onError={handleError}
              />
            )}

            {mode === "remove-background" && (
              <RemoveBackground
                selectedFile={selectedFile}
                loading={loading}
                onFileSelect={
                  handleFileSelect
                }
                onStart={handleStart}
                onError={handleError}
              />
            )}

            {mode === "images-to-pdf" && (
              <ImagesToPdf
                loading={loading}
                onStart={handleStart}
                onResult={(
                  url,
                  name,
                  size,
                  message
                ) =>
                  handleResult(
                    url,
                    name,
                    size,
                    message ||
                      "PDF created successfully."
                  )
                }
                onError={handleError}
              />
            )}

            {mode === "word-to-pdf" && (
              <WordToPDF
                onResult={(
                  url,
                  name,
                  size,
                  message
                ) =>
                  handleResult(
                    url,
                    name,
                    size,
                    message ||
                      "PDF created successfully."
                  )
                }
                onError={handleError}
              />
            )}

            {mode === "pdf-to-word" && (
              <PDFToWord
                onResult={(
                  url,
                  name,
                  size,
                  message
                ) =>
                  handleResult(
                    url,
                    name,
                    size,
                    message ||
                      "Word document created successfully."
                  )
                }
                onError={handleError}
              />
            )}

            {mode === "merge-pdf" && (
              <MergePDF
                onResult={(
                  url,
                  name,
                  size,
                  message
                ) =>
                  handleResult(
                    url,
                    name,
                    size,
                    message ||
                      "PDF files merged successfully."
                  )
                }
                onError={handleError}
              />
            )}

            {error && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            {downloadUrl &&
              downloadName &&
              mode !==
                "remove-background" &&
              mode !== "crop" &&
              mode !== "merge-pdf" && (
                <div
                  ref={resultRef}
                  className="mt-4 scroll-mt-24"
                >
                  <ResultBox
                    downloadUrl={
                      downloadUrl
                    }
                    downloadName={
                      downloadName
                    }
                    resultSize={
                      resultSize
                    }
                    message={
                      resultMessage
                    }
                  />
                </div>
              )}

          </div>
        </section>

        <section
          id="how-it-works"
          className="px-4 py-12 sm:px-6 sm:py-16"
        >
          <div className="mx-auto max-w-6xl">

            <div className="text-center">

              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
                How It Works
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-950 sm:text-3xl">
                Simple from start to finish
              </h2>

            </div>

            <div className="mt-8 grid gap-7 md:grid-cols-3">

              {[
                [
                  "01",
                  "Upload",
                  "Choose your file or image and upload it securely.",
                ],
                [
                  "02",
                  "Process",
                  "Select the tool and configure the settings you need.",
                ],
                [
                  "03",
                  "Download",
                  "Download your processed file when it is ready.",
                ],
              ].map(
                ([
                  number,
                  title,
                  description,
                ]) => (
                  <div
                    key={number}
                    className="text-center"
                  >
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                      {number}
                    </div>

                    <h3 className="mt-4 text-lg font-bold text-slate-950">
                      {title}
                    </h3>

                    <p className="mx-auto mt-1.5 max-w-xs text-sm leading-6 text-slate-600">
                      {description}
                    </p>
                  </div>
                )
              )}

            </div>
          </div>
        </section>

        <section
          id="security"
          className="bg-slate-950 px-4 py-12 text-white sm:px-6 sm:py-16"
        >
          <div className="mx-auto max-w-4xl text-center">

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/10">

              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="h-6 w-6"
              >
                <path
                  d="M12 3l7 3v5c0 4.5-2.9 8.5-7 10-4.1-1.5-7-5.5-7-10V6l7-3z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />

                <path
                  d="M9 12l2 2 4-4"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

            </div>

            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">
              Built with security in mind
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-6 text-slate-300">
              Filevixo uses server-side validation,
              temporary processing files and controlled
              file handling to help keep your files protected.
            </p>

          </div>
        </section>

      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 sm:px-6">

        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">

          <div className="text-center md:text-left">

            <img
              src="/logo.png"
              alt="Filevixo"
              className="mx-auto w-[140px] object-contain md:mx-0"
            />

            <p className="mt-2 max-w-sm text-sm leading-5 text-slate-500">
              Simple, secure online tools for working
              with images and documents.
            </p>

          </div>

          <div className="text-center md:text-right">

            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Business Contact
            </p>

            <a
              href="mailto:anilrasuri17@gmail.com"
              className="mt-1.5 inline-block text-sm font-semibold text-slate-700 transition hover:text-blue-600"
            >
              anilrasuri17@gmail.com
            </a>

          </div>

        </div>

        <div className="mx-auto mt-6 max-w-7xl border-t border-slate-100 pt-4 text-center">

          <p className="text-xs text-slate-400">
            © 2026 Filevixo. All rights reserved.
          </p>

        </div>

      </footer>

    </div>
  );
}

export default App;