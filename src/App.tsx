import {
  useEffect,
  useRef,
  useState,
} from "react";

import "./App.css";
import "./RemoveBackgroundPreview.css";

// Components
import Navbar from "./components/Navbar/Navbar";
import Hero from "./components/Hero/Hero";
import ToolCard from "./components/ToolCard/ToolCard";
import UploadBox from "./components/UploadBox/UploadBox";
import ResultBox from "./components/ResultBox/ResultBox";
import HowItWorks from "./components/HowItWorks/HowItWorks";
import Security from "./components/Security/Security";
import Footer from "./components/Footer/Footer";

// Tools
import CompressImage from "./tools/CompressImage/CompressImage.tsx";
import ConvertImage from "./tools/ConvertImage/ConvertImage.tsx";
import ResizeImage from "./tools/ResizeImage/ResizeImage.tsx";
import CropImage from "./tools/CropImage/CropImage.tsx";
import ImagesToPdf from "./tools/ImagesToPdf/ImagesToPdf.tsx";
import WordToPDF from "./tools/WordToPdf/WordToPdf.tsx";
import PDFToWord from "./tools/PDFToWord/PDFToWord.tsx";
import RemoveBackground from "./tools/RemoveBackground/RemoveBackground.tsx";
import MergePDF from "./tools/MergePdf/MergePdf.tsx";

type ToolId =
  | "compress"
  | "convert"
  | "resize"
  | "crop"
  | "images-to-pdf"
  | "word-to-pdf"
  | "pdf-to-word"
  | "remove-background"
  | "merge-pdf";

type ToolCategory =
  | "Image Tools"
  | "Document Tools"
  | "AI Tools"
  | "PDF Tools";

type ToolColor =
  | "blue"
  | "violet"
  | "emerald"
  | "orange";

interface ResultData {
  url: string;
  name: string;
  size: number;
}

interface ToolDefinition {
  id: ToolId;
  title: string;
  description: string;
  category: ToolCategory;
  color: ToolColor;
  icon: React.ReactNode;
}

/* =========================================================
   ICONS
========================================================= */

const fileIcon = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
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
);

const compressIcon = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M8 4H5v3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    <path
      d="M16 4h3v3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    <path
      d="M8 20H5v-3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    <path
      d="M16 20h3v-3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    <path
      d="M9 9h6v6H9z"
      stroke="currentColor"
      strokeWidth="1.8"
    />
  </svg>
);

