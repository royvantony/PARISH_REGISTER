import React, { useState, useRef, useEffect } from 'react';
import { Palette, Check } from 'lucide-react';
import { useTheme, type ThemeId } from '../../context/ThemeContext';

interface ThemeSelectorProps {
  className?: string;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ className = '' }) => {
  const { theme, setTheme, availableThemes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeTheme = availableThemes.find((t) => t.id === theme) || availableThemes[0];

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={`Change Theme: currently ${activeTheme.name}`}
        aria-label="Change Theme"
        className="flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-parish-border bg-parish-surface-subtle hover:bg-parish-border/40 text-parish-text text-xs font-semibold transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-parish-primary"
      >
        <span
          className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs shrink-0 flex items-center justify-center"
          style={{ backgroundColor: activeTheme.primaryColor }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: activeTheme.accentColor }}
          />
        </span>
        <span className="hidden xl:inline-block text-[11px] font-semibold text-parish-text">
          {activeTheme.name}
        </span>
        <Palette className="w-3.5 h-3.5 text-parish-text-muted shrink-0 ml-0.5" />
      </button>

      {/* Floating Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-parish-surface border border-parish-border shadow-soft-hover p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 pb-2 border-b border-parish-border/60 mb-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-parish-text-muted">
              Colour Theme
            </div>
            <div className="text-[10px] text-parish-text-muted">
              Choose your preferred color palette
            </div>
          </div>

          <div className="space-y-1">
            {availableThemes.map((t) => {
              const isSelected = t.id === theme;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setTheme(t.id as ThemeId);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all cursor-pointer ${isSelected
                    ? 'bg-parish-primary-light text-parish-primary font-bold shadow-xs'
                    : 'hover:bg-parish-surface-subtle text-parish-text'
                    }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Swatch preview dots */}
                    <div
                      className="w-7 h-7 rounded-lg border border-black/10 p-0.5 flex items-center justify-center shrink-0 shadow-xs"
                      style={{ backgroundColor: t.bgColor }}
                    >
                      <div className="flex items-center -space-x-1">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/60 shadow-xs"
                          style={{ backgroundColor: t.primaryColor }}
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-white/60 shadow-xs"
                          style={{ backgroundColor: t.accentColor }}
                        />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate leading-tight">
                        {t.name}
                      </div>
                      <div className="text-[10px] text-parish-text-muted truncate leading-tight mt-0.5">
                        {t.tagline}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-parish-primary shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
