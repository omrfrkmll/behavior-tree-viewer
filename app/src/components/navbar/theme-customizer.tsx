import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  ThemeManager,
  THEME_OPTIONS,
  FONT_SANS_OPTIONS,
  FONT_MONO_OPTIONS,
  ThemeId,
  FontSansId,
  FontMonoId
} from '../../ui/theme';
import { Palette, Sun, Moon, Check, Type, Code } from 'lucide-react';

export const ThemeCustomizer: React.FC = () => {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => ThemeManager.getTheme());
  const [isDark, setIsDark] = useState<boolean>(() => ThemeManager.getIsDark());
  const [fontSans, setFontSans] = useState<FontSansId>(() => ThemeManager.getFontSans());
  const [fontMono, setFontMono] = useState<FontMonoId>(() => ThemeManager.getFontMono());

  useEffect(() => {
    return ThemeManager.subscribe(() => {
      setCurrentTheme(ThemeManager.getTheme());
      setIsDark(ThemeManager.getIsDark());
      setFontSans(ThemeManager.getFontSans());
      setFontMono(ThemeManager.getFontMono());
    });
  }, []);

  const handleSelectTheme = (id: ThemeId) => {
    ThemeManager.setTheme(id);
  };

  const handleToggleDark = () => {
    ThemeManager.toggleDarkMode();
  };

  const handleSelectFontSans = (fontId: FontSansId) => {
    ThemeManager.setFontSans(fontId);
  };

  const handleSelectFontMono = (fontId: FontMonoId) => {
    ThemeManager.setFontMono(fontId);
  };

  const activeThemeMeta = THEME_OPTIONS.find((t) => t.id === currentTheme) || THEME_OPTIONS[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 px-2.5 h-8 text-xs font-medium"
          title="Customize Theme & Fonts"
        >
          <div
            className="size-3.5 rounded-full border border-border shadow-2xs"
            style={{ backgroundColor: activeThemeMeta.primaryColor }}
          />
          <span className="hidden sm:inline">{activeThemeMeta.name}</span>
          <Palette className="size-3.5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-3.5 space-y-3.5 shadow-xl border-border bg-card text-card-foreground"
      >
        {/* Header & Mode Toggle */}
        <div className="flex items-center justify-between border-b border-border pb-2.5">
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-primary" />
            <span className="text-xs font-semibold tracking-tight">Theme & Styling</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleToggleDark}
            className="h-7 px-2 text-xs gap-1.5"
            title="Toggle Light / Dark"
          >
            {isDark ? (
              <>
                <Moon className="size-3 text-primary" />
                <span>Dark</span>
              </>
            ) : (
              <>
                <Sun className="size-3 text-amber-500" />
                <span>Light</span>
              </>
            )}
          </Button>
        </div>

        {/* Preset Themes List */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
            <span>Color Preset</span>
            <span className="text-[10px] text-muted-foreground/80">Radius: {activeThemeMeta.radiusLabel}</span>
          </div>

          <div className="grid grid-cols-1 gap-1">
            {THEME_OPTIONS.map((theme) => {
              const isSelected = theme.id === currentTheme;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleSelectTheme(theme.id)}
                  className={`flex items-center justify-between p-2 rounded-md text-left transition-all border text-xs cursor-pointer ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-foreground font-semibold shadow-2xs'
                      : 'border-transparent hover:bg-accent/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="size-3.5 rounded-full shrink-0 shadow-2xs border border-white/20"
                      style={{ backgroundColor: theme.primaryColor }}
                    />
                    <div className="truncate">
                      <div className="leading-tight">{theme.name}</div>
                      <div className="text-[10px] text-muted-foreground font-normal truncate">
                        {theme.description}
                      </div>
                    </div>
                  </div>
                  {isSelected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Font Theming Section */}
        <div className="border-t border-border pt-3 space-y-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <Type className="size-3.5 text-primary" />
            <span>Font Theming</span>
          </div>

          {/* UI / Sans Font */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center justify-between">
              <span>UI Font (Sans)</span>
              <span className="text-[10px] lowercase text-muted-foreground/75">
                {fontSans === 'default' ? `default (${activeThemeMeta.defaultSans})` : fontSans}
              </span>
            </label>
            <div className="grid grid-cols-3 gap-1">
              {FONT_SANS_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleSelectFontSans(f.id)}
                  className={`px-2 py-1 text-[11px] rounded border transition-colors cursor-pointer text-center truncate ${
                    fontSans === f.id
                      ? 'border-primary bg-primary text-primary-foreground font-medium'
                      : 'border-input hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                  }`}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>

          {/* Code / Mono Font */}
          <div className="space-y-1 pt-1">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Code className="size-3 text-muted-foreground" />
                <span>Code Font (Mono)</span>
              </span>
              <span className="text-[10px] lowercase text-muted-foreground/75">
                {fontMono === 'default' ? `default (${activeThemeMeta.defaultMono})` : fontMono}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-1 font-mono text-[10.5px]">
              {FONT_MONO_OPTIONS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleSelectFontMono(m.id)}
                  className={`px-2 py-1 rounded border transition-colors cursor-pointer text-center truncate ${
                    fontMono === m.id
                      ? 'border-primary bg-primary text-primary-foreground font-medium'
                      : 'border-input hover:bg-accent hover:text-accent-foreground text-muted-foreground'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