const convertIcon = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M7 7h11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="m14 3 4 4-4 4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    <path
      d="M17 17H6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="m10 13-4 4 4 4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const resizeIcon = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M4 9V5a1 1 0 0 1 1-1h4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="M20 15v4a1 1 0 0 1-1 1h-4"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="m4 5 6 6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="m20 19-6-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const cropIcon = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M6 3v14a4 4 0 0 0 4 4h11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="M3 6h14a4 4 0 0 1 4 4v11"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const pdfIcon = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
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

    <path
      d="M8.5 15h1.5a1.5 1.5 0 0 0 0-3H8.5v5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const backgroundIcon = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z"
      stroke="currentColor"
      strokeWidth="1.8"
    />

    <path
      d="m7 16 3.2-3.5 2.4 2.5 2.2-2.5L17 16"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />

    <circle
      cx="9"
      cy="8.5"
      r="1.5"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const mergeIcon = (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <path
      d="M7 4v16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="M17 4v16"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="M4 8h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="M14 16h6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

/* =========================================================
   TOOLS
========================================================= */

const tools: ToolDefinition[] = [
  /* ---------------- IMAGE TOOLS ---------------- */

  {
    id: "compress",
    title: "Compress Image",
    description:
      "Reduce image size while keeping useful quality.",
    category: "Image Tools",
    color: "blue",
    icon: compressIcon,
  },

  {
    id: "convert",
    title: "Convert Image",
    description:
      "Convert images between JPG, PNG, and WEBP.",
    category: "Image Tools",
    color: "blue",
    icon: convertIcon,
  },

  {
    id: "resize",
    title: "Resize Image",
    description:
      "Change image dimensions to the size you need.",
    category: "Image Tools",
    color: "blue",
    icon: resizeIcon,
  },

  {
    id: "crop",
    title: "Crop Image",
    description:
      "Crop your image to remove unwanted areas.",
    category: "Image Tools",
    color: "blue",
    icon: cropIcon,
  },

  /* ---------------- DOCUMENT TOOLS ---------------- */

  {
    id: "word-to-pdf",
    title: "Word to PDF",
    description:
      "Convert Word documents into PDF files.",
    category: "Document Tools",
    color: "violet",
    icon: fileIcon,
  },

  {
    id: "pdf-to-word",
    title: "PDF to Word",
    description:
      "Convert PDF documents into editable Word files.",
    category: "Document Tools",
    color: "violet",
    icon: pdfIcon,
  },

  /* ---------------- AI TOOLS ---------------- */

  {
    id: "remove-background",
    title: "Remove Background",
    description:
      "Remove the background from an image automatically.",
    category: "AI Tools",
    color: "emerald",
    icon: backgroundIcon,
  },

  /* ---------------- PDF TOOLS ---------------- */

  {
    id: "images-to-pdf",
    title: "Images to PDF",
    description:
      "Turn images into a single PDF document.",
    category: "PDF Tools",
    color: "orange",
    icon: pdfIcon,
  },

  {
    id: "merge-pdf",
    title: "Merge PDF",
    description:
      "Combine multiple PDF files into one document.",
    category: "PDF Tools",
    color: "orange",
    icon: mergeIcon,
  },
];

/* =========================================================
   CATEGORY COMPONENT
========================================================= */

function ToolCategory({
  title,
  category,
  tools,
  activeTool,
  onSelect,
}: {
  title: string;
  category: ToolCategory;
  tools: ToolDefinition[];
  activeTool: ToolId;
  onSelect: (id: ToolId) => void;
}) {
  const categoryTools = tools.filter(
    (tool) => tool.category === category,
  );

  if (categoryTools.length === 0) {
    return null;
  }

  return (
    <div className="tool-category">
      <div className="tool-category-heading">
        <h3>{title}</h3>
      </div>

      <div className="tool-category-grid">
        {categoryTools.map((tool) => (
          <ToolCard
            key={tool.id}
            title={tool.title}
            description={tool.description}
            icon={tool.icon}
            active={activeTool === tool.id}
            accent={tool.color}
            onClick={() => onSelect(tool.id)}
          />
        ))}
      </div>
    </div>
  );
}


/* =========================================================
   REMOVE BACKGROUND RESULT PREVIEW
========================================================= */

function RemoveBackgroundResultPreview({
  originalUrl,
  resultUrl,
  originalName,
  originalSize,
  resultName,
  resultSize,
  onDownload,
  onReset,
}: {
  originalUrl: string | null;
  resultUrl: string;
  originalName: string;
  originalSize: number;
  resultName: string;
  resultSize: number;
  onDownload: () => void;
  onReset: () => void;
}) {
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="background-result">
      <div className="background-result-header">
        <div>
          <span className="background-result-label">
            RESULT PREVIEW
          </span>

          <h3>Background removed</h3>

          <p>
            Compare the original image with your transparent result
            before downloading.
          </p>
        </div>
      </div>

      <div className="background-result-preview-grid">
        <div className="background-preview-card">
          <div className="background-preview-card-header">
            <span>Original</span>
            <span>{formatFileSize(originalSize)}</span>
          </div>

          <div className="background-preview-image original">
            {originalUrl ? (
              <img
                src={originalUrl}
                alt="Original image"
              />
            ) : (
              <div className="background-preview-empty">
                Preview unavailable
              </div>
            )}
          </div>

          <div className="background-preview-name">
            {originalName}
          </div>
        </div>

        <div className="background-preview-card">
          <div className="background-preview-card-header">
            <span>Result</span>
            <span>{formatFileSize(resultSize)}</span>
          </div>

          <div className="background-preview-image checkerboard">
            <img
              src={resultUrl}
              alt="Background removed result"
            />
          </div>

          <div className="background-preview-name">
            {resultName}
          </div>
        </div>
      </div>

      <div className="background-result-actions">
        <button
          type="button"
          className="background-download-button"
          onClick={onDownload}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>

          Download PNG
        </button>

        <button
          type="button"
          className="background-start-over-button"
          onClick={onReset}
        >
          Start over
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   APP
========================================================= */

function App() {
  const [activeTool, setActiveTool] =
    useState<ToolId>("compress");

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [outputFormat, setOutputFormat] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [result, setResult] =
    useState<ResultData | null>(null);

  const [resultMessage, setResultMessage] =
    useState("");

  const [originalPreviewUrl, setOriginalPreviewUrl] =
    useState<string | null>(null);

  const [resetKey, setResetKey] = useState(0);

  const [activeSection, setActiveSection] =
    useState<
      "home" | "tools" | "how-it-works"
    >("home");

  const workspaceRef =
    useRef<HTMLElement | null>(null);

  const uploadRef =
    useRef<HTMLDivElement | null>(null);

  const resultRef =
    useRef<HTMLDivElement | null>(null);

  const downloadUrlRef =
    useRef<string | null>(null);

  /* =======================================================
     CLEANUP
  ======================================================= */

  useEffect(() => {
    if (
      activeTool !== "remove-background" ||
      !selectedFile
    ) {
      setOriginalPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFile);
    setOriginalPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [activeTool, selectedFile]);

  useEffect(() => {
    return () => {
      if (downloadUrlRef.current) {
        URL.revokeObjectURL(
          downloadUrlRef.current,
        );
      }
    };
  }, []);

  /* =======================================================
     NAVBAR ACTIVE SECTION
  ======================================================= */

  useEffect(() => {
    const handleScroll = () => {
      const home =
        document.getElementById("home");

      const toolsSection =
        document.getElementById("tools");

      const workspace =
        document.getElementById("workspace");

      const howItWorks =
        document.getElementById("how-it-works");

      const viewportMiddle =
        window.innerHeight * 0.35;

      if (
        howItWorks &&
        howItWorks.getBoundingClientRect().top <=
          viewportMiddle
      ) {
        setActiveSection("how-it-works");
        return;
      }

      if (
        workspace &&
        workspace.getBoundingClientRect().top <=
          viewportMiddle
      ) {
        setActiveSection("tools");
        return;
      }

      if (
        toolsSection &&
        toolsSection.getBoundingClientRect().top <=
          viewportMiddle
      ) {
        setActiveSection("tools");
        return;
      }

      if (home) {
        setActiveSection("home");
      }
    };

    window.addEventListener(
      "scroll",
      handleScroll,
      { passive: true },
    );

    handleScroll();

    return () => {
      window.removeEventListener(
        "scroll",
        handleScroll,
      );
    };
  }, []);

  /* =======================================================
     RESET
  ======================================================= */

  const clearResult = () => {
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(
        downloadUrlRef.current,
      );

      downloadUrlRef.current = null;
    }

    setResult(null);
    setResultMessage("");
    setError("");
  };

  const resetWorkspace = (scrollToUpload = true) => {
    clearResult();

    setSelectedFile(null);
    setOutputFormat("");
    setLoading(false);
    setResetKey((value) => value + 1);

    if (scrollToUpload) {
      window.setTimeout(() => {
        uploadRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 150);
    }
  };

  /* =======================================================
     TOOL SELECT
  ======================================================= */

  const chooseTool = (toolId: ToolId) => {
    setActiveTool(toolId);

    resetWorkspace(false);

    window.setTimeout(() => {
      workspaceRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  };

  /* =======================================================
     FILE
  ======================================================= */

  const handleFileSelect = (file: File) => {
    clearResult();

    setSelectedFile(file);
    setError("");
  };

  const handleRemoveFile = () => {
    resetWorkspace();
  };

  /* =======================================================
     RESULT
  ======================================================= */

  const handleResult = (
    data: ResultData,
  ) => {
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(
        downloadUrlRef.current,
      );
    }

    downloadUrlRef.current = data.url;

    setResult(data);

    setResultMessage(
      "Your file has been processed successfully.",
    );

    setError("");
    setLoading(false);

    window.setTimeout(() => {
      resultRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
  };

  const handleError = (
    message: string,
  ) => {
    setError(message);
    setResult(null);
    setLoading(false);
  };

  const handleLoading = (
    value: boolean,
  ) => {
    setLoading(value);

    if (value) {
      setError("");
      setResult(null);
    }
  };

  /* =======================================================
     DOWNLOAD
  ======================================================= */

  const handleDownload = () => {
    if (!result?.url) {
      return;
    }

    const link =
      document.createElement("a");

    link.href = result.url;
    link.download = result.name;

    document.body.appendChild(link);

    link.click();

    link.remove();
  };

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const scrollToHome = () => {
    document
      .getElementById("home")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  const scrollToTools = () => {
    document
      .getElementById("tools")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  const scrollToHowItWorks = () => {
    document
      .getElementById("how-it-works")
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  };

  /* =======================================================
     ACTIVE TOOL
  ======================================================= */

  const activeToolDefinition =
    tools.find(
      (tool) => tool.id === activeTool,
    );

  /* =======================================================
     TOOL RENDER
  ======================================================= */

  const renderActiveTool = () => {
    const commonProps = {
      file: selectedFile,
      onResult: handleResult,
      onError: handleError,
      onLoading: handleLoading,
    };

    switch (activeTool) {
      case "compress":
        return (
          <CompressImage
            {...commonProps}
          />
        );

      case "convert":
        return (
          <ConvertImage
            file={selectedFile}
            outputFormat={outputFormat}
            setOutputFormat={
              setOutputFormat
            }
            onResult={handleResult}
            onError={handleError}
            onLoading={handleLoading}
          />
        );

      case "resize":
        return (
          <ResizeImage
            {...commonProps}
          />
        );

      case "crop":
        return (
          <CropImage
            {...commonProps}
          />
        );

      case "images-to-pdf":
        return (
          <ImagesToPdf
            {...commonProps}
          />
        );

      case "word-to-pdf":
        return (
          <WordToPDF
            {...commonProps}
          />
        );

      case "pdf-to-word":
        return (
          <PDFToWord
            {...commonProps}
          />
        );

      case "remove-background":
        return (
          <RemoveBackground
            {...commonProps}
          />
        );

      case "merge-pdf":
        return (
          <MergePDF
            {...commonProps}
          />
        );

      default:
        return null;
    }
  };

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <div className="app">

      <Navbar
        activeSection={activeSection}
        onHomeClick={scrollToHome}
        onToolsClick={scrollToTools}
        onHowItWorksClick={
          scrollToHowItWorks
        }
      />

      <main>

        {/* HERO */}

        <Hero />

        {/* TOOLS */}

        <section
          id="tools"
          className="tools-section"
        >
          <div className="tools-container">

            <div className="tools-heading">

              <span className="section-label">
                FILE TOOLS
              </span>

              <h2>
                Everything you need
                <br />
                for your files.
              </h2>

              <p>
                Choose a tool and start
                working with your file.
              </p>

            </div>

            <div className="tools-categories">

              <ToolCategory
                title="Image Tools"
                category="Image Tools"
                tools={tools}
                activeTool={activeTool}
                onSelect={chooseTool}
              />

              <ToolCategory
                title="Document Tools"
                category="Document Tools"
                tools={tools}
                activeTool={activeTool}
                onSelect={chooseTool}
              />

              <ToolCategory
                title="AI Tools"
                category="AI Tools"
                tools={tools}
                activeTool={activeTool}
                onSelect={chooseTool}
              />

              <ToolCategory
                title="PDF Tools"
                category="PDF Tools"
                tools={tools}
                activeTool={activeTool}
                onSelect={chooseTool}
              />

            </div>

          </div>
        </section>

        {/* WORKSPACE */}

        <section
          id="workspace"
          className="workspace-section"
          ref={workspaceRef}
        >
          <div className="workspace-container">

            {/* WORD TO PDF HAS NO EXTRA WORKSPACE HEADING */}

            {activeTool !== "word-to-pdf" &&
              activeTool !== "pdf-to-word" &&
              activeTool !== "remove-background" &&
              activeTool !== "images-to-pdf" &&
              activeTool !== "merge-pdf" && (
              <div className="workspace-heading">

                <span className="section-label">
                  WORKSPACE
                </span>

                <h2>
                  {activeToolDefinition?.title}
                </h2>

                <p>
                  {activeToolDefinition?.description}
                </p>

              </div>
            )}

            {/* The Images to PDF and Merge PDF tools have their own multi-file uploaders. */}
            {activeTool !== "merge-pdf" &&
              activeTool !== "images-to-pdf" && (
              <div
                className="workspace-upload"
                ref={uploadRef}
              >

                <UploadBox
                  file={selectedFile}
                  onFileSelect={
                    handleFileSelect
                  }
                  onRemove={
                    handleRemoveFile
                  }
                  accept={
                    activeTool === "word-to-pdf"
                      ? ".doc,.docx"
                      : activeTool === "pdf-to-word"
                        ? ".pdf"
                        : "image/*"
                  }
                  maxSizeMB={25}
                />

              </div>
            )}

            {error && (
              <div
                className="app-error"
                role="alert"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="2"
                  />

                  <path
                    d="M12 7v6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />

                  <circle
                    cx="12"
                    cy="16.5"
                    r="1"
                    fill="currentColor"
                  />
                </svg>

                <span>{error}</span>
              </div>
            )}

            <div
              className="active-tool-container"
              ref={
                activeTool === "images-to-pdf" ||
                activeTool === "merge-pdf"
                  ? uploadRef
                  : undefined
              }
              key={`${activeTool}-${resetKey}`}
            >
              {renderActiveTool()}
            </div>

            {loading && (
              <div className="workspace-loading">
                <span className="workspace-spinner" />

                <span>
                  Processing your file...
                </span>
              </div>
            )}

            <div ref={resultRef} style={{ marginTop: "24px" }}>
              {activeTool === "remove-background" &&
              result?.url &&
              selectedFile ? (
                <RemoveBackgroundResultPreview
                  originalUrl={
                    originalPreviewUrl
                  }
                  resultUrl={result.url}
                  originalName={
                    selectedFile.name
                  }
                  originalSize={
                    selectedFile.size
                  }
                  resultName={
                    result.name
                  }
                  resultSize={
                    result.size
                  }
                  onDownload={
                    handleDownload
                  }
                  onReset={
                    resetWorkspace
                  }
                />
              ) : (
                <ResultBox
                  url={result?.url || null}
                  fileName={
                    result?.name || ""
                  }
                  fileSize={
                    result?.size
                  }
                  message={
                    resultMessage
                  }
                  onDownload={
                    handleDownload
                  }
                  onReset={
                    resetWorkspace
                  }
                />
              )}
            </div>

          </div>
        </section>

        {/* HOW IT WORKS */}

        <HowItWorks />

        {/* SECURITY */}

        <Security />

      </main>

      <Footer />

    </div>
  );
}

export default App;