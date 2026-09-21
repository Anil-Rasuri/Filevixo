interface ResultBoxProps {
  downloadUrl: string;
  downloadName: string;
  resultSize: number | null;
  message: string;
}

export default function ResultBox({
  downloadUrl,
  downloadName,
  resultSize,
  message,
}: ResultBoxProps) {
  if (!downloadUrl) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="mt-6 rounded-2xl border border-green-200 bg-green-50 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-green-800">
            {message}
          </p>

          {resultSize !== null && (
            <p className="mt-1 text-sm text-green-700">
              Output size: {formatFileSize(resultSize)}
            </p>
          )}
        </div>

        <a
          href={downloadUrl}
          download={downloadName}
          className="inline-flex items-center justify-center rounded-xl bg-green-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-700"
        >
          Download File
        </a>
      </div>
    </div>
  );
}