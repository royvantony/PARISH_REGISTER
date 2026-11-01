import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeId = 'emerald' | 'sapphire' | 'burgundy' | 'midnight';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  bgColor: string;
  isDark?: boolean;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'emerald',
    name: 'Heritage Emerald',
    tagline: 'Warm Linen & Forest Green',
    primaryColor: '#1b4332',
    accentColor: '#c69214',
    bgColor: '#fbf9f4',
  },
  {
    id: 'sapphire',
    name: 'Marian Sapphire',
    tagline: 'Crisp Slate & Royal Azure',
    primaryColor: '#1d4ed8',
    accentColor: '#d97706',
    bgColor: '#f6f8fc',
  },
  {
    id: 'burgundy',
    name: 'Cathedral Burgundy',
    tagline: 'Warm Ivory & Episcopal Wine',
    primaryColor: '#831843',
    accentColor: '#b45309',
    bgColor: '#fbf6f6',
  },
  {
    id: 'midnight',
    name: 'Midnight Sanctuary',
    tagline: 'Dark Slate & Luminous Mint',
    primaryColor: '#10b981',
    accentColor: '#f59e0b',
    bgColor: '#0f172a',
    isDark: true,
  },
];

import { useFeatures } from './FeatureContext';

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  availableThemes: ThemeOption[];
  isThemeSwitchAllowed: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = 'parish_register_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isFeatureEnabled } = useFeatures();
  const isThemeSwitchAllowed = isFeatureEnabled('FEATURE_THEME_SELECTOR');

  const [theme, setThemeState] = useState<ThemeId>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeId;
    return saved && THEME_OPTIONS.some((t) => t.id === saved) ? saved : 'emerald';
  });

  const setTheme = (newTheme: ThemeId) => {
    if (!isThemeSwitchAllowed) return; // Locked to burgundy when hidden
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  useEffect(() => {
    if (!isThemeSwitchAllowed) {
      // Force Cathedral Burgundy as default when theme selector is hidden
      document.documentElement.setAttribute('data-theme', 'burgundy');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [isThemeSwitchAllowed, theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme: !isThemeSwitchAllowed ? 'burgundy' : theme,
        setTheme,
        availableThemes: THEME_OPTIONS,
        isThemeSwitchAllowed,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};


export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
