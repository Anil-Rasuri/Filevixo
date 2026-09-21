import { useEffect, useState } from "react";

type SectionId = "tools" | "how-it-works" | "security";

const sections: { id: SectionId; label: string }[] = [
  { id: "tools", label: "Tools" },
  { id: "how-it-works", label: "How It Works" },
  { id: "security", label: "Security" },
];

export default function Navbar() {
  const [activeSection, setActiveSection] =
    useState<SectionId>("tools");

  useEffect(() => {
    const sectionElements = sections
      .map(({ id }) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (!sectionElements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleSections = entries
          .filter((entry) => entry.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top
          );

        if (visibleSections.length > 0) {
          const id = visibleSections[0].target.id as SectionId;
          setActiveSection(id);
        }
      },
      {
        root: null,

        // The top part of the viewport is treated as the
        // navigation area.
        rootMargin: "-20% 0px -55% 0px",

        // Section needs to enter this area before becoming active.
        threshold: 0,
      }
    );

    sectionElements.forEach((section) => {
      observer.observe(section);
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const handleNavigation = (id: SectionId) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">

        {/* Logo */}
        <button
          type="button"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            })
          }
          className="flex shrink-0 items-center"
        >
          <img
            src="/logo.png"
            alt="Filevixo"
            className="w-[135px] object-contain sm:w-[160px]"
          />
        </button>

        {/* Navigation */}
        <nav className="hidden items-center gap-2 md:flex">
          {sections.map((section) => {
            const isActive = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => handleNavigation(section.id)}
                className={`relative rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-slate-600 hover:bg-slate-50 hover:text-blue-600"
                }`}
              >
                {section.label}

                {/* Active underline */}
                <span
                  className={`absolute bottom-0 left-1/2 h-0.5 -translate-x-1/2 rounded-full bg-blue-600 transition-all duration-200 ${
                    isActive ? "w-6" : "w-0"
                  }`}
                />
              </button>
            );
          })}
        </nav>

        {/* Get Started */}
        <button
          type="button"
          onClick={() => handleNavigation("tools")}
          className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 sm:px-4 sm:text-sm"
        >
          Get Started
        </button>
      </div>
    </header>
  );
}