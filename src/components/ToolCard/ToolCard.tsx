import "./ToolCard.css";

export interface ToolCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  active?: boolean;
  accent?: "blue" | "violet" | "emerald" | "orange";
  href?: string;
  onClick: () => void;
}

export default function ToolCard({
  title,
  description,
  icon,
  active = false,
  accent = "blue",
  href,
  onClick,
}: ToolCardProps) {
  const className = [
    "tool-card",
    `tool-card-${accent}`,
    active ? "active" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <span className="tool-card-icon" aria-hidden="true">
        {icon}
      </span>

      <span className="tool-card-content">
        <span className="tool-card-title">
          {title}
        </span>

        <span className="tool-card-description">
          {description}
        </span>
      </span>

      <span className="tool-card-arrow" aria-hidden="true">
        <svg
          viewBox="0 0 20 20"
          fill="none"
        >
          <path
            d="M4 10h11M10.5 5.5L15 10l-4.5 4.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className={className}
        onClick={onClick}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
    >
      {content}
    </button>
  );
}