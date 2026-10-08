export type ThemeId = 'neutral' | 'minimal-neutral' | 'claude' | 'google' | 'dracula';
export type FontSansId = 'default' | 'geist' | 'inter' | 'outfit' | 'dm-sans';
export type FontMonoId = 'default' | 'geist-mono' | 'jetbrains-mono' | 'fira-code';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  primaryColor: string;
  defaultSans: string;
  defaultMono: string;
  radiusLabel: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'neutral',
    name: 'Neutral (Studio)',
    description: 'Clean monochrome Shadcn design',
    primaryColor: '#171717',
    defaultSans: 'Geist Sans',
    defaultMono: 'Geist Mono',
    radiusLabel: '10px (0.625rem)'
  },
  {
    id: 'minimal-neutral',
    name: 'Minimal Neutral',
    description: 'Soft rounded borders & DM Sans typography',
    primaryColor: '#333333',
    defaultSans: 'DM Sans',
    defaultMono: 'Geist Mono',
    radiusLabel: '16px (1rem)'
  },
  {
    id: 'claude',
    name: 'Claude +',
    description: 'Warm terracotta primary & Outfit sans',
    primaryColor: '#c2410c',
    defaultSans: 'Outfit',
    defaultMono: 'Geist Mono',
    radiusLabel: '16px (1rem)'
  },
  {
    id: 'google',
    name: 'Google',
    description: 'Vibrant Google Blue and crisp system typography',
    primaryColor: '#2563eb',
    defaultSans: 'System UI',
    defaultMono: 'System Mono',
    radiusLabel: '10px (0.625rem)'
  },
  {
    id: 'dracula',
    name: 'Dracula Inspired',
    description: 'Neon purple accents with compact 8px radius & Fira Code',
    primaryColor: '#bd93f9',
    defaultSans: 'Inter',
    defaultMono: 'Fira Code',
    radiusLabel: '8px (0.5rem)'
  }
];

export const FONT_SANS_OPTIONS: { id: FontSansId; name: string }[] = [
  { id: 'default', name: 'Theme Default' },
  { id: 'geist', name: 'Geist Sans' },
  { id: 'inter', name: 'Inter' },
  { id: 'outfit', name: 'Outfit' },
  { id: 'dm-sans', name: 'DM Sans' }
];

export const FONT_MONO_OPTIONS: { id: FontMonoId; name: string }[] = [
  { id: 'default', name: 'Theme Default' },
  { id: 'geist-mono', name: 'Geist Mono' },
  { id: 'jetbrains-mono', name: 'JetBrains Mono' },
  { id: 'fira-code', name: 'Fira Code' }
];

type ThemeChangeListener = () => void;

export class ThemeManager {
  private static isDark: boolean = true;
  private static currentTheme: ThemeId = 'neutral';
  private static fontSans: FontSansId = 'default';
  private static fontMono: FontMonoId = 'default';
  private static listeners: Set<ThemeChangeListener> = new Set();
  private static initialized: boolean = false;

  public static init() {
    if (this.initialized) return;
    this.initialized = true;

    // Load persisted settings
    const savedDark = localStorage.getItem('bt_dark');
    if (savedDark !== null) {
      this.isDark = savedDark === 'true';
    } else {
      this.isDark = document.documentElement.classList.contains('dark') || true;
    }

    const savedTheme = localStorage.getItem('bt_theme') as ThemeId | null;
    if (savedTheme && THEME_OPTIONS.some((t) => t.id === savedTheme)) {
      this.currentTheme = savedTheme;
    }

    const savedFontSans = localStorage.getItem('bt_font_sans') as FontSansId | null;
    if (savedFontSans && FONT_SANS_OPTIONS.some((f) => f.id === savedFontSans)) {
      this.fontSans = savedFontSans;
    }

    const savedFontMono = localStorage.getItem('bt_font_mono') as FontMonoId | null;
    if (savedFontMono && FONT_MONO_OPTIONS.some((f) => f.id === savedFontMono)) {
      this.fontMono = savedFontMono;
    }

    this.applyAll();
  }

  public static subscribe(listener: ThemeChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in theme listener:', err);
      }
    });
  }

  private static applyAll() {
    const html = document.documentElement;

    // Apply dark class
    if (this.isDark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }

    // Apply data-theme
    if (this.currentTheme === 'neutral') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', this.currentTheme);
    }

    // Apply font sans override
    if (this.fontSans === 'default') {
      html.removeAttribute('data-font-sans');
    } else {
      html.setAttribute('data-font-sans', this.fontSans);
    }

    // Apply font mono override
    if (this.fontMono === 'default') {
      html.removeAttribute('data-font-mono');
    } else {
      html.setAttribute('data-font-mono', this.fontMono);
    }
  }

  public static toggleDarkMode(): boolean {
    this.setDarkMode(!this.isDark);
    return this.isDark;
  }

  public static setDarkMode(dark: boolean) {
    this.isDark = dark;
    localStorage.setItem('bt_dark', dark ? 'true' : 'false');
    this.applyAll();
    this.notify();
  }

  public static getIsDark(): boolean {
    return this.isDark;
  }

  public static setTheme(themeId: ThemeId) {
    this.currentTheme = themeId;
    localStorage.setItem('bt_theme', themeId);
    this.applyAll();
    this.notify();
  }

  public static getTheme(): ThemeId {
    return this.currentTheme;
  }

  public static setFontSans(fontId: FontSansId) {
    this.fontSans = fontId;
    localStorage.setItem('bt_font_sans', fontId);
    this.applyAll();
    this.notify();
  }

  public static getFontSans(): FontSansId {
    return this.fontSans;
  }

  public static setFontMono(fontId: FontMonoId) {
    this.fontMono = fontId;
    localStorage.setItem('bt_font_mono', fontId);
    this.applyAll();
    this.notify();
  }

  public static getFontMono(): FontMonoId {
    return this.fontMono;
  }
}
