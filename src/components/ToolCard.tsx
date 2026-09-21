import type { ReactNode } from "react";

interface ToolCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  category: string;
  color: "blue" | "violet" | "emerald" | "orange";
  onClick?: () => void;
}

const colorStyles = {
  blue: {
    accent: "text-blue-600",
    icon: "border-blue-200 bg-blue-50 text-blue-600",
    hover: "hover:border-blue-400 hover:shadow-blue-100",
    arrow: "group-hover:bg-blue-600 group-hover:text-white",
    line: "bg-blue-600",
  },

  violet: {
    accent: "text-violet-600",
    icon: "border-violet-200 bg-violet-50 text-violet-600",
    hover: "hover:border-violet-400 hover:shadow-violet-100",
    arrow: "group-hover:bg-violet-600 group-hover:text-white",
    line: "bg-violet-600",
  },

  emerald: {
    accent: "text-emerald-600",
    icon: "border-emerald-200 bg-emerald-50 text-emerald-600",
    hover: "hover:border-emerald-400 hover:shadow-emerald-100",
    arrow: "group-hover:bg-emerald-600 group-hover:text-white",
    line: "bg-emerald-600",
  },

  orange: {
    accent: "text-orange-600",
    icon: "border-orange-200 bg-orange-50 text-orange-600",
    hover: "hover:border-orange-400 hover:shadow-orange-100",
    arrow: "group-hover:bg-orange-600 group-hover:text-white",
    line: "bg-orange-600",
  },
};

export default function ToolCard({
  title,
  description,
  icon,
  category,
  color,
  onClick,
}: ToolCardProps) {
  const styles = colorStyles[color];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all duration-200 active:scale-[0.98] sm:rounded-2xl sm:p-6 sm:hover:-translate-y-1 sm:hover:shadow-xl ${styles.hover}`}
    >

      {/* Accent */}

      <div
        className={`absolute left-0 top-0 h-full w-1 ${styles.line}`}
      />

      <div className="flex items-start gap-3 sm:gap-4">

        {/* Icon */}

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border sm:h-12 sm:w-12 sm:rounded-xl ${styles.icon}`}
        >
          {icon}
        </div>

        {/* Content */}

        <div className="min-w-0 flex-1">

          <p
            className={`text-[9px] font-bold uppercase tracking-[0.13em] sm:text-[11px] sm:tracking-[0.16em] ${styles.accent}`}
          >
            {category}
          </p>

          <h3 className="mt-1 text-sm font-bold tracking-tight text-slate-950 sm:text-lg">
            {title}
          </h3>

          <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500 sm:mt-2 sm:text-sm sm:leading-6">
            {description}
          </p>

        </div>

        {/* Arrow */}

        <div
          className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 text-sm text-slate-400 transition sm:flex ${styles.arrow}`}
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4"
          >
            <path
              d="M4 10h11M10 5l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

      </div>
    </button>
  );
}