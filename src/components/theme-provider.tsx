'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface ThemeContextType {
  dark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType>({ dark: true, toggle: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('agent-chat-ui-theme');
    const isDark = stored === null ? true : stored === 'dark';
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
    setHydrated(true);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    localStorage.setItem('agent-chat-ui-theme', next ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', next);
  };

  if (!hydrated) {
    // Prevent flash: render nothing until theme is loaded
    return <div className="min-h-screen bg-zinc-950" />;
  }

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
